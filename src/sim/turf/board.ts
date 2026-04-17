import affiliationsPool from '../../data/pools/affiliations.json';
import type {
  Card,
  CurrencyCard,
  ModifierCard,
  PlayerState,
  StackedCard,
  ToughCard,
  Turf,
} from './types';

interface AffiliationModifier { atkBonus: number; defBonus: number; }

const AT_WAR_MAP: Map<string, Set<string>> = new Map(
  affiliationsPool.affiliations.map((a) => [a.id, new Set(a.rival ?? [])]),
);
const MEDIATOR_MAP: Map<string, Set<string>> = new Map(
  affiliationsPool.affiliations.map((a) => [a.id, new Set(a.mediator ?? [])]),
);
const AFFILIATION_MODIFIERS: Map<string, AffiliationModifier> = new Map(
  affiliationsPool.affiliations.map((a) => [
    a.id,
    {
      atkBonus: a.modifier?.atkBonus ?? 0,
      defBonus: a.modifier?.defBonus ?? 0,
    },
  ]),
);

let turfIdCounter = 0;

export interface CreateTurfOpts { isActive?: boolean; reserveIndex?: number; }

export function createTurf(opts: CreateTurfOpts = {}): Turf {
  turfIdCounter++;
  return {
    id: `turf-${turfIdCounter}`,
    stack: [],
    closedRanks: false,
    isActive: opts.isActive ?? false,
    reserveIndex: opts.reserveIndex ?? 0,
  };
}

export function resetTurfIdCounter(): void { turfIdCounter = 0; }

export interface AddToStackOpts { faceUp?: boolean; owner?: string; }

/** Push a card onto the stack. Legacy: boolean = faceUp. New: options. */
export function addToStack(
  turf: Turf, card: Card, optsOrFaceUp: AddToStackOpts | boolean = true,
): void {
  const opts: AddToStackOpts =
    typeof optsOrFaceUp === 'boolean' ? { faceUp: optsOrFaceUp } : optsOrFaceUp;
  const faceUp = opts.faceUp ?? true;
  let owner = opts.owner;
  if (!owner) {
    if (card.kind === 'tough') owner = card.id;
    else {
      for (let i = turf.stack.length - 1; i >= 0; i--) {
        const e = turf.stack[i];
        if (e.card.kind === 'tough') { owner = e.card.id; break; }
      }
      if (!owner) owner = card.id;
    }
  }
  turf.stack.push({ card, faceUp, owner });
}

export function removeFromStack(turf: Turf, idx: number): Card | null {
  if (idx < 0 || idx >= turf.stack.length) return null;
  const [removed] = turf.stack.splice(idx, 1);
  if (turf.sickTopIdx != null) {
    if (idx === turf.sickTopIdx) turf.sickTopIdx = null;
    else if (idx < turf.sickTopIdx) turf.sickTopIdx--;
  }
  return removed?.card ?? null;
}

export function setTopFaceUp(turf: Turf): void {
  if (turf.stack.length === 0) return;
  turf.stack[turf.stack.length - 1].faceUp = true;
}

export function flipCardFaceUp(turf: Turf, stackIdx: number): void {
  const entry = turf.stack[stackIdx];
  if (entry) entry.faceUp = true;
}

function toughs(turf: Turf): ToughCard[] {
  const out: ToughCard[] = [];
  for (const e of turf.stack) if (e.card.kind === 'tough') out.push(e.card);
  return out;
}

/** Dominant affiliation for loyal bonus; null if stack spans incompatibles. */
function dominantAffiliation(turf: Turf): string | null {
  const affs = toughs(turf).map((t) => t.affiliation).filter((a) => a !== 'freelance');
  if (affs.length === 0) return null;
  const distinct = Array.from(new Set(affs));
  if (distinct.length === 1) return distinct[0];
  for (const anchor of distinct) {
    const mediators = MEDIATOR_MAP.get(anchor) ?? new Set<string>();
    if (distinct.every((a) => a === anchor || mediators.has(a))) return anchor;
  }
  return null;
}

function loyalAtkBonus(turf: Turf): number {
  const a = dominantAffiliation(turf);
  return a ? AFFILIATION_MODIFIERS.get(a)?.atkBonus ?? 0 : 0;
}
function loyalDefBonus(turf: Turf): number {
  const a = dominantAffiliation(turf);
  return a ? AFFILIATION_MODIFIERS.get(a)?.defBonus ?? 0 : 0;
}

/** Scale a tough's authored stat by its HP ratio (min 1 while alive). */
function clampByHp(raw: number, tough: ToughCard): number {
  if (tough.hp <= 0) return 0;
  if (tough.maxHp <= 0) return raw;
  const scaled = Math.floor(raw * (tough.hp / tough.maxHp));
  return Math.max(1, scaled);
}

export function positionPower(turf: Turf): number {
  let total = 0;
  for (let i = 0; i < turf.stack.length; i++) {
    const card = turf.stack[i].card;
    if (card.kind === 'currency') continue;
    if (card.kind === 'tough') {
      if (turf.sickTopIdx === i) continue;
      if (card.hp <= 0) continue;
      total += clampByHp(card.power, card);
    } else total += card.power;
  }
  return total + loyalAtkBonus(turf);
}

export function positionResistance(turf: Turf): number {
  let total = 0;
  for (const e of turf.stack) {
    const card = e.card;
    if (card.kind === 'currency') continue;
    if (card.kind === 'tough') {
      if (card.hp <= 0) continue;
      total += clampByHp(card.resistance, card);
    } else total += card.resistance;
  }
  return total + loyalDefBonus(turf);
}

