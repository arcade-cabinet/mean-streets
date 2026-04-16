import type { Rng } from '../cards/rng';
import simConfig from '../../data/ai/turf-sim.json';

export type Rarity = 'common' | 'rare' | 'legendary';
export type CardCategory = 'tough' | 'weapon' | 'drug' | 'currency';

export interface ToughCard {
  kind: 'tough';
  id: string;
  name: string;
  tagline: string;
  archetype: string;
  affiliation: string;
  power: number;
  resistance: number;
  rarity: Rarity;
  abilities: string[];
}

export interface WeaponCard {
  kind: 'weapon';
  id: string;
  name: string;
  category: string;
  power: number;
  resistance: number;
  rarity: Rarity;
  abilities: string[];
}

export interface DrugCard {
  kind: 'drug';
  id: string;
  name: string;
  category: string;
  power: number;
  resistance: number;
  rarity: Rarity;
  abilities: string[];
}

export interface CurrencyCard {
  kind: 'currency';
  id: string;
  name: string;
  denomination: 100 | 1000;
  rarity: Rarity;
}

export type Card = ToughCard | WeaponCard | DrugCard | CurrencyCard;

export type ModifierCard = WeaponCard | DrugCard | CurrencyCard;

// ── Stacked Card, Turf, Queued Action (v0.2) ────────────────

/** `faceUp` is permanent once true (retreat / resolution reveal / abilities). */
export interface StackedCard {
  card: Card;
  faceUp: boolean;
}

export interface Turf {
  id: string;
  stack: StackedCard[];
  sickTopIdx?: number | null;
  closedRanks: boolean;
  rivalBufferSpent?: boolean;
}

/** Strike/recruit declared this turn; resolves end-of-turn. Draw/play/retreat are immediate. */
export interface QueuedAction {
  kind: 'direct_strike' | 'pushed_strike' | 'funded_recruit';
  side: 'A' | 'B';
  turfIdx: number;
  targetTurfIdx: number;
}

export interface PlayerState {
  turfs: Turf[];
  deck: Card[];
  discard: Card[];
  toughsInPlay: number;
  actionsRemaining: number;
  pending: Card | null;
  queued: QueuedAction[];
  turnEnded: boolean;
}

// ── Difficulty & Game Config ────────────────────────────────

export type DifficultyTier =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'nightmare'
  | 'sudden-death'
  | 'ultra-nightmare';

export interface GameConfig {
  difficulty: DifficultyTier;
  suddenDeath: boolean;
  turfCount: number;
  actionsPerTurn: number;
  firstTurnActions: number;
}

const defaultDiff = simConfig.difficulty[simConfig.gameDefaults.defaultDifficulty as DifficultyTier];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  difficulty: simConfig.gameDefaults.defaultDifficulty as DifficultyTier,
  suddenDeath: false,
  turfCount: defaultDiff.turfCount,
  actionsPerTurn: defaultDiff.actionsPerTurn,
  firstTurnActions: defaultDiff.firstTurnActions,
};

// ── Attacks & Phase ─────────────────────────────────────────

export type AttackType = 'direct' | 'funded' | 'pushed';

export interface AttackOutcome {
  type: 'kill' | 'flip' | 'sick' | 'seized' | 'busted' | 'miss';
  targetIndices: number[];
  lostCards: Card[];
  gainedCards: Card[];
  description: string;
}

export type GamePhase = 'action' | 'resolve';

export type TurfActionKind =
  | 'draw'
  | 'play_card'
  | 'retreat'
  | 'direct_strike'
  | 'pushed_strike'
  | 'funded_recruit'
  | 'discard'
  | 'end_turn'
  | 'pass';

/**
 * Payload by kind: draw/end_turn/pass → side only; play_card → turfIdx+cardId;
 * retreat → turfIdx+stackIdx; strikes/recruit → turfIdx+targetTurfIdx;
 * discard → cardId (voluntary pending-modifier discard).
 */
export interface TurfAction {
  kind: TurfActionKind;
  side: 'A' | 'B';
  turfIdx?: number;
  targetTurfIdx?: number;
  cardId?: string;
  stackIdx?: number;
}

// ── AI ──────────────────────────────────────────────────────

export interface TurfObservation {
  phase: GamePhase;
  side: 'A' | 'B';
  turnNumber: number;
  ownTurfCount: number;
  opponentTurfCount: number;
  ownToughsInPlay: number;
  opponentToughsInPlay: number;
  handToughs: number;
  handWeapons: number;
  handDrugs: number;
  handCurrency: number;
  ownPower: number;
  ownDefense: number;
  opponentPower: number;
  opponentDefense: number;
  actionsRemaining: number;
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

// ── Game State ──────────────────────────────────────────────

export interface TurfGameState {
  config: GameConfig;
  players: { A: PlayerState; B: PlayerState };
  firstPlayer: 'A' | 'B';
  turnNumber: number;
  phase: GamePhase;
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

// ── Metrics ─────────────────────────────────────────────────

export interface TurfMetrics {
  turns: number;
  draws: number;
  retreats: number;
  closedRanksEnds: number;
  directStrikes: number;
  pushedStrikes: number;
  fundedRecruits: number;
  kills: number;
  spiked: number;
  seizures: number;
  busts: number;
  cardsPlayed: number;
  cardsDiscarded: number;
  toughsPlayed: number;
  modifiersPlayed: number;
  passes: number;
  goalSwitches: number;
  failedPlans: number;
  stallTurns: number;
  deadHandTurns: number;
  policyGuidedActions: number;
  totalActions: number;
  firstStrike: 'A' | 'B' | null;
}

// ── Deck & Result ───────────────────────────────────────────

export interface DeckSnapshot {
  cardIds: string[];
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
    turfsA: number;
    turfsB: number;
  };
  decks: {
    A: DeckSnapshot;
    B: DeckSnapshot;
  };
}
