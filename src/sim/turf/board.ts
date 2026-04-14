/**
 * Board management — 6 quarter-card slots around each crew card.
 */

import type {
  Position, PlayerBoard, CrewCard, ProductCard,
  CashCard, WeaponCard, ModifierCard, BackpackCard, PayloadCard,
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
    backpack: null,
    runner: false,
    payloadRemaining: 0,
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

export function placeReserveCrew(board: PlayerBoard, idx: number, crew: CrewCard): boolean {
  const pos = board.reserve[idx];
  if (!pos || pos.crew !== null || pos.seized) return false;
  pos.crew = crew;
  pos.turnsActive = 0;
  return true;
}

export function equipBackpack(position: Position, backpack: BackpackCard, asRunner = false): boolean {
  if (!position.crew || position.seized || position.backpack) return false;
  position.backpack = backpack;
  position.runner = asRunner;
  position.payloadRemaining = backpack.payload.length;
  return true;
}

export function clearBackpack(position: Position): BackpackCard | null {
  const backpack = position.backpack;
  position.backpack = null;
  position.runner = false;
  position.payloadRemaining = 0;
  return backpack;
}

export function markRunner(position: Position, active: boolean): void {
  position.runner = active && Boolean(position.backpack) && position.payloadRemaining > 0;
}

export function deployRunner(board: PlayerBoard, reserveIdx: number, activeIdx: number): boolean {
  const reserve = board.reserve[reserveIdx];
  const active = board.active[activeIdx];
  if (!reserve?.crew || !reserve.runner || !reserve.backpack || reserve.seized) return false;
  if (!active || active.seized) return false;

  const nextReserve = {
    crew: active.crew,
    drugTop: active.drugTop,
    drugBottom: active.drugBottom,
    weaponTop: active.weaponTop,
    weaponBottom: active.weaponBottom,
    cashLeft: active.cashLeft,
    cashRight: active.cashRight,
    backpack: active.backpack,
    runner: active.runner,
    payloadRemaining: active.payloadRemaining,
    turnsActive: active.turnsActive,
  };

  active.crew = reserve.crew;
  active.drugTop = reserve.drugTop;
  active.drugBottom = reserve.drugBottom;
  active.weaponTop = reserve.weaponTop;
  active.weaponBottom = reserve.weaponBottom;
  active.cashLeft = reserve.cashLeft;
  active.cashRight = reserve.cashRight;
  active.backpack = reserve.backpack;
  active.runner = reserve.runner;
  active.payloadRemaining = reserve.payloadRemaining;
  active.turnsActive = 0;

  reserve.crew = nextReserve.crew ?? null;
  reserve.drugTop = nextReserve.drugTop ?? null;
  reserve.drugBottom = nextReserve.drugBottom ?? null;
  reserve.weaponTop = nextReserve.weaponTop ?? null;
  reserve.weaponBottom = nextReserve.weaponBottom ?? null;
  reserve.cashLeft = nextReserve.cashLeft ?? null;
  reserve.cashRight = nextReserve.cashRight ?? null;
  reserve.backpack = nextReserve.backpack ?? null;
  reserve.runner = nextReserve.runner ?? false;
  reserve.payloadRemaining = nextReserve.payloadRemaining ?? 0;
  reserve.turnsActive = 0;

  return true;
}

export function consumePayload(position: Position, cardType?: PayloadCard['type']): boolean {
  if (!position.backpack || position.payloadRemaining <= 0) return false;
  if (cardType) {
    const remaining = position.backpack.payload.filter(card => card.type === cardType).length;
    if (remaining <= 0) return false;
  }
  position.payloadRemaining = Math.max(0, position.payloadRemaining - 1);
  if (position.payloadRemaining === 0) {
    position.runner = false;
  }
  return true;
}

export function takePayload(position: Position, payloadId: string): PayloadCard | null {
  if (!position.backpack || position.payloadRemaining <= 0) return null;
  const idx = position.backpack.payload.findIndex(card => card.id === payloadId);
  if (idx < 0) return null;
  const [card] = position.backpack.payload.splice(idx, 1);
  position.payloadRemaining = position.backpack.payload.length;
  if (position.payloadRemaining === 0) {
    position.runner = false;
  }
  return card ?? null;
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

export function clearPosition(pos: Position): Array<CrewCard | ProductCard | CashCard | WeaponCard | BackpackCard> {
  const cards: Array<CrewCard | ProductCard | CashCard | WeaponCard | BackpackCard> = [];
  if (pos.crew) cards.push(pos.crew);
  if (pos.drugTop) cards.push(pos.drugTop);
  if (pos.drugBottom) cards.push(pos.drugBottom);
  if (pos.weaponTop) cards.push(pos.weaponTop);
  if (pos.weaponBottom) cards.push(pos.weaponBottom);
  if (pos.cashLeft) cards.push(pos.cashLeft);
  if (pos.cashRight) cards.push(pos.cashRight);
  if (pos.backpack) cards.push(pos.backpack);
  pos.crew = null;
  pos.drugTop = pos.drugBottom = null;
  pos.weaponTop = pos.weaponBottom = null;
  pos.cashLeft = pos.cashRight = null;
  pos.backpack = null;
  pos.runner = false;
  pos.payloadRemaining = 0;
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
