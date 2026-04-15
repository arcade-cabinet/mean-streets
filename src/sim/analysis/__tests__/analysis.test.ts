import { describe, expect, it } from 'vitest';
import { runSeededBenchmark } from '../benchmarks';
import { estimateCardEffects } from '../effects';
import { deriveLockRecommendations } from '../locking';
import { runCuratedSweep, type ForcedPermutationResult } from '../sweeps';
import { checkConvergence } from '../benchmarks';
import { generateTurfCardPools } from '../../turf/catalog';

describe('analysis layer', () => {
  it('produces deterministic benchmark summaries for fixed profiles', { timeout: 30000 }, () => {
    const first = runSeededBenchmark('smoke');
    const second = runSeededBenchmark('smoke');

    expect(first.summary).toEqual(second.summary);
  });

  it('derives effect estimates and lock states from forced inclusion samples', { timeout: 30000 }, () => {
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
    expect(locks.recommendations.every(rec => rec.reasons.length > 0)).toBe(true);
    expect(locks.recommendations.some(rec => rec.cardId === 'card-001')).toBe(true);
  });

  it('spreads curated quick sweep anchors across weapon and drug categories', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const sweep = runCuratedSweep('weapon_drug', 'quick');
    const weaponIds = [
      ...new Set(
        sweep.permutations
          .map(p => p.forcedIds[0])
          .filter(Boolean),
      ),
    ];
    const drugIds = [
      ...new Set(
        sweep.permutations
          .map(p => p.forcedIds[1])
          .filter(Boolean),
      ),
    ];
    const weaponCategories = weaponIds.map(
      id => pools.weapons.find(c => c.id === id)?.category,
    );
    const drugCategories = drugIds.map(
      id => pools.drugs.find(c => c.id === id)?.category,
    );

    expect(new Set(weaponCategories).size).toBe(5);
    expect(new Set(drugCategories).size).toBe(5);
  }, 120000);

  it('checkConvergence detects 3 consecutive runs in 48-52% band', () => {
    const convergent = checkConvergence([0.49, 0.51, 0.50]);
    expect(convergent.converged).toBe(true);
    expect(convergent.consecutiveInBand).toBe(3);

    const notYet = checkConvergence([0.55, 0.49, 0.51]);
    expect(notYet.converged).toBe(false);
    expect(notYet.consecutiveInBand).toBe(2);

    const outsideBand = checkConvergence([0.45, 0.47, 0.46]);
    expect(outsideBand.converged).toBe(false);
    expect(outsideBand.consecutiveInBand).toBe(0);
  });

  it('locking saturates at maxHistoryLength', () => {
    const baseline = runSeededBenchmark('smoke');
    const permutations: ForcedPermutationResult[] = [{
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
    }];

    const effects = estimateCardEffects(baseline, permutations, 'quick');
    const historyLengths = new Map([['card-001', 10]]);
    const locks = deriveLockRecommendations(effects, historyLengths);
    const rec = locks.recommendations.find(r => r.cardId === 'card-001');
    expect(rec?.state).toBe('saturated');
  }, 30000);
});
