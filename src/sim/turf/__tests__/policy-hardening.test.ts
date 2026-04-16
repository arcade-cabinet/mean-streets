import { describe, expect, it } from 'vitest';
import { selectAction, type ScoredAction } from '../ai/policy';
import { createRng } from '../../cards/rng';
import type { DifficultyTier, TurfAction } from '../types';

function act(id: string, score: number): ScoredAction {
  return {
    action: { kind: 'play_card', side: 'A', turfIdx: 0, cardId: id } as TurfAction,
    score,
    policyUsed: false,
  };
}

describe('policy hardening — getProfile', () => {
  it('throws a helpful error for an unknown difficulty tier', () => {
    const bogus = 'does-not-exist' as DifficultyTier;
    const scored = [act('a', 10), act('b', 9)];
    expect(() => selectAction(scored, bogus, createRng(1))).toThrow(
      /Missing difficulty profile for tier "does-not-exist"/,
    );
  });

  it('lists known tiers in the thrown error message', () => {
    const bogus = 'typo-tier' as DifficultyTier;
    const scored = [act('a', 10), act('b', 9)];
    try {
      selectAction(scored, bogus, createRng(1));
      throw new Error('selectAction should have thrown');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('easy');
      expect(msg).toContain('nightmare');
    }
  });
});

describe('policy hardening — selectAction edges', () => {
  it('throws on empty scored array', () => {
    expect(() => selectAction([], 'medium', createRng(1))).toThrow(
      /No scored actions to select from/,
    );
  });

  it('returns top-scoring when topK=1 and noise=0 (nightmare profile)', () => {
    const scored = [act('lo', 1), act('hi', 100), act('mid', 50)];
    const result = selectAction(scored, 'nightmare', createRng(1));
    expect(result.action.cardId).toBe('hi');
  });

  it('nightmare is deterministic and noise-free across many seeds', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 8)];
    for (let seed = 1; seed <= 25; seed++) {
      const r = selectAction(scored, 'nightmare', createRng(seed));
      expect(r.action.cardId).toBe('a');
    }
  });

  it('is deterministic for a fixed seed (easy, with noise)', () => {
    const scored = [
      act('a', 10),
      act('b', 9.5),
      act('c', 9),
      act('d', 8.5),
      act('e', 8),
    ];
    const r1 = selectAction(scored, 'easy', createRng(1234));
    const r2 = selectAction(scored, 'easy', createRng(1234));
    const r3 = selectAction(scored, 'easy', createRng(1234));
    expect(r1.action.cardId).toBe(r2.action.cardId);
    expect(r2.action.cardId).toBe(r3.action.cardId);
  });

  it('is deterministic across all difficulty tiers for a fixed seed', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 8), act('d', 7)];
    const tiers: DifficultyTier[] = [
      'easy',
      'medium',
      'hard',
      'nightmare',
      'sudden-death',
      'ultra-nightmare',
    ];
    for (const tier of tiers) {
      const r1 = selectAction(scored, tier, createRng(99));
      const r2 = selectAction(scored, tier, createRng(99));
      expect(r1.action.cardId).toBe(r2.action.cardId);
    }
  });

  it('returns the single entry unchanged when scored has length 1', () => {
    const solo = act('solo', 42);
    const result = selectAction([solo], 'easy', createRng(7));
    expect(result).toBe(solo);
  });
});
