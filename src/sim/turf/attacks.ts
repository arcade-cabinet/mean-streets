/**
 * Attack resolution — direct, funded, pushed.
 * No dice. Outcomes determined by card power, affiliation, and drug modifiers.
 *
 * Drug positioning:
 * - TOP (pushed by): offensive — drug effect applies to TARGET
 * - BOTTOM (used by): defensive — drug effect applies to THIS card
 */

import type { Position, AttackOutcome, TurfGameConfig } from './types';
import { positionPower, positionDefense, clearPosition } from './board';

/** Check precision: attacker power <= target defense * multiplier. */
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
 * DIRECT ATTACK: crew vs crew, pure power comparison.
 * Attacker power (with weapon + drug buff) vs defender defense.
 * Drug on top = extra damage. Drug on bottom of attacker = survivability (handled elsewhere).
 */
export function resolveDirectAttack(
  attacker: Position,
  defender: Position,
): AttackOutcome {
  const atkPower = positionPower(attacker);
  // Drug on top = pushed outward = bonus damage
  const drugBonus = attacker.product ? attacker.product.potency : 0;
  const totalAtk = atkPower + drugBonus;

  const defPower = positionDefense(defender);
  // Drug on bottom of defender = buff = extra defense
  const defDrugBonus = defender.product ? defender.product.potency : 0;
  const totalDef = defPower + defDrugBonus;

  if (totalAtk >= totalDef) {
    const name = defender.crew?.displayName ?? 'target';
    clearPosition(defender);
    // Attacker's drug is consumed on use
    if (attacker.product) attacker.product = null;
    return {
      type: 'kill',
      targetIndices: [],
      lostCards: [],
      gainedCards: [],
      description: `${attacker.crew!.displayName} kills ${name} (${totalAtk} vs ${totalDef})`,
    };
  }

  // Partial damage — reduce defender power
  const damage = Math.max(1, totalAtk - Math.floor(totalDef / 2));
  defender.crew!.power = Math.max(1, defender.crew!.power - damage);
  if (attacker.product) attacker.product = null; // consumed
  return {
    type: 'miss',
    targetIndices: [],
    lostCards: [],
    gainedCards: [],
    description: `${attacker.crew!.displayName} wounds target (${totalAtk} vs ${totalDef})`,
  };
}

/**
 * FUNDED ATTACK: crew + cash. Attempt to FLIP the target.
 * Success based on: cash value vs target power, affiliation match.
 * No dice — deterministic based on card relationships.
 */
export function resolveFundedAttack(
  attacker: Position,
  defender: Position,
  _config: TurfGameConfig,
): AttackOutcome {
  const cashValue = attacker.cash?.denomination ?? 0;
  const targetPower = defender.crew?.power ?? 99;
  const isSameAff = attacker.crew!.affiliation === defender.crew!.affiliation;
  const isFreelancer = defender.crew!.affiliation === 'freelance';

  // Flip threshold: cash must be >= target power * modifier
  let threshold = targetPower;
  if (isFreelancer) threshold = Math.floor(threshold * 0.5);  // freelancers flip easy
  if (isSameAff) threshold = Math.floor(threshold * 0.7);     // same crew, easier

  // Drug bonus: if attacker has product on top (pushing), lower threshold
  if (attacker.product) {
    threshold = Math.max(1, threshold - attacker.product.potency);
    attacker.product = null; // consumed
  }

  if (cashValue >= threshold) {
    const flippedCrew = defender.crew!;
    const flippedWeapon = defender.weapon;
    clearPosition(defender);
    attacker.cash = null; // spent
    return {
      type: 'flip',
      targetIndices: [],
      lostCards: [],
      gainedCards: [flippedCrew, ...(flippedWeapon ? [flippedWeapon] : [])],
      description: `${attacker.crew!.displayName} flips ${flippedCrew.displayName} ($${cashValue} vs threshold ${threshold})`,
    };
  }

  // Failed — cash is lost
  const lostCash = attacker.cash!;
  attacker.cash = null;
  return {
    type: 'busted',
    targetIndices: [],
    lostCards: [lostCash],
    gainedCards: [],
    description: `${attacker.crew!.displayName} failed to flip ($${cashValue} < threshold ${threshold})`,
  };
}

/**
 * PUSHED ATTACK: crew + product + cash. Push product into enemy territory.
 * Product on TOP = offensive push. Outcome based on product potency + cash value
 * vs target defense. Can affect multiple targets.
 */
export function resolvePushedAttack(
  attacker: Position,
  defender: Position,
  defenderBoard: Position[],
  _config: TurfGameConfig,
): AttackOutcome {
  const potency = attacker.product?.potency ?? 1;
  const cashValue = attacker.cash?.denomination ?? 0;
  const pushPower = potency + Math.floor(cashValue / 10);
  const defPower = positionDefense(defender);

  if (pushPower >= defPower) {
    // SUCCESS: primary target goes down, splash to adjacent
    const flipped = [defender.crew!];
    clearPosition(defender);

    const adjIndices = findAdjacentOccupied(defenderBoard, defender);
    const splashCount = Math.min(potency - 1, adjIndices.length);
    for (let i = 0; i < splashCount; i++) {
      const adj = defenderBoard[adjIndices[i]];
      if (adj.crew) {
        // Splash: weaken adjacent, don't kill
        adj.crew.power = Math.max(1, adj.crew.power - potency);
      }
    }

    attacker.product = null; // consumed
    attacker.cash = null;    // spent
    return {
      type: 'flip',
      targetIndices: adjIndices.slice(0, splashCount),
      lostCards: [],
      gainedCards: flipped,
      description: `PUSHED: ${attacker.crew!.displayName} takes down target + weakens ${splashCount} adjacent (power ${pushPower} vs ${defPower})`,
    };
  }

  if (pushPower >= Math.floor(defPower / 2)) {
    // PARTIAL: target weakened but not killed
    defender.crew!.power = Math.max(1, defender.crew!.power - potency);
    attacker.product = null;
    attacker.cash = null;
    return {
      type: 'sick',
      targetIndices: [],
      lostCards: [],
      gainedCards: [],
      description: `PUSHED: target weakened by ${potency} (power ${pushPower} vs ${defPower})`,
    };
  }

  // FAILED: product and cash seized
  const lostProduct = attacker.product!;
  const lostCash = attacker.cash!;
  attacker.product = null;
  attacker.cash = null;
  return {
    type: 'seized',
    targetIndices: [],
    lostCards: [lostProduct, lostCash],
    gainedCards: [],
    description: `BUSTED: product and cash seized (power ${pushPower} vs ${defPower})`,
  };
}

function findAdjacentOccupied(board: Position[], target: Position): number[] {
  const idx = board.indexOf(target);
  if (idx < 0) return [];
  const result: number[] = [];
  if (idx > 0 && board[idx - 1].crew) result.push(idx - 1);
  if (idx < board.length - 1 && board[idx + 1].crew) result.push(idx + 1);
  return result;
}
