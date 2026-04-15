import { describe, expect, it } from 'vitest';
import { loadAuthoredCrewCards, loadStarterCrewCards } from './catalog';

describe('loadAuthoredCrewCards', () => {
  it('loads the authored production crew pool from cards.json', () => {
    const cards = loadAuthoredCrewCards();

    expect(cards).toHaveLength(100);
    // Identity-only checks: stats live in tuning history and may shift
    // between autobalance runs, so we don't pin the numeric values here.
    expect(cards[0]).toMatchObject({
      id: 'card-001',
      displayName: 'Ana "Thorn" Reyes',
      archetype: 'bruiser',
      affiliation: 'kings_row',
      abilityText:
        'Deals +2 damage when attacking a target with lower ATK than this card',
      unlocked: true,
      locked: false,
    });
    // Stats stay positive integers within the schema range.
    expect(cards[0]?.power).toBeGreaterThanOrEqual(1);
    expect(cards[0]?.power).toBeLessThanOrEqual(12);
    expect(cards[0]?.resistance).toBeGreaterThanOrEqual(1);
    expect(cards[0]?.resistance).toBeLessThanOrEqual(12);
    expect(cards[2]).toMatchObject({
      id: 'card-003',
      displayName: 'Zhao "Lookout" Sullivan',
      archetype: 'lookout',
      affiliation: 'reapers',
    });
  });

  it('preserves the intended starter unlock boundary', () => {
    const cards = loadStarterCrewCards(25);

    expect(cards.slice(0, 25).every((card) => card.unlocked)).toBe(true);
    expect(cards.slice(25).some((card) => !card.unlocked)).toBe(true);
  });
});
