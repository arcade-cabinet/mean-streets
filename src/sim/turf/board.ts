/**
 * Board management — positions, stacking, seizure.
 * Each position has a crew card + up to 4 quarter-card slots:
 *   top-left: drug (offense), bottom-left: drug (defense)
 *   top-right: weapon (offense), bottom-right: weapon (defense)
 * Plus a cash card for funded/pushed attacks.
 */

import type {
  Position, PlayerBoard,
  CrewCard, ProductCard, CashCard, WeaponCard,
} from './types';

export function emptyPosition(owner: 'A' | 'B'): Position {
  return {
    crew: null, cash: null,
    drugOffense: null, drugDefense: null,
    weaponOffense: null, weaponDefense: null,
    owner, seized: false, turnsActive: 0,
  };
}

export function createBoard(side: 'A' | 'B', count: number, reserveCount: number): PlayerBoard {
  return {
    active: Array.from({ length: count }, () => emptyPosition(side)),
    reserve: Array.from({ length: reserveCount }, () => emptyPosition(side)),
  };
}

export function tickPositions(board: PlayerBoard): void {
  for (const pos of board.active) {
    if (pos.crew) pos.turnsActive++;
  }
}

export function findEmptyActive(board: PlayerBoard): number {
  return board.active.findIndex(p => p.crew === null && !p.seized);
}

export function seizedCount(board: PlayerBoard): number {
  return board.active.filter(p => p.seized).length;
}

export function placeCrew(board: PlayerBoard, idx: number, crew: CrewCard): boolean {
  const pos = board.active[idx];
  if (!pos || pos.crew !== null || pos.seized) return false;
  pos.crew = crew;
  pos.turnsActive = 0;
  return true;
}

export function stackCash(board: PlayerBoard, idx: number, cash: CashCard): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew || pos.cash !== null) return false;
  pos.cash = cash;
  return true;
}

/** Place drug on a crew — caller chooses offense (top) or defense (bottom). */
export function stackDrug(
  board: PlayerBoard, idx: number, drug: ProductCard, slot: 'offense' | 'defense',
): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew) return false;
  if (slot === 'offense') {
    if (pos.drugOffense) return false;
    pos.drugOffense = drug;
  } else {
    if (pos.drugDefense) return false;
    pos.drugDefense = drug;
  }
  return true;
}

/** Place weapon — caller chooses offense (top) or defense (bottom). */
export function armCrew(
  board: PlayerBoard, idx: number, weapon: WeaponCard, slot: 'offense' | 'defense',
): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew) return false;
  if (slot === 'offense') {
    if (pos.weaponOffense) return false;
    pos.weaponOffense = weapon;
  } else {
    if (pos.weaponDefense) return false;
    pos.weaponDefense = weapon;
  }
  return true;
}

/** Effective ATTACK power: crew power + offensive drug + offensive weapon. */
export function positionPower(pos: Position): number {
  if (!pos.crew) return 0;
  let power = pos.crew.power;
  // Bare-fist penalty if no offensive weapon
  if (!pos.weaponOffense) {
    power = Math.max(1, power - 2);
  } else {
    power += pos.weaponOffense.bonus;
  }
  if (pos.drugOffense) power += pos.drugOffense.potency;
  return power;
}

/** Effective DEFENSE: crew resistance + defensive drug + defensive weapon. */
export function positionDefense(pos: Position): number {
  if (!pos.crew) return 0;
  let def = pos.crew.resistance;
  if (pos.weaponDefense) def += pos.weaponDefense.bonus;
  if (pos.drugDefense) def += pos.drugDefense.potency;
  return def;
}

export function clearPosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard> {
  const cards: Array<CrewCard | ProductCard | CashCard | WeaponCard> = [];
  if (pos.crew) cards.push(pos.crew);
  if (pos.cash) cards.push(pos.cash);
  if (pos.drugOffense) cards.push(pos.drugOffense);
  if (pos.drugDefense) cards.push(pos.drugDefense);
  if (pos.weaponOffense) cards.push(pos.weaponOffense);
  if (pos.weaponDefense) cards.push(pos.weaponDefense);
  pos.crew = null;
  pos.cash = null;
  pos.drugOffense = null;
  pos.drugDefense = null;
  pos.weaponOffense = null;
  pos.weaponDefense = null;
  return cards;
}

export function seizePosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard> {
  const cards = clearPosition(pos);
  pos.seized = true;
  return cards;
}

/** Has crew + cash + offensive drug = ready for pushed attack. */
export function findPushReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && p.drugOffense && p.cash && p.turnsActive >= 1) ? i : -1)
    .filter(i => i >= 0);
}

/** Has crew + cash (no drug) = ready for funded attack. */
export function findFundedReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && p.cash && !p.drugOffense && p.turnsActive >= 1) ? i : -1)
    .filter(i => i >= 0);
}

/** Has crew ready for direct attack. */
export function findDirectReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (p.crew && p.turnsActive >= 1) ? i : -1)
    .filter(i => i >= 0);
}

/** Positions that could use more stacking. */
export function findNeedsStacking(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => {
      if (!p.crew || p.seized) return -1;
      if (!p.weaponOffense || !p.drugOffense || !p.cash) return i;
      return -1;
    })
    .filter(i => i >= 0);
}
