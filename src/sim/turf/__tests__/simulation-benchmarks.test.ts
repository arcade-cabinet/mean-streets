import { describe, expect, it } from 'vitest';
import { TURF_SIM_CONFIG } from '../ai';
import { runSeededBenchmark } from '../benchmark';

type BenchmarkProfileName = keyof typeof TURF_SIM_CONFIG.benchmarkProfiles;

function assertBenchmarkThresholds(profile: BenchmarkProfileName): void {
  const thresholds = TURF_SIM_CONFIG.benchmarkThresholds[profile];
  const { summary } = runSeededBenchmark(profile);

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
  expect(summary.reserveCrewPlacements).toBeGreaterThanOrEqual(0);
  expect(summary.backpacksEquipped).toBeGreaterThanOrEqual(0);
  expect(summary.runnerDeployments).toBeGreaterThanOrEqual(0);
  expect(summary.payloadDeployments).toBeGreaterThanOrEqual(0);
  expect(summary.runnerReserveOpportunityTurns).toBeGreaterThanOrEqual(0);
  expect(summary.runnerEquipOpportunityTurns).toBeGreaterThanOrEqual(0);
  expect(summary.runnerDeployOpportunityTurns).toBeGreaterThanOrEqual(0);
  expect(summary.runnerPayloadOpportunityTurns).toBeGreaterThanOrEqual(0);
  expect(summary.runnerOpportunityUseRate).toBeGreaterThanOrEqual(0);
  expect(summary.runnerOpportunityUseRate).toBeLessThanOrEqual(1);
  expect(summary.runnerReserveStartUseRate).toBeGreaterThanOrEqual(0);
  expect(summary.runnerReserveStartUseRate).toBeLessThanOrEqual(1);
}

describe('seeded simulation benchmarks', () => {
  for (const profile of ['smoke', 'ci'] as const satisfies BenchmarkProfileName[]) {
    it(`${profile} profile stays within deterministic acceptance ranges`, { timeout: 25000 }, () => {
      assertBenchmarkThresholds(profile);
    });
  }
});
