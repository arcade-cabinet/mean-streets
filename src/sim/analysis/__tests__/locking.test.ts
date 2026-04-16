import { describe, expect, it } from 'vitest';
import { deriveLockRecommendations, summarizeLockRecommendations } from '../locking';
import type { EffectAnalysisReport } from '../effects';

describe('lock recommendations', () => {
  it('marks cards unstable when win rate delta exceeds threshold', () => {
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-13T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'strong-card',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.56,
          winRateDelta: 0.06,
          winRatePValue: 0.01,
          winRateEffectSize: 0.4,
          winRateConfidence: [0.51, 0.61],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          volatility: 0.01,
          significant: false,
        },
      ],
    };

    const result = deriveLockRecommendations(report);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.state).toBe('unstable');
    expect(
      result.recommendations[0]?.reasons.some(r => r.includes('winRateDelta')),
    ).toBe(true);

    const summary = summarizeLockRecommendations(result);
    expect(summary.unstable).toBe(1);
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

  it('marks cards as saturated when history length exceeds max', () => {
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-15T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'saturated-card',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.56,
          winRateDelta: 0.06,
          winRatePValue: 0.01,
          winRateEffectSize: 0.4,
          winRateConfidence: [0.51, 0.61],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          volatility: 0.01,
          significant: false,
        },
      ],
    };

    const historyLengths = new Map([['saturated-card', 10]]);
    const result = deriveLockRecommendations(report, historyLengths);
    expect(result.recommendations[0]?.state).toBe('saturated');

    const summary = summarizeLockRecommendations(result);
    expect(summary.saturated).toBe(1);
  });

  it('rejects stat that crosses rarity band without grade promotion', () => {
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-15T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'overpowered-common',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.52,
          winRateDelta: 0.02,
          winRatePValue: 0.4,
          winRateEffectSize: 0.1,
          winRateConfidence: [0.48, 0.56],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          volatility: 0.02,
          significant: false,
        },
      ],
    };

    const rarities = new Map([['overpowered-common', 'common']]);
    // A common is meant to sit near the catalog median; a raw stat of 8
    // is well above the common band and should flag.
    const stats = new Map([['overpowered-common', 8]]);
    const result = deriveLockRecommendations(report, undefined, rarities, stats);
    const rec = result.recommendations.find(r => r.cardId === 'overpowered-common');
    expect(rec?.reasons.some(r => r.includes('rarity band'))).toBe(true);
  });

  it('skips rarity-band check when stats map is not provided', () => {
    // Regression pin: prior implementation fabricated a stat from winrate,
    // causing spurious "exceeds rarity band" flags. With no stats map,
    // the check must be skipped rather than guessed.
    const report: EffectAnalysisReport = {
      generatedAt: '2026-04-15T00:00:00.000Z',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [
        {
          cardId: 'no-stat-common',
          sampleCount: 128,
          baselineWinRate: 0.5,
          forcedWinRate: 0.52,
          winRateDelta: 0.02,
          winRatePValue: 0.4,
          winRateEffectSize: 0.1,
          winRateConfidence: [0.48, 0.56],
          medianTurnDelta: 0,
          turnPValue: 1,
          turnConfidence: [7, 7],
          fundedDelta: 0,
          pushedDelta: 0,
          directDelta: 0,
          volatility: 0.02,
          significant: false,
        },
      ],
    };
    const rarities = new Map([['no-stat-common', 'common']]);
    const result = deriveLockRecommendations(report, undefined, rarities);
    const rec = result.recommendations.find(r => r.cardId === 'no-stat-common');
    expect(rec?.reasons.some(r => r.includes('rarity band'))).toBe(false);
  });
});
