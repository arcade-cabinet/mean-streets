// Abilities — Epic D (Kira). APIs: applyTangibles, runIntangiblesPhase.
// Intangibles fire legendary → rare → common, attacker-then-defender.
// Classification is in abilities-effects.ts (ABILITY_INDEX).
import affiliationsPool from '../../data/pools/affiliations.json';
import { ABILITY_INDEX } from './abilities-effects';
import type {
  Card,
  CurrencyCard,
  QueuedAction,
  Rarity,
  StackedCard,
  ToughCard,
  Turf,
  TurfGameState,
} from './types';

export interface TangibleBonus {
  atkPowerDelta: number;
  defResistDelta: number;
  sickOnHit: boolean;
  targetOverride: 'bottom' | 'anywhere' | null;
  ignoreResistance: boolean;
}

export type IntangibleOutcome =
  | { kind: 'proceed' }
  | { kind: 'canceled'; reason: string }
  | { kind: 'redirected'; newTargetTurfIdx: number; reason: string };

// ── Stack & affiliation helpers ─────────────────────────────
function rarityRank(r: Rarity): number {
  return r === 'legendary' ? 3 : r === 'rare' ? 2 : 1;
}

export function stackCardsByRarityDesc(turf: Turf): StackedCard[] {
  const indexed = turf.stack.map((sc, i) => ({ sc, i }));
  indexed.sort((a, b) => {
    const d = rarityRank(b.sc.card.rarity) - rarityRank(a.sc.card.rarity);
    return d !== 0 ? d : a.i - b.i;
  });
  return indexed.map((entry) => entry.sc);
}

const cardsIn = (turf: Turf): Card[] => turf.stack.map((sc) => sc.card);
const toughsIn = (turf: Turf): ToughCard[] =>
  cardsIn(turf).filter((c): c is ToughCard => c.kind === 'tough');

