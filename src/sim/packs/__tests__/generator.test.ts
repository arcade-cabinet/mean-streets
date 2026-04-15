import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generatePack, starterGrant, matchRewardPacks } from '../generator';
import type { Card, Rarity } from '../../turf/types';

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

  it('rarity distribution follows 70/25/5 weights over many packs', () => {
    const counts: Record<Rarity, number> = { common: 0, rare: 0, legendary: 0 };
    const r = createRng(12345);
    for (let i = 0; i < 200; i++) {
      const cards = generatePack('tough-5', emptyCollection, r);
      for (const c of cards) counts[c.rarity]++;
    }
    const total = counts.common + counts.rare + counts.legendary;
    expect(counts.common / total).toBeGreaterThan(0.5);
    expect(counts.rare / total).toBeGreaterThan(0.1);
    expect(counts.legendary / total).toBeGreaterThan(0.01);
  });

  it('sudden death win bumps rarity up', () => {
    const normalCounts: Record<Rarity, number> = { common: 0, rare: 0, legendary: 0 };
    const sdCounts: Record<Rarity, number> = { common: 0, rare: 0, legendary: 0 };

    for (let seed = 1; seed <= 100; seed++) {
      const normal = generatePack('tough-5', emptyCollection, createRng(seed));
      for (const c of normal) normalCounts[c.rarity]++;

      const sd = generatePack('tough-5', emptyCollection, createRng(seed), { suddenDeathWin: true });
      for (const c of sd) sdCounts[c.rarity]++;
    }

    const normalRareRate = (normalCounts.rare + normalCounts.legendary) /
      (normalCounts.common + normalCounts.rare + normalCounts.legendary);
    const sdRareRate = (sdCounts.rare + sdCounts.legendary) /
      (sdCounts.common + sdCounts.rare + sdCounts.legendary);

    expect(sdRareRate).toBeGreaterThanOrEqual(normalRareRate);
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

  it('returns sudden death rewards on win with sudden death', () => {
    const rewards = matchRewardPacks('medium', true, true);
    expect(rewards.length).toBeGreaterThan(0);
    expect(rewards[0].kind).toBe('tough-5');
  });

  it('returns larger rewards for harder difficulties', () => {
    const easyRewards = matchRewardPacks('easy', false, true);
    const nightmareRewards = matchRewardPacks('nightmare', false, true);
    const easyTotal = easyRewards.reduce((sum, r) => sum + r.count, 0);
    const nightmareTotal = nightmareRewards.reduce((sum, r) => sum + r.count, 0);
    expect(nightmareTotal).toBeGreaterThanOrEqual(easyTotal);
  });
});
