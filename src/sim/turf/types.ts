import type { Rng } from '../cards/rng';
import simConfig from '../../data/ai/turf-sim.json';

// ── Rarity & Collection ─────────────────────────────────────
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
export type CardCategory = 'tough' | 'weapon' | 'drug' | 'currency';
/** One card instance: rolled rarity + the difficulty it was unlocked at. */
export interface CardInstance { cardId: string; rolledRarity: Rarity; unlockDifficulty: DifficultyTier; }

// ── Card types ──────────────────────────────────────────────
export interface ToughCard {
  kind: 'tough'; id: string; name: string; tagline: string;
  archetype: string; affiliation: string;
  power: number; resistance: number; rarity: Rarity; abilities: string[];
  maxHp: number; // authored; equals base resistance
  hp: number;    // current; reduces on wound
}
export interface WeaponCard {
  kind: 'weapon'; id: string; name: string; category: string;
  power: number; resistance: number; rarity: Rarity; abilities: string[];
}
export interface DrugCard {
  kind: 'drug'; id: string; name: string; category: string;
  power: number; resistance: number; rarity: Rarity; abilities: string[];
}
export interface CurrencyCard {
  kind: 'currency'; id: string; name: string; denomination: 100 | 1000; rarity: Rarity;
  abilities?: string[];
}
export type Card = ToughCard | WeaponCard | DrugCard | CurrencyCard;
export type ModifierCard = WeaponCard | DrugCard | CurrencyCard;

// ── Stack & Turf ─────────────────────────────────────────────
/** faceUp is permanent once true (retreat / resolution reveal / abilities). */
export interface StackedCard {
  card: Card;
  faceUp: boolean;
  /** tough id this modifier is equipped to; for toughs, owner === card.id */
  owner?: string;
}
export interface Turf {
  id: string; stack: StackedCard[]; sickTopIdx?: number | null;
  closedRanks: boolean; rivalBufferSpent?: boolean;
  isActive: boolean;    // true for the current engagement turf only
  reserveIndex: number; // 0 = active, 1+ = reserve in queue order
}
/** Strike/recruit declared this turn; resolves end-of-turn. */
export interface QueuedAction {
  kind: 'direct_strike' | 'pushed_strike' | 'funded_recruit';
  side: 'A' | 'B'; turfIdx: number; targetTurfIdx: number;
}
export interface PlayerState {
  turfs: Turf[]; // index 0 = active, 1+ = reserves in queue order
  deck: Card[];
  toughsInPlay: number; actionsRemaining: number;
  pending: Card | null; queued: QueuedAction[]; turnEnded: boolean;
}

// ── Difficulty & Game Config ────────────────────────────────
export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'nightmare' | 'ultra-nightmare';
export interface GameConfig {
  difficulty: DifficultyTier; suddenDeath: boolean;
  turfCount: number; actionsPerTurn: number; firstTurnActions: number;
}
const defaultDiff = simConfig.difficulty[simConfig.gameDefaults.defaultDifficulty as DifficultyTier];
export const DEFAULT_GAME_CONFIG: GameConfig = {
  difficulty: simConfig.gameDefaults.defaultDifficulty as DifficultyTier,
  suddenDeath: false, turfCount: defaultDiff.turfCount,
  actionsPerTurn: defaultDiff.actionsPerTurn, firstTurnActions: defaultDiff.firstTurnActions,
};

// ── Attacks & Phase ─────────────────────────────────────────
export type AttackType = 'direct' | 'funded' | 'pushed';
export interface AttackOutcome {
  type: 'kill' | 'flip' | 'sick' | 'seized' | 'busted' | 'miss';
  targetIndices: number[]; lostCards: Card[]; gainedCards: Card[]; description: string;
}
export type GamePhase = 'action' | 'resolve';

export type TurfActionKind =
  | 'draw' | 'play_card' | 'retreat'
  | 'modifier_swap' | 'send_to_market' | 'send_to_holding'
  | 'black_market_trade' | 'black_market_heal'
  | 'direct_strike' | 'pushed_strike' | 'funded_recruit'
  | 'discard' | 'end_turn' | 'pass';

/**
 * Payload by kind:
 *   draw/end_turn/pass → side only; play_card → turfIdx+cardId;
 *   retreat → turfIdx+stackIdx; modifier_swap → turfIdx+toughId+targetToughId+cardId;
 *   send_to_market/holding → turfIdx+toughId;
 *   black_market_trade → offeredMods+targetRarity; black_market_heal → offeredMods+healTarget;
 *   strikes/recruit → turfIdx+targetTurfIdx; discard → cardId.
 */
export interface TurfAction {
  kind: TurfActionKind; side: 'A' | 'B';
  turfIdx?: number; targetTurfIdx?: number; cardId?: string;
  stackIdx?: number;      // retreat / modifier_swap target position
  toughId?: string;       // modifier swap source
  targetToughId?: string; // modifier swap destination
  offeredMods?: string[]; // black_market_trade/heal offered modifier card ids
  targetRarity?: Rarity;  // black_market_trade target tier
  healTarget?: string;    // black_market_heal tough id to heal
}

