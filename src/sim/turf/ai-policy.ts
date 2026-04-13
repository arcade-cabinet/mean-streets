import { TURF_AI_CONFIG } from './ai-config';
import {
  findDirectReady,
  findFundedReady,
  findPushReady,
  hasEmptySlot,
  offensiveCash,
  defensiveCash,
  positionDefense,
  positionPower,
} from './board';
import { canPrecisionAttack } from './attacks';
import type { ModifierCard, PlayerState, Position, TurfGameConfig } from './types';

interface AttackChoice {
  attackerIdx: number;
  targetIdx: number;
  score: number;
}

interface ModifierPlacementChoice {
  index: number;
  slot: 'offense' | 'defense';
  score: number;
}

const attackWeights = TURF_AI_CONFIG.tacticalWeights.attack;
const placementWeights = TURF_AI_CONFIG.tacticalWeights.placement;

function targetFragility(pos: Position): number {
  if (!pos.crew) return 0;
  return Math.max(0, 10 - pos.crew.resistance) * placementWeights.emptyModifierBonus;
}

function retaliationRisk(pos: Position): number {
  let risk = 0;
  if (pos.weaponBottom) risk += pos.weaponBottom.bonus;
  if (pos.drugBottom) risk += pos.drugBottom.potency;
  return risk;
}

function scoreDirect(attacker: Position, defender: Position): number {
  const atk = positionPower(attacker);
  const def = positionDefense(defender);
  const margin = atk - def;
  return (
    margin * attackWeights.killMargin
    + (margin >= 0 ? attackWeights.seizeBonus : 0)
    + targetFragility(defender) * attackWeights.lowResistanceBonus
    - retaliationRisk(defender) * attackWeights.retaliationRisk
  );
}

function scoreFunded(attacker: Position, defender: Position): number {
  const atkCash = offensiveCash(attacker);
  const threshold = (defender.crew?.resistance ?? 99) + defensiveCash(defender);
  const margin = atkCash - threshold;
  return (
    margin * attackWeights.cashEfficiency
    + (margin >= 0 ? attackWeights.flipBonus : 0)
    + targetFragility(defender) * attackWeights.lowResistanceBonus
    - retaliationRisk(defender) * attackWeights.retaliationRisk
  );
}

function scorePushed(attacker: Position, defender: Position, enemyBoard: Position[]): number {
  const potency = attacker.drugTop?.potency ?? 0;
  const pushPower = potency + Math.floor(offensiveCash(attacker) / 10);
  const def = positionDefense(defender);
  const splashTargets = enemyBoard.filter(pos => pos.crew && pos !== defender).length;
  return (
    (pushPower - def) * attackWeights.killMargin
    + attackWeights.flipBonus
    + Math.min(splashTargets, 2) * attackWeights.splashBonus
    - retaliationRisk(defender) * attackWeights.retaliationRisk
  );
}

function chooseBestAttack(
  attackerIndices: number[],
  ownBoard: Position[],
  enemyBoard: Position[],
  score: (attacker: Position, defender: Position) => number,
): AttackChoice | null {
  let best: AttackChoice | null = null;

  for (const attackerIdx of attackerIndices) {
    const attacker = ownBoard[attackerIdx];
    for (let targetIdx = 0; targetIdx < enemyBoard.length; targetIdx++) {
      const target = enemyBoard[targetIdx];
      if (!target.crew) continue;
      const nextScore = score(attacker, target);
      if (!best || nextScore > best.score) {
        best = { attackerIdx, targetIdx, score: nextScore };
      }
    }
  }

  return best;
}

function scoreModifierPlacement(pos: Position, card: ModifierCard, slot: 'offense' | 'defense'): number {
  if (!pos.crew || pos.seized) return Number.NEGATIVE_INFINITY;

  let score = hasEmptySlot(pos) ? placementWeights.emptyModifierBonus : 0;
  if (slot === 'offense') {
    score += placementWeights.offenseReady * Math.max(1, pos.crew.power);
  } else {
    score += placementWeights.defenseReady * Math.max(1, pos.crew.resistance);
  }

  if (card.type === 'cash') {
    score += (slot === 'offense'
      ? placementWeights.cashOffenseMultiplier
      : placementWeights.cashDefenseMultiplier) * card.denomination;
  } else if (card.type === 'weapon') {
    score += card.bonus;
  } else if (card.type === 'product') {
    score += card.potency;
  }

  if (pos.seized) {
    score -= placementWeights.seizedPenalty;
  }

  return score;
}

export function chooseBestDirectAttack(
  player: PlayerState,
  opponent: PlayerState,
  config: TurfGameConfig,
): AttackChoice | null {
  const ready = findDirectReady(player.board);
  let best: AttackChoice | null = null;

  for (const attackerIdx of ready) {
    const attacker = player.board.active[attackerIdx];
    if (!attacker.crew) continue;

    for (let targetIdx = 0; targetIdx < opponent.board.active.length; targetIdx++) {
      const defender = opponent.board.active[targetIdx];
      if (!defender.crew) continue;
      if (!canPrecisionAttack(
        positionPower(attacker),
        positionDefense(defender),
        config.precisionMult,
        attacker.crew.archetype === 'bruiser',
      )) {
        continue;
      }

      const score = scoreDirect(attacker, defender);
      if (!best || score > best.score) {
        best = { attackerIdx, targetIdx, score };
      }
    }
  }

  return best;
}

export function chooseBestFundedAttack(player: PlayerState, opponent: PlayerState): AttackChoice | null {
  return chooseBestAttack(
    findFundedReady(player.board),
    player.board.active,
    opponent.board.active,
    scoreFunded,
  );
}

export function chooseBestPushedAttack(
  player: PlayerState,
  opponent: PlayerState,
  _config: TurfGameConfig,
): AttackChoice | null {
  return chooseBestAttack(
    findPushReady(player.board),
    player.board.active,
    opponent.board.active,
    (attacker, defender) => scorePushed(attacker, defender, opponent.board.active),
  );
}

export function chooseBestModifierPlacement(
  player: PlayerState,
  card: ModifierCard,
): ModifierPlacementChoice | null {
  let best: ModifierPlacementChoice | null = null;

  for (let index = 0; index < player.board.active.length; index++) {
    const pos = player.board.active[index];
    if (!pos.crew || pos.seized) continue;

    const choices: Array<'offense' | 'defense'> = [];
    if (
      (card.type === 'weapon' && !pos.weaponTop)
      || (card.type === 'product' && !pos.drugTop)
      || (card.type === 'cash' && !pos.cashLeft)
    ) {
      choices.push('offense');
    }
    if (
      (card.type === 'weapon' && !pos.weaponBottom)
      || (card.type === 'product' && !pos.drugBottom)
      || (card.type === 'cash' && !pos.cashRight)
    ) {
      choices.push('defense');
    }

    for (const slot of choices) {
      const score = scoreModifierPlacement(pos, card, slot);
      if (!best || score > best.score) {
        best = { index, slot, score };
      }
    }
  }

  return best;
}
