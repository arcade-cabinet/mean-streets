import { evaluateFuzzy } from '../ai-fuzzy';
import {
  defensiveCash,
  offensiveCash,
  positionDefense,
  positionPower,
} from '../board';
import { policyActionKey } from '../environment';
import type {
  PlannerMemory,
  TurfAction,
  TurfGameState,
  TurfObservation,
  TurfPolicyArtifact,
} from '../types';
import { TURF_AI_CONFIG } from './config';
import { getPolicyValue, isPolicyPreferredAction } from './policy';

export interface ActionScore {
  score: number;
  policyUsed: boolean;
}

function blockedLanePenalty(memory: PlannerMemory, lane: number | undefined): number {
  if (lane === undefined) return 0;
  return (memory.blockedLanes[lane] ?? 0) * 1.15;
}

function pressuredLaneBonus(memory: PlannerMemory, lane: number | undefined): number {
  if (lane === undefined) return 0;
  return Math.min(2, memory.pressuredLanes[lane] ?? 0) * 0.35;
}

export function scoreAction(
  state: TurfGameState,
  observation: TurfObservation,
  memory: PlannerMemory,
  action: TurfAction,
  policyArtifact?: TurfPolicyArtifact,
): ActionScore {
  const attackWeights = TURF_AI_CONFIG.tacticalWeights.attack;
  const placementWeights = TURF_AI_CONFIG.tacticalWeights.placement;
  const player = state.players[action.side];
  const opponent = state.players[action.side === 'A' ? 'B' : 'A'];
  const fuzzy = evaluateFuzzy(state, action.side);
  let score = 0;

  switch (action.kind) {
    case 'place_crew': {
      const crew = player.hand.crew.find(card => card.id === action.crewCardId);
      if (!crew) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const lanePressure = observation.opponentCrewCount - observation.ownCrewCount;
      score = crew.power + (crew.resistance * 0.9) + lanePressure + (fuzzy.desperation * 2);
      break;
    }

    case 'place_reserve_crew': {
      const crew = player.hand.crew.find(card => card.id === action.crewCardId);
      if (!crew) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      score = (crew.power * 0.85) + (crew.resistance * 1.05) + 0.4 + fuzzy.desperation;
      break;
    }

    case 'equip_backpack': {
      if (action.reserveIdx === undefined || !action.backpackCardId) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const reserve = player.board.reserve[action.reserveIdx];
      const backpack = player.hand.backpacks.find(card => card.id === action.backpackCardId);
      if (!reserve?.crew || !backpack) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const cashPayload = backpack.payload.filter(card => card.type === 'cash').length;
      const offensePayload = backpack.payload.filter(card => card.type === 'weapon' || card.type === 'product').length;
      score = 1.4 + backpack.payload.length * 0.35 + offensePayload * 0.5 + cashPayload * 0.25;
      break;
    }

    case 'deploy_runner': {
      if (action.reserveIdx === undefined || action.positionIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const reserve = player.board.reserve[action.reserveIdx];
      const active = player.board.active[action.positionIdx];
      if (!reserve?.crew || !reserve.runner || !reserve.backpack || !active) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      score = 1.1 + reserve.payloadRemaining * 0.35;
      if (!active.crew) score += 0.8;
      if (active.crew && active.turnsActive === 0) score += 0.5;
      break;
    }

    case 'deploy_payload': {
      if (action.positionIdx === undefined || !action.modifierCardId || !action.slot) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const lane = player.board.active[action.positionIdx];
      if (!lane?.runner || !lane.backpack || !lane.crew) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const payload = lane.backpack.payload.find(card => card.id === action.modifierCardId);
      if (!payload) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      score = action.slot === 'offense' ? 1.35 : 0.95;
      if (payload.type === 'weapon') score += action.slot === 'offense' ? 1.7 : 0.8;
      if (payload.type === 'product') score += action.slot === 'offense' ? 1.55 : 0.7;
      if (payload.type === 'cash') score += action.slot === 'offense' ? 1.3 : 0.5;
      if (action.slot === 'offense' && lane.backpack.payload.length > 1) score += 0.25;
      break;
    }

    case 'arm_weapon':
    case 'stack_product':
    case 'stack_cash': {
      if (action.positionIdx === undefined || !action.modifierCardId) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const position = player.board.active[action.positionIdx];
      if (!position.crew) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const card = player.hand.modifiers.find(candidate => candidate.id === action.modifierCardId);
      if (!card) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      const laneRole = action.positionIdx === undefined ? undefined : memory.laneRoles[action.positionIdx];
      score = action.slot === 'offense'
        ? placementWeights.offenseReady * Math.max(1, positionPower(position))
        : placementWeights.defenseReady * Math.max(1, positionDefense(position));
      score += action.slot === 'offense' ? 1.1 : 0.05;
      if (action.kind === 'stack_cash') {
        const denomination = card.type === 'cash' ? card.denomination : 0;
        score += action.slot === 'offense'
          ? placementWeights.cashOffenseMultiplier * denomination
          : placementWeights.cashDefenseMultiplier * denomination;
        if (action.slot === 'offense') {
          if (position.weaponTop) score += 1.9;
          if (position.drugTop) score += 1.9;
          if (!position.cashLeft) score += 1.1;
          score += 1.1;
          if (observation.ownReadyFunded > 0) score -= 0.9;
          if (observation.ownReadyPushed > 0) score -= 1.4;
          if (observation.ownReadyFunded > 0 && !position.cashLeft) score -= 0.75;
          if (laneRole === 'funded') score -= 0.9;
          if (laneRole === 'pushed') score -= 1.6;
        } else {
          if (position.weaponBottom) score += 0.2;
          if (position.drugBottom) score += 0.2;
        }
      } else if (action.kind === 'arm_weapon' && card.type === 'weapon') {
        score += card.bonus * (action.slot === 'offense' ? 1.9 : 1.0);
        if (action.slot === 'offense' && position.cashLeft) score += 1.5;
        if (action.slot === 'offense' && position.drugTop) score += 0.9;
        if (action.slot === 'offense' && position.cashLeft && !position.drugTop) score += 1.1;
        if (action.slot === 'offense' && position.cashLeft && observation.ownReadyPushed > 0) score += 0.9;
        if (action.slot === 'offense' && laneRole === 'funded') score += 1.1;
        if (action.slot === 'offense' && laneRole === 'pushed') score -= 0.7;
      } else if (action.kind === 'stack_product' && card.type === 'product') {
        score += card.potency * (action.slot === 'offense' ? 1.95 : 0.95);
        if (action.slot === 'offense' && position.cashLeft) score += 1.8;
        if (action.slot === 'offense' && position.weaponTop) score += 1.1;
        if (action.slot === 'offense' && position.cashLeft && observation.ownReadyPushed > 0) score -= 1.35;
        if (action.slot === 'offense' && position.cashLeft && position.weaponTop && observation.ownReadyPushed > 0) score -= 0.65;
        if (action.slot === 'offense' && laneRole === 'funded') score -= 1.4;
        if (action.slot === 'offense' && laneRole === 'pushed') score += 0.35;
        if (
          action.slot === 'offense' &&
          memory.focusLane === action.positionIdx &&
          memory.focusRole === 'funded' &&
          position.cashLeft &&
          position.weaponTop &&
          observation.ownReadyPushed === 0
        ) {
          score += 1.1;
        }
      }
      score += pressuredLaneBonus(memory, action.positionIdx) - blockedLanePenalty(memory, action.positionIdx);
      break;
    }

    case 'reclaim': {
      const position = action.positionIdx === undefined ? null : player.board.active[action.positionIdx];
      if (!position?.seized) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      score = 4 + fuzzy.desperation * 4 + (memory.consecutivePasses * 0.5);
      score -= observation.ownReadyDirect * 0.35;
      score -= observation.ownReadyFunded * 0.65;
      score -= observation.ownReadyPushed * 0.9;
      break;
    }

    case 'direct_attack':
    case 'funded_attack':
    case 'pushed_attack': {
      if (action.attackerIdx === undefined || action.targetIdx === undefined) {
        return { score: Number.NEGATIVE_INFINITY, policyUsed: false };
      }
      const attacker = player.board.active[action.attackerIdx];
      const defender = opponent.board.active[action.targetIdx];
      if (!attacker.crew || !defender.crew) return { score: Number.NEGATIVE_INFINITY, policyUsed: false };

      const atkPower = positionPower(attacker);
      const defPower = positionDefense(defender);
      const margin = atkPower - defPower;
      const offenseCashValue = offensiveCash(attacker);
      const offenseDrugPotency = attacker.drugTop?.potency ?? 0;
      const focusedLane = memory.focusLane;
      const focusedRole = memory.focusRole;
      const fundedPressure = observation.ownReadyFunded > 0 ? 1 : 0;
      const pushedPressure = observation.ownReadyPushed > 0 ? 1 : 0;
      score = (margin * attackWeights.killMargin)
        + pressuredLaneBonus(memory, action.targetIdx)
        - blockedLanePenalty(memory, action.targetIdx);

      if (action.kind === 'funded_attack') {
        score += attackWeights.flipBonus
          + (offenseCashValue - defensiveCash(defender)) * attackWeights.cashEfficiency
          + 1.5
          + Math.max(0, 2 - margin) * 0.75
          + fundedPressure * 0.8
          + (pushedPressure > 0 ? 0.35 : 0);
        if (focusedLane === action.attackerIdx && focusedRole === 'funded') score += 1.1;
        if (
          focusedLane === action.attackerIdx &&
          focusedRole === 'funded' &&
          observation.handProducts > 0 &&
          margin >= 0 &&
          pushedPressure === 0
        ) {
          // Keep funded pressure live for one profitable exchange before upgrading.
          score += 1.2;
        }
      } else if (action.kind === 'pushed_attack') {
        score += attackWeights.flipBonus
          + attackWeights.splashBonus
          + offenseDrugPotency * 0.8
          + Math.max(0, 1 - margin) * 0.75
          + pushedPressure * 1.1
          + (offenseCashValue >= 100 ? 0.6 : 0);
        if (focusedLane === action.attackerIdx && focusedRole === 'pushed') score += 0.9;
      } else {
        score += margin >= 0 ? attackWeights.seizeBonus : 0;
        if (offenseCashValue > 0) score -= 1.75;
        if (offenseDrugPotency > 0) score -= 1.25;
        if (margin <= 1) score -= 1.5;
        if (fundedPressure > 0) score -= 1.15;
        if (pushedPressure > 0) score -= 1.35;
        if ((fundedPressure > 0 || pushedPressure > 0) && margin <= 2) score -= 0.8;
        if (focusedLane === action.attackerIdx && focusedRole) score -= 0.6;
      }

      if (defender.crew.resistance <= 3) score += attackWeights.lowResistanceBonus * 4;
      if (observation.opponentSeized >= state.config.positionCount - 1) score += 5;
      break;
    }

    case 'pass':
      score = -2 - memory.consecutivePasses - fuzzy.desperation;
      break;
  }

  const actionKey = policyActionKey(action);
  const learnedValue = getPolicyValue(policyArtifact, observation.stateKey, actionKey);
  const policyPreferred = isPolicyPreferredAction(policyArtifact, observation.stateKey, actionKey);
  let policyValueMultiplier = TURF_AI_CONFIG.policyWeights.valueMultiplier;
  let policyPreferredBonus = TURF_AI_CONFIG.policyWeights.preferredBonus;
  if (
    memory.focusRole === 'funded' &&
    observation.ownReadyFunded > 0 &&
    observation.ownReadyPushed === 0
  ) {
    if (action.kind === 'funded_attack' || action.kind === 'stack_product') {
      policyValueMultiplier *= 1.35;
      policyPreferredBonus += 0.4;
    } else if (action.kind === 'direct_attack') {
      policyValueMultiplier *= 1.15;
      policyPreferredBonus += 0.2;
    }
  }
  score += learnedValue * policyValueMultiplier;
  if (policyPreferred) score += policyPreferredBonus;

  return {
    score,
    policyUsed: policyPreferred || learnedValue !== 0,
  };
}

export function describeActionForTrace(action: TurfAction): string {
  switch (action.kind) {
    case 'place_crew':
      return `place_crew@${action.positionIdx}`;
    case 'place_reserve_crew':
      return `place_reserve_crew@${action.reserveIdx}`;
    case 'equip_backpack':
      return `equip_backpack@${action.reserveIdx}`;
    case 'deploy_runner':
      return `deploy_runner@${action.reserveIdx}->${action.positionIdx}`;
    case 'deploy_payload':
      return `deploy_payload@${action.positionIdx}:${action.slot}`;
    case 'arm_weapon':
    case 'stack_product':
    case 'stack_cash':
      return `${action.kind}@${action.positionIdx}:${action.slot}`;
    case 'direct_attack':
    case 'funded_attack':
    case 'pushed_attack':
      return `${action.kind}@${action.attackerIdx}->${action.targetIdx}`;
    case 'reclaim':
      return `reclaim@${action.positionIdx}`;
    case 'pass':
      return 'pass';
  }
}