function affiliationsOnTurf(turf: Turf): string[] {
  return toughs(turf).map((t) => t.affiliation);
}

function hasRivalOnTurf(turf: Turf, affiliation: string): boolean {
  const enemies = AT_WAR_MAP.get(affiliation);
  if (!enemies || enemies.size === 0) return false;
  return affiliationsOnTurf(turf).some((a) => enemies.has(a));
}

function hasCurrencyBuffer(turf: Turf): boolean {
  if (turf.rivalBufferSpent) return false;
  for (const e of turf.stack) if (e.card.kind === 'currency') return true;
  return false;
}

function hasNeutralToughBuffer(turf: Turf, incoming: string): boolean {
  const enemies = AT_WAR_MAP.get(incoming);
  if (!enemies) return false;
  const rivalsOnTurf = affiliationsOnTurf(turf).filter((a) => enemies.has(a));
  if (rivalsOnTurf.length === 0) return false;
  return toughs(turf).some((t) => {
    if (enemies.has(t.affiliation)) return false;
    for (const rival of rivalsOnTurf) {
      const rivalEnemies = AT_WAR_MAP.get(rival);
      if (rivalEnemies?.has(t.affiliation)) return false;
    }
    return true;
  });
}

export function turfAffiliationConflict(turf: Turf, incoming: Card): boolean {
  if (incoming.kind !== 'tough') return false;
  if (!hasRivalOnTurf(turf, incoming.affiliation)) return false;
  if (hasNeutralToughBuffer(turf, incoming.affiliation)) return false;
  return !hasCurrencyBuffer(turf);
}

/** Consume one currency buffer unit when required to permit rival placement. */
export function consumeRivalBufferIfNeeded(turf: Turf, incoming: Card): boolean {
  if (incoming.kind !== 'tough') return false;
  if (!hasRivalOnTurf(turf, incoming.affiliation)) return false;
  if (hasNeutralToughBuffer(turf, incoming.affiliation)) return false;
  if (!hasCurrencyBuffer(turf)) return false;
  turf.rivalBufferSpent = true;
  return true;
}

export function turfToughs(turf: Turf): ToughCard[] { return toughs(turf); }

export function turfModifiers(turf: Turf): ModifierCard[] {
  const out: ModifierCard[] = [];
  for (const e of turf.stack) if (e.card.kind !== 'tough') out.push(e.card as ModifierCard);
  return out;
}

/** Modifiers bound to a specific tough (via StackedCard.owner). */
export function modifiersByOwner(turf: Turf, toughId: string): ModifierCard[] {
  const out: ModifierCard[] = [];
  for (const e of turf.stack) {
    if (e.card.kind === 'tough') continue;
    if (e.owner === toughId) out.push(e.card as ModifierCard);
  }
  return out;
}

/**
 * Individual tough's combat power: HP-clamped base + owned modifiers.
 * Per RULES §7 — damage calc uses individual stats, not turf sums.
 */
export function toughCombatPower(turf: Turf, toughIdx: number): number {
  const entry = turf.stack[toughIdx];
  if (!entry || entry.card.kind !== 'tough') return 0;
  const tough = entry.card;
  if (tough.hp <= 0) return 0;
  let total = clampByHp(tough.power, tough);
  for (const mod of modifiersByOwner(turf, tough.id)) {
    if (mod.kind !== 'currency') total += mod.power;
  }
  return total;
}

/** Individual tough's combat resistance: HP-clamped base + owned modifiers. */
export function toughCombatResistance(turf: Turf, toughIdx: number): number {
  const entry = turf.stack[toughIdx];
  if (!entry || entry.card.kind !== 'tough') return 0;
  const tough = entry.card;
  if (tough.hp <= 0) return 0;
  let total = clampByHp(tough.resistance, tough);
  for (const mod of modifiersByOwner(turf, tough.id)) {
    if (mod.kind !== 'currency') total += mod.resistance;
  }
  return total;
}

export function turfCurrency(turf: Turf): CurrencyCard[] {
  const out: CurrencyCard[] = [];
  for (const e of turf.stack) if (e.card.kind === 'currency') out.push(e.card);
  return out;
}

export function hasToughOnTurf(turf: Turf): boolean {
  for (const e of turf.stack) if (e.card.kind === 'tough' && e.card.hp > 0) return true;
  return false;
}

export function stackEntryAt(turf: Turf, idx: number): StackedCard | null {
  return turf.stack[idx] ?? null;
}

/** Reserve promotion: shift turfs[0] out, mark next turfs[0] active. */
export function promoteReserveTurf(player: PlayerState): void {
  if (player.turfs.length === 0) return;
  player.turfs.shift();
  for (let i = 0; i < player.turfs.length; i++) {
    const t = player.turfs[i];
    t.reserveIndex = Math.max(0, t.reserveIndex - 1);
    t.isActive = i === 0;
  }
}

/**
 * Seize the defender's active turf. Modifier cleanup is the caller's
 * responsibility (they go to the Black Market from resolve.ts).
 */
export function seizeTurf(
  defender: PlayerState, defenderTurfIdx: number,
  _attacker: PlayerState, _destinationTurfIdx?: number,
): void {
  const seized = defender.turfs[defenderTurfIdx];
  if (!seized) return;
  if (defenderTurfIdx === 0) promoteReserveTurf(defender);
  else defender.turfs.splice(defenderTurfIdx, 1);
}
