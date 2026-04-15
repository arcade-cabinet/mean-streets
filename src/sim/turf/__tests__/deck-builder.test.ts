import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generateTurfCardPools } from '../catalog';
import { buildAutoDeck } from '../deck-builder';

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
