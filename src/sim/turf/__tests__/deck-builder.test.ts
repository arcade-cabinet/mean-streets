import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generateTurfCardPools } from '../catalog';
import { buildAutoDeck } from '../deck-builder';

describe('buildAutoDeck', () => {
  it('builds a legal 25/25 deck with minimum modifier composition', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const deck = buildAutoDeck(pools, createRng(7));

    expect(deck.crew).toHaveLength(25);
    expect(deck.modifiers).toHaveLength(25);
    expect(deck.backpacks).toHaveLength(12);
    expect(deck.modifiers.filter(card => card.type === 'weapon').length).toBeGreaterThanOrEqual(3);
    expect(deck.modifiers.filter(card => card.type === 'product').length).toBeGreaterThanOrEqual(3);
    expect(deck.modifiers.filter(card => card.type === 'cash').length).toBeGreaterThanOrEqual(3);
    expect(deck.backpacks.every(card => card.payload.length >= 2 && card.payload.length <= 4)).toBe(true);
  });
});
