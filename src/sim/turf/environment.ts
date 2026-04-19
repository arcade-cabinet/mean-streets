import { TURF_SIM_CONFIG } from './ai/config';
import { queueStrike } from './attacks';
import { modifiersByOwner } from './board';
import {
  handleDraw,
  handleEndTurn,
  handleModifierSwap,
  handlePlayCard,
  handleRetreat,
} from './env-handlers';
import { normalizeActionKey } from './env-query';
import { sendToHolding } from './holding';
import { healAtMarket, sendToMarket, tradeAtMarket } from './market';
import { resolvePhase } from './resolve';
import type {
  GameConfig,
  PlannerMemory,
  TurfAction,
  TurfGameState,
  TurfMetrics,
} from './types';

export {
  createObservation,
  createPolicySample,
  enumerateLegalActions,
  normalizeActionKey,
  policyActionKey,
} from './env-query';

export interface TurfStepResult {
  reward: number;
  actionKey: string;
  terminal: boolean;
  reason: string;
}

// ── Metrics ────────────────────────────────────────────────

export function emptyMetrics(): TurfMetrics {
  return {
    turns: 0, draws: 0, retreats: 0, closedRanksEnds: 0,
    directStrikes: 0, pushedStrikes: 0, fundedRecruits: 0,
    kills: 0, spiked: 0, seizures: 0, busts: 0,
    cardsPlayed: 0, cardsDiscarded: 0, toughsPlayed: 0, modifiersPlayed: 0,
    passes: 0, goalSwitches: 0, failedPlans: 0,
    stallTurns: 0, deadHandTurns: 0, policyGuidedActions: 0, totalActions: 0,
    firstStrike: null,
    raids: 0, marketTrades: 0, marketHeals: 0, modifierSwaps: 0,
    mythicsFlipped: 0, bribesAccepted: 0, bribesFailed: 0,
  };
}

// ── Action budget ──────────────────────────────────────────

export function actionsForTurn(
  config: GameConfig, turnNumber: number, side?: 'A' | 'B',
): number {
  const base = turnNumber <= 1 ? config.firstTurnActions : config.actionsPerTurn;
  if (!side) return base;
  const profiles = TURF_SIM_CONFIG.difficultyProfiles as Record<
    string, { actionBonus: number; playerActionPenalty: number } | undefined
  >;
  const profile = profiles[config.difficulty];
  if (!profile) {
    throw new Error(
      `actionsForTurn: missing difficulty profile for "${config.difficulty}" in ` +
        `turf-sim.json. Known tiers: ${Object.keys(profiles).join(', ')}`,
    );
  }
  if (side === 'B' && profile.actionBonus) return base + profile.actionBonus;
  if (side === 'A' && profile.playerActionPenalty)
    return Math.max(1, base - profile.playerActionPenalty);
  return base;
}

// ── Planner memory ─────────────────────────────────────────

export function emptyPlannerMemory(): PlannerMemory {
  return {
    lastGoal: null, lastActionKind: null,
    consecutivePasses: 0, failedPlans: 0,
    blockedLanes: {}, pressuredLanes: {},
    laneRoles: {}, focusLane: null, focusRole: null,
  };
}

export function updatePlannerMemory(
  memory: PlannerMemory, action: TurfAction, reward: number,
): void {
  memory.lastActionKind = action.kind;
  // Only true "doing nothing" actions count as passes. end_turn is the
  // normal turn-close and does NOT escalate anti_stall — the AI may have
  // played several productive actions before ending.
  if (action.kind === 'pass')
    memory.consecutivePasses++;
  else memory.consecutivePasses = 0;
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

// ── Step action ────────────────────────────────────────────

export function stepAction(
  state: TurfGameState, action: TurfAction,
): TurfStepResult {
  const player = state.players[action.side];
  const opp = state.players[action.side === 'A' ? 'B' : 'A'];
  let reward = 0;
  let reason: string = action.kind;
  let costsAction = true;

  switch (action.kind) {
    case 'draw':
      handleDraw(player, state);
      break;
    case 'play_card': {
      const r = handlePlayCard(player, action, state);
      reward = r.reward; reason = r.reason;
      break;
    }
    case 'retreat':
      handleRetreat(player, action, state);
      break;
    case 'modifier_swap':
      handleModifierSwap(player, action, state);
      break;
    case 'send_to_market':
      if (!action.toughId) throw new Error('send_to_market: missing toughId');
      sendToMarket(state, action.side, action.toughId);
      break;
    case 'send_to_holding':
      if (!action.toughId) throw new Error('send_to_holding: missing toughId');
      sendToHolding(state, action.side, action.toughId);
      break;
    case 'black_market_trade': {
      if (!action.offeredMods || !action.targetRarity)
        throw new Error('black_market_trade: missing offeredMods/targetRarity');
      if (tradeAtMarket(state, action.side, action.offeredMods, action.targetRarity))
        state.metrics.marketTrades++;
      costsAction = false;
      break;
    }
    case 'black_market_heal': {
      if (!action.healTarget || !action.offeredMods)
        throw new Error('black_market_heal: missing healTarget/offeredMods');
      if (healAtMarket(state, action.side, action.healTarget, action.offeredMods))
        state.metrics.marketHeals++;
      costsAction = false;
      break;
    }
    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit':
      queueStrike(player, action);
      reason = `${action.kind}_queued`;
      break;
    case 'discard': {
      if (!action.cardId) throw new Error('discard: missing cardId');
      if (!player.pending || player.pending.id !== action.cardId)
        throw new Error('discard: cardId does not match pending');
      // Modifiers route to the shared Black Market; toughs simply leave play.
      const discarded = player.pending;
      player.pending = null;
      if (discarded.kind !== 'tough') {
        state.blackMarket.push(discarded as import('./types').ModifierCard);
      }
      state.metrics.cardsDiscarded++;
      costsAction = false;
      reward += TURF_SIM_CONFIG.rewards.discard;
      break;
    }
    case 'end_turn':
      handleEndTurn(player, state);
      costsAction = false;
      if (state.players.A.turnEnded && state.players.B.turnEnded)
        resolvePhase(state);
      break;
    case 'pass':
      state.metrics.passes++;
      reward += TURF_SIM_CONFIG.rewards.pass;
      break;
  }

  if (costsAction) {
    player.actionsRemaining--;
    state.metrics.totalActions++;
    // Clear justPromoted after first real action so normal budget resumes.
    const activeTurf = player.turfs[0];
    if (activeTurf?.justPromoted) activeTurf.justPromoted = false;
  }

  if (player.deck.length === 0 && player.pending === null)
    state.metrics.deadHandTurns++;

  updatePlannerMemory(state.aiMemory[action.side], action, reward);

  if (opp.turfs.length === 0 && !state.winner) {
    state.winner = action.side;
    state.endReason = 'total_seizure';
  }

  return {
    reward,
    actionKey: normalizeActionKey(action),
    terminal: Boolean(state.winner) || state.endReason === 'draw',
    reason,
  };
}

// Re-export helper for test convenience.
export { modifiersByOwner };
