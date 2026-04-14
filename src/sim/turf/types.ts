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
  power: number;       // center top — attack strength
  resistance: number;  // center bottom — damage absorption
  abilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}

export interface ProductCard {
  type: 'product';
  id: string;
  name: string;
  category: string;
  potency: number;
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}

export interface CashCard {
  type: 'cash';
  id: string;
  denomination: 100 | 1000;
}

export interface WeaponCard {
  type: 'weapon';
  id: string;
  name: string;
  category: string;
  bonus: number;
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}

/** Payload cards only exist independently in data/deck construction, never as quarter-card draw objects in play. */
export type PayloadCard = ProductCard | CashCard | WeaponCard;

export interface BackpackCard {
  type: 'backpack';
  id: string;
  name: string;
  icon: string;
  size: 1 | 2 | 3 | 4;
  payload: PayloadCard[];
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}

export type GameCard = CrewCard | ProductCard | CashCard | WeaponCard | BackpackCard;

// ── Board State ──────────────────────────────────────────────

/**
 * A single street position with 6 quarter-card slots around the crew card.
 *
 * Layout:
 *   [DRUG]  [PWR]  [WEAP]    ← top row: offensive modifiers
 *   [CASH]   👊    [CASH]    ← center: gang symbol + currency
 *   [DRUG]  [RES]  [WEAP]    ← bottom row: defensive modifiers
 */
