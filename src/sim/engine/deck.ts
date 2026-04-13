/**
 * Deck building and card utilities.
 * Creates shuffled decks from gang definitions.
 */

import type { CardData, GangData } from '../schemas';

/** Fisher-Yates shuffle — mutates in place, returns same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Create a shuffled copy of a gang's card definitions. */
export function buildDeck(gang: GangData): CardData[] {
  return shuffle([...gang.cards]);
}

/** Get a card's ATK value for the current phase. */
export function getAtk(card: CardData, isNight: boolean): number {
  return isNight ? card.nightAtk : card.dayAtk;
}

/** Get a card's DEF value for the current phase. */
export function getDef(card: CardData, isNight: boolean): number {
  return isNight ? card.nightDef : card.dayDef;
}

/**
 * Get effective attack damage including gang passive.
 * BRUTAL passive adds flat damage to all attacks.
 */
export function getEffectiveAtk(
  card: CardData,
  isNight: boolean,
  passiveType: string,
  passiveValue: number,
): number {
  const base = getAtk(card, isNight);
  if (passiveType === 'BRUTAL') return base + passiveValue;
  return base;
}

/**
 * Check precision rule: can this card attack the target?
 * ATK must be <= target's current HP * precision multiplier.
 */
export function canPrecisionAttack(
  effectiveAtk: number,
  targetHp: number,
  precisionMult: number,
): boolean {
  return effectiveAtk <= targetHp * precisionMult;
}
