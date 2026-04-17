// Abilities — Epic D (Kira) / v0.3. APIs: applyTangibles, runIntangiblesPhase.
// Intangibles fire mythic → legendary → rare → uncommon → common,
// attacker-then-defender. Classification + rarity scaling live in
// abilities-effects.ts; handler bodies live in ability-handlers.ts;
// passive query hooks live in ability-hooks.ts.
import { ABILITY_INDEX, scaleDelta } from './abilities-effects';
import {
  maybeBribe,
  proceed,
  runBuildTurf,
  runCleanSlate,
  runCounter,
  runSelfAttack,
  runStrikeRetreated,
} from './ability-handlers';
import type {
  Card,
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
  | {
      kind: 'redirected';
      newTargetTurfIdx: number;
      newTargetStackIdx?: number;
      reason: string;
    };

const RARITY_ORDER: Record<Rarity, number> = {
  mythic: 5,
  legendary: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

export function stackCardsByRarityDesc(turf: Turf): StackedCard[] {
  return turf.stack
    .map((sc, i) => ({ sc, i }))
    .sort((a, b) => {
      const d = RARITY_ORDER[b.sc.card.rarity] - RARITY_ORDER[a.sc.card.rarity];
      return d !== 0 ? d : a.i - b.i;
    })
    .map((e) => e.sc);
}

const toughsIn = (turf: Turf): ToughCard[] =>
  turf.stack
    .map((sc) => sc.card)
    .filter((c): c is ToughCard => c.kind === 'tough');

// ── API 1: applyTangibles (rarity-aware) ────────────────────
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
  for (const sc of attackerTurf.stack)
    applyCardToBonus(sc.card, 'attacker', bonus);
  for (const sc of defenderTurf.stack)
    applyCardToBonus(sc.card, 'defender', bonus);
  for (const t of toughsIn(attackerTurf)) {
    if (t.archetype === 'bruiser') bonus.ignoreResistance = true;
    if (t.archetype === 'shark' && !bonus.targetOverride)
      bonus.targetOverride = 'bottom';
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
    const t = scaleDelta(def.tangible, card.rarity);
    if (t.atkPowerDelta && cardSide === 'attacker')
      bonus.atkPowerDelta += t.atkPowerDelta;
    if (t.defResistDelta && cardSide === 'defender')
      bonus.defResistDelta += t.defResistDelta;
    if (t.sickOnHit && cardSide === 'attacker') bonus.sickOnHit = true;
    if (t.targetOverride && cardSide === 'attacker')
      bonus.targetOverride = t.targetOverride;
    if (t.ignoreResistance && cardSide === 'attacker')
      bonus.ignoreResistance = true;
  }
}

// ── API 2: runIntangiblesPhase ──────────────────────────────
type IntangibleHandler = (
  state: TurfGameState,
  queued: QueuedAction,
  carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
  carrierCard: Card,
) => IntangibleOutcome;

// Passive-only abilities (query hooks) dispatch to proceed-stubs.
const INTANGIBLE_HANDLERS: Record<string, IntangibleHandler> = {
  counter: runCounter,
  bribe: proceed,
  loyaltyFlip: proceed,
  selfAttack: runSelfAttack,
  cleanSlate: runCleanSlate,
  buildTurf: runBuildTurf,
  strikeRetreated: runStrikeRetreated,
  strikeTwo: proceed,
  chainThree: proceed,
  absolute: proceed,
  immunity: proceed,
  noReveal: proceed,
  transcend: proceed,
  insight: proceed,
  patchup: proceed,
  fieldMedic: proceed,
  resuscitate: proceed,
  launder: proceed,
  lowProfile: proceed,
};

export function runIntangiblesPhase(
  state: TurfGameState,
  queued: QueuedAction,
): IntangibleOutcome {
  const defSide: 'A' | 'B' = queued.side === 'A' ? 'B' : 'A';
  const attacker = state.players[queued.side].turfs[queued.turfIdx];
  const defender = state.players[defSide].turfs[queued.targetTurfIdx];
  if (!attacker || !defender) return proceed();

  // Currency-pressure (bribe) fires before ability intangibles — §10.3.
  const bribe = maybeBribe(state, defender);
  if (bribe.kind !== 'proceed') return bribe;

  const atkSorted = stackCardsByRarityDesc(attacker);
  const defSorted = stackCardsByRarityDesc(defender);
  const bands: Rarity[] = ['mythic', 'legendary', 'rare', 'uncommon', 'common'];
  for (const band of bands) {
    for (const sc of atkSorted) {
      if (sc.card.rarity !== band) continue;
      const res = fireCardIntangibles(state, queued, sc, 'attacker', attacker);
      if (res.kind !== 'proceed') return res;
    }
    for (const sc of defSorted) {
      if (sc.card.rarity !== band) continue;
      const res = fireCardIntangibles(state, queued, sc, 'defender', defender);
      if (res.kind !== 'proceed') return res;
    }
  }
  return proceed();
}

function fireCardIntangibles(
  state: TurfGameState,
  queued: QueuedAction,
  sc: StackedCard,
  carrierSide: 'attacker' | 'defender',
  carrier: Turf,
): IntangibleOutcome {
  if (sc.card.kind === 'currency') return proceed();
  for (const ability of sc.card.abilities) {
    const def = ABILITY_INDEX[ability];
    if (!def || !def.intangible) continue;
    if (def.onKind && def.onKind !== sc.card.kind) continue;
    if (def.side !== carrierSide && def.side !== 'self') continue;
    const handler = INTANGIBLE_HANDLERS[def.intangible];
    if (!handler) continue;
    const carrierIdx = carrier.stack.indexOf(sc);
    const result = handler(state, queued, carrierIdx, carrierSide, sc.card);
    if (result.kind !== 'proceed') return result;
  }
  return proceed();
}

// Passive query hooks re-exported for callers importing from './abilities'.
export {
  hasAbsolute,
  hasChainThree,
  hasImmunity,
  hasInsight,
  hasLaunder,
  hasLowProfile,
  hasNoReveal,
  hasStrikeTwo,
  hasTranscend,
} from './ability-hooks';
