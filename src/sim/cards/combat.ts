/**
 * Combat engine for single-power character cards.
 * Power = attack damage = vanguard HP.
 * Abilities trigger based on archetype.
 */

import type { CharacterCard } from './schemas';
import { areAtWar } from './deckbuilder';

export interface LiveCard {
  card: CharacterCard;
  hp: number;
  maxHp: number;
  shield: number;
}

export function createLiveCard(card: CharacterCard): LiveCard {
  return { card, hp: card.power, maxHp: card.power, shield: 0 };
}

/** Calculate effective damage including archetype modifiers. */
export function calcDamage(
  attacker: CharacterCard,
  target: CharacterCard,
  attackerHandSize: number,
  defenderHandSize: number,
  targetDamage: number,
): number {
  let dmg = attacker.power;

  // ENFORCER: double vs rival affiliation
  if (attacker.archetype === 'enforcer' && areAtWar(attacker.affiliation, target.affiliation)) {
    dmg *= 2;
  }

  // SHARK: +1 per card fewer opponent has
  if (attacker.archetype === 'shark') {
    const diff = Math.max(0, attackerHandSize - defenderHandSize);
    dmg += diff;
  }

  return dmg;
}

/** Can this card attack the target? (precision rule) */
export function canAttack(
  attacker: CharacterCard,
  targetHp: number,
  precisionMult: number,
): boolean {
  // BRUISER ignores precision
  if (attacker.archetype === 'bruiser') return true;
  return attacker.power <= targetHp * precisionMult;
}

export function applyDamage(target: LiveCard, dmg: number): boolean {
  let remaining = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remaining);
  return target.hp <= 0;
}

export function rollDie(
  dieSize: number,
  handSize: number,
  hasShield: boolean,
  rng: { next(): number },
): { roll: number; hit: boolean; target: string; cardIndex?: number } {
  const roll = Math.floor(rng.next() * dieSize) + 1;
  const positions = handSize + 1;
  if (roll > positions) return { roll, hit: false, target: 'miss' };
  if (hasShield) return { roll, hit: false, target: 'shield' };
  if (roll <= handSize) return { roll, hit: true, target: 'hand', cardIndex: roll - 1 };
  return { roll, hit: true, target: 'vanguard' };
}
