// Passive-ability query hooks — read by scoring, heat, UI layers.
// Paired with abilities.ts / abilities-effects.ts (Epic D / v0.3).
// These are pure lookups; mutating handlers live in abilities.ts.
import type { CurrencyCard, ToughCard, Turf, TurfGameState } from './types';

const hasOnTough = (t: ToughCard | null | undefined, a: string): boolean =>
  !!t && t.abilities.includes(a);

export const hasImmunity = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'IMMUNITY');
export const hasNoReveal = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'NO_REVEAL');
export const hasTranscend = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'TRANSCEND');
export const hasStrikeTwo = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'STRIKE_TWO');
export const hasChainThree = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'CHAIN_THREE');
export const hasAbsolute = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'ABSOLUTE');
export const hasLowProfile = (t: ToughCard | null | undefined) =>
  hasOnTough(t, 'LOW_PROFILE');

export function cardHasLaunder(
  card: { abilities?: string[] } | null | undefined,
): boolean {
  const abilities = card?.abilities;
  if (!abilities) return false;
  return abilities.includes('LAUNDER') || abilities.includes('launder');
}

/**
 * LAUNDER currency preserves its heat-relief role and is excluded from
 * turf-wide bribe spend pools so the effect cannot silently delete itself.
 */
export function isBribeSpendableCurrency(
  card: CurrencyCard | null | undefined,
): boolean {
  return !!card && !cardHasLaunder(card);
}

/** LAUNDER — legendary currency ability; scan all cards in the stack for the tag. */
export function hasLaunder(turf: Turf | null | undefined): boolean {
  if (!turf) return false;
  for (const sc of turf.stack) {
    if (cardHasLaunder(sc.card)) return true;
  }
  return false;
}

/** INSIGHT — does this side see per-card heat breakdown of the opponent? */
export function hasInsight(state: TurfGameState, side: 'A' | 'B'): boolean {
  for (const turf of state.players[side].turfs) {
    for (const sc of turf.stack) {
      if (sc.card.kind === 'tough' && sc.card.abilities.includes('INSIGHT')) {
        return true;
      }
    }
  }
  return false;
}
