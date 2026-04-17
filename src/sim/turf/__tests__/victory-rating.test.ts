import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  classifyTurfSeizure,
  classifyWarOutcome,
  computePerTurfRewards,
  computeWarOutcomeReward,
} from '../../packs/rewards';
import type { WarStats } from '../types';

// Victory-rating tiers are the RULES §13 contract that feeds the pack
// reward generator. These tests pin the thresholds so production can
// rely on "turns 1 → absolute, turns 2 → overwhelming, ..." without
// surprising regressions.

describe('classifyTurfSeizure — per-turf rating thresholds', () => {
  it('seized on turn 1 = Absolute Victory', () => {
    expect(classifyTurfSeizure(1)).toBe('absolute');
  });

  it('seized on turn 2 = Overwhelming', () => {
    expect(classifyTurfSeizure(2)).toBe('overwhelming');
  });

  it('seized on turn 3 = Decisive', () => {
    expect(classifyTurfSeizure(3)).toBe('decisive');
  });

  it('seized after turn 3 = Standard', () => {
    expect(classifyTurfSeizure(4)).toBe('standard');
    expect(classifyTurfSeizure(10)).toBe('standard');
  });
});

describe('computePerTurfRewards', () => {
  it('yields 5-card pack for Absolute victories', () => {
    const warStats: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
    };
    const rng = createRng(1);
    const rewards = computePerTurfRewards(warStats, rng);
    expect(rewards).toHaveLength(1);
    expect(rewards[0].rating).toBe('absolute');
    expect(rewards[0].pack).not.toBeNull();
    expect(rewards[0].pack!.kind).toBe('standard');
  });

  it('yields triple pack for Overwhelming', () => {
    const warStats: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 2 }],
    };
    const rng = createRng(1);
    const [reward] = computePerTurfRewards(warStats, rng);
    expect(reward.rating).toBe('overwhelming');
    expect(reward.pack!.kind).toBe('triple');
  });

  it('yields single pack for Decisive', () => {
    const warStats: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 3 }],
    };
    const [reward] = computePerTurfRewards(warStats, createRng(1));
    expect(reward.rating).toBe('decisive');
    expect(reward.pack!.kind).toBe('single');
  });

  it('no pack for Standard', () => {
    const warStats: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 5 }],
    };
    const [reward] = computePerTurfRewards(warStats, createRng(1));
    expect(reward.rating).toBe('standard');
    expect(reward.pack).toBeNull();
  });
});

describe('classifyWarOutcome — war-level rating', () => {
  it('Perfect: all own seizures Absolute + zero losses', () => {
    const ws: WarStats = {
      seizures: [
        { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
        { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 1 },
      ],
    };
    expect(classifyWarOutcome(ws, true, 'A')).toBe('perfect');
  });

  it('Flawless: all own seizures Decisive-or-better + zero losses', () => {
    const ws: WarStats = {
      seizures: [
        { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
        { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 3 },
      ],
    };
    expect(classifyWarOutcome(ws, true, 'A')).toBe('flawless');
  });

  it('Dominant: zero losses, but some Standard seizures', () => {
    const ws: WarStats = {
      seizures: [
        { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
        { seizedBy: 'A', seizedTurfIdx: 1, turnsOnThatTurf: 10 }, // standard
      ],
    };
    expect(classifyWarOutcome(ws, true, 'A')).toBe('dominant');
  });

  it('Won: winner lost at least one turf', () => {
    const ws: WarStats = {
      seizures: [
        { seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 },
        { seizedBy: 'B', seizedTurfIdx: 0, turnsOnThatTurf: 2 }, // A lost
      ],
    };
    expect(classifyWarOutcome(ws, true, 'A')).toBe('won');
  });

  it('null when not won', () => {
    const ws: WarStats = { seizures: [] };
    expect(classifyWarOutcome(ws, false, 'A')).toBeNull();
  });
});

describe('computeWarOutcomeReward — mythic draws', () => {
  it('Perfect war + non-empty pool → draws a mythic', () => {
    const pool = ['mythic-a', 'mythic-b', 'mythic-c'];
    const ws: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
    };
    const r = computeWarOutcomeReward(ws, true, pool, createRng(1), 'A');
    expect(r.outcome).toBe('perfect');
    expect(r.mythicDraw).not.toBeNull();
    expect(pool).toHaveLength(2); // one drawn
  });

  it('Perfect war + empty pool → escalating currency fallback', () => {
    const pool: string[] = [];
    const ws: WarStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
    };
    const r = computeWarOutcomeReward(ws, true, pool, createRng(1), 'A');
    expect(r.outcome).toBe('perfect');
    expect(r.mythicDraw).toBeNull();
    expect(r.escalatingCurrency).toBeGreaterThan(0);
  });

  it('loss → no reward', () => {
    const ws: WarStats = { seizures: [] };
    const r = computeWarOutcomeReward(ws, false, [], createRng(1), 'A');
    expect(r.outcome).toBeNull();
    expect(r.pack).toBeNull();
    expect(r.mythicDraw).toBeNull();
  });
});
