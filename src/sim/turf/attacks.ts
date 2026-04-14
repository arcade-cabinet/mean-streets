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

function chipAttacker(attacker: Position, amount: number): void {
  if (!attacker.crew || amount <= 0) return;
  attacker.crew.resistance = Math.max(1, attacker.crew.resistance - amount);
}

function applyCounterDamage(attacker: Position, defender: Position): string[] {
  const notes: string[] = [];

  if (defender.weaponBottom?.category === 'bladed') {
    chipAttacker(attacker, defender.weaponBottom.bonus);
    notes.push(`PARRY ${defender.weaponBottom.bonus}`);
  }

  if (defender.drugBottom?.category === 'stimulant') {
    chipAttacker(attacker, defender.drugBottom.potency);
    notes.push(`REFLEXES ${defender.drugBottom.potency}`);
  }

  return notes;
}

function applyAttackerAftermath(attacker: Position): string[] {
  const notes: string[] = [];

  if (attacker.drugTop?.category === 'narcotic') {
    chipAttacker(attacker, 1);
    notes.push('BERSERK backlash');
  }

  return notes;
}

function defenderEvades(defender: Position): boolean {
  if (defender.weaponBottom?.category !== 'stealth') return false;
  defender.weaponBottom = null;
  return true;
}

function defenderSurvivesKill(defender: Position): boolean {
  if (defender.drugBottom?.category !== 'narcotic') return false;
  defender.drugBottom = null;
  if (defender.crew) defender.crew.resistance = 1;
  return true;
}

function applySuppression(attacker: Position, defender: Position): string[] {
  if (!defender.crew || attacker.drugTop?.category !== 'sedative') return [];
  defender.crew.power = Math.max(1, defender.crew.power - attacker.drugTop.potency);
  return [`SUPPRESS ${attacker.drugTop.potency}`];
}

function defensiveThresholdBonus(defender: Position): number {
  let bonus = 0;
  if (defender.weaponBottom?.category === 'explosive') bonus += defender.weaponBottom.bonus;
  if (defender.weaponBottom?.category === 'ranged') bonus += defender.weaponBottom.bonus;
  return bonus;
}

function defensiveDamageReduction(defender: Position): number {
  let reduction = 0;
  if (defender.drugBottom?.category === 'sedative') reduction += defender.drugBottom.potency;
  if (defender.drugBottom?.category === 'steroid') reduction += defender.drugBottom.potency;
  if (defender.weaponBottom?.category === 'blunt') reduction += defender.weaponBottom.bonus;
  return reduction;
}

function attackerBonusDamage(
  attacker: Position,
  context?: AttackContext,
): { amount: number; notes: string[] } {
  const notes: string[] = [];
  let amount = 0;
  if (attacker.weaponTop?.category === 'ranged') {
    amount += attacker.weaponTop.bonus;
    notes.push(`REACH ${attacker.weaponTop.bonus}`);
  }
  if (attacker.drugTop?.category === 'steroid') {
    amount += attacker.drugTop.potency;
    notes.push(`BULK ${attacker.drugTop.potency}`);
  }
  if (
    attacker.crew?.archetype === 'shark' &&
    context &&
    context.opponentCardsInPlay < context.ownCardsInPlay
  ) {
    const diff = context.ownCardsInPlay - context.opponentCardsInPlay;
    amount += diff;
    notes.push(`BLOOD_FRENZY ${diff}`);
  }
  if (
    attacker.crew?.archetype === 'enforcer' &&
    context?.targetIsAtWar === true
  ) {
    // VENDETTA: double final damage against a rival affiliation.
    // Applied as a multiplier hook in the caller — we mark intent here.
  }
  return { amount, notes };
}

export interface AttackContext {
  /** Number of active cards on the attacker's side (board). */
  ownCardsInPlay: number;
  /** Number of active cards on the defender's side (board). */
  opponentCardsInPlay: number;
  /** True when the defender's affiliation is in the attacker's atWarWith list. */
  targetIsAtWar?: boolean;
}

function joinDescription(base: string, notes: string[]): string {
  if (notes.length === 0) return base;
  return `${base} [${notes.join(', ')}]`;
}

