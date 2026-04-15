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

describe('selectAction', () => {
  it('throws on empty scored array', () => {
    expect(() => selectAction([], 'medium', createRng(1))).toThrow();
  });

  it('returns the only candidate when scored has one entry', () => {
    const result = selectAction([act('solo', 10)], 'easy', createRng(1));
    expect(result.action.cardId).toBe('solo');
  });

  it('easy: samples from top 5 with 30% noise, can pick non-top action', () => {
    const scored = [
      act('a', 10), act('b', 9.5), act('c', 9), act('d', 8.5), act('e', 8),
      act('f', 2), act('g', 1),
    ];
    const picks = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = selectAction(scored, 'easy', createRng(seed));
      picks.add(r.action.cardId!);
    }
    expect(picks.has('f')).toBe(false);
    expect(picks.has('g')).toBe(false);
    expect(picks.size).toBeGreaterThan(1);
  });

  it('medium: samples from top 3 with 15% noise', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 8), act('d', 2), act('e', 1)];
    const picks = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = selectAction(scored, 'medium', createRng(seed));
      picks.add(r.action.cardId!);
    }
    expect(picks.has('d')).toBe(false);
    expect(picks.has('e')).toBe(false);
  });

  it('hard: samples from top 2 with 5% noise', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 5), act('d', 1)];
    const picks = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = selectAction(scored, 'hard', createRng(seed));
      picks.add(r.action.cardId!);
    }
    expect(picks.has('c')).toBe(false);
    expect(picks.has('d')).toBe(false);
    expect(picks.size).toBeLessThanOrEqual(2);
  });

  it('nightmare: always picks the best (0% noise, top-1)', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 5)];
    for (let seed = 1; seed <= 50; seed++) {
      const r = selectAction(scored, 'nightmare', createRng(seed));
      expect(r.action.cardId).toBe('a');
    }
  });

  it('ultra-nightmare: always picks the best (0% noise, top-1)', () => {
    const scored = [act('a', 10), act('b', 9), act('c', 5)];
    for (let seed = 1; seed <= 50; seed++) {
      const r = selectAction(scored, 'ultra-nightmare', createRng(seed));
      expect(r.action.cardId).toBe('a');
    }
  });

  it('deterministic with same seed', () => {
    const scored = [act('a', 10), act('b', 9.5), act('c', 9), act('d', 8.5), act('e', 8)];
    const r1 = selectAction(scored, 'easy', createRng(42));
    const r2 = selectAction(scored, 'easy', createRng(42));
    expect(r1.action.cardId).toBe(r2.action.cardId);
  });
});

describe('actionsForTurn difficulty modifiers', () => {
  it('hard: AI gets +1 action', async () => {
    const { actionsForTurn } = await import('../environment');
    const { DEFAULT_GAME_CONFIG } = await import('../types');
    const config = { ...DEFAULT_GAME_CONFIG, difficulty: 'hard' as DifficultyTier };
    const base = config.actionsPerTurn;
    expect(actionsForTurn(config, 2, 'B')).toBe(base + 1);
    expect(actionsForTurn(config, 2, 'A')).toBe(base);
  });

  it('nightmare: player gets -1 action', async () => {
    const { actionsForTurn } = await import('../environment');
    const { DEFAULT_GAME_CONFIG } = await import('../types');
    const config = { ...DEFAULT_GAME_CONFIG, difficulty: 'nightmare' as DifficultyTier };
    const base = config.actionsPerTurn;
    expect(actionsForTurn(config, 2, 'A')).toBe(base - 1);
    expect(actionsForTurn(config, 2, 'B')).toBe(base);
  });

  it('nightmare: player action floor is 1', async () => {
    const { actionsForTurn } = await import('../environment');
    const config = {
      difficulty: 'nightmare' as DifficultyTier,
      suddenDeath: false,
      turfCount: 4,
      actionsPerTurn: 1,
      firstTurnActions: 1,
    };
    expect(actionsForTurn(config, 2, 'A')).toBe(1);
  });

  it('medium/easy: no action modifications', async () => {
    const { actionsForTurn } = await import('../environment');
    const { DEFAULT_GAME_CONFIG } = await import('../types');
    expect(actionsForTurn(DEFAULT_GAME_CONFIG, 2, 'A')).toBe(DEFAULT_GAME_CONFIG.actionsPerTurn);
    expect(actionsForTurn(DEFAULT_GAME_CONFIG, 2, 'B')).toBe(DEFAULT_GAME_CONFIG.actionsPerTurn);
  });
});
