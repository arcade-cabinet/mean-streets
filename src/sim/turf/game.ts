import { DEFAULT_TURF_CONFIG } from './types';
import type {
  AutoDeckPolicy,
} from './deck-builder';
import type {
  PlannerTrace,
  TurfAction,
  TurfGameConfig,
  TurfGameResult,
  TurfGameState,
  TurfPolicyArtifact,
} from './types';
import type { TurfCardPools } from './catalog';
import { randomSeed } from '../cards/rng';
import {
  createInitialTurfState,
  createObservation,
  createPolicySample,
  enumerateLegalActions,
  normalizeActionKey,
  stepAction,
  tickRound,
} from './environment';
import { decideAction, TURF_SIM_CONFIG } from './ai';

export interface PlayTurfGameOptions {
  pools?: TurfCardPools;
  deckPolicyA?: AutoDeckPolicy;
  deckPolicyB?: AutoDeckPolicy;
  policyArtifact?: TurfPolicyArtifact;
  capturePolicySamples?: boolean;
  explorationRate?: number;
}

function shouldStrike(state: TurfGameState, side: 'A' | 'B'): boolean {
  const observation = createObservation(state, side);
  const buildTurns = state.buildupTurns[side];
  const setupPotential = observation.ownCrewCount >= 2 && (observation.handCash + observation.handProducts + observation.handWeapons > 0);
  const pushPotential = (setupPotential && observation.handCash > 0 && observation.handProducts > 0)
    || (observation.ownReadyFunded > 0 && observation.handProducts > 0);
  if (buildTurns >= state.config.maxBuildupRounds - 2) return true;
  if (observation.ownReadyPushed > 0 && buildTurns >= 4) return true;
  if (buildTurns >= 7 && observation.ownReadyPushed > 0) return true;
  if (buildTurns >= 7 && observation.ownReadyFunded > 0 && !pushPotential) return true;
  if (observation.ownReadyFunded > 0 && buildTurns >= 5 && !pushPotential) return true;
  if (observation.ownReadyDirect > 0 && buildTurns >= 6 && observation.handCash + observation.handProducts + observation.handWeapons === 0) {
    return true;
  }
  if (setupPotential && buildTurns < 7) return false;
  if (state.aiMemory[side].consecutivePasses >= 2) return true;
  if (state.players[side].hand.crew.length === 0 && state.players[side].hand.modifiers.length === 0) return true;
  return false;
}

function pushTrace(state: TurfGameState, trace: PlannerTrace): void {
  state.plannerTrace.push(trace);
  if (state.plannerTrace.length > 512) {
    state.plannerTrace.shift();
  }
}

function chooseActionWithExploration(
  state: TurfGameState,
  side: 'A' | 'B',
  policyArtifact: TurfPolicyArtifact | undefined,
  explorationRate: number,
): { action: TurfAction; trace: PlannerTrace } {
  const legalActions = enumerateLegalActions(state, side);
  const nonPass = legalActions.filter(action => action.kind !== 'pass');
  if (explorationRate > 0 && state.rng.next() < explorationRate && nonPass.length > 0) {
    const action = nonPass[state.rng.int(0, nonPass.length - 1)];
    const observation = createObservation(state, side);
    const trace: PlannerTrace = {
      side,
      phase: state.phase,
      chosenGoal: 'anti_stall',
      previousGoal: state.aiMemory[side].lastGoal,
      switchedGoal: state.aiMemory[side].lastGoal !== 'anti_stall',
      stateKey: observation.stateKey,
      legalActionCount: legalActions.length,
      chosenAction: action,
      consideredGoals: [{ goal: 'anti_stall', score: 1 }],
      actionScores: [{ action: normalizeActionKey(action), score: 1 }],
      policyUsed: false,
      replanReason: 'exploration',
    };
    state.aiMemory[side].lastGoal = 'anti_stall';
    return { action, trace };
  }

  return decideAction(state, side, policyArtifact);
}

function executePlannedAction(
  state: TurfGameState,
  side: 'A' | 'B',
  options: PlayTurfGameOptions,
): void {
  if (state.plannerTrace.length === 0) {
    state.firstPlayer = side;
  }
  const { action, trace } = chooseActionWithExploration(
    state,
    side,
    options.policyArtifact,
    options.explorationRate ?? 0,
  );
  pushTrace(state, trace);
  if (trace.switchedGoal) state.metrics.goalSwitches++;
  if (trace.policyUsed) state.metrics.policyGuidedActions++;

  const result = stepAction(state, action);
  if (result.reward < 0 && action.kind !== 'pass') {
    state.metrics.failedPlans++;
  }
  if (options.capturePolicySamples) {
    state.policySamples.push(createPolicySample(state, side, action, trace.chosenGoal, result.reward));
  }
  if (action.kind === 'pass') {
    state.metrics.stallTurns++;
  }
}

function checkWin(state: TurfGameState): boolean {
  if (state.winner) return true;
  for (const side of ['A', 'B'] as const) {
    const opponentSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
    if (state.players[side].positionsSeized >= state.config.positionCount) {
      state.winner = side;
      state.endReason = 'total_seizure';
      return true;
    }
    if (state.players[opponentSide].board.active.every(position => position.seized)) {
      state.winner = side;
      state.endReason = 'total_seizure';
      return true;
    }
  }
  return false;
}

