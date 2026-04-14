import type { ModifierCard } from '../../sim/turf/types';

export interface ModifierComposition {
  weapon: number;
  product: number;
  cash: number;
}

export const MODIFIER_MINIMUMS: ModifierComposition = {
  weapon: 3,
  product: 3,
  cash: 3,
};

export function countModifierComposition(cards: ModifierCard[]): ModifierComposition {
  return cards.reduce<ModifierComposition>((counts, card) => {
    counts[card.type] += 1;
    return counts;
  }, { weapon: 0, product: 0, cash: 0 });
}

export function hasValidModifierComposition(cards: ModifierCard[]): boolean {
  const counts = countModifierComposition(cards);
  return counts.weapon >= MODIFIER_MINIMUMS.weapon
    && counts.product >= MODIFIER_MINIMUMS.product
    && counts.cash >= MODIFIER_MINIMUMS.cash;
}
