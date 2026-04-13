/**
 * Board management — position creation, stacking, seizure.
 */

import type {
  Position, PlayerBoard, PlayerState,
  CrewCard, ProductCard, CashCard, WeaponCard,
} from './types';

/** Create an empty position owned by the given side. */
export function emptyPosition(owner: 'A' | 'B'): Position {
  return { crew: null, product: null, cash: null, weapon: null, owner, seized: false };
}

/** Create initial board for a player. */
export function createBoard(side: 'A' | 'B', count: number, reserveCount: number): PlayerBoard {
  return {
    active: Array.from({ length: count }, () => emptyPosition(side)),
    reserve: Array.from({ length: reserveCount }, () => emptyPosition(side)),
  };
}

/** Count non-empty active positions. */
export function occupiedCount(board: PlayerBoard): number {
  return board.active.filter(p => p.crew !== null).length;
}

/** Count seized positions on this board. */
export function seizedCount(board: PlayerBoard): number {
  return board.active.filter(p => p.seized).length;
}

/** Find first empty active position index. Returns -1 if full. */
export function findEmptyActive(board: PlayerBoard): number {
  return board.active.findIndex(p => p.crew === null && !p.seized);
}

/** Find first empty reserve position index. Returns -1 if full. */
export function findEmptyReserve(board: PlayerBoard): number {
  return board.reserve.findIndex(p => p.crew === null);
}

/** Place a crew card on an empty active position. */
export function placeCrew(board: PlayerBoard, idx: number, crew: CrewCard): boolean {
  const pos = board.active[idx];
  if (!pos || pos.crew !== null || pos.seized) return false;
  pos.crew = crew;
  return true;
}

/** Stack a product card onto a crew position. */
export function stackProduct(board: PlayerBoard, idx: number, product: ProductCard): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew || pos.product !== null) return false;
  pos.product = product;
  return true;
}

/** Stack cash onto a crew position. */
export function stackCash(board: PlayerBoard, idx: number, cash: CashCard): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew || pos.cash !== null) return false;
  pos.cash = cash;
  return true;
}

/** Arm a crew with a weapon. */
export function armCrew(board: PlayerBoard, idx: number, weapon: WeaponCard): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew || pos.weapon !== null) return false;
  pos.weapon = weapon;
  return true;
}

/** Get effective power of a position (crew power + weapon bonus). */
export function positionPower(pos: Position): number {
  if (!pos.crew) return 0;
  let power = pos.crew.power;
  if (pos.weapon) power += pos.weapon.bonus;
  if (pos.product?.effect === 'boost') power += pos.product.potency;
  return power;
}

/** Kill/remove crew from a position, return all cards to discard. */
export function clearPosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard> {
  const cards: Array<CrewCard | ProductCard | CashCard | WeaponCard> = [];
  if (pos.crew) cards.push(pos.crew);
  if (pos.product) cards.push(pos.product);
  if (pos.cash) cards.push(pos.cash);
  if (pos.weapon) cards.push(pos.weapon);
  pos.crew = null;
  pos.product = null;
  pos.cash = null;
  pos.weapon = null;
  return cards;
}

/** Seize a position — mark it as seized, clear the occupant. */
export function seizePosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard> {
  const cards = clearPosition(pos);
  pos.seized = true;
  return cards;
}

/** Reclaim a seized position by placing a crew card. */
export function reclaimPosition(pos: Position, crew: CrewCard): boolean {
  if (!pos.seized) return false;
  pos.seized = false;
  pos.crew = crew;
  return true;
}

/** Find positions with full stacks (crew + product + cash) for pushed attacks. */
export function findPushReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && p.product && p.cash) ? i : -1)
    .filter(i => i >= 0);
}

/** Find positions with crew + cash for funded attacks. */
export function findFundedReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && p.cash && !p.product) ? i : -1)
    .filter(i => i >= 0);
}

/** Find positions with just crew for direct attacks. */
export function findDirectReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && !p.cash && !p.product) ? i : -1)
    .filter(i => i >= 0);
}
