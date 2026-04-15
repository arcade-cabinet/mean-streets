import type { Card, CurrencyCard, ModifierCard, PlayerState, Turf, ToughCard } from './types';
import affiliationsPool from '../../data/pools/affiliations.json';

const AT_WAR_MAP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const aff of affiliationsPool.affiliations) {
    map.set(aff.id, new Set(aff.rival ?? []));
  }
  return map;
})();

let turfIdCounter = 0;

export function createTurf(): Turf {
  turfIdCounter++;
  return { id: `turf-${turfIdCounter}`, stack: [] };
}

export function resetTurfIdCounter(): void {
  turfIdCounter = 0;
}

export function addToStack(turf: Turf, card: Card): void {
  turf.stack.push(card);
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
  return removed ?? null;
}

function toughs(turf: Turf): ToughCard[] {
  return turf.stack.filter((c): c is ToughCard => c.kind === 'tough');
}

export function positionPower(turf: Turf): number {
  let total = 0;
  for (let i = 0; i < turf.stack.length; i++) {
    const card = turf.stack[i];
    if (card.kind === 'currency') continue;
    if (card.kind === 'tough' && turf.sickTopIdx === i) continue;
    total += card.power;
  }
  return total;
}

export function positionResistance(turf: Turf): number {
  let total = 0;
  for (const card of turf.stack) {
    if (card.kind === 'currency') continue;
    total += card.resistance;
  }
  return total;
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
  return turf.stack.some((c) => c.kind === 'currency');
}

function hasNeutralToughBuffer(
  turf: Turf,
  incomingAffiliation: string,
): boolean {
  const enemies = AT_WAR_MAP.get(incomingAffiliation);
  if (!enemies) return false;
  const rivalAffiliations = affiliationsOnTurf(turf).filter((a) =>
    enemies.has(a),
  );
  if (rivalAffiliations.length === 0) return false;

  return toughs(turf).some((t) => {
    if (enemies.has(t.affiliation)) return false;
    for (const rivalAff of rivalAffiliations) {
      const rivalEnemies = AT_WAR_MAP.get(rivalAff);
      if (rivalEnemies?.has(t.affiliation)) return false;
    }
    return true;
  });
}

export function turfAffiliationConflict(
  turf: Turf,
  incoming: Card,
): boolean {
  if (incoming.kind !== 'tough') return false;
  if (!hasRivalOnTurf(turf, incoming.affiliation)) return false;
  return !hasCurrencyBuffer(turf) && !hasNeutralToughBuffer(turf, incoming.affiliation);
}

export function turfToughs(turf: Turf): ToughCard[] {
  return toughs(turf);
}

export function turfModifiers(turf: Turf): ModifierCard[] {
  return turf.stack.filter(
    (c): c is ModifierCard => c.kind !== 'tough',
  );
}

export function turfCurrency(turf: Turf): CurrencyCard[] {
  return turf.stack.filter(
    (c): c is CurrencyCard => c.kind === 'currency',
  );
}

export function hasToughOnTurf(turf: Turf): boolean {
  return turf.stack.some((c) => c.kind === 'tough');
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
    addToStack(dest, mod);
  }
}
