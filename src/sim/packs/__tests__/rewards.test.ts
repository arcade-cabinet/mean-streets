import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  classifyTurfSeizure,
  classifyWarOutcome,
  computePerTurfRewards,
  computeRewardBundle,
  computeWarOutcomeReward,
  flattenRewardBundlePacks,
  rollPackCategory,
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

  it('scales Perfect War fallback currency after pool exhaustion', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
    ]);
    const first = computeWarOutcomeReward(stats, true, [], createRng(7), 'A', 0);
    expect(first.outcome).toBe('perfect');
    expect(first.mythicDraw).toBeNull();
    expect(first.escalatingCurrency).toBe(500);

    const second = computeWarOutcomeReward(stats, true, [], createRng(7), 'A', 1);
    expect(second.escalatingCurrency).toBe(1000);

    const third = computeWarOutcomeReward(stats, true, [], createRng(7), 'A', 2);
    expect(third.escalatingCurrency).toBe(1500);
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

  it('threads the fallback count through the bundle outcome reward', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
    ]);
    const bundle = computeRewardBundle(stats, true, [], createRng(5), 'A', 2);
    expect(bundle.warOutcomeReward.escalatingCurrency).toBe(1500);
  });
});

describe('flattenRewardBundlePacks', () => {
  it('collects every concrete reward pack from the bundle', () => {
    const stats = mkStats([
      { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
      { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 2 },
      { seizedBy: 'A', seizedTurfIdx: 2, turnsOnThatTurf: 3 },
    ]);
    const bundle = computeRewardBundle(stats, true, [], createRng(9), 'A');
    expect(flattenRewardBundlePacks(bundle).map((pack) => pack.kind)).toEqual([
      'standard',
      'triple',
      'single',
      'standard',
    ]);
  });
});

describe('rollPackCategory', () => {
  it('returns a valid PackKind', () => {
    const kind = rollPackCategory(createRng(1));
    expect(['single', 'triple', 'standard']).toContain(kind);
  });

  it('is deterministic with the same seed', () => {
    const a = rollPackCategory(createRng(42));
    const b = rollPackCategory(createRng(42));
    expect(a).toBe(b);
  });

  it('returns standard for every seed (default weights: 100% standard)', () => {
    // Default topTierPackKindWeights = { single:0, triple:0, standard:1 }
    // so every call must return 'standard' regardless of rng value.
    for (let seed = 0; seed < 20; seed++) {
      expect(rollPackCategory(createRng(seed))).toBe('standard');
    }
  });

  it('absolute victory (1 turn) awards a standard pack via rollPackCategory', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }]);
    const rewards = computePerTurfRewards(stats, createRng(7));
    expect(rewards[0].rating).toBe('absolute');
    expect(rewards[0].pack?.kind).toBe('standard');
  });

  it('overwhelming victory (2 turns) awards a triple pack', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 2 }]);
    const rewards = computePerTurfRewards(stats, createRng(7));
    expect(rewards[0].rating).toBe('overwhelming');
    expect(rewards[0].pack?.kind).toBe('triple');
  });

  it('decisive victory (3 turns) awards a single pack', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 3 }]);
    const rewards = computePerTurfRewards(stats, createRng(7));
    expect(rewards[0].rating).toBe('decisive');
    expect(rewards[0].pack?.kind).toBe('single');
  });

  it('standard victory (> 3 turns) awards no pack', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 5 }]);
    const rewards = computePerTurfRewards(stats, createRng(7));
    expect(rewards[0].rating).toBe('standard');
    expect(rewards[0].pack).toBeNull();
  });

  it('flawless war outcome awards a standard pack via rollPackCategory', () => {
    const stats = mkStats([{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 3 }]);
    const reward = computeWarOutcomeReward(stats, true, [], createRng(1), 'A');
    expect(reward.outcome).toBe('flawless');
    expect(reward.pack?.kind).toBe('standard');
  });
});
