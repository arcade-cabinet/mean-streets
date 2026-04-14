import { describe, expect, it } from 'vitest';
import { deriveLockRecommendations, summarizeLockRecommendations } from '../locking';
import type { EffectAnalysisReport } from '../effects';

describe('lock recommendations', () => {
  it('marks cards unstable when they materially regress reserve-start runner usage', () => {
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-13T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'runner-bad',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.5,
          winRateDelta: 0,
          winRatePValue: 1,
          winRateEffectSize: 0,
          winRateConfidence: [0.45, 0.55],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          reserveCrewDelta: 0,
          backpacksEquippedDelta: 0,
          runnerDeploymentsDelta: 0,
          payloadDeploymentsDelta: 0,
          runnerOpportunityUseRateDelta: -0.02,
          runnerReserveStartUseRateDelta: -0.06,
          volatility: 0.01,
          significant: false,
        },
      ],
    };

    const result = deriveLockRecommendations(report);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.state).toBe('unstable');
    expect(result.recommendations[0]?.reasons.some(reason => reason.includes('runner reserve-start rate'))).toBe(true);

    const summary = summarizeLockRecommendations(result);
    expect(summary.unstable).toBe(1);
    expect(summary.runnerReserveStartRiskCards).toEqual(['runner-bad']);
  });

  it('surfaces volatility-only unstable cards separately in the summary', () => {
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-13T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'volatility-only',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.51,
          winRateDelta: 0.01,
          winRatePValue: 0.9,
          winRateEffectSize: 0.01,
          winRateConfidence: [0.46, 0.56],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          reserveCrewDelta: 0,
          backpacksEquippedDelta: 0,
          runnerDeploymentsDelta: 0,
          payloadDeploymentsDelta: 0,
          runnerOpportunityUseRateDelta: 0,
          runnerReserveStartUseRateDelta: 0,
          volatility: 0.07,
          significant: false,
        },
      ],
    };

    const result = deriveLockRecommendations(report);
    const summary = summarizeLockRecommendations(result);

    expect(result.recommendations[0]?.state).toBe('unstable');
    expect(summary.volatilityOnlyUnstableCards).toEqual(['volatility-only']);
  });
});
