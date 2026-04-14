import { TURF_SIM_CONFIG } from '../turf/ai';
import type { EffectAnalysisReport } from './effects';

export type LockState = 'unmeasured' | 'unstable' | 'provisionally_stable' | 'locked';

export interface LockRecommendation {
  cardId: string;
  state: LockState;
  reasons: string[];
}

export interface LockAnalysisReport {
  generatedAt: string;
  analysisProfile: keyof typeof TURF_SIM_CONFIG.analysisProfiles;
  recommendations: LockRecommendation[];
}

export interface LockSummary {
  totalCards: number;
  unmeasured: number;
  unstable: number;
  provisionallyStable: number;
  locked: number;
  runnerReserveStartRiskCards: string[];
  volatilityOnlyUnstableCards: string[];
}

export function deriveLockRecommendations(
  effectReport: EffectAnalysisReport,
): LockAnalysisReport {
  const thresholds = TURF_SIM_CONFIG.statisticalThresholds;
  const minimumSweepSamples = TURF_SIM_CONFIG.analysisProfiles[effectReport.analysisProfile].minimumSweepSamples;
  const reserveStartRiskMax = thresholds.effectDeltaMax;

  const recommendations = effectReport.cardEffects.map(effect => {
    const reasons: string[] = [];
    let state: LockState = 'provisionally_stable';

    if (effect.sampleCount < minimumSweepSamples) {
      state = 'unmeasured';
      reasons.push(`sampleCount ${effect.sampleCount} below ${minimumSweepSamples}`);
    }
    if (Math.abs(effect.winRateDelta) > thresholds.effectDeltaMax) {
      state = 'unstable';
      reasons.push(`winRateDelta ${effect.winRateDelta.toFixed(4)} exceeds ${thresholds.effectDeltaMax}`);
    }
    if (Math.abs(effect.medianTurnDelta) > thresholds.turnDeltaMax) {
      state = 'unstable';
      reasons.push(`turnDelta ${effect.medianTurnDelta.toFixed(4)} exceeds ${thresholds.turnDeltaMax}`);
    }
    if (effect.volatility > thresholds.volatilityMax) {
      state = 'unstable';
      reasons.push(`volatility ${effect.volatility.toFixed(4)} exceeds ${thresholds.volatilityMax}`);
    }
    if (effect.significant && Math.abs(effect.winRateDelta) > thresholds.interactionRiskMax) {
      state = 'unstable';
      reasons.push(`significant interaction risk ${effect.winRateDelta.toFixed(4)} exceeds ${thresholds.interactionRiskMax}`);
    }
    if (effect.runnerReserveStartUseRateDelta < -reserveStartRiskMax) {
      state = 'unstable';
      reasons.push(
        `runner reserve-start rate ${effect.runnerReserveStartUseRateDelta.toFixed(4)} below -${reserveStartRiskMax.toFixed(4)}`,
      );
    } else if (effect.runnerReserveStartUseRateDelta < 0) {
      reasons.push(`runner reserve-start rate regressed by ${effect.runnerReserveStartUseRateDelta.toFixed(4)}`);
    }
    if (state === 'provisionally_stable' && !effect.significant) {
      state = 'locked';
      reasons.push('effect within thresholds and no significant outlier signal');
    }

    return { cardId: effect.cardId, state, reasons };
  });

  return {
    generatedAt: new Date().toISOString(),
    analysisProfile: effectReport.analysisProfile,
    recommendations,
  };
}

export function summarizeLockRecommendations(report: LockAnalysisReport): LockSummary {
  const summary: LockSummary = {
    totalCards: report.recommendations.length,
    unmeasured: 0,
    unstable: 0,
    provisionallyStable: 0,
    locked: 0,
    runnerReserveStartRiskCards: [],
    volatilityOnlyUnstableCards: [],
  };

  for (const recommendation of report.recommendations) {
    switch (recommendation.state) {
      case 'unmeasured':
        summary.unmeasured++;
        break;
      case 'unstable':
        summary.unstable++;
        break;
      case 'provisionally_stable':
        summary.provisionallyStable++;
        break;
      case 'locked':
        summary.locked++;
        break;
    }
    if (recommendation.reasons.some(reason => reason.includes('runner reserve-start rate'))) {
      summary.runnerReserveStartRiskCards.push(recommendation.cardId);
    }
    if (
      recommendation.state === 'unstable' &&
      recommendation.reasons.length > 0 &&
      recommendation.reasons.every(reason => reason.includes('volatility'))
    ) {
      summary.volatilityOnlyUnstableCards.push(recommendation.cardId);
    }
  }

  return summary;
}
