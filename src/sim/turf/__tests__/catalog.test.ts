import { describe, expect, it } from 'vitest';
import { loadStarterToughCards, loadToughCards } from '../../cards/catalog';
import { generateTurfCardPools } from '../catalog';

describe('generateTurfCardPools', () => {
  it('uses the starter tough pool by default', () => {
    const pools = generateTurfCardPools(42);

    expect(pools.crew).toHaveLength(loadStarterToughCards().length);
    expect(pools.crew.map((card) => card.id)).toEqual(
      loadStarterToughCards().map((card) => card.id),
    );
  });

  it('uses the full authored tough catalog when allUnlocked is true', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const allToughs = loadToughCards();

    expect(pools.crew).toHaveLength(allToughs.length);
    expect(pools.crew.map((card) => card.id)).toEqual(
      allToughs.map((card) => card.id),
    );
    expect(pools.crew.some((card) => card.id === 'card-100')).toBe(true);
  });
});
