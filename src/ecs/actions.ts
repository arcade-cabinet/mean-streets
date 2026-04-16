import type { Entity, World } from 'koota';
import { stepAction } from '../sim/turf/environment';
import type { TurfAction, TurfGameState } from '../sim/turf/types';
import { ActionBudget, GameState, PlayerA, PlayerB, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

const getEntity = (world: World) =>
  world.queryFirst(GameState, PlayerA, PlayerB, ActionBudget);

/**
 * Re-publish the ActionBudget trait from the viewpoint of the local
 * player (side A). The handless model keeps both players' budgets live
 * on the sim simultaneously; UI chrome tracks A via this trait.
 */
function syncBudget(e: Entity, gs: TurfGameState): void {
  const a = gs.players.A;
  e.set(ActionBudget, {
    remaining: a.actionsRemaining,
    total: e.get(ActionBudget)?.total ?? a.actionsRemaining,
    turnNumber: gs.turnNumber,
  });
}

/**
 * Broadcast "state changed" to Koota subscribers. Re-assigning the
 * trait values (not just marking changed) ensures `useTrait` consumers
 * receive the fresh reference and re-render.
 */
function syncAll(e: Entity, gs: TurfGameState): void {
  syncBudget(e, gs);
  e.set(PlayerA, gs.players.A);
  e.set(PlayerB, gs.players.B);
  e.changed(GameState);
  e.changed(PlayerA);
  e.changed(PlayerB);
}

type StrikeKind = 'direct_strike' | 'pushed_strike' | 'funded_recruit';

/** Draw the top of deck into `pending`. Costs 1 action. */
export function drawAction(world: World, side: 'A' | 'B') {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'draw', side };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/**
 * Place `pending` onto a turf. Validates that the cardId matches the
 * current pending card for `side` (prevents stale-UI double-play).
 */
export function playCardAction(
  world: World,
  side: 'A' | 'B',
  turfIdx: number,
  cardId: string,
) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const pending = gs.players[side].pending;
  if (!pending || pending.id !== cardId) return null;

  const action: TurfAction = { kind: 'play_card', side, turfIdx, cardId };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/** Move a face-up tough at `stackIdx` to the top of its turf's stack. */
export function retreatAction(
  world: World,
  side: 'A' | 'B',
  turfIdx: number,
  stackIdx: number,
) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'retreat', side, turfIdx, stackIdx };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/**
 * Queue a strike or funded recruit. Resolves at end-of-turn when both
 * sides' `turnEnded` flags are set (sim handles the resolvePhase call).
 */
export function queueStrikeAction(
  world: World,
  side: 'A' | 'B',
  kind: StrikeKind,
  sourceTurfIdx: number,
  targetTurfIdx: number,
) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = {
    kind,
    side,
    turfIdx: sourceTurfIdx,
    targetTurfIdx,
  };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/** Voluntarily discard the current `pending` card. Free (no action cost). */
export function discardPendingAction(world: World, side: 'A' | 'B') {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const pending = gs.players[side].pending;
  if (!pending) return null;

  const action: TurfAction = { kind: 'discard', side, cardId: pending.id };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/** Pass (no-op, costs 1 action). Used by AI; rarely useful for humans. */
export function passAction(world: World, side: 'A' | 'B') {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'pass', side };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

/**
 * Mark `side` as turn-ended. When both sides are ended, sim's stepAction
 * auto-triggers resolvePhase (see environment.ts:179). After resolve the
 * turn counter bumps and both sides' action budgets refresh.
 */
export function endTurnAction(world: World, side: 'A' | 'B') {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'end_turn', side };
  const result = stepAction(gs, action);
  syncAll(e, gs);
  return result;
}

export function setScreen(world: World, screen: ScreenName): void {
  const e = world.queryFirst(ScreenTrait);
  const s = e?.get(ScreenTrait);
  if (s) {
    s.current = screen;
    e!.changed(ScreenTrait);
  }
}
