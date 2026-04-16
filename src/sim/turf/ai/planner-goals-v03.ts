// v0.3 goal helpers — desirability + factory fns for heat_management,
// mythic_hunt, and stack_rebuild. Split from planner.ts to honor the
// 300-LOC cap. Evaluators are registered by planner.ts::buildThink.
import type { TurfGameState } from '../types';
import { goal, type PlannerOwner } from './planner-goals';

function activeToughCount(state: TurfGameState, side: 'A' | 'B'): number {
  const active = state.players[side].turfs[0];
  if (!active) return 0;
  let n = 0;
  for (const sc of active.stack) if (sc.card.kind === 'tough') n++;
  return n;
}

function opponentMythicOnActive(
  state: TurfGameState,
  side: 'A' | 'B',
): boolean {
  const oppSide = side === 'A' ? 'B' : 'A';
  const oppActive = state.players[oppSide].turfs[0];
  if (!oppActive) return false;
  for (const sc of oppActive.stack) {
    if (sc.card.kind === 'tough' && sc.card.rarity === 'mythic') {
      // Confirm via mythicAssignments — mythic must belong to opponent's side.
      const assigned = state.mythicAssignments[sc.card.id];
      if (!assigned || assigned === oppSide) return true;
    }
  }
  return false;
}

// heat_management — fires when shared heat > 0.4. Ramps smoothly from
// 0 (at h=0.4) up to 1.2 (saturation at h=1.0).
export function desireHeatMgmt(owner: PlannerOwner): number {
  const h = owner.state.heat;
  if (h <= 0.4) return 0;
  return Math.min(1.2, (h - 0.4) * 2.0);
}

export function buildHeatMgmt(owner: PlannerOwner) {
  // Prefer custody routes (send_to_holding), Launder-carrying plays, and
  // send_to_market cleanup. Draw and end_turn remain in the fallback chain.
  return goal(owner, 'heat_management', [
    'send_to_holding',
    'play_card',
    'send_to_market',
    'draw',
    'end_turn',
  ]);
}

// mythic_hunt — fires when opponent's active turf hosts a mythic tough
// that mythicAssignments attributes to their side.
export function desireMythicHunt(owner: PlannerOwner): number {
  if (!opponentMythicOnActive(owner.state, owner.side)) return 0;
  // High-value offensive opportunity; push above standard pressure.
  return 1.0;
}

export function buildMythicHunt(owner: PlannerOwner) {
  // Queued strikes are the mythic-kill path; prefer funded recruit when
  // the target is low-resistance, otherwise direct/pushed.
  return goal(owner, 'mythic_hunt', [
    ['direct_strike', 'pushed_strike', 'funded_recruit'],
    'play_card',
    'draw',
    'end_turn',
  ]);
}

// stack_rebuild — fires when the active turf's tough count is <= 1.
export function desireStackRebuild(owner: PlannerOwner): number {
  const n = activeToughCount(owner.state, owner.side);
  if (n > 1) return 0;
  // Empty / near-empty active turf — rebuilding outranks everything.
  return n === 0 ? 1.4 : 0.9;
}

export function buildStackRebuild(owner: PlannerOwner) {
  // Rebuild prefers playing the pending card (toughs) and drawing;
  // queued strikes are deprioritized by exclusion from the chain.
  return goal(owner, 'stack_rebuild', [
    'play_card',
    'draw',
    'discard',
    'end_turn',
  ]);
}
