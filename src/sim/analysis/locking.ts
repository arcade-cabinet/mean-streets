import { TURF_SIM_CONFIG } from '../turf/ai';
import type { EffectAnalysisReport } from './effects';

export type LockState = 'unmeasured' | 'unstable' | 'provisionally_stable' | 'locked' | 'saturated';

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
  saturated: number;
  volatilityOnlyUnstableCards: string[];
}

const RARITY_STAT_BANDS: Record<string, { max: number }> = {
  common: { max: 5 },
  rare: { max: 8 },
  legendary: { max: 12 },
};

function statExceedsRarityBand(
  rarity: string | undefined,
  stat: number,
): boolean {
  if (!rarity) return false;
  const band = RARITY_STAT_BANDS[rarity];
  if (!band) return false;
  return stat > band.max;
}

export function deriveLockRecommendations(
  effectReport: EffectAnalysisReport,
  historyLengths?: Map<string, number>,
  rarities?: Map<string, string>,
  /**
   * Optional map of card ID → current primary stat (power for toughs and
   * most modifiers, resistance for resistance-oriented cards). When
   * supplied alongside `rarities`, the lock analyzer can flag cards whose
   * authored stats drift outside their declared rarity band. Without this
   * map, the rarity-band check is skipped rather than fabricated from
   * winrate (the prior heuristic produced nonsense values).
   */
  stats?: Map<string, number>,
): LockAnalysisReport {
  const thresholds = TURF_SIM_CONFIG.statisticalThresholds;
  const minimumSweepSamples =
    TURF_SIM_CONFIG.analysisProfiles[effectReport.analysisProfile].minimumSweepSamples;
  const maxHistory = (
    TURF_SIM_CONFIG as { autobalance?: { maxHistoryLength?: number } }
  ).autobalance?.maxHistoryLength ?? 8;

  const recommendations = effectReport.cardEffects.map(effect => {
    const reasons: string[] = [];
    let state: LockState = 'provisionally_stable';

    const histLen = historyLengths?.get(effect.cardId) ?? 0;
    if (histLen >= maxHistory) {
      state = 'saturated';
      reasons.push(`history length ${histLen} >= ${maxHistory} (saturated)`);
      return { cardId: effect.cardId, state, reasons };
    }

    if (effect.sampleCount < minimumSweepSamples) {
      state = 'unmeasured';
      reasons.push(`sampleCount ${effect.sampleCount} below ${minimumSweepSamples}`);
    }

    if (Math.abs(effect.winRateDelta) > thresholds.effectDeltaMax) {
      state = 'unstable';
      reasons.push(
        `winRateDelta ${effect.winRateDelta.toFixed(4)} exceeds ${thresholds.effectDeltaMax}`,
      );
    }

    if (Math.abs(effect.medianTurnDelta) > thresholds.turnDeltaMax) {
      state = 'unstable';
      reasons.push(
        `turnDelta ${effect.medianTurnDelta.toFixed(4)} exceeds ${thresholds.turnDeltaMax}`,
      );
    }

    if (effect.volatility > thresholds.volatilityMax) {
      state = 'unstable';
      reasons.push(
        `volatility ${effect.volatility.toFixed(4)} exceeds ${thresholds.volatilityMax}`,
      );
    }

    if (
      effect.significant &&
      Math.abs(effect.winRateDelta) > thresholds.interactionRiskMax
    ) {
      state = 'unstable';
      reasons.push(
        `significant interaction risk ${effect.winRateDelta.toFixed(4)} exceeds ${thresholds.interactionRiskMax}`,
      );
    }

    const rarity = rarities?.get(effect.cardId);
    const currentStat = stats?.get(effect.cardId);
    if (currentStat !== undefined && statExceedsRarityBand(rarity, currentStat)) {
      if (state === 'provisionally_stable') state = 'unstable';
      reasons.push(
        `stat ${currentStat} exceeds rarity band for ${rarity} (max ${RARITY_STAT_BANDS[rarity!]?.max})`,
      );
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

export function summarizeLockRecommendations(
  report: LockAnalysisReport,
): LockSummary {
  const summary: LockSummary = {
    totalCards: report.recommendations.length,
    unmeasured: 0,
    unstable: 0,
    provisionallyStable: 0,
    locked: 0,
    saturated: 0,
    volatilityOnlyUnstableCards: [],
  };

  for (const rec of report.recommendations) {
    switch (rec.state) {
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
      case 'saturated':
        summary.saturated++;
        break;
    }
    if (
      rec.state === 'unstable' &&
      rec.reasons.length > 0 &&
      rec.reasons.every(r => r.includes('volatility'))
    ) {
      summary.volatilityOnlyUnstableCards.push(rec.cardId);
    }
  }

  return summary;
}