export function playTurfGame(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
  options: PlayTurfGameOptions = {},
): TurfGameResult {
  const gameSeed = seed ?? randomSeed();
  const { state, templates } = createInitialTurfState(config, gameSeed, {
    pools: options.pools,
    deckPolicyA: options.deckPolicyA,
    deckPolicyB: options.deckPolicyB,
  });

  let roundNumber = 0;

  while (state.phase === 'buildup' && roundNumber < config.maxBuildupRounds && !state.winner) {
    roundNumber++;
    state.turnNumber++;
    state.metrics.turns++;
    state.buildupTurns.A++;
    state.buildupTurns.B++;
    tickRound(state);

    const aStrikes = shouldStrike(state, 'A');
    const bStrikes = shouldStrike(state, 'B');
    if (aStrikes || bStrikes) {
      state.phase = 'combat';
      state.metrics.buildupRoundsA = state.buildupTurns.A;
      state.metrics.buildupRoundsB = state.buildupTurns.B;
      state.metrics.firstStrike = aStrikes === bStrikes ? null : aStrikes ? 'A' : 'B';
      break;
    }

    const first: 'A' | 'B' = state.rng.next() < 0.5 ? 'A' : 'B';
    const second: 'A' | 'B' = first === 'A' ? 'B' : 'A';
    executePlannedAction(state, first, options);
    executePlannedAction(state, second, options);
  }

  if (state.phase === 'buildup') {
    state.phase = 'combat';
    state.metrics.buildupRoundsA = state.buildupTurns.A;
    state.metrics.buildupRoundsB = state.buildupTurns.B;
  }

  while (!state.winner && roundNumber < config.maxRounds) {
    roundNumber++;
    state.turnNumber++;
    state.metrics.turns++;
    state.metrics.combatRounds++;
    tickRound(state);

    let actionsA = config.actionsPerRound;
    let actionsB = config.actionsPerRound;
    let nonPassActions = 0;

    while ((actionsA > 0 || actionsB > 0) && !state.winner) {
      const aFirst = state.rng.next() < 0.5;
      if (aFirst) {
        if (actionsA > 0) {
          const beforePasses = state.metrics.passes;
          executePlannedAction(state, 'A', options);
          if (state.metrics.passes === beforePasses) nonPassActions++;
          actionsA--;
          state.metrics.totalActions++;
        }
        if (actionsB > 0 && !state.winner) {
          const beforePasses = state.metrics.passes;
          executePlannedAction(state, 'B', options);
          if (state.metrics.passes === beforePasses) nonPassActions++;
          actionsB--;
          state.metrics.totalActions++;
        }
      } else {
        if (actionsB > 0) {
          const beforePasses = state.metrics.passes;
          executePlannedAction(state, 'B', options);
          if (state.metrics.passes === beforePasses) nonPassActions++;
          actionsB--;
          state.metrics.totalActions++;
        }
        if (actionsA > 0 && !state.winner) {
          const beforePasses = state.metrics.passes;
          executePlannedAction(state, 'A', options);
          if (state.metrics.passes === beforePasses) nonPassActions++;
          actionsA--;
          state.metrics.totalActions++;
        }
      }

      if (checkWin(state)) break;
    }

    if (nonPassActions === 0) state.metrics.stallTurns++;
    if (checkWin(state)) break;
  }

  if (!state.winner) {
    const seizedA = state.players.A.positionsSeized;
    const seizedB = state.players.B.positionsSeized;
    state.winner = seizedA >= seizedB ? 'A' : 'B';
    state.endReason = 'timeout';
  }

  return {
    winner: state.winner,
    endReason: state.endReason ?? 'timeout',
    firstPlayer: state.firstPlayer,
    turnCount: roundNumber,
    metrics: state.metrics,
    seed: gameSeed,
    plannerTrace: state.plannerTrace,
    policySamples: options.capturePolicySamples ? state.policySamples : undefined,
    finalState: {
      seizedA: state.players.A.positionsSeized,
      seizedB: state.players.B.positionsSeized,
    },
    decks: {
      A: {
        crewIds: templates.A.crew.map(card => card.id),
        modifierIds: templates.A.modifiers.map(card => card.id),
      },
      B: {
        crewIds: templates.B.crew.map(card => card.id),
        modifierIds: templates.B.modifiers.map(card => card.id),
      },
    },
  };
}

export function buildConvergenceSlices(results: TurfGameResult[]): Array<{
  games: number;
  winRateA: number;
  timeoutRate: number;
  passRatePerTurn: number;
}> {
  const slices = TURF_SIM_CONFIG.convergenceSlices;
  const out: Array<{ games: number; winRateA: number; timeoutRate: number; passRatePerTurn: number }> = [];
  for (let i = 1; i <= slices; i++) {
    const end = Math.max(1, Math.floor((results.length * i) / slices));
    const chunk = results.slice(0, end);
    const winsA = chunk.filter(result => result.winner === 'A').length;
    const timeouts = chunk.filter(result => result.endReason === 'timeout').length;
    const turns = chunk.reduce((sum, result) => sum + result.turnCount, 0);
    const passes = chunk.reduce((sum, result) => sum + result.metrics.passes, 0);
    out.push({
      games: chunk.length,
      winRateA: Number((winsA / chunk.length).toFixed(4)),
      timeoutRate: Number((timeouts / chunk.length).toFixed(4)),
      passRatePerTurn: Number((passes / Math.max(1, turns)).toFixed(4)),
    });
  }
  return out;
}
