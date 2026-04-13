/**
 * Attack resolution — direct, funded, pushed.
 * No dice. Outcomes from card power/resistance + drug/weapon modifiers.
 *
 * Quarter-card positioning:
 *   Top-left drug = offensive (buffs attack)
 *   Bottom-left drug = defensive (buffs when attacked)
 *   Top-right weapon = offensive (bonus on attack)
 *   Bottom-right weapon = defensive (bonus on defense)
 */

import type { Position, AttackOutcome, TurfGameConfig } from './types';
import { positionPower, positionDefense, clearPosition } from './board';

export function canPrecisionAttack(
  attackerPower: number,
  targetDefense: number,
  precisionMult: number,
  ignoresPrecision: boolean,
): boolean {
  if (ignoresPrecision) return true;
  return attackerPower <= targetDefense * precisionMult;
}

/**
 * DIRECT ATTACK: attacker power vs defender defense.
 * Offensive drugs/weapons boost attack. Defensive drugs/weapons boost defense.
 */
export function resolveDirectAttack(
  attacker: Position,
  defender: Position,
): AttackOutcome {
  const atk = positionPower(attacker);
  const def = positionDefense(defender);

  if (atk >= def) {
    const name = defender.crew?.displayName ?? 'target';
    clearPosition(defender);
    // Consume offensive drug on use
    if (attacker.drugOffense) attacker.drugOffense = null;
    return {
      type: 'kill', targetIndices: [], lostCards: [], gainedCards: [],
      description: `${attacker.crew!.displayName} kills ${name} (${atk} vs ${def})`,
    };
  }

  // Partial damage: reduce defender's resistance
  const dmg = Math.max(1, atk - Math.floor(def / 2));
  defender.crew!.resistance = Math.max(1, defender.crew!.resistance - dmg);
  if (attacker.drugOffense) attacker.drugOffense = null;
  return {
    type: 'miss', targetIndices: [], lostCards: [], gainedCards: [],
    description: `${attacker.crew!.displayName} wounds target (${atk} vs ${def})`,
  };
}

/**
 * FUNDED ATTACK: crew + cash. Flip attempt.
 * Cash value vs target resistance, modified by affiliation + offensive drug.
 */
export function resolveFundedAttack(
  attacker: Position,
  defender: Position,
  _config: TurfGameConfig,
): AttackOutcome {
  const cashValue = attacker.cash?.denomination ?? 0;
  const targetRes = defender.crew?.resistance ?? 99;
  const isSameAff = attacker.crew!.affiliation === defender.crew!.affiliation;
  const isFreelancer = defender.crew!.affiliation === 'freelance';

  let threshold = targetRes;
  if (isFreelancer) threshold = Math.floor(threshold * 0.5);
  if (isSameAff) threshold = Math.floor(threshold * 0.7);
  if (attacker.drugOffense) {
    threshold = Math.max(1, threshold - attacker.drugOffense.potency);
    attacker.drugOffense = null;
  }

  if (cashValue >= threshold) {
    const flipped = defender.crew!;
    const flippedWeaponO = defender.weaponOffense;
    const flippedWeaponD = defender.weaponDefense;
    clearPosition(defender);
    attacker.cash = null;
    return {
      type: 'flip', targetIndices: [], lostCards: [],
      gainedCards: [flipped, ...(flippedWeaponO ? [flippedWeaponO] : []), ...(flippedWeaponD ? [flippedWeaponD] : [])],
      description: `${attacker.crew!.displayName} flips ${flipped.displayName} ($${cashValue} vs ${threshold})`,
    };
  }

  attacker.cash = null;
  return {
    type: 'busted', targetIndices: [], lostCards: [attacker.cash!].filter(Boolean), gainedCards: [],
    description: `${attacker.crew!.displayName} failed to flip ($${cashValue} < ${threshold})`,
  };
}

/**
 * PUSHED ATTACK: crew + offensive drug + cash.
 * Drug potency + cash vs target defense. Splash to adjacent.
 */
export function resolvePushedAttack(
  attacker: Position,
  defender: Position,
  defenderBoard: Position[],
  _config: TurfGameConfig,
): AttackOutcome {
  const potency = attacker.drugOffense?.potency ?? 1;
  const cashValue = attacker.cash?.denomination ?? 0;
  const pushPower = potency + Math.floor(cashValue / 10);
  const defPower = positionDefense(defender);

  if (pushPower >= defPower) {
    const flipped = [defender.crew!];
    clearPosition(defender);
    const adjIndices = findAdjacent(defenderBoard, defender);
    const splash = Math.min(potency - 1, adjIndices.length);
    for (let i = 0; i < splash; i++) {
      const adj = defenderBoard[adjIndices[i]];
      if (adj.crew) adj.crew.resistance = Math.max(1, adj.crew.resistance - potency);
    }
    attacker.drugOffense = null;
    attacker.cash = null;
    return {
      type: 'flip', targetIndices: adjIndices.slice(0, splash), lostCards: [],
      gainedCards: flipped,
      description: `PUSHED: takes down target + weakens ${splash} adjacent`,
    };
  }

  if (pushPower >= Math.floor(defPower / 2)) {
    defender.crew!.resistance = Math.max(1, defender.crew!.resistance - potency);
    attacker.drugOffense = null;
    attacker.cash = null;
    return {
      type: 'sick', targetIndices: [], lostCards: [], gainedCards: [],
      description: `PUSHED: target weakened by ${potency}`,
    };
  }

  attacker.drugOffense = null;
  attacker.cash = null;
  return {
    type: 'seized', targetIndices: [], lostCards: [], gainedCards: [],
    description: `BUSTED: push failed`,
  };
}

function findAdjacent(board: Position[], target: Position): number[] {
  const idx = board.indexOf(target);
  if (idx < 0) return [];
  const r: number[] = [];
  if (idx > 0 && board[idx - 1].crew) r.push(idx - 1);
  if (idx < board.length - 1 && board[idx + 1].crew) r.push(idx + 1);
  return r;
}
