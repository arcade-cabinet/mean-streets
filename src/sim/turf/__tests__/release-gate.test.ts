import { describe, expect, it } from 'vitest';
import { TURF_SIM_CONFIG } from '../ai';
import { runSeededBenchmark } from '../benchmark';

const itRelease = process.env.RELEASE_GATING ? it : it.skip;

// Minimum proportion of the balance catalog that must be locked before a
// release is allowed. Lock progress is driven by repeated benchmark passes
// writing back to sim/reports/turf/balance-history.json; see
// `pnpm run analysis:lock -- --persist`. Tightening this number is how we
// ratchet toward 1.0 without flipping the gate red every time a pre-launch
// balance tweak resets a few cards.
const LOCK_COVERAGE_MIN = 0.7;

describe('release gate', () => {
  itRelease('requires the balance catalog to be mostly locked before release', () => {
    const { balance } = runSeededBenchmark('release', { includeBalance: true });
    expect(balance).toBeDefined();
    const perfs = balance?.performances ?? [];
    const locked = perfs.filter(card => card.locked).length;
    const coverage = perfs.length === 0 ? 0 : locked / perfs.length;
    if (coverage < LOCK_COVERAGE_MIN) {
      const unlocked = perfs
        .filter(card => !card.locked)
        .map(card => `${card.id} (Δ${card.winRateDelta.toFixed(3)}, samples=${card.includedCount})`);
      throw new Error(
        `Balance lock coverage ${(coverage * 100).toFixed(1)}% < required ${(LOCK_COVERAGE_MIN * 100).toFixed(0)}%. ` +
        `Unlocked cards (${unlocked.length}): ${unlocked.slice(0, 10).join(', ')}${unlocked.length > 10 ? `, +${unlocked.length - 10} more` : ''}`,
      );
    }
  }, 120000);

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
  }, 120000);
});
