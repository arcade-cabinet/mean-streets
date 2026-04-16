import type { Card, CardCategory, DifficultyTier, Rarity } from '../turf/types';

export type PackKind =
  | 'tough-5'
  | 'weapon-5'
  | 'drug-5'
  | 'currency-5'
  | 'single'
  | 'triple';

export interface PackInstance {
  id: string;
  kind: PackKind;
  cards: Card[];
  openedAt: string | null;
}

export interface PackReward {
  kind: PackKind;
  count: number;
}

export interface PackConfig {
  rarityWeights: Record<Rarity, number>;
  suddenDeathBumpChance: number;
  starterGrant: PackReward[];
  rewards: Record<DifficultyTier, { base: PackReward[]; suddenDeath: PackReward[] }>;
}

export const PACK_SIZE: Record<PackKind, number> = {
  'tough-5': 5,
  'weapon-5': 5,
  'drug-5': 5,
  'currency-5': 5,
  single: 1,
  triple: 3,
};

export const PACK_CATEGORY: Record<PackKind, CardCategory | null> = {
  'tough-5': 'tough',
  'weapon-5': 'weapon',
  'drug-5': 'drug',
  'currency-5': 'currency',
  single: null,
  triple: null,
};

// ── v0.3 War-outcome rewards (RULES §13) ─────────────────────────

/**
 * Per-turf seizure rating. Turns-to-seize determines the tier; the
 * winner of each turf gets the bonus independently, so a single war
 * can yield multiple per-turf rewards.
 */
export type VictoryRating = 'absolute' | 'overwhelming' | 'decisive' | 'standard';

/**
 * End-of-war rating for the winner only. "won" is the base case; the
 * higher ratings stack additional quality based on how cleanly the
 * war closed.
 */
export type WarOutcome = 'perfect' | 'flawless' | 'dominant' | 'won';

export interface TurfSeizureReward {
  /** Null for `standard` rating (seizure took longer than 3 turns). */
  pack: PackInstance | null;
  rating: VictoryRating;
  turnsToSeize: number;
}

export interface WarOutcomeReward {
  /** Null on loss OR when the reward is a mythic draw / currency fallback. */
  pack: PackInstance | null;
  /** Null on loss. */
  outcome: WarOutcome | null;
  /** Mythic cardId pulled from the unassigned pool on Perfect War. */
  mythicDraw: string | null;
  /** Flat $500 fallback when a Perfect War fires with an empty mythic pool. */
  escalatingCurrency: number | null;
}

export interface RewardBundle {
  turfRewards: TurfSeizureReward[];
  warOutcomeReward: WarOutcomeReward;
}
