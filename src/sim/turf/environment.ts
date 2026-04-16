import type {
  Card,
  GameConfig,
  PlannerMemory,
  PlayerState,
  TurfAction,
  TurfGameState,
  TurfMetrics,
} from './types';
import {
  addToStack,
  hasToughOnTurf,
  seizeTurf,
  turfAffiliationConflict,
} from './board';
import {
  resolveDirectStrike,
  resolveFundedRecruit,
  resolvePushedStrike,
} from './attacks';
import { isModifierCard, normalizeActionKey, playerHasToughInPlay } from './env-query';
import { TURF_SIM_CONFIG } from './ai/config';

export {
  createObservation,
  createPolicySample,
  enumerateLegalActions,
  normalizeActionKey,
  policyActionKey,
} from './env-query';

// ── Interfaces ─────────────────────────────────────────────

export interface TurfStepResult {
  reward: number;
  actionKey: string;
  terminal: boolean;
  reason: string;
}

// ── Metrics ────────────────────────────────────────────────

export function emptyMetrics(): TurfMetrics {
  return {
    turns: 0,
    directStrikes: 0,
    pushedStrikes: 0,
    fundedRecruits: 0,
    kills: 0,
    spiked: 0,
    seizures: 0,
    busts: 0,
    cardsPlayed: 0,
    cardsDiscarded: 0,
    toughsPlayed: 0,
    modifiersPlayed: 0,
    passes: 0,
    goalSwitches: 0,
    failedPlans: 0,
    stallTurns: 0,
    deadHandTurns: 0,
    policyGuidedActions: 0,
    totalActions: 0,
    firstStrike: null,
  };
}

// ── Action budget ──────────────────────────────────────────

export function actionsForTurn(config: GameConfig, turnNumber: number, side?: 'A' | 'B'): number {
  const base = turnNumber <= 1 ? config.firstTurnActions : config.actionsPerTurn;
  if (!side) return base;
  const profiles = TURF_SIM_CONFIG.difficultyProfiles as Record<
    string,
    { actionBonus: number; playerActionPenalty: number } | undefined
  >;
  const profile = profiles[config.difficulty];
  if (!profile) {
    // Missing difficulty profile is a config bug — surface immediately
    // rather than silently returning `base` and masking the miswire.
    throw new Error(
      `actionsForTurn: missing difficulty profile for "${config.difficulty}" in ` +
        `turf-sim.json. Known tiers: ${Object.keys(profiles).join(', ')}`,
    );
  }
  const isAI = side === 'B';
  if (isAI && profile.actionBonus) return base + profile.actionBonus;
  if (!isAI && profile.playerActionPenalty) return Math.max(1, base - profile.playerActionPenalty);
  return base;
}

// ── Planner memory ─────────────────────────────────────────

export function emptyPlannerMemory(): PlannerMemory {
  return {
    lastGoal: null,
    lastActionKind: null,
    consecutivePasses: 0,
    failedPlans: 0,
    blockedLanes: {},
    pressuredLanes: {},
    laneRoles: {},
    focusLane: null,
    focusRole: null,
  };
}

function updatePlannerMemory(
  memory: PlannerMemory,
  action: TurfAction,
  reward: number,
): void {
  memory.lastActionKind = action.kind;
  if (action.kind === 'pass' || action.kind === 'end_turn') {
    memory.consecutivePasses++;
  } else {
    memory.consecutivePasses = 0;
  }
  const lane = action.targetTurfIdx ?? action.turfIdx;
  if (lane !== undefined) {
    if (reward <= 0) {
      memory.blockedLanes[lane] = (memory.blockedLanes[lane] ?? 0) + 1;
      memory.failedPlans++;
    } else {
      delete memory.blockedLanes[lane];
      memory.pressuredLanes[lane] = (memory.pressuredLanes[lane] ?? 0) + 1;
    }
  }
}

// ── Hand helpers ───────────────────────────────────────────

function removeCardFromHand(player: PlayerState, cardId: string): Card | null {
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  return player.hand.splice(idx, 1)[0] ?? null;
}

// ── Draw phase ─────────────────────────────────────────────

export function drawPhase(state: TurfGameState, side: 'A' | 'B'): void {
  const player = state.players[side];
  if (player.deck.length > 0) {
    const card = player.deck.shift();
    if (card) player.hand.push(card);
  }
}

export function tickRound(state: TurfGameState): void {
  drawPhase(state, 'A');
  drawPhase(state, 'B');
}

// ── Turn transition ────────────────────────────────────────

/**
 * Advance the game to the next side's turn. Atomically:
 *   1. Switches turnSide to the opponent of the current side.
 *   2. Increments turnNumber and turn metrics.
 *   3. Draws a card for the incoming side.
 *   4. Resets the incoming side's actionsRemaining via actionsForTurn.
 *
 * This is the single source of truth for turn transitions. Callers that
 * drive the sim outside of `runTurn` (e.g. the ECS bridge) should invoke
 * this after `stepAction(state, { kind: 'end_turn', ... })` rather than
 * mutating turn fields directly.
 */
