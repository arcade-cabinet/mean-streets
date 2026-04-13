/**
 * Combat resolution engine.
 * Pure functions for damage, healing, overdraw, die rolls, vanguard death.
 */

import type { CardData } from '../schemas';
import { getDef } from './deck';

/** Vanguard state during a game. */
export interface VanguardState {
  card: CardData;
  hp: number;
  maxHp: number;
  shield: number;
}

/** Player state during a game. */
export interface PlayerState {
  gangId: string;
  passiveType: string;
  passiveValue: number;
  deck: CardData[];
  hand: CardData[];
  vanguard: VanguardState | null;
  discard: CardData[];
}

/** Result of applying damage to a vanguard. */
export interface DamageResult {
  damageDealt: number;
  shieldAbsorbed: number;
  killed: boolean;
  newHp: number;
  newShield: number;
}

/** Apply damage to a vanguard, shields absorb first. */
export function applyDamage(
  vanguard: VanguardState,
  rawDamage: number,
): DamageResult {
  let dmg = rawDamage;
  let shieldAbsorbed = 0;

  if (vanguard.shield > 0) {
    shieldAbsorbed = Math.min(vanguard.shield, dmg);
    dmg -= shieldAbsorbed;
  }

  const newHp = Math.max(0, vanguard.hp - dmg);
  const newShield = vanguard.shield - shieldAbsorbed;

  return {
    damageDealt: rawDamage - shieldAbsorbed + (vanguard.hp - newHp === dmg ? 0 : 0),
    shieldAbsorbed,
    killed: newHp <= 0,
    newHp,
    newShield,
  };
}

/** Heal a vanguard by sacrificing a card. Returns actual heal amount. */
export function healVanguard(
  vanguard: VanguardState,
  healAmount: number,
): number {
  const before = vanguard.hp;
  vanguard.hp = Math.min(vanguard.maxHp, vanguard.hp + healAmount);
  return vanguard.hp - before;
}

/** Roll a die and determine the result. */
export interface DieResult {
  roll: number;
  hit: boolean;
  target: 'hand' | 'vanguard' | 'miss' | 'shield_absorbed';
  cardIndex?: number;
}

export function rollDie(
  dieSize: number,
  handSize: number,
  hasShield: boolean,
): DieResult {
  const roll = Math.floor(Math.random() * dieSize) + 1;
  const totalPositions = handSize + 1; // hand slots + vanguard

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

/**
 * Process a card draw, handling overdraw penalty.
 * Returns true if overdraw penalty triggered.
 */
export function drawCards(
  player: PlayerState,
  count: number,
  handMax: number,
  isNight: boolean,
): { drawn: number; overdrawTriggered: boolean; shieldSaved: boolean } {
  let drawn = 0;
  let overdrawTriggered = false;
  let shieldSaved = false;

  for (let i = 0; i < count; i++) {
    if (player.deck.length === 0) break;
    const card = player.deck.pop()!;
    player.hand.push(card);
    drawn++;

    if (player.hand.length > handMax) {
      if (player.vanguard && player.vanguard.shield > 0) {
        player.vanguard.shield--;
        const overflow = player.hand.pop()!;
        player.discard.push(overflow);
        shieldSaved = true;
      } else {
        overdrawTriggered = true;
        const forced = player.hand.shift()!;
        if (player.vanguard) {
          player.discard.push(player.vanguard.card);
        }
        const def = getDef(forced, isNight);
        const shield = player.passiveType === 'ANCHOR' ? player.passiveValue : 0;
        player.vanguard = { card: forced, hp: def, maxHp: def, shield };
      }
    }
  }

  return { drawn, overdrawTriggered, shieldSaved };
}

/** Create initial vanguard state from a card. */
export function createVanguard(
  card: CardData,
  isNight: boolean,
  passiveType: string,
  passiveValue: number,
): VanguardState {
  const def = getDef(card, isNight);
  const shield = passiveType === 'ANCHOR' ? passiveValue : 0;
  return { card, hp: def, maxHp: def, shield };
}

/** Promote a card from hand to vanguard. Returns the new vanguard. */
export function promoteFromHand(
  player: PlayerState,
  cardIndex: number,
  isNight: boolean,
): VanguardState {
  const card = player.hand.splice(cardIndex, 1)[0];
  const vanguard = createVanguard(
    card, isNight, player.passiveType, player.passiveValue,
  );
  player.vanguard = vanguard;
  return vanguard;
}
