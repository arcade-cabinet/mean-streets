/**
 * Koota ECS world definition for game simulation.
 * Defines all traits (components) and relations used by the game engine.
 */

import { createWorld, trait, relation } from 'koota';

// ── Card traits ──────────────────────────────────────────────

/** Core card identity — immutable after creation. */
export const Card = trait({
  id: '',
  name: '',
  gangId: '',
  tier: 0,
  dayAtk: 0,
  dayDef: 0,
  nightAtk: 0,
  nightDef: 0,
});

/** Current combat state of a card when it's a vanguard. */
export const CombatState = trait({
  hp: 0,
  maxHp: 0,
  shield: 0,
});

// ── Tag traits (no data, just presence flags) ────────────────

/** Marks a card entity as currently being the vanguard (active fighter). */
export const IsVanguard = trait();

/** Marks a card as face-down (opponent's hand cards). */
export const IsFaceDown = trait();

/** Marks a card as currently being dealt (animation state). */
export const IsDealing = trait();

/** Marks a card as being dragged by the player. */
export const IsDragging = trait();

/** Marks a card as discarded. */
export const IsDiscarded = trait();

/** Marks a card as being in a deck (draw pile). */
export const InDeck = trait();

// ── Relations ────────────────────────────────────────────────

/**
 * Relation: card is held by a player entity.
 * Used to model hand ownership. The target is the player entity.
 */
export const HeldBy = relation({ exclusive: true });

/**
 * Relation: card belongs to a player's side (A or B).
 * Every card in the game has this relation.
 */
export const OwnedBy = relation({ exclusive: true });

// ── World-level traits (singletons) ─────────────────────────

/** Current game phase. */
export const GamePhase = trait({
  phase: 'MENU' as string,
});

/** Current turn state. */
export const TurnState = trait({
  currentTurn: 'A' as 'A' | 'B',
  firstPlayer: 'A' as 'A' | 'B',
  turnNumber: 0,
  consecutivePasses: 0,
  isNight: false,
  nightShiftCounter: 0,
});

/** Forced die roll tracking. */
export const ForcedDie = trait({
  forcedA: false,
  forcedB: false,
});

/** Game configuration stored in the world. */
export const Config = trait({
  dieSize: 6,
  precisionMult: 1.5,
  handMax: 5,
  runsEnabled: true,
  setsEnabled: true,
  nightShiftEvery: 2,
  maxTurns: 200,
  gangA: '',
  gangB: '',
  passiveA: '' as string,
  passiveB: '' as string,
});

/** Metrics accumulator stored in the world. */
export const Metrics = trait({
  turns: 0, passes: 0, attacks: 0, sacrifices: 0, hustles: 0,
  dieRolls: 0, dieHits: 0, dieMisses: 0, dieVanguardHits: 0,
  precisionLocks: 0, overdrawPenalties: 0, shieldSaves: 0,
  vanguardDeaths: 0, runsPlayed: 0, setsPlayed: 0, nightShifts: 0,
  killsByA: 0, killsByB: 0, forcedDieRolls: 0,
  sacrificeDraws: 0, bleedDiscards: 0, stallBreakers: 0,
  cardsRemainingInDeck: 0,
});

/** Game result stored at end of game. */
export const GameResult = trait({
  winner: '' as '' | 'A' | 'B',
  endReason: '' as '' | 'starvation' | 'stall',
});

// ── World factory ────────────────────────────────────────────

export function createGameWorld() {
  return createWorld(
    GamePhase, TurnState, ForcedDie, Config, Metrics, GameResult,
  );
}

export type GameWorld = ReturnType<typeof createGameWorld>;
