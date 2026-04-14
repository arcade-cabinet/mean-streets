import { bootstrapTest, std, WelchTTest } from '@psych/lib';
import { TURF_SIM_CONFIG } from '../turf/ai';
import type { BenchmarkRun } from './benchmarks';
import type { ForcedPermutationResult } from './sweeps';

export interface CardEffectEstimate {
  cardId: string;
  sampleCount: number;
  baselineWinRate: number;
  forcedWinRate: number;
  winRateDelta: number;
  winRatePValue: number;
  winRateEffectSize: number;
  winRateConfidence: [number, number];
  medianTurnDelta: number;
  turnPValue: number;
  turnConfidence: [number, number];
  fundedDelta: number;
  pushedDelta: number;
  directDelta: number;
  reserveCrewDelta: number;
  backpacksEquippedDelta: number;
  runnerDeploymentsDelta: number;
  payloadDeploymentsDelta: number;
  runnerOpportunityUseRateDelta: number;
  runnerReserveStartUseRateDelta: number;
  volatility: number;
  significant: boolean;
}

export interface EffectAnalysisReport {
  generatedAt: string;
  analysisProfile: keyof typeof TURF_SIM_CONFIG.analysisProfiles;
  baselineProfile: BenchmarkRun['summary']['profile'];
  cardEffects: CardEffectEstimate[];
}

export interface EffectEstimationProgress {
  completed: number;
  total: number;
  cardId: string;
}

