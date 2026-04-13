import { WelchTTest, bootstrapTest, std } from '@psych/lib';
import type { BenchmarkRun } from './benchmarks';
import type { ForcedPermutationResult } from './sweeps';
import { TURF_SIM_CONFIG } from '../turf/ai';

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
  volatility: number;
  significant: boolean;
}

export interface EffectAnalysisReport {
  generatedAt: string;
  analysisProfile: keyof typeof TURF_SIM_CONFIG.analysisProfiles;
  baselineProfile: BenchmarkRun['summary']['profile'];
  cardEffects: CardEffectEstimate[];
}

export function estimateCardEffects(
  baseline: BenchmarkRun,
  permutations: ForcedPermutationResult[],
  analysisProfile: keyof typeof TURF_SIM_CONFIG.analysisProfiles = 'quick',
): EffectAnalysisReport {
  const alpha = TURF_SIM_CONFIG.statisticalThresholds.alpha;
  const baselineWins = baseline.results.map(result => (result.winner === 'A' ? 1 : 0));
  const baselineTurns = baseline.results.map(result => result.turnCount);
  const baselineFunded = baseline.results.map(result => result.metrics.fundedAttacks);
  const baselinePushed = baseline.results.map(result => result.metrics.pushedAttacks);
  const baselineDirect = baseline.results.map(result => result.metrics.directAttacks);
  const byCard = new Map<string, ForcedPermutationResult[]>();

  for (const permutation of permutations) {
    for (const forcedId of permutation.forcedIds) {
      const group = byCard.get(forcedId) ?? [];
      group.push(permutation);
      byCard.set(forcedId, group);
    }
  }

  const cardEffects: CardEffectEstimate[] = [...byCard.entries()].map(([cardId, runs]) => {
    const forcedWins = runs.flatMap(run => run.winSeries);
    const forcedTurns = runs.flatMap(run => run.turnSeries);
    const forcedFunded = runs.flatMap(run => run.fundedSeries);
    const forcedPushed = runs.flatMap(run => run.pushedSeries);
    const forcedDirect = runs.flatMap(run => run.directSeries);
    const winTest = new WelchTTest(forcedWins, baselineWins, true, 0, alpha);
    const turnTest = new WelchTTest(forcedTurns, baselineTurns, true, 0, alpha);
    const winRateConfidence = bootstrapTest('mean', TURF_SIM_CONFIG.analysisProfiles[analysisProfile].bootstrapSamples, alpha, forcedWins);
    const turnConfidence = bootstrapTest('median', TURF_SIM_CONFIG.analysisProfiles[analysisProfile].bootstrapSamples, alpha, forcedTurns);
    const forcedWinRate = forcedWins.reduce((sum, value) => sum + value, 0) / Math.max(1, forcedWins.length);
    const baselineWinRate = baselineWins.reduce((sum, value) => sum + value, 0) / Math.max(1, baselineWins.length);
    const forcedTurnMedian = [...forcedTurns].sort((a, b) => a - b)[Math.floor(forcedTurns.length / 2)] ?? 0;
    const baselineTurnMedian = [...baselineTurns].sort((a, b) => a - b)[Math.floor(baselineTurns.length / 2)] ?? 0;

    return {
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
        forcedFunded.reduce((sum, value) => sum + value, 0) / Math.max(1, forcedFunded.length)
        - baselineFunded.reduce((sum, value) => sum + value, 0) / Math.max(1, baselineFunded.length),
      pushedDelta:
        forcedPushed.reduce((sum, value) => sum + value, 0) / Math.max(1, forcedPushed.length)
        - baselinePushed.reduce((sum, value) => sum + value, 0) / Math.max(1, baselinePushed.length),
      directDelta:
        forcedDirect.reduce((sum, value) => sum + value, 0) / Math.max(1, forcedDirect.length)
        - baselineDirect.reduce((sum, value) => sum + value, 0) / Math.max(1, baselineDirect.length),
      volatility: std(runs.map(run => run.winRateA)),
      significant: winTest.p < alpha || turnTest.p < alpha,
    };
  }).sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta));

  return {
    generatedAt: new Date().toISOString(),
    analysisProfile,
    baselineProfile: baseline.summary.profile,
    cardEffects,
  };
}
