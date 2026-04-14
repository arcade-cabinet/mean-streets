import { describe, expect, it } from 'vitest';
import type { ModifierCard } from '../../../sim/turf/types';
import { countModifierComposition, hasValidModifierComposition } from '../rules';

let modifierIdCounter = 0;

function mod(type: ModifierCard['type']): ModifierCard {
  modifierIdCounter++;
  if (type === 'cash') return { type: 'cash', id: `cash-${modifierIdCounter}`, denomination: 100 };
  if (type === 'weapon') {
    return {
      type: 'weapon',
      id: `weapon-${modifierIdCounter}`,
      name: 'Crowbar',
      category: 'blunt',
      bonus: 2,
      offenseAbility: 'SHATTER',
      offenseAbilityText: 'shatter',
      defenseAbility: 'BRACE',
      defenseAbilityText: 'brace',
      unlocked: true,
      locked: false,
    };
  }
  return {
    type: 'product',
    id: `product-${modifierIdCounter}`,
    name: 'Velvet Static',
    category: 'sedative',
    potency: 2,
    offenseAbility: 'SUPPRESS',
    offenseAbilityText: 'suppress',
    defenseAbility: 'NUMB',
    defenseAbilityText: 'numb',
    unlocked: true,
    locked: false,
  };
}

describe('deckbuilder modifier rules', () => {
  it('counts modifier composition by subtype', () => {
    const cards = [mod('weapon'), mod('weapon'), mod('product'), mod('cash')];
    expect(countModifierComposition(cards)).toEqual({
      weapon: 2,
      product: 1,
      cash: 1,
    });
  });

  it('rejects modifier pools that miss the documented minimums', () => {
    const cards = [
      ...Array.from({ length: 22 }, () => mod('weapon')),
      ...Array.from({ length: 2 }, () => mod('product')),
      mod('cash'),
    ];
    expect(hasValidModifierComposition(cards)).toBe(false);
  });

  it('accepts legal modifier pools with at least 3 of each subtype', () => {
    const cards = [
      ...Array.from({ length: 19 }, () => mod('weapon')),
      ...Array.from({ length: 3 }, () => mod('product')),
      ...Array.from({ length: 3 }, () => mod('cash')),
    ];
    expect(hasValidModifierComposition(cards)).toBe(true);
  });
});
