/**
 * ECS action functions — call sim engine, then signal trait changes to Koota.
 */

import type { World, Entity } from 'koota';
import type { ModifierCard, PlayerState, AttackOutcome } from '../sim/turf/types';
import { deployRunner, equipBackpack, placeCrew, placeModifier, placeReserveCrew, takePayload, tickPositions } from '../sim/turf/board';
import { resolveDirectAttack, resolveFundedAttack, resolvePushedAttack } from '../sim/turf/attacks';
import { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

const getEntity = (world: World) => world.queryFirst(GameState, PlayerA, PlayerB, ActionBudget);

/** Place crew from hand[0] onto position for side A. */
export function placeCrewAction(world: World, positionIdx: number): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  if (!pA || pA.hand.crew.length === 0) return false;
  const placed = placeCrew(pA.board, positionIdx, pA.hand.crew[0]);
  if (placed) { pA.hand.crew.splice(0, 1); e!.changed(PlayerA); }
  return placed;
}

export function placeReserveCrewAction(world: World, reserveIdx: number): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  if (!pA || pA.hand.crew.length === 0) return false;
  const placed = placeReserveCrew(pA.board, reserveIdx, pA.hand.crew[0]);
  if (placed) { pA.hand.crew.splice(0, 1); e!.changed(PlayerA); }
  return placed;
}

export function equipBackpackAction(world: World, reserveIdx: number, backpackIdx: number): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  const backpack = pA?.hand.backpacks[backpackIdx];
  if (!pA || !backpack) return false;
  const reserve = pA.board.reserve[reserveIdx];
  if (!reserve) return false;
  const placed = equipBackpack(reserve, backpack, true);
  if (placed) { pA.hand.backpacks.splice(backpackIdx, 1); e!.changed(PlayerA); }
  return placed;
}

export function deployRunnerAction(world: World, reserveIdx: number, activeIdx: number): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  const gs = e?.get(GameState);
  if (!pA || !gs || gs.phase !== 'buildup') return false;
  const moved = deployRunner(pA.board, reserveIdx, activeIdx);
  if (moved) { e!.changed(PlayerA); }
  return moved;
}

export function deployPayloadAction(
  world: World,
  activeIdx: number,
  payloadId: string,
  orientation: 'offense' | 'defense',
): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  const gs = e?.get(GameState);
  if (!pA || !gs || gs.phase !== 'buildup') return false;
  const lane = pA.board.active[activeIdx];
  if (!lane?.runner || !lane.backpack) return false;
  const card = takePayload(lane, payloadId);
  if (!card) return false;
  const placed = placeModifier(pA.board, activeIdx, card, orientation);
  if (placed) {
    e!.changed(PlayerA);
    return true;
  }
  lane.backpack.payload.unshift(card);
  lane.payloadRemaining = lane.backpack.payload.length;
  lane.runner = lane.payloadRemaining > 0;
  return false;
}

/** Place modifier card from hand[cardIdx] onto position for side A. */
export function placeModifierAction(
  world: World, positionIdx: number, cardIdx: number, orientation: 'offense' | 'defense',
): boolean {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  const card = pA?.hand.modifiers[cardIdx] as ModifierCard | undefined;
  if (!pA || !card) return false;
  const placed = placeModifier(pA.board, positionIdx, card, orientation);
  if (placed) { pA.hand.modifiers.splice(cardIdx, 1); e!.changed(PlayerA); }
  return placed;
}

/** Direct attack: player A's attackerIdx vs player B's targetIdx. */
export function directAttackAction(world: World, attackerIdx: number, targetIdx: number): AttackOutcome | null {
  const e = getEntity(world);
  const pA = e?.get(PlayerA);
  const pB = e?.get(PlayerB);
  if (!pA || !pB) return null;
  const atk = pA.board.active[attackerIdx];
  const def = pB.board.active[targetIdx];
  if (!atk?.crew || !def?.crew) return null;
  const outcome = resolveDirectAttack(atk, def);
  e!.changed(PlayerA); e!.changed(PlayerB); consumeAction(e!);
  return outcome;
}

/** Funded (bribe) attack: player A's attackerIdx vs player B's targetIdx. */
export function fundedAttackAction(world: World, attackerIdx: number, targetIdx: number): AttackOutcome | null {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  const pA = e?.get(PlayerA);
  const pB = e?.get(PlayerB);
  if (!gs || !pA || !pB) return null;
  const atk = pA.board.active[attackerIdx];
  const def = pB.board.active[targetIdx];
  if (!atk?.crew || !def?.crew) return null;
  const outcome = resolveFundedAttack(atk, def, gs.config);
  e!.changed(PlayerA); e!.changed(PlayerB); consumeAction(e!);
  return outcome;
}

/** Pushed (drug + cash splash) attack: player A's attackerIdx vs player B's targetIdx. */
export function pushedAttackAction(world: World, attackerIdx: number, targetIdx: number): AttackOutcome | null {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  const pA = e?.get(PlayerA);
  const pB = e?.get(PlayerB);
  if (!gs || !pA || !pB) return null;
  const atk = pA.board.active[attackerIdx];
  const def = pB.board.active[targetIdx];
  if (!atk?.crew || !def?.crew) return null;
  const outcome = resolvePushedAttack(atk, def, pB.board.active, gs.config);
  e!.changed(PlayerA); e!.changed(PlayerB); consumeAction(e!);
  return outcome;
}

/** Advance the round: tick positions, draw cards, reset action budget. */
export function endRoundAction(world: World): void {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  const pA = e?.get(PlayerA);
  const pB = e?.get(PlayerB);
  if (!e || !gs || !pA || !pB) return;

  tickPositions(pA.board); tickPositions(pB.board);
  drawCard(pA); drawCard(pB);
  gs.turnNumber++; gs.metrics.turns++;

  e.set(ActionBudget, { remaining: gs.config.actionsPerRound, total: gs.config.actionsPerRound });
  e.changed(GameState); e.changed(PlayerA); e.changed(PlayerB);
}

/** Transition from buildup to combat. */
export function strikeAction(world: World): void {
  const e = getEntity(world);
  const gs = e?.get(GameState);
  if (!e || !gs || gs.phase !== 'buildup') return;
  gs.phase = 'combat'; gs.hasStruck.A = true; gs.hasStruck.B = true;
  e.changed(GameState);
  e.set(ActionBudget, { remaining: gs.config.actionsPerRound, total: gs.config.actionsPerRound });
  setScreen(world, 'combat');
}

/** Navigate to a UI screen. */
export function setScreen(world: World, screen: ScreenName): void {
  const e = world.queryFirst(ScreenTrait);
  const s = e?.get(ScreenTrait);
  if (s) { s.current = screen; e!.changed(ScreenTrait); }
}

function consumeAction(e: Entity): void {
  const b = e.get(ActionBudget);
  if (b && b.remaining > 0) e.set(ActionBudget, { remaining: b.remaining - 1, total: b.total });
}

function drawCard(p: PlayerState): void {
  if (p.crewDraw.length > 0 && p.hand.crew.length < 5) p.hand.crew.push(p.crewDraw.pop()!);
  if (p.modifierDraw.length > 0 && p.hand.modifiers.length < 7) p.hand.modifiers.push(p.modifierDraw.pop()!);
  if (p.backpackDraw.length > 0 && p.hand.backpacks.length < 4) p.hand.backpacks.push(p.backpackDraw.pop()!);
}