export function advanceTurn(state: TurfGameState): void {
  const prevSide = state.turnSide;
  const nextSide = prevSide === 'A' ? 'B' : 'A';
  state.turnSide = nextSide;
  state.turnNumber++;
  state.metrics.turns++;

  drawPhase(state, nextSide);

  state.players[nextSide].actionsRemaining = actionsForTurn(
    state.config,
    state.turnNumber,
    nextSide,
  );
}

// ── Step action ────────────────────────────────────────────

function resolveStrike(
  state: TurfGameState,
  action: TurfAction,
  player: PlayerState,
  opp: PlayerState,
): { reward: number; reason: string } {
  const aTurf = player.turfs[action.turfIdx!];
  const dTurf = opp.turfs[action.targetTurfIdx!];
  if (!aTurf || !dTurf) throw new Error('Invalid turf indices');

  const result =
    action.kind === 'direct_strike'
      ? resolveDirectStrike(aTurf, dTurf)
      : action.kind === 'pushed_strike'
        ? resolvePushedStrike(aTurf, dTurf)
        : resolveFundedRecruit(aTurf, dTurf);

  if (action.kind === 'direct_strike') state.metrics.directStrikes++;
  else if (action.kind === 'pushed_strike') state.metrics.pushedStrikes++;
  else state.metrics.fundedRecruits++;

  if (!state.metrics.firstStrike) state.metrics.firstStrike = action.side;

  const rw = TURF_SIM_CONFIG.rewards;
  let reward = 0;
  if (result.outcome === 'kill') {
    state.metrics.kills++;
    opp.toughsInPlay--;
    if (action.kind === 'funded_recruit') {
      player.toughsInPlay++;
      reward += rw.fundedRecruitKill;
    } else {
      reward += rw.killBase;
    }
    if (!hasToughOnTurf(dTurf)) {
      seizeTurf(opp, action.targetTurfIdx!, player, action.turfIdx);
      state.metrics.seizures++;
      reward += rw.seize;
    }
  } else if (result.outcome === 'sick') {
    state.metrics.spiked++;
    reward += rw.sick;
  } else {
    state.metrics.busts++;
    reward += rw.bust;
  }

  return { reward, reason: `${action.kind}:${result.outcome}` };
}

export function stepAction(
  state: TurfGameState,
  action: TurfAction,
): TurfStepResult {
  const player = state.players[action.side];
  const opp = state.players[action.side === 'A' ? 'B' : 'A'];
  let reward = 0;
  let reason: string = action.kind;
  let costsAction = true;

  switch (action.kind) {
    case 'play_card': {
      if (action.turfIdx === undefined || !action.cardId)
        throw new Error('Invalid play_card action');
      const card = removeCardFromHand(player, action.cardId);
      if (!card) throw new Error('Card not in hand');
      if (isModifierCard(card) && !playerHasToughInPlay(player))
        throw new Error('Draw-gate: cannot play modifier with no toughs in play');
      const turf = player.turfs[action.turfIdx];
      if (!turf) throw new Error('Invalid turf index');
      if (isModifierCard(card) && !hasToughOnTurf(turf))
        throw new Error('Cannot play modifier on empty turf');
      // RULES.md §4: rivals cannot coexist on a turf without a buffer.
      // If the incoming card is a tough that would create an unresolved
      // clash, the play is discarded (card lost, action spent). Mirrors
      // the funded-recruit re-evaluation behaviour.
      if (turfAffiliationConflict(turf, card)) {
        state.metrics.cardsDiscarded++;
        reward += TURF_SIM_CONFIG.rewards.discard;
        reason = 'play_card_discarded_rival';
        break;
      }
      addToStack(turf, card);
      state.metrics.cardsPlayed++;
      if (card.kind === 'tough') {
        player.toughsInPlay++;
        state.metrics.toughsPlayed++;
        reward += TURF_SIM_CONFIG.rewards.playTough;
      } else {
        state.metrics.modifiersPlayed++;
        reward += TURF_SIM_CONFIG.rewards.playModifier;
      }
      break;
    }

    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit': {
      if (action.turfIdx === undefined || action.targetTurfIdx === undefined)
        throw new Error(`Invalid ${action.kind} action`);
      const result = resolveStrike(state, action, player, opp);
      reward = result.reward;
      reason = result.reason;
      break;
    }

    case 'discard': {
      if (!action.cardId) throw new Error('Invalid discard action');
      const card = removeCardFromHand(player, action.cardId);
      if (!card) throw new Error('Card not in hand');
      player.discard.push(card);
      state.metrics.cardsDiscarded++;
      costsAction = false;
      reward += TURF_SIM_CONFIG.rewards.discard;
      break;
    }

    case 'end_turn': {
      player.actionsRemaining = 0;
      costsAction = false;
      break;
    }

    case 'pass': {
      state.metrics.passes++;
      reward += TURF_SIM_CONFIG.rewards.pass;
      break;
    }
  }

  if (costsAction) {
    player.actionsRemaining--;
    state.metrics.totalActions++;
  }

  if (player.hand.length === 0) state.metrics.deadHandTurns++;

  updatePlannerMemory(state.aiMemory[action.side], action, reward);

  if (opp.turfs.length === 0) {
    state.winner = action.side;
    state.endReason = 'total_seizure';
  }

  return {
    reward,
    actionKey: normalizeActionKey(action),
    terminal: Boolean(state.winner),
    reason,
  };
}
