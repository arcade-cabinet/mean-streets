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
