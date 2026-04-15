import type { World, Entity } from 'koota';
import type { TurfAction, TurfGameState } from '../sim/turf/types';
import { stepAction, advanceTurn } from '../sim/turf/environment';
import { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

const getEntity = (world: World) => world.queryFirst(GameState, PlayerA, PlayerB, ActionBudget);

function syncBudget(e: Entity, gs: TurfGameState): void {
  const player = gs.players[gs.turnSide];
  e.set(ActionBudget, {
    remaining: player.actionsRemaining,
    total: e.get(ActionBudget)?.total ?? player.actionsRemaining,
    turnNumber: gs.turnNumber,
  });
}

export function strikeAction(
  world: World,
  kind: 'direct_strike' | 'pushed_strike' | 'funded_recruit',
  turfIdx: number,
  targetTurfIdx: number,
) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind, side: gs.turnSide, turfIdx, targetTurfIdx };
  const result = stepAction(gs, action);

  syncBudget(e, gs);
  e.changed(GameState);
  e.changed(PlayerA);
  e.changed(PlayerB);
  return result;
}

export function playCardAction(
  world: World,
  turfIdx: number,
  cardId: string,
) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'play_card', side: gs.turnSide, turfIdx, cardId };
  const result = stepAction(gs, action);

  syncBudget(e, gs);
  e.changed(GameState);
  e.changed(gs.turnSide === 'A' ? PlayerA : PlayerB);
  return result;
}

export function discardAction(world: World, cardId: string) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'discard', side: gs.turnSide, cardId };
  const result = stepAction(gs, action);

  e.changed(GameState);
  e.changed(gs.turnSide === 'A' ? PlayerA : PlayerB);
  return result;
}

export function passAction(world: World) {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return null;

  const action: TurfAction = { kind: 'pass', side: gs.turnSide };
  const result = stepAction(gs, action);

  syncBudget(e, gs);
  e.changed(GameState);
  return result;
}

export function endTurnAction(world: World): void {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs) return;

  // Delegate all sim mutations to the environment. `stepAction` zeroes
  // the outgoing side's remaining actions; `advanceTurn` swaps sides,
  // bumps turnNumber, draws for the new side, and resets the incoming
  // side's action budget via `actionsForTurn`.
  const action: TurfAction = { kind: 'end_turn', side: gs.turnSide };
  stepAction(gs, action);
  advanceTurn(gs);

  const newBudget = gs.players[gs.turnSide].actionsRemaining;
  e.set(ActionBudget, {
    remaining: newBudget,
    total: newBudget,
    turnNumber: gs.turnNumber,
  });
  e.changed(GameState);
  e.changed(PlayerA);
  e.changed(PlayerB);
}

export function setScreen(world: World, screen: ScreenName): void {
  const e = world.queryFirst(ScreenTrait);
  const s = e?.get(ScreenTrait);
  if (s) { s.current = screen; e!.changed(ScreenTrait); }
}
