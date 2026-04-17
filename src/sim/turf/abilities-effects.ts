/**
 * Ability effect registry — paired with `abilities.ts` (Epic D / v0.3).
 *
 * Flat tangible & intangible rules keyed by authored ability string.
 * `abilities.ts` walks every card on the combat stacks and dispatches
 * here for both phases.
 *
 * Adding a new ability:
 *   1. Append a row to `ABILITY_INDEX` below.
 *   2. If intangible, name an existing handler in
 *      `abilities.ts#INTANGIBLE_HANDLERS` or add one there.
 *   3. Update `src/data/ai/turf-sim.json` only if it changes balance.
 */
import type { Card, Rarity } from './types';

export type TangibleDelta = {
  atkPowerDelta?: number;
  defResistDelta?: number;
  sickOnHit?: boolean;
  targetOverride?: 'bottom' | 'anywhere';
  ignoreResistance?: boolean;
};

export type IntangibleHandlerId =
  | 'counter'
  | 'bribe'
  | 'loyaltyFlip'
  | 'selfAttack'
  | 'cleanSlate'
  | 'buildTurf'
  | 'strikeRetreated'
  | 'immunity'
  | 'noReveal'
  | 'transcend'
  | 'insight'
  | 'absolute'
  | 'strikeTwo'
  | 'chainThree'
  | 'patchup'
  | 'fieldMedic'
  | 'resuscitate'
  | 'launder'
  | 'lowProfile';

export type AbilitySide = 'attacker' | 'defender' | 'self';
export type AbilityKind = 'tangible' | 'intangible' | 'both' | 'passive';

export interface AbilityDef {
  kind: AbilityKind;
  side: AbilitySide;
  onKind?: Card['kind'];
  tangible?: TangibleDelta;
  intangible?: IntangibleHandlerId;
}

/** Rarity scaling multipliers (§11). */
export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.3,
  legendary: 1.5,
  mythic: 1.7,
};

/** Scale every numeric field in a TangibleDelta by the rolled rarity. */
export function scaleDelta(
  delta: TangibleDelta,
  rarity: Rarity,
): TangibleDelta {
  const m = RARITY_MULT[rarity];
  const out: TangibleDelta = {};
  if (delta.atkPowerDelta)
    out.atkPowerDelta = Math.round(delta.atkPowerDelta * m);
  if (delta.defResistDelta)
    out.defResistDelta = Math.round(delta.defResistDelta * m);
  if (delta.sickOnHit) out.sickOnHit = true;
  if (delta.targetOverride) out.targetOverride = delta.targetOverride;
  if (delta.ignoreResistance) out.ignoreResistance = true;
  return out;
}

// ── Registry builders ───────────────────────────────────────
const atk = (atkPowerDelta: number): TangibleDelta => ({ atkPowerDelta });
const def = (defResistDelta: number): TangibleDelta => ({ defResistDelta });
const T = (
  side: AbilitySide,
  onKind: Card['kind'],
  tangible: TangibleDelta,
): AbilityDef => ({ kind: 'tangible', side, onKind, tangible });
const I = (
  side: AbilitySide,
  onKind: Card['kind'],
  intangible: IntangibleHandlerId,
): AbilityDef => ({ kind: 'intangible', side, onKind, intangible });
const P = (
  side: AbilitySide,
  onKind: Card['kind'],
  intangible: IntangibleHandlerId,
): AbilityDef => ({ kind: 'passive', side, onKind, intangible });

export const ABILITY_INDEX: Record<string, AbilityDef> = {
  // ── Weapons — tangible ───────────────────────────────────
  LACERATE: T('attacker', 'weapon', atk(1)),
  REACH: T('attacker', 'weapon', atk(1)),
  OVERWATCH: T('attacker', 'weapon', atk(1)),
  BRACE: T('defender', 'weapon', def(1)),
  SHATTER: T('attacker', 'weapon', atk(1)),
  AMBUSH: T('attacker', 'weapon', atk(1)),
  BLAST: T('attacker', 'weapon', atk(1)),

  // ── Weapons — intangible ─────────────────────────────────
  PARRY: I('defender', 'weapon', 'counter'),
  EVASION: I('defender', 'weapon', 'counter'),
  DETERRENT: I('defender', 'weapon', 'counter'),

  // ── Drugs — tangible ─────────────────────────────────────
  RUSH: T('attacker', 'drug', atk(1)),
  BULK: T('attacker', 'drug', { atkPowerDelta: 1, defResistDelta: 1 }),
  FORTIFY: T('defender', 'drug', def(1)),
  SUPPRESS: T('attacker', 'drug', atk(1)),
  REFLEXES: T('defender', 'drug', def(1)),
  BERSERK: T('attacker', 'drug', { atkPowerDelta: 2, sickOnHit: true }),
  PAINKILLERS: T('defender', 'drug', def(1)),
  NUMB: T('defender', 'drug', def(1)),

  // ── Drugs — intangible (selfAttack needs ≥ 2 attacker turfs) ─
  CONFUSE: I('defender', 'drug', 'selfAttack'),
  PARANOIA: I('defender', 'drug', 'selfAttack'),

  // ── Healing chain (§7) ───────────────────────────────────
  PATCHUP: I('self', 'drug', 'patchup'),
  FIELD_MEDIC: I('self', 'tough', 'fieldMedic'),
  RESUSCITATE: I('self', 'drug', 'resuscitate'),

  // ── Heat relief (§10.1) ──────────────────────────────────
  LAUNDER: P('self', 'currency', 'launder'),
  LOW_PROFILE: P('self', 'drug', 'lowProfile'),

  // ── Mythic signatures (§11) ──────────────────────────────
  STRIKE_TWO: I('attacker', 'tough', 'strikeTwo'),
  CLEAN_SLATE: I('self', 'tough', 'cleanSlate'),
  BUILD_TURF: I('self', 'tough', 'buildTurf'),
  INSIGHT: P('self', 'tough', 'insight'),
  STRIKE_RETREATED: I('attacker', 'tough', 'strikeRetreated'),
  CHAIN_THREE: I('attacker', 'tough', 'chainThree'),
  TRANSCEND: P('self', 'tough', 'transcend'),
  IMMUNITY: P('self', 'tough', 'immunity'),
  NO_REVEAL: P('self', 'tough', 'noReveal'),
  ABSOLUTE: I('attacker', 'tough', 'absolute'),
};
