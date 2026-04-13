import { describe, expect, it } from 'vitest';
import { TURF_SIM_CONFIG } from '../ai';
import { runSeededBenchmark } from '../benchmark';

const itRelease = process.env.RELEASE_GATING ? it : it.skip;

describe('release gate', () => {
  itRelease('requires every balance card to be locked before release', () => {
    const { balance } = runSeededBenchmark('release', { includeBalance: true });
    expect(balance).toBeDefined();
    expect(balance?.performances.every(card => card.locked)).toBe(true);
  }, 30000);

  itRelease('requires release benchmark medians and action mix to stay within thresholds', () => {
    const thresholds = TURF_SIM_CONFIG.benchmarkThresholds.release;
    const { summary } = runSeededBenchmark('release');

    expect(summary.winRateA).toBeGreaterThanOrEqual(thresholds.winRateMin);
    expect(summary.winRateA).toBeLessThanOrEqual(thresholds.winRateMax);
    expect(summary.firstMoverWinRate).toBeGreaterThanOrEqual(thresholds.firstMoverMin);
    expect(summary.firstMoverWinRate).toBeLessThanOrEqual(thresholds.firstMoverMax);
    expect(summary.timeoutRate).toBeLessThanOrEqual(thresholds.timeoutRateMax);
    expect(summary.medianTurns).toBeGreaterThanOrEqual(thresholds.medianTurnsMin);
    expect(summary.medianTurns).toBeLessThanOrEqual(thresholds.medianTurnsMax);
    expect(summary.p90Turns).toBeLessThanOrEqual(thresholds.p90TurnsMax);
    expect(summary.failedPlans).toBeLessThanOrEqual(thresholds.failedPlansMax);
    expect(summary.fundedAttacks).toBeGreaterThanOrEqual(thresholds.fundedAttacksMin);
    expect(summary.pushedAttacks).toBeGreaterThanOrEqual(thresholds.pushedAttacksMin);
    expect(summary.policyGuidedActions).toBeGreaterThanOrEqual(thresholds.policyGuidedMin);
  }, 30000);
});
