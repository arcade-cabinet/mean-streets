/**
 * Board management — 6 quarter-card slots around each crew card.
 */

import type {
  Position, PlayerBoard, CrewCard, ProductCard,
  CashCard, WeaponCard, ModifierCard,
} from './types';

function isActionReady(pos: Position): boolean {
  return !!pos.crew && (pos.turnsActive >= 1 || pos.drugTop?.category === 'stimulant');
}

export function emptyPosition(owner: 'A' | 'B'): Position {
  return {
    crew: null,
    drugTop: null, drugBottom: null,
    weaponTop: null, weaponBottom: null,
    cashLeft: null, cashRight: null,
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

/**
 * Place a quarter-size modifier card onto a crew position.
 * Routes to the correct slot based on card type and chosen orientation.
 */
export function placeModifier(
  board: PlayerBoard, idx: number, card: ModifierCard, slot: 'offense' | 'defense',
): boolean {
  const pos = board.active[idx];
  if (!pos || !pos.crew) return false;

  switch (card.type) {
    case 'product':
      if (slot === 'offense') {
        if (pos.drugTop) return false;
        pos.drugTop = card;
      } else {
        if (pos.drugBottom) return false;
        pos.drugBottom = card;
      }
      return true;

    case 'weapon':
      if (slot === 'offense') {
        if (pos.weaponTop) return false;
        pos.weaponTop = card;
      } else {
        if (pos.weaponBottom) return false;
        pos.weaponBottom = card;
      }
      return true;

    case 'cash':
      if (slot === 'offense') {
        if (pos.cashLeft) return false;
        pos.cashLeft = card;
      } else {
        if (pos.cashRight) return false;
        pos.cashRight = card;
      }
      return true;

    default:
      return false;
  }
}

/** Effective ATTACK power: crew power + top weapon + top drug. */
export function positionPower(pos: Position): number {
  if (!pos.crew) return 0;
  let power = pos.crew.power;
  if (pos.weaponTop) power += pos.weaponTop.bonus;
  else power = Math.max(1, power - 2); // bare-fist penalty
  if (pos.drugTop) power += pos.drugTop.potency;
  return power;
}

/** Effective DEFENSE: crew resistance + bottom weapon + bottom drug. */
export function positionDefense(pos: Position): number {
  if (!pos.crew) return 0;
  let def = pos.crew.resistance;
  if (pos.weaponBottom) def += pos.weaponBottom.bonus;
  if (pos.drugBottom) def += pos.drugBottom.potency;
  return def;
}

/** Offensive cash value (center-left). */
export function offensiveCash(pos: Position): number {
  return pos.cashLeft?.denomination ?? 0;
}

/** Defensive cash value (center-right). */
export function defensiveCash(pos: Position): number {
  return pos.cashRight?.denomination ?? 0;
}

export function clearPosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard> {
  const cards: Array<CrewCard | ProductCard | CashCard | WeaponCard> = [];
  if (pos.crew) cards.push(pos.crew);
  if (pos.drugTop) cards.push(pos.drugTop);
  if (pos.drugBottom) cards.push(pos.drugBottom);
  if (pos.weaponTop) cards.push(pos.weaponTop);
  if (pos.weaponBottom) cards.push(pos.weaponBottom);
  if (pos.cashLeft) cards.push(pos.cashLeft);
  if (pos.cashRight) cards.push(pos.cashRight);
  pos.crew = null;
  pos.drugTop = pos.drugBottom = null;
  pos.weaponTop = pos.weaponBottom = null;
  pos.cashLeft = pos.cashRight = null;
  return cards;
}

export function seizePosition(pos: Position) {
  clearPosition(pos);
  pos.seized = true;
}

/** Crew + offensive cash + offensive drug = push ready. */
export function findPushReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (isActionReady(p) && p.drugTop && p.cashLeft) ? i : -1)
    .filter(i => i >= 0);
}

/** Crew + offensive cash (no drug) = funded attack ready. */
export function findFundedReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (isActionReady(p) && p.cashLeft && !p.drugTop) ? i : -1)
    .filter(i => i >= 0);
}

/** Crew ready for direct attack. */
export function findDirectReady(board: PlayerBoard): number[] {
  return board.active
    .map((p, i) => (isActionReady(p)) ? i : -1)
    .filter(i => i >= 0);
}

/** Has any empty modifier slot. */
export function hasEmptySlot(pos: Position): boolean {
  if (!pos.crew || pos.seized) return false;
  return !pos.drugTop || !pos.drugBottom || !pos.weaponTop ||
    !pos.weaponBottom || !pos.cashLeft || !pos.cashRight;
}
