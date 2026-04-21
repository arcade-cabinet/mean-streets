import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generateTurfCardPools } from '../catalog';
import {
  buildAutoDeck,
  buildCollectionDeck,
  collectionPreferenceKey,
} from '../deck-builder';
import type { Card, ToughCard } from '../types';

function tough(id: string): ToughCard {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'brawler',
    affiliation: 'freelance',
    power: 5,
    resistance: 5,
    rarity: 'common',
    abilities: [],
    maxHp: 5,
    hp: 5,
  };
}

describe('buildAutoDeck', () => {
  it('builds a legal 50-card deck with minimum modifier composition', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const deck = buildAutoDeck(pools, createRng(7));

    expect(deck).toHaveLength(50);
    const toughs = deck.filter(c => c.kind === 'tough');
    const weapons = deck.filter(c => c.kind === 'weapon');
    const drugs = deck.filter(c => c.kind === 'drug');
    const currency = deck.filter(c => c.kind === 'currency');

    expect(toughs).toHaveLength(25);
    expect(weapons.length + drugs.length + currency.length).toBe(25);
    expect(weapons.length).toBeGreaterThanOrEqual(3);
    expect(drugs.length).toBeGreaterThanOrEqual(3);
    expect(currency.length).toBeGreaterThanOrEqual(3);
  });
});

describe('buildCollectionDeck', () => {
  it('excludes disabled cards from the live draw pile', () => {
    const deck = buildCollectionDeck(
      [tough('enabled'), tough('disabled')],
      createRng(42),
      [
        { cardId: 'enabled', enabled: true, priority: 5 },
        { cardId: 'disabled', enabled: false, priority: 10 },
      ],
    );

    expect(deck.map((card) => card.id)).toEqual(['enabled']);
  });

  it('biases higher-priority cards toward earlier draw positions', () => {
    const collection: Card[] = [tough('high'), tough('low-a'), tough('low-b')];
    let highIndexTotal = 0;
    let lowIndexTotal = 0;

    for (let seed = 1; seed <= 200; seed++) {
      const deck = buildCollectionDeck(collection, createRng(seed), [
        { cardId: 'high', enabled: true, priority: 10 },
        { cardId: 'low-a', enabled: true, priority: 1 },
        { cardId: 'low-b', enabled: true, priority: 1 },
      ]);
      highIndexTotal += deck.findIndex((card) => card.id === 'high');
      lowIndexTotal += deck.findIndex((card) => card.id === 'low-a');
      lowIndexTotal += deck.findIndex((card) => card.id === 'low-b');
    }

    const highAverage = highIndexTotal / 200;
    const lowAverage = lowIndexTotal / 400;
    expect(highAverage).toBeLessThan(lowAverage);
  });

  it('treats rolled-rarity buckets of the same card as separate preference targets', () => {
    const common = tough('card-001');
    const legendary = { ...tough('card-001'), rarity: 'legendary' as const };

    const deck = buildCollectionDeck(
      [common, legendary],
      createRng(42),
      [
        {
          cardId: collectionPreferenceKey(common),
          enabled: false,
          priority: 5,
        },
        {
          cardId: collectionPreferenceKey(legendary),
          enabled: true,
          priority: 10,
        },
      ],
    );

    expect(deck).toEqual([legendary]);
  });
});
