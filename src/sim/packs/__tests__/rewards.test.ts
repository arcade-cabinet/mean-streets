import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  classifyTurfSeizure,
  classifyWarOutcome,
  computePerTurfRewards,
  computeRewardBundle,
  computeWarOutcomeReward,
} from '../rewards';
import type { WarStats } from '../../turf/types';

function mkStats(seizures: WarStats['seizures']): WarStats {
  return { seizures };
}

describe('classifyTurfSeizure', () => {
  it('maps 1 turn → absolute', () => {
    expect(classifyTurfSeizure(1)).toBe('absolute');
  });

  it('maps 2 turns → overwhelming', () => {
    expect(classifyTurfSeizure(2)).toBe('overwhelming');
  });

  it('maps 3 turns → decisive', () => {
    expect(classifyTurfSeizure(3)).toBe('decisive');
  });

  it('maps > 3 turns → standard', () => {
    expect(classifyTurfSeizure(4)).toBe('standard');
    expect(classifyTurfSeizure(10)).toBe('standard');
  });
});

describe('classifyWarOutcome', () => {
  it('returns null on loss', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }]);
    expect(classifyWarOutcome(stats, false, 'A')).toBeNull();
  });

  it('classifies perfect war (all absolute, no losses)', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 2, turnsOnThatTurf: 1 },
    ]);
    expect(classifyWarOutcome(stats, true, 'A')).toBe('perfect');
  });

  it('classifies flawless war (all decisive-or-better, no losses)', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 3 },
    ]);
    expect(classifyWarOutcome(stats, true, 'A')).toBe('flawless');
  });

  it('classifies dominant war (no losses, some standard)', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 5 },
    ]);
    expect(classifyWarOutcome(stats, true, 'A')).toBe('dominant');
  });

  it('classifies won war (won despite losses)', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'B', seizedTurfIdx: 1, turnsOnThatTurf: 2 },
      { seizedBy: 'A', seizedTurfIdx: 2, turnsOnThatTurf: 1 },
    ]);
    expect(classifyWarOutcome(stats, true, 'A')).toBe('won');
  });
});

describe('computePerTurfRewards', () => {
  it('produces no pack for standard seizures', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 6 }]);
    const rewards = computePerTurfRewards(stats, createRng(1));
    expect(rewards).toHaveLength(1);
    expect(rewards[0].pack).toBeNull();
    expect(rewards[0].rating).toBe('standard');
  });

  it('produces a pack per non-standard seizure', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 2 },
      { seizedBy: 'A', seizedTurfIdx: 2, turnsOnThatTurf: 3 },
    ]);
    const rewards = computePerTurfRewards(stats, createRng(42));
    expect(rewards).toHaveLength(3);
    for (const r of rewards) expect(r.pack).not.toBeNull();
    expect(rewards[0].rating).toBe('absolute');
    expect(rewards[1].rating).toBe('overwhelming');
    expect(rewards[2].rating).toBe('decisive');
  });

  it('is deterministic with the same seed', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }]);
    const a = computePerTurfRewards(stats, createRng(99));
    const b = computePerTurfRewards(stats, createRng(99));
    expect(a[0].pack?.kind).toEqual(b[0].pack?.kind);
    expect(a[0].pack?.id).toEqual(b[0].pack?.id);
  });
});

describe('computeWarOutcomeReward', () => {
  it('draws a mythic on Perfect War when pool is non-empty', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
    ]);
    const pool = ['silhouette', 'accountant', 'architect'];
    const reward = computeWarOutcomeReward(stats, true, pool, createRng(7), 'A');
    expect(reward.outcome).toBe('perfect');
    expect(reward.mythicDraw).not.toBeNull();
    expect(reward.pack).toBeNull();
    expect(pool).toHaveLength(2);
  });

  it('falls back to $500 on Perfect War with empty pool', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
    ]);
    const reward = computeWarOutcomeReward(stats, true, [], createRng(7), 'A');
    expect(reward.outcome).toBe('perfect');
    expect(reward.mythicDraw).toBeNull();
    expect(reward.escalatingCurrency).toBe(500);
  });

  it('returns null outcome on loss', () => {
    const stats = mkStats([{ seizedBy: 'B', seizedTurfIdx: 0, turnsOnThatTurf: 1 }]);
    const reward = computeWarOutcomeReward(stats, false, [], createRng(1), 'A');
    expect(reward.outcome).toBeNull();
    expect(reward.pack).toBeNull();
    expect(reward.mythicDraw).toBeNull();
  });

  it('awards a pack for flawless / dominant / won outcomes', () => {
    const flawless = computeWarOutcomeReward(
      mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 3 }]),
      true, [], createRng(1), 'A',
    );
    expect(flawless.outcome).toBe('flawless');
    expect(flawless.pack).not.toBeNull();

    const dominant = computeWarOutcomeReward(
      mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 7 }]),
      true, [], createRng(2), 'A',
    );
    expect(dominant.outcome).toBe('dominant');
    expect(dominant.pack?.kind).toBe('triple');

    const won = computeWarOutcomeReward(
      mkStats([
        { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
        { seizedBy: 'B', seizedTurfIdx: 1, turnsOnThatTurf: 2 },
      ]),
      true, [], createRng(3), 'A',
    );
    expect(won.outcome).toBe('won');
    expect(won.pack?.kind).toBe('single');
  });
});

describe('computeRewardBundle', () => {
  it('packs together turf + war-outcome rewards', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 1 },
    ]);
    const bundle = computeRewardBundle(stats, true, ['silhouette'], createRng(5), 'A');
    expect(bundle.turfRewards).toHaveLength(2);
    expect(bundle.warOutcomeReward.outcome).toBe('perfect');
    expect(bundle.warOutcomeReward.mythicDraw).toBe('silhouette');
  });

  it('returns empty turf rewards on loss', () => {
    const stats = mkStats([
      { seizedBy: 'B', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
    ]);
    const bundle = computeRewardBundle(stats, false, [], createRng(1), 'A');
    expect(bundle.turfRewards).toEqual([]);
    expect(bundle.warOutcomeReward.outcome).toBeNull();
  });
});
