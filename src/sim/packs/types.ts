import type { Card, CardCategory, DifficultyTier, Rarity } from '../turf/types';

export type PackKind = 'single' | 'triple' | 'standard';

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
  typeWeights: Record<CardCategory, number>;
  starterGrant: PackReward[];
  rewards: Record<DifficultyTier, { base: PackReward[] }>;
}

export const PACK_SIZE: Record<PackKind, number> = {
  single: 1,
  triple: 3,
  standard: 5,
};

// ── v0.3 War-outcome rewards (RULES §13) ─────────────────────────

export type VictoryRating = 'absolute' | 'overwhelming' | 'decisive' | 'standard';
export type WarOutcome = 'perfect' | 'flawless' | 'dominant' | 'won';

export interface TurfSeizureReward {
  pack: PackInstance | null;
  rating: VictoryRating;
  turnsToSeize: number;
}

export interface WarOutcomeReward {
  pack: PackInstance | null;
  outcome: WarOutcome | null;
  mythicDraw: string | null;
  escalatingCurrency: number | null;
}

export interface RewardBundle {
  turfRewards: TurfSeizureReward[];
  warOutcomeReward: WarOutcomeReward;
}
