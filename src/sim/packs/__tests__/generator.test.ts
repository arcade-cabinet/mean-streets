import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generatePack, starterGrant, matchRewardPacks } from '../generator';
import type { Card } from '../../turf/types';

describe('generatePack', () => {
  const rng = () => createRng(42);
  const emptyCollection: Card[] = [];

  it('tough-5 produces 5 tough cards', () => {
    const cards = generatePack('tough-5', emptyCollection, rng());
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.kind).toBe('tough');
    }
  });

  it('weapon-5 produces 5 weapon cards', () => {
    const cards = generatePack('weapon-5', emptyCollection, rng());
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.kind).toBe('weapon');
    }
  });

  it('drug-5 produces 5 drug cards', () => {
    const cards = generatePack('drug-5', emptyCollection, rng());
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.kind).toBe('drug');
    }
  });

  it('currency-5 produces 5 currency cards', () => {
    const cards = generatePack('currency-5', emptyCollection, rng());
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.kind).toBe('currency');
    }
  });

  it('single produces 1 card', () => {
    const cards = generatePack('single', emptyCollection, rng());
    expect(cards).toHaveLength(1);
  });

  it('triple produces 3 cards', () => {
    const cards = generatePack('triple', emptyCollection, rng());
    expect(cards).toHaveLength(3);
  });

  it('rolled rarity skews low at easy difficulty', () => {
    const counts: Record<string, number> = {
      common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
    };
    const r = createRng(12345);
    for (let i = 0; i < 200; i++) {
      const cards = generatePack('tough-5', emptyCollection, r, { unlockDifficulty: 'easy' });
      for (const c of cards) counts[c.rarity]++;
    }
    const total = counts.common + counts.uncommon + counts.rare + counts.legendary;
    expect(total).toBeGreaterThan(0);
    // Commons + uncommons should dominate easy-difficulty rolls.
    expect((counts.common + counts.uncommon) / total).toBeGreaterThan(0.5);
    expect(counts.mythic).toBe(0);
  });

  it('high-difficulty multiplier boosts roll-up probability', () => {
    const easyCounts: Record<string, number> = {
      common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
    };
    const ultraCounts: Record<string, number> = {
      common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
    };

    for (let seed = 1; seed <= 100; seed++) {
      const easy = generatePack('tough-5', emptyCollection, createRng(seed), { unlockDifficulty: 'easy' });
      for (const c of easy) easyCounts[c.rarity]++;

      const ultra = generatePack('tough-5', emptyCollection, createRng(seed), {
        unlockDifficulty: 'ultra-nightmare',
      });
      for (const c of ultra) ultraCounts[c.rarity]++;
    }

    const easyTotal = easyCounts.common + easyCounts.uncommon + easyCounts.rare + easyCounts.legendary;
    const ultraTotal = ultraCounts.common + ultraCounts.uncommon + ultraCounts.rare + ultraCounts.legendary;
    const easyHigh = (easyCounts.rare + easyCounts.legendary) / easyTotal;
    const ultraHigh = (ultraCounts.rare + ultraCounts.legendary) / ultraTotal;
    expect(ultraHigh).toBeGreaterThanOrEqual(easyHigh);
  });

  it('is deterministic with the same seed', () => {
    const a = generatePack('tough-5', emptyCollection, createRng(99));
    const b = generatePack('tough-5', emptyCollection, createRng(99));
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });
});

describe('starterGrant', () => {
  it('produces starter collection: 20 toughs + 5 weapons + 5 drugs + 5 currency', () => {
    const cards = starterGrant(createRng(42));
    const toughs = cards.filter(c => c.kind === 'tough');
    const weapons = cards.filter(c => c.kind === 'weapon');
    const drugs = cards.filter(c => c.kind === 'drug');
    const currency = cards.filter(c => c.kind === 'currency');

    expect(toughs).toHaveLength(20);
    expect(weapons).toHaveLength(5);
    expect(drugs).toHaveLength(5);
    expect(currency).toHaveLength(5);
    expect(cards).toHaveLength(35);
  });
});

describe('matchRewardPacks', () => {
  it('returns empty array on loss', () => {
    expect(matchRewardPacks('medium', false, false)).toEqual([]);
  });

  it('returns base rewards on win without sudden death', () => {
    const rewards = matchRewardPacks('medium', false, true);
    expect(rewards.length).toBeGreaterThan(0);
    expect(rewards[0].kind).toBe('triple');
  });

  it('ignores deprecated sudden-death flag (returns base rewards)', () => {
    const base = matchRewardPacks('medium', false, true);
    const sd = matchRewardPacks('medium', true, true);
    expect(sd).toEqual(base);
  });

  it('returns larger rewards for harder difficulties', () => {
    const easyRewards = matchRewardPacks('easy', false, true);
    const nightmareRewards = matchRewardPacks('nightmare', false, true);
    const easyTotal = easyRewards.reduce((sum, r) => sum + r.count, 0);
    const nightmareTotal = nightmareRewards.reduce((sum, r) => sum + r.count, 0);
    expect(nightmareTotal).toBeGreaterThanOrEqual(easyTotal);
  });
});