/** Dominant affiliation = most-represented among toughs on the turf. */
function dominantAffiliation(turf: Turf): string | null {
  const counts = new Map<string, number>();
  for (const t of toughsIn(turf)) {
    counts.set(t.affiliation, (counts.get(t.affiliation) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [aff, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      best = aff;
    }
  }
  return best;
}

const LOYAL_MAP: Map<string, Set<string>> = new Map(
  affiliationsPool.affiliations.map((a) => [a.id, new Set(a.loyal ?? [])]),
);

function affiliationsAreLoyal(a: string, b: string): boolean {
  if (a === b) return true;
  return (
    (LOYAL_MAP.get(a)?.has(b) ?? false) || (LOYAL_MAP.get(b)?.has(a) ?? false)
  );
}

// ── API 1: applyTangibles ───────────────────────────────────
export function applyTangibles(
  attackerTurf: Turf,
  defenderTurf: Turf,
): TangibleBonus {
  const bonus: TangibleBonus = {
    atkPowerDelta: 0,
    defResistDelta: 0,
    sickOnHit: false,
    targetOverride: null,
    ignoreResistance: false,
  };
  for (const sc of attackerTurf.stack) {
    applyCardToBonus(sc.card, 'attacker', bonus);
  }
  for (const sc of defenderTurf.stack) {
    applyCardToBonus(sc.card, 'defender', bonus);
  }
  for (const t of toughsIn(attackerTurf)) {
    if (t.archetype === 'bruiser') bonus.ignoreResistance = true;
    if (t.archetype === 'shark' && !bonus.targetOverride) {
      bonus.targetOverride = 'bottom';
    }
    if (t.archetype === 'ghost') bonus.targetOverride = 'anywhere';
  }
  return bonus;
}

function applyCardToBonus(
  card: Card,
  cardSide: 'attacker' | 'defender',
  bonus: TangibleBonus,
): void {
  if (card.kind === 'currency') return;
  for (const ability of card.abilities) {
    const def = ABILITY_INDEX[ability];
    if (!def || !def.tangible) continue;
    if (def.onKind && def.onKind !== card.kind) continue;
    if (def.side !== cardSide && def.side !== 'self') continue;
    const t = def.tangible;
    if (t.atkPowerDelta && cardSide === 'attacker') {
      bonus.atkPowerDelta += t.atkPowerDelta;
    }
    if (t.defResistDelta && cardSide === 'defender') {
      bonus.defResistDelta += t.defResistDelta;
    }
    if (t.sickOnHit && cardSide === 'attacker') bonus.sickOnHit = true;
    if (t.targetOverride && cardSide === 'attacker') {
      bonus.targetOverride = t.targetOverride;
    }
    if (t.ignoreResistance && cardSide === 'attacker') {
      bonus.ignoreResistance = true;
    }
  }
}

// ── API 2: runIntangiblesPhase ──────────────────────────────
type IntangibleHandler = (
  state: TurfGameState,
  queued: QueuedAction,
  carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
) => IntangibleOutcome;

// Stubs — currency-driven bribe is handled by `maybeBribe`; the
// ability-tagged `bribe`/`loyaltyFlip` handlers ship with later cards.
const proceedStub = (): IntangibleOutcome => ({ kind: 'proceed' });

const INTANGIBLE_HANDLERS: Record<string, IntangibleHandler> = {
  counter: runCounter,
  bribe: proceedStub,
  loyaltyFlip: proceedStub,
  selfAttack: runSelfAttack,
};

function getTurf(
  state: TurfGameState,
  side: 'A' | 'B',
  idx: number,
): Turf | null {
  return state.players[side].turfs[idx] ?? null;
}

export function runIntangiblesPhase(
  state: TurfGameState,
  queued: QueuedAction,
): IntangibleOutcome {
  const atkSide = queued.side;
  const defSide: 'A' | 'B' = atkSide === 'A' ? 'B' : 'A';
  const attacker = getTurf(state, atkSide, queued.turfIdx);
  const defender = getTurf(state, defSide, queued.targetTurfIdx);
  if (!attacker || !defender) return { kind: 'proceed' };

  const atkByRarity = stackCardsByRarityDesc(attacker);
  const defByRarity = stackCardsByRarityDesc(defender);

  const bands: Rarity[] = ['legendary', 'rare', 'common'];
  for (const band of bands) {
    for (const sc of atkByRarity) {
      if (sc.card.rarity !== band) continue;
      const res = fireCardIntangibles(state, queued, sc, 'attacker', attacker);
      if (res.kind !== 'proceed') return res;
    }
    for (const sc of defByRarity) {
      if (sc.card.rarity !== band) continue;
      const res = fireCardIntangibles(state, queued, sc, 'defender', defender);
      if (res.kind !== 'proceed') return res;
    }
  }

  // Currency-driven bribe runs after ability intangibles (no ability string).
  const bribeOutcome = maybeBribe(state, queued);
  if (bribeOutcome.kind !== 'proceed') return bribeOutcome;

  return { kind: 'proceed' };
}

function fireCardIntangibles(
  state: TurfGameState,
  queued: QueuedAction,
  sc: StackedCard,
  carrierSide: 'attacker' | 'defender',
  carrier: Turf,
): IntangibleOutcome {
  if (sc.card.kind === 'currency' || sc.card.kind === 'tough') {
    return { kind: 'proceed' };
  }
  for (const ability of sc.card.abilities) {
    const def = ABILITY_INDEX[ability];
    if (!def || !def.intangible) continue;
    if (def.onKind && def.onKind !== sc.card.kind) continue;
    if (def.side !== carrierSide && def.side !== 'self') continue;
    const handler = INTANGIBLE_HANDLERS[def.intangible];
    if (!handler) continue;
    const carrierIdx = carrier.stack.indexOf(sc);
    const result = handler(state, queued, carrierIdx, carrierSide);
    if (result.kind !== 'proceed') return result;
  }
  return { kind: 'proceed' };
}

// ── Intangible handlers ─────────────────────────────────────
function removeFromStackAndAdjustSick(turf: Turf, idx: number): void {
  turf.stack.splice(idx, 1);
  if (turf.sickTopIdx != null) {
    if (idx === turf.sickTopIdx) turf.sickTopIdx = null;
    else if (idx < turf.sickTopIdx) turf.sickTopIdx--;
  }
}

function runCounter(
  state: TurfGameState,
  queued: QueuedAction,
  carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
): IntangibleOutcome {
  if (carrierSide !== 'defender') return { kind: 'proceed' };
  const defSide: 'A' | 'B' = queued.side === 'A' ? 'B' : 'A';
  const defender = getTurf(state, defSide, queued.targetTurfIdx);
  if (!defender || carrierIdx < 0 || carrierIdx >= defender.stack.length) {
    return { kind: 'proceed' };
  }
  removeFromStackAndAdjustSick(defender, carrierIdx);
  return { kind: 'canceled', reason: 'countered' };
}

function maybeBribe(
  state: TurfGameState,
  queued: QueuedAction,
): IntangibleOutcome {
  const defSide: 'A' | 'B' = queued.side === 'A' ? 'B' : 'A';
  const attacker = getTurf(state, queued.side, queued.turfIdx);
  const defender = getTurf(state, defSide, queued.targetTurfIdx);
  if (!attacker || !defender) return { kind: 'proceed' };

  const defCurrency = cardsIn(defender).filter(
    (c): c is CurrencyCard => c.kind === 'currency',
  );
  const total = defCurrency.reduce((s, c) => s + c.denomination, 0);
  if (total < 500) return { kind: 'proceed' };

  const atkAff = dominantAffiliation(attacker);
  const defAff = dominantAffiliation(defender);
  if (!atkAff || !defAff) return { kind: 'proceed' };
  if (!affiliationsAreLoyal(atkAff, defAff)) return { kind: 'proceed' };

  // Consume one $500+ currency card (prefer highest denomination).
  let idx = -1;
  let best = 0;
  for (let i = 0; i < defender.stack.length; i++) {
    const c = defender.stack[i].card;
    if (c.kind !== 'currency' || c.denomination < 500) continue;
    if (c.denomination > best) [best, idx] = [c.denomination, i];
  }
  if (idx < 0) return { kind: 'proceed' };
  removeFromStackAndAdjustSick(defender, idx);
  return { kind: 'canceled', reason: 'bribed' };
}

function runSelfAttack(
  state: TurfGameState,
  queued: QueuedAction,
  _carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
): IntangibleOutcome {
  if (carrierSide !== 'defender') return { kind: 'proceed' };
  const atk = state.players[queued.side];
  let weakestIdx = -1;
  let weakestPower = Number.POSITIVE_INFINITY;
  for (let i = 0; i < atk.turfs.length; i++) {
    if (i === queued.turfIdx) continue;
    const power = atk.turfs[i].stack.reduce(
      (s, sc) => (sc.card.kind === 'currency' ? s : s + sc.card.power),
      0,
    );
    if (power < weakestPower) {
      weakestPower = power;
      weakestIdx = i;
    }
  }
  if (weakestIdx < 0) return { kind: 'proceed' };
  const reason = 'self-attack';
  return { kind: 'redirected', newTargetTurfIdx: weakestIdx, reason };
}