export interface Position {
  crew: CrewCard | null;
  /** Top-left: drug offense (buffs attacks outward). */
  drugTop: ProductCard | null;
  /** Bottom-left: drug defense (buffs when attacked). */
  drugBottom: ProductCard | null;
  /** Top-right: weapon offense (bonus when attacking). */
  weaponTop: WeaponCard | null;
  /** Bottom-right: weapon defense (bonus when defending). */
  weaponBottom: WeaponCard | null;
  /** Center-left: cash offense (funds attacks, bribes, pushed ops). */
  cashLeft: CashCard | null;
  /** Center-right: cash defense (protects against flips/recruitment). */
  cashRight: CashCard | null;
  /** Backpack attached to this lane, usually delivered by a runner. */
  backpack: BackpackCard | null;
  /** Runner state while a reserve crew is carrying payload. */
  runner: boolean;
  /** How many payload items remain in the attached backpack. */
  payloadRemaining: number;
  owner: 'A' | 'B';
  seized: boolean;
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

/** A quarter-size modifier card — weapon, drug, or cash. */
export type ModifierCard = ProductCard | CashCard | WeaponCard;

/**
 * Legacy modifier alias preserved during the backpack/runner migration.
 * Prefer `PayloadCard` and `BackpackCard` for new code.
 */
export type LegacyModifierCard = ModifierCard;

export interface PlayerState {
  board: PlayerBoard;
  /** Full-size crew draw pile. */
  crewDraw: CrewCard[];
  /** Legacy loose-modifier draw pile kept temporarily during backpack migration. */
  modifierDraw: ModifierCard[];
  /** Canonical full-card backpack draw pile. */
  backpackDraw: BackpackCard[];
  hand: {
    crew: CrewCard[];
    /** Legacy loose payload cards kept temporarily during migration. */
    modifiers: ModifierCard[];
    /** Canonical full-card backpack kits. */
    backpacks: BackpackCard[];
  };
  discard: GameCard[];
  positionsSeized: number;
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

export type TurfActionKind =
  | 'reclaim'
  | 'place_crew'
  | 'place_reserve_crew'
  | 'equip_backpack'
  | 'deploy_runner'
  | 'deploy_payload'
  | 'arm_weapon'
  | 'stack_product'
  | 'stack_cash'
  | 'direct_attack'
  | 'funded_attack'
  | 'pushed_attack'
  | 'pass';

export interface TurfAction {
  kind: TurfActionKind;
  side: 'A' | 'B';
  attackerIdx?: number;
  targetIdx?: number;
  positionIdx?: number;
  reserveIdx?: number;
  slot?: 'offense' | 'defense';
  crewCardId?: string;
  modifierCardId?: string;
  cashCardId?: string;
  backpackCardId?: string;
}

export interface TurfObservation {
  phase: GamePhase;
  side: 'A' | 'B';
  turnNumber: number;
  ownCrewCount: number;
  opponentCrewCount: number;
  ownSeized: number;
  opponentSeized: number;
  ownReadyDirect: number;
  ownReadyFunded: number;
  ownReadyPushed: number;
  handCrew: number;
  handWeapons: number;
  handProducts: number;
  handCash: number;
  handBackpacks: number;
  activeRunners: number;
  stagedBackpacks: number;
  ownPower: number;
  ownDefense: number;
  opponentPower: number;
  opponentDefense: number;
  stateKey: string;
}

export interface PlannerMemory {
  lastGoal: string | null;
  lastActionKind: TurfActionKind | null;
  consecutivePasses: number;
  failedPlans: number;
  blockedLanes: Record<number, number>;
  pressuredLanes: Record<number, number>;
  laneRoles: Record<number, 'funded' | 'pushed'>;
  focusLane: number | null;
  focusRole: 'funded' | 'pushed' | null;
}

export interface PlannerTrace {
  side: 'A' | 'B';
  phase: GamePhase;
  chosenGoal: string;
  previousGoal: string | null;
  switchedGoal: boolean;
  stateKey: string;
  legalActionCount: number;
  chosenAction: TurfAction;
  consideredGoals: Array<{ goal: string; score: number }>;
  actionScores: Array<{ action: string; score: number }>;
  policyUsed: boolean;
  replanReason: string;
}

export interface PolicySample {
  side: 'A' | 'B';
  stateKey: string;
  actionKey: string;
  goal: string;
  reward: number;
}

export interface TurfPolicyEntry {
  stateKey: string;
  bestActionKey: string;
  value: number;
  visits: number;
  actions: Record<string, { value: number; visits: number }>;
}

export interface TurfPolicyArtifact {
  version: 1;
  generatedAt: string;
  configVersion: string;
  entries: Record<string, TurfPolicyEntry>;
}

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
  aiMemory: { A: PlannerMemory; B: PlannerMemory };
  plannerTrace: PlannerTrace[];
  policySamples: PolicySample[];
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
  reserveCrewPlaced: number;
  backpacksEquipped: number;
  runnerDeployments: number;
  payloadDeployments: number;
  runnerOpportunityTurns: number;
  runnerOpportunityTaken: number;
  runnerOpportunityMissed: number;
  runnerReserveOpportunityTurns: number;
  runnerReserveOpportunityTaken: number;
  runnerReserveOpportunityMissed: number;
  runnerEquipOpportunityTurns: number;
  runnerEquipOpportunityTaken: number;
  runnerEquipOpportunityMissed: number;
  runnerDeployOpportunityTurns: number;
  runnerDeployOpportunityTaken: number;
  runnerDeployOpportunityMissed: number;
  runnerPayloadOpportunityTurns: number;
  runnerPayloadOpportunityTaken: number;
  runnerPayloadOpportunityMissed: number;
  positionsReclaimed: number;
  passes: number;
  goalSwitches: number;
  failedPlans: number;
  stallTurns: number;
  deadHandTurns: number;
  laneConversions: number;
  offensePlacements: number;
  defensePlacements: number;
  policyGuidedActions: number;
  buildupRoundsA: number;
  buildupRoundsB: number;
  combatRounds: number;
  totalActions: number;
  firstStrike: 'A' | 'B' | null;
}

export interface DeckTemplate {
  crew: CrewCard[];
  modifiers: ModifierCard[];
  backpacks: BackpackCard[];
}

export interface DeckSnapshot {
  crewIds: string[];
  modifierIds: string[];
  backpackIds: string[];
}

export interface TurfGameResult {
  winner: 'A' | 'B';
  endReason: string;
  firstPlayer: 'A' | 'B';
  turnCount: number;
  metrics: TurfMetrics;
  seed: number;
  plannerTrace: PlannerTrace[];
  policySamples?: PolicySample[];
  finalState: {
    seizedA: number; // positions seized on A's side by B
    seizedB: number; // positions seized on B's side by A
  };
  decks: {
    A: DeckSnapshot;
    B: DeckSnapshot;
  };
}
