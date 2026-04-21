import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TURF_SIM_CONFIG } from '../ai';
import { runSeededBenchmark } from '../benchmark';
import { checkConvergence } from '../../analysis/benchmarks';
import { loadBalanceHistory } from '../balance';

const itRelease = process.env.RELEASE_GATING ? it : it.skip;

const LOCK_COVERAGE_MIN = 0.7;
const BALANCE_HISTORY_PATH = join(
  process.cwd(), 'sim', 'reports', 'turf', 'balance-history.json',
);

describe('release gate', () => {
  itRelease(
    'requires the balance catalog to be mostly locked before release',
    () => {
      const history = loadBalanceHistory(BALANCE_HISTORY_PATH);
      const cards = Object.entries(history.cards).filter(([, state]) =>
        state.locked || state.consecutiveStableRuns > 0,
      );
      const locked = cards.filter(([, state]) => state.locked).length;
      const coverage = cards.length === 0 ? 0 : locked / cards.length;
      if (coverage < LOCK_COVERAGE_MIN) {
        const unlocked = cards
          .filter(([, state]) => !state.locked)
          .map(([cardId, state]) => `${cardId} (stableRuns=${state.consecutiveStableRuns})`);
        throw new Error(
          `Balance lock coverage ${(coverage * 100).toFixed(1)}% < required ${(LOCK_COVERAGE_MIN * 100).toFixed(0)}%. ` +
          `Unlocked cards (${unlocked.length}): ${unlocked.slice(0, 10).join(', ')}${unlocked.length > 10 ? `, +${unlocked.length - 10} more` : ''}`,
        );
      }
    },
    120000,
  );

  itRelease(
    'requires release benchmark medians and action mix within thresholds',
    () => {
      // Use ci-release profile (1000 games, wider tolerance bands) for CI
      // memory safety. Full release (5000 games) runs locally via analysis:lock.
      const thresholds = TURF_SIM_CONFIG.benchmarkThresholds['ci-release'];
      const { summary } = runSeededBenchmark('ci-release');

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
    },
    120000,
  );

  itRelease(
    'benchmark winrate converges to 45-65% band within 3 consecutive runs',
    () => {
      const winRates: number[] = [];
      for (let i = 0; i < 3; i++) {
        const { summary } = runSeededBenchmark('ci', {
          overrides: { runSeed: 12345 + i * 1000 },
        });
        winRates.push(summary.winRateA);
      }
      const result = checkConvergence(winRates);
      expect(result.converged).toBe(true);
    },
    300000,
  );
});
