// @ts-expect-error Yuka does not ship TypeScript declarations
import { Think } from 'yuka';
import { hasToughOnTurf, positionPower, positionResistance } from '../board';
import { createObservation, enumerateLegalActions } from '../env-query';
import type {
  PlannerTrace,
  TurfAction,
  TurfGameState,
  TurfPolicyArtifact,
} from '../types';
import { TURF_SIM_CONFIG } from './config';
import {
  goal,
  type PlannerOwner,
  scoreAll,
  TurfGoalEvaluator,
} from './planner-goals';
import {
  buildHeatMgmt,
  buildMythicHunt,
  buildStackRebuild,
  desireHeatMgmt,
  desireMythicHunt,
  desireStackRebuild,
} from './planner-goals-v03';
import { selectAction } from './policy';

// Does the player own at least one turf where a retreat would shield a
// weak top tough with a sturdier face-up one beneath it?
function hasRetreatUpside(state: TurfGameState, side: 'A' | 'B'): boolean {
  for (const turf of state.players[side].turfs) {
    if (turf.stack.length < 2) continue;
    const top = turf.stack[turf.stack.length - 1].card;
    if (top.kind !== 'tough') continue;
    for (let i = 0; i < turf.stack.length - 1; i++) {
      if (!turf.stack[i].faceUp) continue;
      const c = turf.stack[i].card;
      if (c.kind !== 'tough') continue;
      if (c.resistance + c.power > top.resistance + top.power) return true;
    }
  }
  return false;
}

function underPressure(state: TurfGameState, side: 'A' | 'B'): boolean {
  const me = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  let myMax = 0;
  for (const t of me.turfs)
    if (hasToughOnTurf(t)) myMax = Math.max(myMax, positionResistance(t));
  let oppMax = 0;
  for (const t of opp.turfs)
    if (hasToughOnTurf(t)) oppMax = Math.max(oppMax, positionPower(t));
  return oppMax > myMax + 1;
}

function cashOnBoard(state: TurfGameState, side: 'A' | 'B'): number {
  let total = 0;
  for (const t of state.players[side].turfs)
    for (const sc of t.stack)
      if (sc.card.kind === 'currency') total += sc.card.denomination;
  return total;
}

function buildThink(owner: PlannerOwner): Think {
  const brain = new Think(owner);
  owner.brain = brain;
  const obs = owner.observation;
  const pl = TURF_SIM_CONFIG.aiPlanner;
  const player = owner.state.players[owner.side];
  const pendingKind = player.pending?.kind ?? null;
  const hasPending = pendingKind !== null;
  const canDraw = !hasPending && player.deck.length > 0;

  // draw_tempo — refill when the pending slot is open and deck/budget allow.
  brain.addEvaluator(
    new TurfGoalEvaluator(
      'draw_tempo',
      1.05,
      () => {
        if (!canDraw) return 0;
        const deckFactor = Math.min(1, player.deck.length / 10);
        const budgetFactor = player.actionsRemaining >= 2 ? 1 : 0.4;
        const emptyBoard = player.toughsInPlay === 0 ? 0.5 : 0;
        return 0.6 * deckFactor * budgetFactor + emptyBoard;
      },
      () => goal(owner, 'draw_tempo', ['draw', 'end_turn']),
    ),
  );

  // build_stack — drop the pending card somewhere it helps.
  brain.addEvaluator(
    new TurfGoalEvaluator(
      'build_stack',
      pl.buildStack.bias,
      () => {
        if (!hasPending) return 0;
        const isTough = pendingKind === 'tough';
        const base =
          pl.buildStack.base + (isTough ? pl.buildStack.perToughWeight : 0.2);
        const desperation =
          obs.ownToughsInPlay === 0 ? pl.buildStack.noToughsDesperation : 0;
        return base + desperation;
      },
      () => goal(owner, 'build_stack', ['play_card', 'discard', 'end_turn']),
    ),
  );

  // retreat_shield — swap a weaker top tough with a stronger face-up one.
  brain.addEvaluator(
    new TurfGoalEvaluator(
      'retreat_shield',
      1.0,
      () => {
        if (!hasRetreatUpside(owner.state, owner.side)) return 0;
        return underPressure(owner.state, owner.side) ? 1.1 : 0.45;
      },
      () => goal(owner, 'retreat_shield', ['retreat', 'end_turn']),
    ),
  );

  brain.addEvaluator(
    new TurfGoalEvaluator(
      'direct_pressure',
      pl.directPressure.bias,
      () => {
        if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0)
          return 0;
        const margin = obs.ownPower - obs.opponentDefense;
        return (
          pl.directPressure.base +
          Math.max(0, margin) * pl.directPressure.marginScale +
          (obs.opponentTurfCount <= 1 ? pl.directPressure.lastTurfBonus : 0)
        );
      },
      () =>
        goal(owner, 'direct_pressure', [
          ['direct_strike', 'pushed_strike', 'funded_recruit'],
          'play_card',
          'draw',
          'end_turn',
        ]),
    ),
  );

  brain.addEvaluator(
    new TurfGoalEvaluator(
      'funded_pressure',
      pl.fundedPressure.bias,
      () => {
        if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0)
          return 0;
        // v0.2: cash is on the board, not in hand.
        const cash = cashOnBoard(owner.state, owner.side);
        if (cash <= 0) return pl.fundedPressure.floor;
        const units =
          cash / TURF_SIM_CONFIG.aiScoring.currencyDenominationScale;
        return (
          pl.fundedPressure.baseWithCurrency +
          units * pl.fundedPressure.perCurrencyWeight
        );
      },
      () =>
        goal(owner, 'funded_pressure', [
          ['funded_recruit', 'direct_strike'],
          'play_card',
          'draw',
          'end_turn',
        ]),
    ),
  );

  brain.addEvaluator(
    new TurfGoalEvaluator(
      'pushed_pressure',
      pl.pushedPressure.bias,
      () => {
        if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0)
          return 0;
        return pl.pushedPressure.base;
      },
      () =>
        goal(owner, 'pushed_pressure', [
          ['pushed_strike', 'direct_strike'],
          'play_card',
          'draw',
          'end_turn',
        ]),
    ),
  );

  brain.addEvaluator(
    new TurfGoalEvaluator(
      'anti_stall',
      pl.antiStall.bias,
      (o) => {
        if (o.memory.consecutivePasses >= pl.antiStall.consecutivePassThreshold)
          return (
            pl.antiStall.base +
            o.memory.consecutivePasses * pl.antiStall.perPassEscalation
          );
        return pl.antiStall.idleFloor;
      },
      () =>
        goal(owner, 'anti_stall', [
          'play_card',
          'direct_strike',
          'draw',
          'retreat',
          'discard',
          'pass',
        ]),
    ),
  );

  // v0.3 evaluators. Biases: heat_management 0.8 mid-priority (fires
  // above heat 0.4), mythic_hunt 1.2 offensive opportunity (opp mythic on
  // active), stack_rebuild 1.5 highest (rebuilds the lane after seizure).
  brain.addEvaluator(
    new TurfGoalEvaluator('heat_management', 0.8, desireHeatMgmt, buildHeatMgmt),
  );
  brain.addEvaluator(
    new TurfGoalEvaluator('mythic_hunt', 1.2, desireMythicHunt, buildMythicHunt),
  );
  brain.addEvaluator(
    new TurfGoalEvaluator(
      'stack_rebuild',
      pl.stackRebuild.bias,
      desireStackRebuild,
      buildStackRebuild,
    ),
  );

  return brain;
}