// ── Holding, Lockup & War Stats ─────────────────────────────
export interface ToughInCustody {
  tough: ToughCard; attachedModifiers: ModifierCard[];
  turnsRemaining?: number; // countdown for lockup; undefined = voluntary holding
}
export interface WarStats {
  seizures: Array<{
    seizedBy: 'A' | 'B'; seizedTurfIdx: number;
    turnsOnThatTurf: number; // feeds Absolute/Overwhelming/Decisive rating
  }>;
}

// ── AI ──────────────────────────────────────────────────────
export interface TurfObservation {
  phase: GamePhase; side: 'A' | 'B'; turnNumber: number;
  ownTurfCount: number; opponentTurfCount: number;
  ownToughsInPlay: number; opponentToughsInPlay: number;
  handToughs: number; handWeapons: number; handDrugs: number; handCurrency: number;
  ownPower: number; ownDefense: number; opponentPower: number; opponentDefense: number;
  actionsRemaining: number; stateKey: string;
}
export interface PlannerMemory {
  lastGoal: string | null; lastActionKind: TurfActionKind | null;
  consecutivePasses: number; failedPlans: number;
  blockedLanes: Record<number, number>; pressuredLanes: Record<number, number>;
  laneRoles: Record<number, 'funded' | 'pushed'>;
  focusLane: number | null; focusRole: 'funded' | 'pushed' | null;
}
export interface PlannerTrace {
  side: 'A' | 'B'; phase: GamePhase; chosenGoal: string;
  previousGoal: string | null; switchedGoal: boolean; stateKey: string;
  legalActionCount: number; chosenAction: TurfAction;
  consideredGoals: Array<{ goal: string; score: number }>;
  actionScores: Array<{ action: string; score: number }>;
  policyUsed: boolean; replanReason: string;
}
export interface PolicySample {
  side: 'A' | 'B'; stateKey: string; actionKey: string; goal: string; reward: number;
}
export interface TurfPolicyEntry {
  stateKey: string; bestActionKey: string; value: number; visits: number;
  actions: Record<string, { value: number; visits: number }>;
}
export interface TurfPolicyArtifact {
  version: 1; generatedAt: string; configVersion: string;
  entries: Record<string, TurfPolicyEntry>;
}

// ── Game State ──────────────────────────────────────────────
export interface TurfGameState {
  config: GameConfig; players: { A: PlayerState; B: PlayerState };
  firstPlayer: 'A' | 'B'; turnNumber: number; phase: GamePhase;
  aiState: { A: string; B: string }; aiTurnsInState: { A: number; B: number };
  aiMemory: { A: PlannerMemory; B: PlannerMemory };
  plannerTrace: PlannerTrace[]; policySamples: PolicySample[];
  rng: Rng; seed: number; winner: 'A' | 'B' | null; endReason: string | null;
  metrics: TurfMetrics;
  heat: number;                                       // shared [0,1]; drives raid probability
  blackMarket: ModifierCard[];                        // displaced modifiers pool
  holding: { A: ToughInCustody[]; B: ToughInCustody[] }; // voluntary cop custody
  lockup: { A: ToughInCustody[]; B: ToughInCustody[] };  // N-turn seized custody
  mythicPool: string[];                               // unassigned mythic cardIds (10 at start)
  mythicAssignments: Record<string, 'A' | 'B'>;      // cardId → side
  warStats: WarStats;
  /** Drug card ids that have already fired their one-shot RESUSCITATE heal. */
  resuscitateConsumed: Set<string>;
}

// ── Metrics ─────────────────────────────────────────────────
export interface TurfMetrics {
  turns: number; draws: number; retreats: number; closedRanksEnds: number;
  directStrikes: number; pushedStrikes: number; fundedRecruits: number;
  kills: number; spiked: number; seizures: number; busts: number;
  cardsPlayed: number; cardsDiscarded: number; toughsPlayed: number; modifiersPlayed: number;
  passes: number; goalSwitches: number; failedPlans: number;
  stallTurns: number; deadHandTurns: number; policyGuidedActions: number; totalActions: number;
  firstStrike: 'A' | 'B' | null;
  raids: number; marketTrades: number; marketHeals: number; modifierSwaps: number;
  mythicsFlipped: number; bribesAccepted: number; bribesFailed: number;
}

// ── Deck & Result ───────────────────────────────────────────
export interface DeckSnapshot { cardIds: string[]; }
export interface TurfGameResult {
  winner: 'A' | 'B'; endReason: string; firstPlayer: 'A' | 'B';
  turnCount: number; metrics: TurfMetrics; seed: number;
  plannerTrace: PlannerTrace[]; policySamples?: PolicySample[];
  finalState: { turfsA: number; turfsB: number };
  decks: { A: DeckSnapshot; B: DeckSnapshot };
}
