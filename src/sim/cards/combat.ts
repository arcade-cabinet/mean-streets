/**
 * Character card combat engine.
 * Handles attack resolution with archetype abilities,
 * affiliation bonuses, and day/night stat switching.
 */

import type { CharacterCard } from './schemas';
import { areAtWar, areAtPeace } from './deckbuilder';

/** Live card state during a game. */
export interface LiveCard {
  card: CharacterCard;
  hp: number;
  maxHp: number;
  shield: number;
  revealed: boolean;  // snitch ability
  vanished: boolean;  // ghost ability — can't be targeted
}

/** Get ATK for the current phase. */
export function getAtk(card: CharacterCard, isNight: boolean): number {
  return isNight ? card.nightAtk : card.dayAtk;
}

/** Get DEF for the current phase. */
export function getDef(card: CharacterCard, isNight: boolean): number {
  return isNight ? card.nightDef : card.dayDef;
}

/** Calculate effective attack damage including archetype + affiliation. */
export function calcEffectiveAtk(
  attacker: CharacterCard,
  target: CharacterCard,
  isNight: boolean,
): number {
  let atk = getAtk(attacker, isNight);

  // BRUISER: +2 vs targets with lower ATK
  if (attacker.archetype === 'bruiser') {
    const targetAtk = getAtk(target, isNight);
    if (atk > targetAtk) atk += 2;
  }

  // ENFORCER: +3 vs rival affiliations
  if (attacker.archetype === 'enforcer') {
    if (areAtWar(attacker.affiliation, target.affiliation)) {
      atk += 3;
    }
  }

  // SHARK: +1 per point of damage on target
  if (attacker.archetype === 'shark') {
    const targetDef = getDef(target, isNight);
    // Damage on target = maxHp - currentHp (passed in from LiveCard)
    // We can't access LiveCard here, so this is handled in the game loop
  }

  return atk;
}

/** Create a live card from a character card definition. */
export function createLiveCard(
  card: CharacterCard,
  isNight: boolean,
): LiveCard {
  const def = getDef(card, isNight);
  return {
    card,
    hp: def,
    maxHp: def,
    shield: 0,
    revealed: false,
    vanished: false,
  };
}

/** Apply damage to a live card, shields first. */
export function applyDamage(
  target: LiveCard,
  rawDamage: number,
): { dealt: number; shieldAbsorbed: number; killed: boolean } {
  let dmg = rawDamage;
  let shieldAbsorbed = 0;

  if (target.shield > 0) {
    shieldAbsorbed = Math.min(target.shield, dmg);
    target.shield -= shieldAbsorbed;
    dmg -= shieldAbsorbed;
  }

  target.hp = Math.max(0, target.hp - dmg);
  return {
    dealt: rawDamage - shieldAbsorbed,
    shieldAbsorbed,
    killed: target.hp <= 0,
  };
}

/** Heal a live card by sacrificing another card. */
export function healCard(
  target: LiveCard,
  healAmount: number,
  healerArchetype: string,
): number {
  // MEDIC: double healing
  const effective = healerArchetype === 'medic' ? healAmount * 2 : healAmount;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + effective);
  return target.hp - before;
}

/** Check precision rule. */
export function canPrecisionAttack(
  effectiveAtk: number,
  targetHp: number,
  precisionMult: number,
): boolean {
  return effectiveAtk <= targetHp * precisionMult;
}

/** Roll a die for the penalty mechanic. */
export function rollDie(
  dieSize: number,
  handSize: number,
  hasShield: boolean,
): { roll: number; hit: boolean; target: string; cardIndex?: number } {
  const roll = Math.floor(Math.random() * dieSize) + 1;
  const totalPositions = handSize + 1;

  if (roll > totalPositions) {
    return { roll, hit: false, target: 'miss' };
  }
  if (hasShield) {
    return { roll, hit: false, target: 'shield_absorbed' };
  }
  if (roll <= handSize) {
    return { roll, hit: true, target: 'hand', cardIndex: roll - 1 };
  }
  return { roll, hit: true, target: 'vanguard' };
}
