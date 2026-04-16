import { describe, expect, it } from 'vitest';
import { loadToughCards, loadStarterToughCards } from './catalog';

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
});
