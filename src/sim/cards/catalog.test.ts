import { describe, expect, it } from 'vitest';
import {
  loadCollectibleCards,
  loadCompiledMythics,
  loadCompiledToughs,
  loadMythicPoolIds,
  loadStarterToughCards,
  loadToughCards,
} from './catalog';

describe('loadToughCards', () => {
  it('loads the authored production tough pool from compiled JSON', () => {
    const cards = loadToughCards();

    expect(cards).toHaveLength(100);
    expect(cards[0]).toMatchObject({
      kind: 'tough',
      id: 'card-001',
      name: 'Ana "Thorn" Reyes',
      archetype: 'bruiser',
      affiliation: 'kings_row',
    });
    expect(cards[0]?.power).toBeGreaterThanOrEqual(1);
    expect(cards[0]?.power).toBeLessThanOrEqual(12);
    expect(cards[0]?.resistance).toBeGreaterThanOrEqual(1);
    expect(cards[0]?.resistance).toBeLessThanOrEqual(12);
    expect(cards[2]).toMatchObject({
      kind: 'tough',
      id: 'card-003',
      name: 'Zhao "Lookout" Sullivan',
      archetype: 'lookout',
      affiliation: 'reapers',
    });
  });

  it('returns the first N cards as starters', () => {
    const cards = loadStarterToughCards(25);
    expect(cards).toHaveLength(25);
    expect(cards.every((card) => card.kind === 'tough')).toBe(true);
  });

  it('returns fresh compiled card copies including portraits', () => {
    const [first] = loadCompiledToughs();
    const [second] = loadCompiledToughs();

    expect(first).not.toBe(second);
    expect(first.portrait).not.toBe(second.portrait);

    first.abilities.push('MUTATED');
    if (first.portrait.layers) {
      first.portrait.layers.body = 'tampered';
    }

    expect(second.abilities).not.toContain('MUTATED');
    if (second.portrait.layers) {
      expect(second.portrait.layers.body).not.toBe('tampered');
    }
  });
});

describe('mythic catalog helpers', () => {
  it('includes mythics in the full collectible catalog', () => {
    const cards = loadCollectibleCards();
    const mythics = cards.filter((card) => card.rarity === 'mythic');

    expect(cards).toHaveLength(213);
    expect(mythics).toHaveLength(10);
    expect(mythics.every((card) => card.kind === 'tough')).toBe(true);
    expect(cards.some((card) => card.id === 'currency-launder')).toBe(true);
  });

  it('returns fresh collectible card copies from the cached catalog', () => {
    const [first] = loadCollectibleCards();
    const [second] = loadCollectibleCards();

    expect(first).not.toBe(second);
    if (first.kind !== 'currency' && second.kind !== 'currency') {
      first.abilities.push('MUTATED');
      expect(second.abilities).not.toContain('MUTATED');
    }
  });

  it('loads mythic pool ids from the compiled mythic catalog', () => {
    const ids = loadMythicPoolIds();

    expect(ids).toHaveLength(10);
    expect(ids.every((id) => /^mythic-\d{2}$/.test(id))).toBe(true);
    expect(ids).toEqual(loadCompiledMythics().map((card) => card.id));
  });

  it('returns fresh compiled mythic copies including portraits', () => {
    const [first] = loadCompiledMythics();
    const [second] = loadCompiledMythics();

    expect(first).not.toBe(second);
    expect(first.portrait).not.toBe(second.portrait);

    first.abilities.push('MUTATED');
    first.portrait.sprite = 'tampered';

    expect(second.abilities).not.toContain('MUTATED');
    expect(second.portrait.sprite).not.toBe('tampered');
  });
});
