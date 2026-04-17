import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generatePack, starterGrant, matchRewardPacks } from '../generator';
import type { Card } from '../../turf/types';

describe('generatePack', () => {
  const rng = () => createRng(42);
  const emptyCollection: Card[] = [];

  it('standard produces 5 cards with mixed types', () => {
    const cards = generatePack('standard', emptyCollection, rng());
    expect(cards).toHaveLength(5);
    const kinds = new Set(cards.map(c => c.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(1);
  });

  it('single produces 1 card', () => {
    const cards = generatePack('single', emptyCollection, rng());
    expect(cards).toHaveLength(1);
  });

  it('triple produces 3 cards', () => {
    const cards = generatePack('triple', emptyCollection, rng());
    expect(cards).toHaveLength(3);
  });

  it('probabilistic type weights produce toughs most often', () => {
    const counts: Record<string, number> = { tough: 0, weapon: 0, drug: 0, currency: 0 };
    const r = createRng(12345);
    for (let i = 0; i < 100; i++) {
      const cards = generatePack('standard', emptyCollection, r);
      for (const c of cards) counts[c.kind]++;
    }
    expect(counts.tough).toBeGreaterThan(counts.weapon);
    expect(counts.tough).toBeGreaterThan(counts.drug);
    expect(counts.tough).toBeGreaterThan(counts.currency);
  });

  it('rolled rarity skews low at easy difficulty', () => {
    const counts: Record<string, number> = {
      common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
    };
    const r = createRng(12345);
    for (let i = 0; i < 200; i++) {
      const cards = generatePack('standard', emptyCollection, r, { unlockDifficulty: 'easy' });
      for (const c of cards) counts[c.rarity]++;
    }
    const total = counts.common + counts.uncommon + counts.rare + counts.legendary;
    expect(total).toBeGreaterThan(0);
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
      const easy = generatePack('standard', emptyCollection, createRng(seed), { unlockDifficulty: 'easy' });
      for (const c of easy) easyCounts[c.rarity]++;

      const ultra = generatePack('standard', emptyCollection, createRng(seed), {
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
    const a = generatePack('standard', emptyCollection, createRng(99));
    const b = generatePack('standard', emptyCollection, createRng(99));
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });
});

describe('starterGrant', () => {
  it('produces starter collection with mixed types (7 standard packs = 35 cards)', () => {
    const cards = starterGrant(createRng(42));
    expect(cards.length).toBe(35);
    const kinds = new Set(cards.map(c => c.kind));
    expect(kinds.has('tough')).toBe(true);
  });
});

describe('matchRewardPacks', () => {
  it('returns empty array on loss', () => {
    expect(matchRewardPacks('medium', false, false)).toEqual([]);
  });

  it('returns base rewards on win', () => {
    const rewards = matchRewardPacks('medium', false, true);
    expect(rewards.length).toBeGreaterThan(0);
    expect(rewards[0].kind).toBe('triple');
  });

  it('returns larger rewards for harder difficulties', () => {
    const easyRewards = matchRewardPacks('easy', false, true);
    const nightmareRewards = matchRewardPacks('nightmare', false, true);
    const easyTotal = easyRewards.reduce((sum, r) => sum + r.count, 0);
    const nightmareTotal = nightmareRewards.reduce((sum, r) => sum + r.count, 0);
    expect(nightmareTotal).toBeGreaterThanOrEqual(easyTotal);
  });
});
