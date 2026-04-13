/**
 * Core types for the turf war game engine.
 * 5v5 position seizure, 4 deck types, stacking operations.
 */

import type { Rng } from '../cards/rng';

// ── Card Types ───────────────────────────────────────────────

export interface CrewCard {
  type: 'crew';
  id: string;
  displayName: string;
  archetype: string;
  affiliation: string;
  power: number;
  abilityText: string;
}

export interface ProductCard {
  type: 'product';
  id: string;
  name: string;
  effect: string;
  effectDesc: string;
  potency: number; // 1-5, multiplier for pushed attacks
}

export interface CashCard {
  type: 'cash';
  id: string;
  denomination: number; // 1, 5, 10, 20, 100, 500, 1000
}

export interface WeaponCard {
  type: 'weapon';
  id: string;
  name: string;
  effect: string;
  effectDesc: string;
  bonus: number; // +damage or modifier
}

export type GameCard = CrewCard | ProductCard | CashCard | WeaponCard;

// ── Board State ──────────────────────────────────────────────

/** A single street position — can be empty, yours, or seized. */
export interface Position {
  /** The crew card occupying this position (null = empty). */
  crew: CrewCard | null;
  /** Product stacked on this crew (null = none). */
  product: ProductCard | null;
  /** Cash stacked on this crew (null = none). */
  cash: CashCard | null;
  /** Weapon armed on this crew (null = none). */
  weapon: WeaponCard | null;
  /** Who controls this position. */
  owner: 'A' | 'B';
  /** Is this position seized by the opponent? */
  seized: boolean;
  /** Turns since crew was placed. 0 = just placed, can't act yet. */
  turnsActive: number;
}

/** Full board for one player: 5 active + 5 reserve. */
export interface PlayerBoard {
  active: Position[];  // 5 positions
  reserve: Position[]; // 5 positions
}

// ── Attack Types ─────────────────────────────────────────────

export type AttackType = 'direct' | 'funded' | 'pushed';

/** Outcome of a die roll during an attack. */
export interface AttackOutcome {
  type: 'kill' | 'flip' | 'sick' | 'seized' | 'busted' | 'miss';
  targetIndices: number[];
  lostCards: GameCard[];
  gainedCards: GameCard[];
  description: string;
}

// ── Player State ─────────────────────────────────────────────

export interface PlayerState {
  board: PlayerBoard;
  crewDraw: CrewCard[];
  productDraw: ProductCard[];
  cashDraw: CashCard[];
  weaponDraw: WeaponCard[];
  hand: {
    crew: CrewCard[];
    product: ProductCard[];
    cash: CashCard[];
    weapon: WeaponCard[];
  };
  discard: GameCard[];
  positionsSeized: number; // how many of opponent's positions you hold
}

// ── Game State ───────────────────────────────────────────────

export interface TurfGameConfig {
  positionCount: number;        // 5
  reserveCount: number;         // 5
  maxRounds: number;            // safety cap
  precisionMult: number;        // 3.0
  crewDrawPerTurn: number;      // 1
  cashPerTurn: number;          // 1
  productPerPositions: number;  // draw 1 product per N positions held
  weaponOnKill: boolean;        // draw weapon on kill
  weaponOnSeize: boolean;       // draw weapon on seize
  /** Max buildup rounds before combat starts automatically. */
  maxBuildupRounds: number;
  /** Actions per player per combat round. */
  actionsPerRound: number;
}

export const DEFAULT_TURF_CONFIG: TurfGameConfig = {
  positionCount: 5,
  reserveCount: 5,
  maxRounds: 100,
  precisionMult: 3.0,
  crewDrawPerTurn: 1,
  cashPerTurn: 1,
  productPerPositions: 2,
  weaponOnKill: true,
  weaponOnSeize: true,
  maxBuildupRounds: 10,
  actionsPerRound: 5,
};

export type GamePhase = 'buildup' | 'combat';

export interface TurfGameState {
  config: TurfGameConfig;
  players: { A: PlayerState; B: PlayerState };
  turnSide: 'A' | 'B';
  firstPlayer: 'A' | 'B';
  turnNumber: number;
  phase: GamePhase;
  /** Per-player buildup turn count (how many turns each spent building). */
  buildupTurns: { A: number; B: number };
  /** Has each player decided to strike yet? */
  hasStruck: { A: boolean; B: boolean };
  /** AI behavior state per player. */
  aiState: { A: string; B: string };
  aiTurnsInState: { A: number; B: number };
  rng: Rng;
  seed: number;
  winner: 'A' | 'B' | null;
  endReason: string | null;
  metrics: TurfMetrics;
}

export interface TurfMetrics {
  turns: number;
  directAttacks: number;
  fundedAttacks: number;
  pushedAttacks: number;
  kills: number;
  flips: number;
  seizures: number;
  busts: number;
  weaponsDrawn: number;
  productPlayed: number;
  cashPlayed: number;
  crewPlaced: number;
  positionsReclaimed: number;
  passes: number;
  buildupRoundsA: number;
  buildupRoundsB: number;
  combatRounds: number;
  totalActions: number;
  firstStrike: 'A' | 'B' | null;
}

export interface TurfGameResult {
  winner: 'A' | 'B';
  endReason: string;
  firstPlayer: 'A' | 'B';
  turnCount: number;
  metrics: TurfMetrics;
  seed: number;
  finalState: {
    seizedA: number; // positions seized on A's side by B
    seizedB: number; // positions seized on B's side by A
  };
}
