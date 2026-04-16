/**
 * Ability effect registry — paired with `abilities.ts` (Epic D).
 *
 * Flat tangible & intangible rules keyed by authored ability string
 * (`LACERATE`, `PARRY`, `BULK`…). `abilities.ts` walks every card on
 * the combat stacks and dispatches here for both phases.
 *
 * Adding a new ability:
 *   1. Append a row to `ABILITY_INDEX` below.
 *   2. If intangible, name an existing handler or add one in
 *      `abilities.ts#INTANGIBLE_HANDLERS`.
 *   3. Update `src/data/ai/turf-sim.json` only if it changes balance.
 */

import type { Card } from './types';

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
  | 'selfAttack';

export type AbilitySide = 'attacker' | 'defender' | 'self';

export interface AbilityDef {
  kind: 'tangible' | 'intangible' | 'both';
  /** Where the card must sit for the effect to apply. */
  side: AbilitySide;
  /** Optional card-kind gate (weapon/drug/tough). */
  onKind?: Card['kind'];
  tangible?: TangibleDelta;
  /** Intangible handler ID — wired in abilities.ts. */
  intangible?: IntangibleHandlerId;
}

export const ABILITY_INDEX: Record<string, AbilityDef> = {
  // Weapons — tangible
  LACERATE: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },
  REACH: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },
  OVERWATCH: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },
  BRACE: {
    kind: 'tangible',
    side: 'defender',
    onKind: 'weapon',
    tangible: { defResistDelta: 1 },
  },
  SHATTER: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },
  AMBUSH: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },
  BLAST: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'weapon',
    tangible: { atkPowerDelta: 1 },
  },

  // Weapons — intangible
  PARRY: {
    kind: 'intangible',
    side: 'defender',
    onKind: 'weapon',
    intangible: 'counter',
  },
  EVASION: {
    kind: 'intangible',
    side: 'defender',
    onKind: 'weapon',
    intangible: 'counter',
  },
  DETERRENT: {
    kind: 'intangible',
    side: 'defender',
    onKind: 'weapon',
    intangible: 'counter',
  },

  // Drugs — tangible
  RUSH: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'drug',
    tangible: { atkPowerDelta: 1 },
  },
  BULK: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'drug',
    tangible: { atkPowerDelta: 1, defResistDelta: 1 },
  },
  FORTIFY: {
    kind: 'tangible',
    side: 'defender',
    onKind: 'drug',
    tangible: { defResistDelta: 1 },
  },
  SUPPRESS: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'drug',
    tangible: { atkPowerDelta: 1 },
  },
  REFLEXES: {
    kind: 'tangible',
    side: 'defender',
    onKind: 'drug',
    tangible: { defResistDelta: 1 },
  },
  BERSERK: {
    kind: 'tangible',
    side: 'attacker',
    onKind: 'drug',
    tangible: { atkPowerDelta: 2, sickOnHit: true },
  },
  PAINKILLERS: {
    kind: 'tangible',
    side: 'defender',
    onKind: 'drug',
    tangible: { defResistDelta: 1 },
  },
  NUMB: {
    kind: 'tangible',
    side: 'defender',
    onKind: 'drug',
    tangible: { defResistDelta: 1 },
  },

  // Drugs — intangible (selfAttack fires only if another attacker turf exists)
  CONFUSE: {
    kind: 'intangible',
    side: 'defender',
    onKind: 'drug',
    intangible: 'selfAttack',
  },
  PARANOIA: {
    kind: 'intangible',
    side: 'defender',
    onKind: 'drug',
    intangible: 'selfAttack',
  },
};
