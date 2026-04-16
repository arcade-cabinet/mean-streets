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

interface AffiliationModifier {
  atkBonus: number;
  defBonus: number;
}

const AT_WAR_MAP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const aff of affiliationsPool.affiliations) {
    map.set(aff.id, new Set(aff.rival ?? []));
  }
  return map;
})();

const MEDIATOR_MAP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const aff of affiliationsPool.affiliations) {
    map.set(aff.id, new Set(aff.mediator ?? []));
  }
  return map;
})();

const AFFILIATION_MODIFIERS: Map<string, AffiliationModifier> = (() => {
  const map = new Map<string, AffiliationModifier>();
  for (const aff of affiliationsPool.affiliations) {
    const mod = aff.modifier ?? { atkBonus: 0, defBonus: 0 };
    map.set(aff.id, {
      atkBonus: mod.atkBonus ?? 0,
      defBonus: mod.defBonus ?? 0,
    });
  }
  return map;
})();

let turfIdCounter = 0;

export function createTurf(): Turf {
  turfIdCounter++;
  return { id: `turf-${turfIdCounter}`, stack: [], closedRanks: false };
}

export function resetTurfIdCounter(): void {
  turfIdCounter = 0;
}

/**
 * Push a card onto the stack as a {@link StackedCard}. `faceUp` defaults to
 * true — callers that need to transfer cards as face-down (modifier transfer
 * on kill, opponent-side additions) pass `false`.
 */
export function addToStack(turf: Turf, card: Card, faceUp = true): void {
  turf.stack.push({ card, faceUp });
}

export function removeFromStack(turf: Turf, idx: number): Card | null {
  if (idx < 0 || idx >= turf.stack.length) return null;
  const [removed] = turf.stack.splice(idx, 1);
  if (turf.sickTopIdx != null) {
    if (idx === turf.sickTopIdx) {
      turf.sickTopIdx = null;
    } else if (idx < turf.sickTopIdx) {
      turf.sickTopIdx--;
    }
  }
  return removed?.card ?? null;
}

/** Flip the current top of the stack permanently face-up (retreat / reveal). */
export function setTopFaceUp(turf: Turf): void {
  if (turf.stack.length === 0) return;
  turf.stack[turf.stack.length - 1].faceUp = true;
}

/** Flip an arbitrary card in the stack permanently face-up. */
export function flipCardFaceUp(turf: Turf, stackIdx: number): void {
  const entry = turf.stack[stackIdx];
  if (entry) entry.faceUp = true;
}

function toughs(turf: Turf): ToughCard[] {
  const out: ToughCard[] = [];
  for (const e of turf.stack) {
    if (e.card.kind === 'tough') out.push(e.card);
  }
  return out;
}

/**
 * Dominant affiliation for loyal-stacking (atk/def bonus), or null if the
 * stack spans incompatible affiliations. Mediators from the anchor's
 * mediator list are tolerated; freelance is ignored. Empty → null.
 */
function dominantAffiliation(turf: Turf): string | null {
  const affs = toughs(turf)
    .map((t) => t.affiliation)
    .filter((a) => a !== 'freelance');
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
  const anchor = dominantAffiliation(turf);
  if (!anchor) return 0;
  return AFFILIATION_MODIFIERS.get(anchor)?.atkBonus ?? 0;
}

function loyalDefBonus(turf: Turf): number {
  const anchor = dominantAffiliation(turf);
  if (!anchor) return 0;
  return AFFILIATION_MODIFIERS.get(anchor)?.defBonus ?? 0;
}

export function positionPower(turf: Turf): number {
  let total = 0;
  for (let i = 0; i < turf.stack.length; i++) {
    const card = turf.stack[i].card;
    if (card.kind === 'currency') continue;
    if (card.kind === 'tough' && turf.sickTopIdx === i) continue;
    total += card.power;
  }
  return total + loyalAtkBonus(turf);
}

export function positionResistance(turf: Turf): number {
  let total = 0;
  for (const e of turf.stack) {
    if (e.card.kind === 'currency') continue;
    total += e.card.resistance;
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

/** True if the turf carries any currency card that hasn't already been
 * spent as a rival buffer this match. */
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

/**
 * Consume one unit of currency buffer if this rival placement is permitted
 * SOLELY by the currency buffer (no neutral tough). Call AFTER
 * `turfAffiliationConflict` returned false and BEFORE `addToStack`.
 */
export function consumeRivalBufferIfNeeded(
  turf: Turf,
  incoming: Card,
): boolean {
  if (incoming.kind !== 'tough') return false;
  if (!hasRivalOnTurf(turf, incoming.affiliation)) return false;
  if (hasNeutralToughBuffer(turf, incoming.affiliation)) return false;
  if (!hasCurrencyBuffer(turf)) return false;
  turf.rivalBufferSpent = true;
  return true;
}

export function turfToughs(turf: Turf): ToughCard[] {
  return toughs(turf);
}

export function turfModifiers(turf: Turf): ModifierCard[] {
  const out: ModifierCard[] = [];
  for (const e of turf.stack) {
    if (e.card.kind !== 'tough') out.push(e.card as ModifierCard);
  }
  return out;
}

export function turfCurrency(turf: Turf): CurrencyCard[] {
  const out: CurrencyCard[] = [];
  for (const e of turf.stack) {
    if (e.card.kind === 'currency') out.push(e.card);
  }
  return out;
}

export function hasToughOnTurf(turf: Turf): boolean {
  for (const e of turf.stack) if (e.card.kind === 'tough') return true;
  return false;
}

/** Raw access to the underlying {@link StackedCard} at index. */
export function stackEntryAt(turf: Turf, idx: number): StackedCard | null {
  return turf.stack[idx] ?? null;
}

export function seizeTurf(
  defender: PlayerState,
  defenderTurfIdx: number,
  attacker: PlayerState,
  destinationTurfIdx?: number,
): void {
  const seized = defender.turfs[defenderTurfIdx];
  if (!seized) return;

  const mods = turfModifiers(seized);
  defender.turfs.splice(defenderTurfIdx, 1);

  if (attacker.turfs.length === 0) return;

  const destIdx = destinationTurfIdx ?? 0;
  const dest = attacker.turfs[destIdx];
  if (!dest) return;

  for (const mod of mods) {
    addToStack(dest, mod, false);
  }
}
