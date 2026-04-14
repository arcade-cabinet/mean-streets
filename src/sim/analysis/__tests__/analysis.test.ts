import { describe, expect, it } from 'vitest';
import { runSeededBenchmark } from '../benchmarks';
import { estimateCardEffects } from '../effects';
import { deriveLockRecommendations } from '../locking';
import { runCuratedSweep, type ForcedPermutationResult } from '../sweeps';
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
        reserveCrewSeries: [2, 2, 1, 2, 2, 2, 2, 1],
        backpackSeries: [1, 1, 1, 1, 1, 1, 1, 1],
        runnerSeries: [1, 1, 1, 1, 1, 1, 1, 1],
        payloadSeries: [2, 2, 2, 1, 2, 2, 2, 1],
        runnerOpportunitySeries: [2, 2, 2, 2, 2, 2, 2, 2],
        runnerOpportunityTakenSeries: [2, 2, 2, 1, 2, 2, 2, 1],
        runnerReserveOpportunitySeries: [1, 1, 1, 1, 1, 1, 1, 1],
        runnerReserveTakenSeries: [1, 1, 1, 1, 1, 1, 1, 1],
        winRateA: 0.75,
        medianTurns: 7,
        p90Turns: 7,
        fundedAttacks: 1,
        pushedAttacks: 1.75,
        directAttacks: 4,
        reserveCrewPlacements: 1.75,
        backpacksEquipped: 1,
        runnerDeployments: 1,
        payloadDeployments: 1.75,
        runnerOpportunityUseRate: 0.875,
        runnerReserveStartUseRate: 1,
      },
      {
        forcedIds: ['card-002'],
        games: 8,
        winSeries: [0, 0, 0, 1, 0, 0, 0, 1],
        turnSeries: [9, 8, 9, 8, 9, 8, 9, 8],
        fundedSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        pushedSeries: [0, 1, 0, 1, 0, 1, 0, 1],
        directSeries: [6, 6, 6, 6, 6, 6, 6, 6],
        reserveCrewSeries: [1, 1, 1, 1, 1, 1, 1, 1],
        backpackSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        runnerSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        payloadSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        runnerOpportunitySeries: [1, 1, 1, 1, 1, 1, 1, 1],
        runnerOpportunityTakenSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        runnerReserveOpportunitySeries: [1, 1, 1, 1, 1, 1, 1, 1],
        runnerReserveTakenSeries: [0, 0, 0, 0, 0, 0, 0, 0],
        winRateA: 0.25,
        medianTurns: 8,
        p90Turns: 9,
        fundedAttacks: 0,
        pushedAttacks: 0.5,
        directAttacks: 6,
        reserveCrewPlacements: 1,
        backpacksEquipped: 0,
        runnerDeployments: 0,
        payloadDeployments: 0,
        runnerOpportunityUseRate: 0,
        runnerReserveStartUseRate: 0,
      },
    ];

    const effects = estimateCardEffects(baseline, permutations, 'quick');
    const locks = deriveLockRecommendations(effects);

    expect(effects.cardEffects).toHaveLength(2);
    expect(effects.cardEffects[0]?.runnerReserveStartUseRateDelta).not.toBeUndefined();
    expect(locks.recommendations).toHaveLength(2);
    expect(locks.recommendations.every(rec => rec.reasons.length > 0)).toBe(true);
    expect(locks.recommendations.some(rec => rec.cardId === 'card-001')).toBe(true);
  });

  it('spreads curated quick sweep anchors across weapon and drug categories', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const sweep = runCuratedSweep('weapon_drug', 'quick');
    const weaponIds = [...new Set(sweep.permutations.map(permutation => permutation.forcedIds[0]).filter(Boolean))];
    const drugIds = [...new Set(sweep.permutations.map(permutation => permutation.forcedIds[1]).filter(Boolean))];
    const weaponCategories = weaponIds.map(id => pools.weapons.find(card => card.id === id)?.category);
    const drugCategories = drugIds.map(id => pools.drugs.find(card => card.id === id)?.category);

    expect(new Set(weaponCategories).size).toBe(4);
    expect(new Set(drugCategories).size).toBe(4);
  }, 30000);
});