/** DIRECT: attacker power vs defender defense. */
export function resolveDirectAttack(
  attacker: Position,
  defender: Position,
  context?: AttackContext,
): AttackOutcome {
  if (defenderEvades(defender)) {
    return {
      type: 'miss', targetIndices: [], lostCards: [], gainedCards: [],
      description: `${defender.crew?.displayName ?? 'target'} evades the attack`,
    };
  }

  const atk = positionPower(attacker);
  const def = positionDefense(defender) + defensiveThresholdBonus(defender);
  const notes: string[] = [];

  if (atk >= def) {
    if (defenderSurvivesKill(defender)) {
      notes.push(...applyCounterDamage(attacker, defender));
      notes.push(...applyAttackerAftermath(attacker));
      return {
        type: 'sick', targetIndices: [], lostCards: [], gainedCards: [],
        description: joinDescription(`${defender.crew!.displayName} survives the killing blow`, notes),
      };
    }
    const name = defender.crew?.displayName ?? 'target';
    clearPosition(defender);
    if (attacker.drugTop) attacker.drugTop = null; // consumed
    notes.push(...applyCounterDamage(attacker, defender));
    notes.push(...applyAttackerAftermath(attacker));
    return {
      type: 'kill', targetIndices: [], lostCards: [], gainedCards: [],
      description: joinDescription(`${attacker.crew!.displayName} kills ${name} (${atk} vs ${def})`, notes),
    };
  }

  let dmg = Math.max(1, atk - Math.floor(def / 2));
  dmg = Math.max(0, dmg - defensiveDamageReduction(defender));
  if (attacker.weaponTop?.category === 'bladed') {
    dmg += attacker.weaponTop.bonus;
    notes.push(`LACERATE ${attacker.weaponTop.bonus}`);
  }
  const bonus = attackerBonusDamage(attacker, context);
  if (bonus.amount > 0) {
    dmg += bonus.amount;
    notes.push(...bonus.notes);
  }
  if (attacker.crew?.archetype === 'enforcer' && context?.targetIsAtWar) {
    dmg *= 2;
    notes.push('VENDETTA x2');
  }
  notes.push(...applySuppression(attacker, defender));
  notes.push(...applyCounterDamage(attacker, defender));
  notes.push(...applyAttackerAftermath(attacker));
  if (dmg === 0) {
    if (attacker.drugTop) attacker.drugTop = null;
    return {
      type: 'miss', targetIndices: [], lostCards: [], gainedCards: [],
      description: joinDescription(`${defender.crew!.displayName} shrugs off the hit`, notes),
    };
  }
  defender.crew!.resistance = Math.max(1, defender.crew!.resistance - dmg);
  if (attacker.drugTop) attacker.drugTop = null;
  return {
    type: 'miss', targetIndices: [], lostCards: [], gainedCards: [],
    description: joinDescription(`${attacker.crew!.displayName} wounds target (${atk} vs ${def})`, notes),
  };
}

/** FUNDED: crew + offensive cash. Flip attempt. Defensive cash resists. */
export function resolveFundedAttack(
  attacker: Position, defender: Position, _config: TurfGameConfig,
): AttackOutcome {
  if (defenderEvades(defender)) {
    attacker.cashLeft = null;
    return {
      type: 'busted', targetIndices: [], lostCards: [], gainedCards: [],
      description: `${defender.crew?.displayName ?? 'target'} slips the funded play`,
    };
  }

  const atkCash = offensiveCash(attacker);
  const defCash = defensiveCash(defender);
  const targetRes = defender.crew?.resistance ?? 99;
  const isSameAff = attacker.crew!.affiliation === defender.crew!.affiliation;
  const isFreelancer = defender.crew!.affiliation === 'freelance';
  const notes: string[] = [];

  let threshold = targetRes + defCash + defensiveThresholdBonus(defender);
  if (isFreelancer) threshold = Math.floor(threshold * 0.5);
  if (isSameAff) threshold = Math.floor(threshold * 0.7);
  if (attacker.drugTop?.category === 'hallucinogen') {
    threshold = Math.max(1, threshold - attacker.drugTop.potency);
    notes.push(`CONFUSE ${attacker.drugTop.potency}`);
  }
  if (defender.drugBottom?.category === 'hallucinogen') {
    threshold += defender.drugBottom.potency;
    notes.push(`PARANOIA ${defender.drugBottom.potency}`);
  }
  if (attacker.drugTop) {
    attacker.drugTop = null;
  }

  if (atkCash >= threshold) {
    const flipped = defender.crew!;
    clearPosition(defender);
    attacker.cashLeft = null;
    notes.push(...applyCounterDamage(attacker, defender));
    notes.push(...applyAttackerAftermath(attacker));
    return {
      type: 'flip', targetIndices: [], lostCards: [], gainedCards: [flipped],
      description: joinDescription(
        `${attacker.crew!.displayName} flips ${flipped.displayName} ($${atkCash} vs ${threshold})`,
        notes,
      ),
    };
  }

  attacker.cashLeft = null;
  notes.push(...applyCounterDamage(attacker, defender));
  notes.push(...applyAttackerAftermath(attacker));
  return {
    type: 'busted', targetIndices: [], lostCards: [], gainedCards: [],
    description: joinDescription(`Failed flip ($${atkCash} < ${threshold})`, notes),
  };
}

