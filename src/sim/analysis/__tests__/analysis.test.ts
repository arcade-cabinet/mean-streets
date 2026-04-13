import { describe, expect, it } from 'vitest';
import { runSeededBenchmark } from '../benchmarks';
import { estimateCardEffects } from '../effects';
import { deriveLockRecommendations } from '../locking';
import type { ForcedPermutationResult } from '../sweeps';

describe('analysis layer', () => {
  it('produces deterministic benchmark summaries for fixed profiles', () => {
    const first = runSeededBenchmark('smoke');
    const second = runSeededBenchmark('smoke');

    expect(first.summary).toEqual(second.summary);
  });

  it('derives effect estimates and lock states from forced inclusion samples', () => {
    const baseline = runSeededBenchmark('smoke');
    const permutations: ForcedPermutationResult[] = [
      {
        forcedIds: ['card-001'],
        games: 8,
        winSeries: [1, 1, 1, 0, 1, 1, 1, 0],
        turnSeries: [7, 7, 6, 7, 6, 7, 7, 6],
        fundedSeries: [1, 1, 1, 1, 1, 1, 1, 1],
        pushedSeries: [2, 2, 2, 1, 2, 2, 2, 1],
        directSeries: [4, 4, 4, 4, 4, 4, 4, 4],
        winRateA: 0.75,
        medianTurns: 7,
        p90Turns: 7,
        fundedAttacks: 1,
        pushedAttacks: 1.75,
        directAttacks: 4,
      },
      {
        forcedIds: ['card-002'],
        games: 8,
        winSeries: [0, 0, 0, 1, 0, 0, 0, 1],
        turnSeries: [9, 8, 9, 8, 9, 8, 9, 8],
        fundedSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        pushedSeries: [0, 1, 0, 1, 0, 1, 0, 1],
        directSeries: [6, 6, 6, 6, 6, 6, 6, 6],
        winRateA: 0.25,
        medianTurns: 8,
        p90Turns: 9,
        fundedAttacks: 0,
        pushedAttacks: 0.5,
        directAttacks: 6,
      },
    ];

    const effects = estimateCardEffects(baseline, permutations, 'quick');
    const locks = deriveLockRecommendations(effects);

    expect(effects.cardEffects).toHaveLength(2);
    expect(locks.recommendations).toHaveLength(2);
    expect(locks.recommendations.some(rec => rec.cardId === 'card-001')).toBe(true);
  });
});
