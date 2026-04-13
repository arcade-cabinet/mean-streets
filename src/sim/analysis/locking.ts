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

export function deriveLockRecommendations(
  effectReport: EffectAnalysisReport,
): LockAnalysisReport {
  const thresholds = TURF_SIM_CONFIG.statisticalThresholds;
  const minimumSweepSamples = TURF_SIM_CONFIG.analysisProfiles[effectReport.analysisProfile].minimumSweepSamples;

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
