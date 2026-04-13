/**
 * Attack resolution — direct, funded, pushed.
 * Drug/weapon/cash positioning determines offense vs defense.
 */

import type { Position, AttackOutcome, TurfGameConfig } from './types';
import { positionPower, positionDefense, offensiveCash, defensiveCash, clearPosition } from './board';

export function canPrecisionAttack(
  atkPower: number, defPower: number, mult: number, ignores: boolean,
): boolean {
  return ignores || atkPower <= defPower * mult;
}

/** DIRECT: attacker power vs defender defense. */
export function resolveDirectAttack(attacker: Position, defender: Position): AttackOutcome {
  const atk = positionPower(attacker);
  const def = positionDefense(defender);

  if (atk >= def) {
    const name = defender.crew?.displayName ?? 'target';
    clearPosition(defender);
    if (attacker.drugTop) attacker.drugTop = null; // consumed
    return {
      type: 'kill', targetIndices: [], lostCards: [], gainedCards: [],
      description: `${attacker.crew!.displayName} kills ${name} (${atk} vs ${def})`,
    };
  }

  const dmg = Math.max(1, atk - Math.floor(def / 2));
  defender.crew!.resistance = Math.max(1, defender.crew!.resistance - dmg);
  if (attacker.drugTop) attacker.drugTop = null;
  return {
    type: 'miss', targetIndices: [], lostCards: [], gainedCards: [],
    description: `${attacker.crew!.displayName} wounds target (${atk} vs ${def})`,
  };
}

/** FUNDED: crew + offensive cash. Flip attempt. Defensive cash resists. */
export function resolveFundedAttack(
  attacker: Position, defender: Position, _config: TurfGameConfig,
): AttackOutcome {
  const atkCash = offensiveCash(attacker);
  const defCash = defensiveCash(defender);
  const targetRes = defender.crew?.resistance ?? 99;
  const isSameAff = attacker.crew!.affiliation === defender.crew!.affiliation;
  const isFreelancer = defender.crew!.affiliation === 'freelance';

  let threshold = targetRes + defCash;
  if (isFreelancer) threshold = Math.floor(threshold * 0.5);
  if (isSameAff) threshold = Math.floor(threshold * 0.7);
  if (attacker.drugTop) {
    threshold = Math.max(1, threshold - attacker.drugTop.potency);
    attacker.drugTop = null;
  }

  if (atkCash >= threshold) {
    const flipped = defender.crew!;
    clearPosition(defender);
    attacker.cashLeft = null;
    return {
      type: 'flip', targetIndices: [], lostCards: [], gainedCards: [flipped],
      description: `${attacker.crew!.displayName} flips ${flipped.displayName} ($${atkCash} vs ${threshold})`,
    };
  }

  attacker.cashLeft = null;
  return {
    type: 'busted', targetIndices: [], lostCards: [], gainedCards: [],
    description: `Failed flip ($${atkCash} < ${threshold})`,
  };
}

/** PUSHED: crew + offensive drug + offensive cash. Splash capable. */
export function resolvePushedAttack(
  attacker: Position, defender: Position,
  defBoard: Position[], _config: TurfGameConfig,
): AttackOutcome {
  const potency = attacker.drugTop?.potency ?? 1;
  const cash = offensiveCash(attacker);
  const pushPower = potency + Math.floor(cash / 10);
  const defPower = positionDefense(defender);

  if (pushPower >= defPower) {
    const flipped = [defender.crew!];
    clearPosition(defender);
    const adj = findAdjacent(defBoard, defender);
    const splash = Math.min(potency - 1, adj.length);
    for (let i = 0; i < splash; i++) {
      const a = defBoard[adj[i]];
      if (a.crew) a.crew.resistance = Math.max(1, a.crew.resistance - potency);
    }
    attacker.drugTop = null;
    attacker.cashLeft = null;
    return {
      type: 'flip', targetIndices: adj.slice(0, splash), lostCards: [],
      gainedCards: flipped, description: `PUSH: target down + ${splash} weakened`,
    };
  }

  if (pushPower >= Math.floor(defPower / 2)) {
    defender.crew!.resistance = Math.max(1, defender.crew!.resistance - potency);
    attacker.drugTop = null;
    attacker.cashLeft = null;
    return {
      type: 'sick', targetIndices: [], lostCards: [], gainedCards: [],
      description: `PUSH: target weakened by ${potency}`,
    };
  }

  attacker.drugTop = null;
  attacker.cashLeft = null;
  return {
    type: 'seized', targetIndices: [], lostCards: [], gainedCards: [],
    description: `PUSH: busted`,
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