export function decideAction(
  state: TurfGameState,
  side: 'A' | 'B',
  policyArtifact?: TurfPolicyArtifact,
): { action: TurfAction; trace: PlannerTrace } {
  const observation = createObservation(state, side);
  const legalActions = enumerateLegalActions(state, side);
  const memory = state.aiMemory[side];
  const owner: PlannerOwner = {
    brain: null as unknown as Think,
    state,
    side,
    observation,
    memory,
    policyArtifact,
    legalActions,
    selectedGoal: null,
    selectedAction: null,
    policyUsed: false,
    consideredGoals: [],
    actionScores: [],
    replanReason: 'initial',
  };

  const brain = buildThink(owner);
  owner.brain = brain;
  brain.execute();

  if (!owner.selectedAction) {
    const candidates = legalActions.filter(
      (a) => a.kind !== 'pass' && a.kind !== 'end_turn',
    );
    const scored = scoreAll(owner, candidates);
    const viable = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY);
    if (viable.length > 0) {
      const best = selectAction(viable, state.config.difficulty, state.rng);
      owner.selectedAction = best.action;
      owner.selectedGoal = owner.selectedGoal ?? 'anti_stall';
      owner.policyUsed = owner.policyUsed || best.policyUsed;
      owner.replanReason =
        owner.replanReason === 'initial'
          ? 'global-fallback'
          : `${owner.replanReason}|global-fallback`;
    }
  }

  const action = owner.selectedAction ?? { kind: 'end_turn' as const, side };
  const trace: PlannerTrace = {
    side,
    phase: state.phase,
    chosenGoal: owner.selectedGoal ?? 'anti_stall',
    previousGoal: memory.lastGoal,
    switchedGoal: memory.lastGoal !== owner.selectedGoal,
    stateKey: observation.stateKey,
    legalActionCount: legalActions.length,
    chosenAction: action,
    consideredGoals: owner.consideredGoals.sort((a, b) => b.score - a.score),
    actionScores: owner.actionScores.slice(
      0,
      TURF_SIM_CONFIG.aiPlanner.traceMaxActions,
    ),
    policyUsed: owner.policyUsed,
    replanReason: owner.replanReason,
  };
  memory.lastGoal = trace.chosenGoal;
  return { action, trace };
}
