/**
 * Attack resolution — direct, funded, pushed.
 * Each attack type has different die roll outcome tables.
 */

import type { Position, AttackOutcome, TurfGameConfig } from './types';
import type { Rng } from '../cards/rng';
import { positionPower, clearPosition, seizePosition } from './board';

/** Check precision: attacker power <= target power * multiplier. */
export function canPrecisionAttack(
  attackerPower: number,
  targetPower: number,
  precisionMult: number,
  ignoresPrecision: boolean,
): boolean {
  if (ignoresPrecision) return true;
  return attackerPower <= targetPower * precisionMult;
}

/**
 * DIRECT ATTACK: crew vs crew, pure damage.
 * No die roll. Attacker power vs defender power.
 * If attacker >= defender, kill. Otherwise, reduce defender power.
 */
export function resolveDirectAttack(
  attacker: Position,
  defender: Position,
): AttackOutcome {
  const atkPower = positionPower(attacker);
  const defPower = positionPower(defender);

  if (atkPower >= defPower) {
    const lost = clearPosition(defender);
    return {
      type: 'kill',
      targetIndices: [],
      lostCards: [],
      gainedCards: [],
      description: `${attacker.crew!.displayName} kills ${lost[0]?.type === 'crew' ? (lost[0] as any).displayName : 'target'} (${atkPower} vs ${defPower})`,
    };
  }

  // Partial damage — reduce defender's effective HP
  defender.crew!.power = Math.max(1, defPower - atkPower);
  return {
    type: 'miss',
    targetIndices: [],
    lostCards: [],
    gainedCards: [],
    description: `${attacker.crew!.displayName} wounds target (${atkPower} vs ${defPower}, reduced to ${defender.crew!.power})`,
  };
}

/**
 * FUNDED ATTACK: crew + cash. Attempt to FLIP the target.
 * Die roll determines outcome.
 */
export function resolveFundedAttack(
  attacker: Position,
  defender: Position,
  config: TurfGameConfig,
  rng: Rng,
): AttackOutcome {
  const roll = rng.int(1, config.dieSize);
  const isSameAffiliation = attacker.crew!.affiliation === defender.crew!.affiliation;
  const isFreelancer = defender.crew!.affiliation === 'freelance';

  // Flip threshold adjusted by affiliation
  let threshold = config.flipThreshold;
  if (isFreelancer) threshold -= 2;        // freelancers flip easy
  if (isSameAffiliation) threshold -= 1;    // same crew, easier to turn

  // Weapon bonus: Fake Badge reduces threshold
  if (attacker.weapon?.effect === 'flip') threshold -= 2;

  threshold = Math.max(1, threshold);

  if (roll >= threshold) {
    // SUCCESS: flip the target card to your side
    const flippedCrew = defender.crew!;
    const flippedWeapon = defender.weapon;
    clearPosition(defender);
    // Cash is spent
    attacker.cash = null;
    return {
      type: 'flip',
      targetIndices: [],
      lostCards: [],
      gainedCards: [flippedCrew, ...(flippedWeapon ? [flippedWeapon] : [])],
      description: `${attacker.crew!.displayName} flips ${flippedCrew.displayName} (rolled ${roll}, needed ${threshold}+)`,
    };
  }

  // FAILURE: cash is seized by defender
  const lostCash = attacker.cash!;
  attacker.cash = null;
  return {
    type: 'busted',
    targetIndices: [],
    lostCards: [lostCash],
    gainedCards: [],
    description: `${attacker.crew!.displayName} failed to flip (rolled ${roll}, needed ${threshold}+). Cash seized.`,
  };
}

/**
 * PUSHED ATTACK: crew + product + cash. The big play.
 * Multiple outcomes based on die roll.
 */
export function resolvePushedAttack(
  attacker: Position,
  defender: Position,
  defenderBoard: Position[],
  config: TurfGameConfig,
  rng: Rng,
): AttackOutcome {
  const roll = rng.int(1, config.dieSize);
  const potency = attacker.product?.potency ?? 1;

  // Hook effect: lower threshold
  const hookBonus = attacker.product?.effect === 'hook' ? potency : 0;

  if (roll >= 5 + (config.dieSize > 6 ? 1 : 0) - hookBonus) {
    // BEST: multiple enemies get hooked/flipped, keep product+cash
    const flipped = [defender.crew!];
    clearPosition(defender);
    // Also affect adjacent positions based on potency
    const adjacentHits = Math.min(potency - 1, 2);
    const adjIndices = findAdjacentOccupied(defenderBoard, defender);
    for (let i = 0; i < adjacentHits && i < adjIndices.length; i++) {
      const adj = defenderBoard[adjIndices[i]];
      if (adj.crew) {
        flipped.push(adj.crew);
        clearPosition(adj);
      }
    }
    // Product consumed, cash kept
    attacker.product = null;
    return {
      type: 'flip',
      targetIndices: adjIndices.slice(0, adjacentHits),
      lostCards: [],
      gainedCards: flipped,
      description: `PUSHED: ${attacker.crew!.displayName} hooks ${flipped.length} targets (rolled ${roll})`,
    };
  }

  if (roll >= 3 - hookBonus) {
    // OK: target gets sick/debuffed, product consumed, cash spent
    if (defender.crew) {
      defender.crew.power = Math.max(1, defender.crew.power - potency);
    }
    attacker.product = null;
    attacker.cash = null;
    return {
      type: 'sick',
      targetIndices: [],
      lostCards: [],
      gainedCards: [],
      description: `PUSHED: ${defender.crew?.displayName ?? 'target'} gets sick (-${potency} power, rolled ${roll})`,
    };
  }

  // BAD: product AND cash seized by opponent
  const lostProduct = attacker.product!;
  const lostCash = attacker.cash!;
  attacker.product = null;
  attacker.cash = null;
  return {
    type: 'seized',
    targetIndices: [],
    lostCards: [lostProduct, lostCash],
    gainedCards: [],
    description: `BUSTED: ${attacker.crew!.displayName}'s product and cash seized (rolled ${roll})`,
  };
}

/** Find indices of occupied adjacent positions. */
function findAdjacentOccupied(board: Position[], target: Position): number[] {
  const idx = board.indexOf(target);
  if (idx < 0) return [];
  const result: number[] = [];
  if (idx > 0 && board[idx - 1].crew) result.push(idx - 1);
  if (idx < board.length - 1 && board[idx + 1].crew) result.push(idx + 1);
  return result;
}
