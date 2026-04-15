import {
  positionPower,
  positionResistance,
  turfCurrency,
  turfToughs,
  turfAffiliationConflict,
  hasToughOnTurf,
} from '../board';
import { topToughIdx } from '../stack-ops';
import { policyActionKey } from '../env-query';
import type {
  Card,
  PlannerMemory,
  TurfAction,
  TurfGameState,
  TurfObservation,
  TurfPolicyArtifact,
} from '../types';
import { TURF_AI_CONFIG, TURF_SIM_CONFIG } from './config';
import { getPolicyValue, isPolicyPreferredAction } from './policy';

export interface ActionScore {
  score: number;
  policyUsed: boolean;
}

function findCard(hand: Card[], cardId: string | undefined): Card | undefined {
  if (!cardId) return undefined;
  return hand.find((c) => c.id === cardId);
}

export function scoreAction(
  state: TurfGameState,
  observation: TurfObservation,
  memory: PlannerMemory,
  action: TurfAction,
  policyArtifact?: TurfPolicyArtifact,
): ActionScore {
  const attackWeights = TURF_AI_CONFIG.tacticalWeights.attack;
  const sc = TURF_SIM_CONFIG.aiScoring;
  const combat = TURF_SIM_CONFIG.combat;
  const player = state.players[action.side];
  const opponent = state.players[action.side === 'A' ? 'B' : 'A'];
  let score = 0;

  switch (action.kind) {
    case 'play_card': {
      const card = findCard(player.hand, action.cardId);
      if (!card || action.turfIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const turf = player.turfs[action.turfIdx];
      if (!turf) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };

      if (card.kind === 'tough') {
        const toughCount = turfToughs(turf).length;
        score = card.power + card.resistance * sc.placeCrewCrewResistanceWeight;
        score += (observation.opponentToughsInPlay - observation.ownToughsInPlay) * sc.placeCrewDesperationWeight;
        if (toughCount === 0) score += sc.emptyTurfBonus;
        if (turfAffiliationConflict(turf, card)) {
          return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
        }
        const sameAff = turfToughs(turf).filter((t) => t.affiliation === card.affiliation).length;
        if (sameAff > 0) score += sc.affiliationSynergyBonus;
      } else if (card.kind === 'weapon' || card.kind === 'drug') {
        if (!hasToughOnTurf(turf)) {
          return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
        }
        score = card.power * sc.modPowerWeight + card.resistance * sc.modResistanceWeight;
        const turfPow = positionPower(turf);
        if (turfPow > 0) score += sc.modOnPoweredTurfBonus;
      } else if (card.kind === 'currency') {
        if (!hasToughOnTurf(turf)) {
          return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
        }
        score = card.denomination / sc.currencyDenominationScale;
        const existingCash = turfCurrency(turf);
        const totalCash = existingCash.reduce((s, c) => s + c.denomination, 0) + card.denomination;
        if (totalCash >= sc.fundedThreshold) score += sc.fundedReadyBonus;
        else score += sc.currencyBaseScore;
      }
      break;
    }

    case 'direct_strike': {
      if (action.turfIdx === undefined || action.targetTurfIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const atkTurf = player.turfs[action.turfIdx];
      const defTurf = opponent.turfs[action.targetTurfIdx];
      if (!atkTurf || !defTurf) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      if (!hasToughOnTurf(atkTurf) || !hasToughOnTurf(defTurf)) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const P = positionPower(atkTurf);
      const R = positionResistance(defTurf);
      const margin = P - R;
      score = margin * attackWeights.killMargin;
      if (margin >= 0) score += attackWeights.seizeBonus;
      else if (P >= Math.floor(R / combat.sickThresholdDivisor)) score += sc.sickBonus;
      else score += sc.missPenalty;

      const defToughs = turfToughs(defTurf);
      if (defToughs.length > 0) {
        const targetIdx = topToughIdx(defTurf);
        if (targetIdx >= 0) {
          const target = defTurf.stack[targetIdx];
          if (target.kind === 'tough' && target.resistance <= sc.lowResistanceThreshold) {
            score += attackWeights.lowResistanceBonus * sc.lowResistanceMultiplier;
          }
        }
      }
      if (opponent.turfs.length <= 1) score += sc.lastTurfBonus;
      break;
    }

    case 'pushed_strike': {
      if (action.turfIdx === undefined || action.targetTurfIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const atkTurf = player.turfs[action.turfIdx];
      const defTurf = opponent.turfs[action.targetTurfIdx];
      if (!atkTurf || !defTurf) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const currency = turfCurrency(atkTurf);
      if (currency.length === 0) return { score: -5, policyUsed: false };

      const cashBonus = currency[0].denomination / combat.pushedDenominationScale;
      const P = positionPower(atkTurf) + cashBonus;
      const R = positionResistance(defTurf);
      const margin = P - R;
      score = margin * attackWeights.killMargin + attackWeights.flipBonus + attackWeights.splashBonus;
      if (margin >= 0) score += sc.pushedKillBonus;
      if (opponent.turfs.length <= 1) score += sc.lastTurfBonus;
      break;
    }

    case 'funded_recruit': {
      if (action.turfIdx === undefined || action.targetTurfIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const atkTurf = player.turfs[action.turfIdx];
      const defTurf = opponent.turfs[action.targetTurfIdx];
      if (!atkTurf || !defTurf) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const currency = turfCurrency(atkTurf);
      const totalCash = currency.reduce((s, c) => s + c.denomination, 0);
      if (totalCash < combat.fundedRecruitMinCash) return { score: -5, policyUsed: false };

      const tgtIdx = topToughIdx(defTurf);
      if (tgtIdx < 0) return { score: -5, policyUsed: false };
      const target = defTurf.stack[tgtIdx];
      if (target.kind !== 'tough') return { score: -5, policyUsed: false };

      const affMult = combat.affiliationMult as Record<string, number>;
      const atkAffs = turfToughs(atkTurf).map((t) => t.affiliation);
      let mult = affMult.other;
      if (target.affiliation === 'freelance') mult = affMult.freelance;
      else if (atkAffs.includes(target.affiliation)) mult = affMult.same;
      else if (turfAffiliationConflict(atkTurf, target)) mult = affMult.rival;

      const threshold = target.resistance * mult;
      if (totalCash >= threshold) {
        score = attackWeights.flipBonus + sc.fundedSuccessBonus + target.power;
        if (mult <= affMult.same) score += sc.fundedCheapAffinityBonus;
      } else {
        score = sc.fundedFailPenalty;
      }
      if (opponent.turfs.length <= 1) score += sc.lastTurfBonus;
      break;
    }

    case 'discard': {
      const card = findCard(player.hand, action.cardId);
      if (!card) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      score = sc.discardBase;
      if (card.kind === 'currency' && card.denomination === 100) score += sc.discardCheapCurrencyBonus;
      if (observation.ownToughsInPlay === 0 && card.kind !== 'tough') score += sc.discardNoToughsBonus;
      break;
    }

    case 'end_turn':
      score = sc.endTurnBase;
      if (observation.actionsRemaining <= 0) score += sc.endTurnNoActionsBonus;
      break;

    case 'pass':
      score = sc.passBasePenalty - memory.consecutivePasses;
      break;
  }

  const actionKey = policyActionKey(action);
  const learnedValue = getPolicyValue(policyArtifact, observation.stateKey, actionKey);
  const policyPreferred = isPolicyPreferredAction(policyArtifact, observation.stateKey, actionKey);
  const policyWeights = TURF_AI_CONFIG.policyWeights;
  score += learnedValue * policyWeights.valueMultiplier;
  if (policyPreferred) score += policyWeights.preferredBonus;

  return {
    score,
    policyUsed: policyPreferred || learnedValue !== 0,
  };
}

export function describeActionForTrace(action: TurfAction): string {
  switch (action.kind) {
    case 'play_card':
      return `play_card@${action.turfIdx}:${action.cardId}`;
    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit':
      return `${action.kind}@${action.turfIdx}->${action.targetTurfIdx}`;
    case 'discard':
      return `discard:${action.cardId}`;
    case 'end_turn':
      return 'end_turn';
    case 'pass':
      return 'pass';
  }
}