/** PUSHED: crew + offensive drug + offensive cash. Splash capable. */
export function resolvePushedAttack(
  attacker: Position, defender: Position,
  defBoard: Position[], _config: TurfGameConfig,
): AttackOutcome {
  if (defenderEvades(defender)) {
    attacker.drugTop = null;
    attacker.cashLeft = null;
    return {
      type: 'seized', targetIndices: [], lostCards: [], gainedCards: [],
      description: `${defender.crew?.displayName ?? 'target'} evades the push`,
    };
  }

  const potency = attacker.drugTop?.potency ?? 1;
  const cash = offensiveCash(attacker);
  const pushPower = potency + Math.floor(cash / 10);
  const defPower = positionDefense(defender) + defensiveThresholdBonus(defender);
  const notes: string[] = [];

  if (pushPower >= defPower) {
    if (defenderSurvivesKill(defender)) {
      notes.push(...applySuppression(attacker, defender));
      notes.push(...applyCounterDamage(attacker, defender));
      notes.push(...applyAttackerAftermath(attacker));
      attacker.drugTop = null;
      attacker.cashLeft = null;
      return {
        type: 'sick', targetIndices: [], lostCards: [], gainedCards: [],
        description: joinDescription(`${defender.crew!.displayName} survives the push`, notes),
      };
    }
    const flipped = [defender.crew!];
    clearPosition(defender);
    const adj = findAdjacent(defBoard, defender);
    const explosiveSplash = attacker.weaponTop?.category === 'explosive' ? attacker.weaponTop.bonus : 0;
    const splash = Math.min(Math.max(0, potency - 1 + explosiveSplash), adj.length);
    for (let i = 0; i < splash; i++) {
      const a = defBoard[adj[i]];
      if (a.crew) a.crew.resistance = Math.max(1, a.crew.resistance - potency);
    }
    attacker.drugTop = null;
    attacker.cashLeft = null;
    notes.push(...applyCounterDamage(attacker, defender));
    notes.push(...applyAttackerAftermath(attacker));
    return {
      type: 'flip', targetIndices: adj.slice(0, splash), lostCards: [],
      gainedCards: flipped,
      description: joinDescription(`PUSH: target down + ${splash} weakened`, notes),
    };
  }

  if (pushPower >= Math.floor(defPower / 2)) {
    const reducedPotency = Math.max(0, potency - defensiveDamageReduction(defender));
    if (reducedPotency === 0) {
      attacker.drugTop = null;
      attacker.cashLeft = null;
      notes.push(...applyCounterDamage(attacker, defender));
      notes.push(...applyAttackerAftermath(attacker));
      return {
        type: 'busted', targetIndices: [], lostCards: [], gainedCards: [],
        description: joinDescription(`PUSH: target holds firm`, notes),
      };
    }
    defender.crew!.resistance = Math.max(1, defender.crew!.resistance - reducedPotency);
    notes.push(...applySuppression(attacker, defender));
    attacker.drugTop = null;
    attacker.cashLeft = null;
    notes.push(...applyCounterDamage(attacker, defender));
    notes.push(...applyAttackerAftermath(attacker));
    return {
      type: 'sick', targetIndices: [], lostCards: [], gainedCards: [],
      description: joinDescription(`PUSH: target weakened by ${reducedPotency}`, notes),
    };
  }

  attacker.drugTop = null;
  attacker.cashLeft = null;
  notes.push(...applyCounterDamage(attacker, defender));
  notes.push(...applyAttackerAftermath(attacker));
  return {
    type: 'seized', targetIndices: [], lostCards: [], gainedCards: [],
    description: joinDescription(`PUSH: busted`, notes),
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
