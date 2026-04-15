import type { Rng } from '../cards/rng';
import type { Card, Rarity } from '../turf/types';
import { loadToughCards } from '../cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../turf/generators';
import { TURF_SIM_CONFIG } from '../turf/ai/config';
import type { PackKind, PackReward } from './types';
import { PACK_CATEGORY, PACK_SIZE } from './types';

const RARITY_TIERS: Rarity[] = ['common', 'rare', 'legendary'];

function rollRarity(rng: Rng, suddenDeathWin: boolean): Rarity {
  const cfg = TURF_SIM_CONFIG.packEconomy.rarityWeights;
  const total = cfg.common + cfg.rare + cfg.legendary;
  const roll = rng.next() * total;

  let base: Rarity;
  if (roll < cfg.common) base = 'common';
  else if (roll < cfg.common + cfg.rare) base = 'rare';
  else base = 'legendary';

  if (suddenDeathWin && base !== 'legendary') {
    const bumpChance = TURF_SIM_CONFIG.packEconomy.suddenDeathBumpChance;
    if (rng.next() < bumpChance) {
      const idx = RARITY_TIERS.indexOf(base);
      return RARITY_TIERS[Math.min(idx + 1, RARITY_TIERS.length - 1)];
    }
  }

  return base;
}

function getPool(category: 'tough' | 'weapon' | 'drug' | 'currency'): Card[] {
  switch (category) {
    case 'tough': return loadToughCards();
    case 'weapon': return generateWeapons();
    case 'drug': return generateDrugs();
    case 'currency': return generateCurrency();
  }
}

function stampRarity(card: Card, rarity: Rarity): Card {
  return { ...card, rarity };
}

function pickCard(
  pool: Card[],
  rng: Rng,
  exclude: Set<string>,
): Card {
  const available = pool.filter(c => !exclude.has(c.id));
  if (available.length > 0) return rng.pick(available);
  return rng.pick(pool);
}

export interface GeneratePackOptions {
  suddenDeathWin?: boolean;
  category?: 'tough' | 'weapon' | 'drug' | 'currency';
}

export function generatePack(
  kind: PackKind,
  collection: Card[],
  rng: Rng,
  options: GeneratePackOptions = {},
): Card[] {
  const size = PACK_SIZE[kind];
  const suddenDeathWin = options.suddenDeathWin ?? false;

  const category = PACK_CATEGORY[kind] ?? options.category;
  const pool = category ? getPool(category) : [
    ...loadToughCards(),
    ...generateWeapons(),
    ...generateDrugs(),
    ...generateCurrency(),
  ];

  if (category === 'currency') {
    return Array.from({ length: size }, () => rng.pick(pool));
  }

  const cards: Card[] = [];
  const usedIds = new Set(collection.map(c => c.id));

  for (let i = 0; i < size; i++) {
    const rarity = rollRarity(rng, suddenDeathWin);
    const base = pickCard(pool, rng, usedIds);
    cards.push(stampRarity(base, rarity));
    usedIds.add(base.id);
  }

  return cards;
}

export function starterGrant(rng: Rng): Card[] {
  const grants = TURF_SIM_CONFIG.packEconomy.starterGrant as PackReward[];
  const cards: Card[] = [];
  for (const grant of grants) {
    for (let i = 0; i < grant.count; i++) {
      cards.push(...generatePack(grant.kind, cards, rng));
    }
  }
  return cards;
}

export function matchRewardPacks(
  difficulty: string,
  suddenDeath: boolean,
  won: boolean,
): PackReward[] {
  if (!won) return [];
  const rewardCfg = TURF_SIM_CONFIG.packEconomy.rewards;
  const tier = rewardCfg[difficulty as keyof typeof rewardCfg];
  if (!tier) return [];
  const rewards = suddenDeath ? tier.suddenDeath : tier.base;
  return rewards as PackReward[];
}