export function estimateCardEffects(
  baseline: BenchmarkRun,
  permutations: ForcedPermutationResult[],
  analysisProfile: keyof typeof TURF_SIM_CONFIG.analysisProfiles = 'quick',
  onProgress?: (progress: EffectEstimationProgress) => void,
): EffectAnalysisReport {
  const alpha = TURF_SIM_CONFIG.statisticalThresholds.alpha;
  const baselineWins = baseline.results.map((result) =>
    result.winner === 'A' ? 1 : 0,
  );
  const baselineTurns = baseline.results.map((result) => result.turnCount);
  const baselineFunded = baseline.results.map(
    (result) => result.metrics.fundedAttacks,
  );
  const baselinePushed = baseline.results.map(
    (result) => result.metrics.pushedAttacks,
  );
  const baselineDirect = baseline.results.map(
    (result) => result.metrics.directAttacks,
  );
  const baselineReserveCrew = baseline.results.map(
    (result) => result.metrics.reserveCrewPlaced,
  );
  const baselineBackpacks = baseline.results.map(
    (result) => result.metrics.backpacksEquipped,
  );
  const baselineRunners = baseline.results.map(
    (result) => result.metrics.runnerDeployments,
  );
  const baselinePayloads = baseline.results.map(
    (result) => result.metrics.payloadDeployments,
  );
  const baselineRunnerUseRate = baseline.results.map((result) =>
    result.metrics.runnerOpportunityTurns > 0
      ? result.metrics.runnerOpportunityTaken /
        result.metrics.runnerOpportunityTurns
      : 0,
  );
  const baselineRunnerReserveStartRate = baseline.results.map((result) =>
    result.metrics.runnerReserveOpportunityTurns > 0
      ? result.metrics.runnerReserveOpportunityTaken /
        result.metrics.runnerReserveOpportunityTurns
      : 0,
  );
  const byCard = new Map<string, ForcedPermutationResult[]>();

  for (const permutation of permutations) {
    for (const forcedId of permutation.forcedIds) {
      const group = byCard.get(forcedId) ?? [];
      group.push(permutation);
      byCard.set(forcedId, group);
    }
  }

  const entries = [...byCard.entries()];
  const cardEffects: CardEffectEstimate[] = [];
  for (const [index, [cardId, runs]] of entries.entries()) {
    const forcedWins = runs.flatMap((run) => run.winSeries);
    const forcedTurns = runs.flatMap((run) => run.turnSeries);
    const forcedFunded = runs.flatMap((run) => run.fundedSeries);
    const forcedPushed = runs.flatMap((run) => run.pushedSeries);
    const forcedDirect = runs.flatMap((run) => run.directSeries);
    const forcedReserveCrew = runs.flatMap((run) => run.reserveCrewSeries);
    const forcedBackpacks = runs.flatMap((run) => run.backpackSeries);
    const forcedRunners = runs.flatMap((run) => run.runnerSeries);
    const forcedPayloads = runs.flatMap((run) => run.payloadSeries);
    const forcedRunnerUseRates = runs.flatMap((run) =>
      run.runnerOpportunitySeries.map((value, rateIndex) =>
        value > 0 ? run.runnerOpportunityTakenSeries[rateIndex]! / value : 0,
      ),
    );
    const forcedRunnerReserveStartRates = runs.flatMap((run) =>
      run.runnerReserveOpportunitySeries.map((value, rateIndex) =>
        value > 0 ? run.runnerReserveTakenSeries[rateIndex]! / value : 0,
      ),
    );
    const winTest = new WelchTTest(forcedWins, baselineWins, true, 0, alpha);
    const turnTest = new WelchTTest(forcedTurns, baselineTurns, true, 0, alpha);
    const winRateConfidence = bootstrapTest(
      'mean',
      TURF_SIM_CONFIG.analysisProfiles[analysisProfile].bootstrapSamples,
      alpha,
      forcedWins,
    );
    const turnConfidence = bootstrapTest(
      'median',
      TURF_SIM_CONFIG.analysisProfiles[analysisProfile].bootstrapSamples,
      alpha,
      forcedTurns,
    );
    const forcedWinRate =
      forcedWins.reduce((sum, value) => sum + value, 0) /
      Math.max(1, forcedWins.length);
    const baselineWinRate =
      baselineWins.reduce((sum, value) => sum + value, 0) /
      Math.max(1, baselineWins.length);
    const forcedTurnMedian =
      [...forcedTurns].sort((a, b) => a - b)[
        Math.floor(forcedTurns.length / 2)
      ] ?? 0;
    const baselineTurnMedian =
      [...baselineTurns].sort((a, b) => a - b)[
        Math.floor(baselineTurns.length / 2)
      ] ?? 0;

    cardEffects.push({
      cardId,
      sampleCount: forcedWins.length,
      baselineWinRate,
      forcedWinRate,
      winRateDelta: forcedWinRate - baselineWinRate,
      winRatePValue: winTest.p,
      winRateEffectSize: winTest.cohenD,
      winRateConfidence,
      medianTurnDelta: forcedTurnMedian - baselineTurnMedian,
      turnPValue: turnTest.p,
      turnConfidence,
      fundedDelta:
        forcedFunded.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedFunded.length) -
        baselineFunded.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineFunded.length),
      pushedDelta:
        forcedPushed.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedPushed.length) -
        baselinePushed.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselinePushed.length),
      directDelta:
        forcedDirect.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedDirect.length) -
        baselineDirect.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineDirect.length),
      reserveCrewDelta:
        forcedReserveCrew.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedReserveCrew.length) -
        baselineReserveCrew.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineReserveCrew.length),
      backpacksEquippedDelta:
        forcedBackpacks.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedBackpacks.length) -
        baselineBackpacks.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineBackpacks.length),
      runnerDeploymentsDelta:
        forcedRunners.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedRunners.length) -
        baselineRunners.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineRunners.length),
      payloadDeploymentsDelta:
        forcedPayloads.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedPayloads.length) -
        baselinePayloads.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselinePayloads.length),
      runnerOpportunityUseRateDelta:
        forcedRunnerUseRates.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedRunnerUseRates.length) -
        baselineRunnerUseRate.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineRunnerUseRate.length),
      runnerReserveStartUseRateDelta:
        forcedRunnerReserveStartRates.reduce((sum, value) => sum + value, 0) /
          Math.max(1, forcedRunnerReserveStartRates.length) -
        baselineRunnerReserveStartRate.reduce((sum, value) => sum + value, 0) /
          Math.max(1, baselineRunnerReserveStartRate.length),
      volatility: std(runs.map((run) => run.winRateA)),
      significant: winTest.p < alpha || turnTest.p < alpha,
    });
    onProgress?.({
      completed: index + 1,
      total: entries.length,
      cardId,
    });
  }

  cardEffects.sort(
    (a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta),
  );

  return {
    generatedAt: new Date().toISOString(),
    analysisProfile,
    baselineProfile: baseline.summary.profile,
    cardEffects,
  };
}
