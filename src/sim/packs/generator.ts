import type { Rng } from '../cards/rng';
import type { Card, Rarity } from '../turf/types';
import { loadToughCards } from '../cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../turf/generators';
import { TURF_SIM_CONFIG } from '../turf/ai/config';
import type { PackKind, PackReward } from './types';
import { PACK_CATEGORY, PACK_SIZE } from './types';

const RARITY_TIERS: Rarity[] = ['common', 'rare', 'legendary'];

const VALID_PACK_KINDS: ReadonlySet<string> = new Set([
  'tough-5', 'weapon-5', 'drug-5', 'currency-5', 'single', 'triple',
]);

function isPackRewardArray(value: unknown): value is PackReward[] {
  if (!Array.isArray(value)) return false;
  return value.every((r) => {
    if (r == null || typeof r !== 'object') return false;
    const kind = (r as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !VALID_PACK_KINDS.has(kind)) return false;
    const count = (r as { count?: unknown }).count;
    // Count must be a finite non-negative INTEGER. Fractional counts
    // (e.g. a typo'd `0.5`) would otherwise pass the earlier `typeof ===
    // 'number'` check and misbehave inside the reward loop.
    return Number.isInteger(count) && (count as number) >= 0;
  });
}

function coercePackRewards(value: unknown, source: string): PackReward[] {
  if (!isPackRewardArray(value)) {
    throw new Error(
      `${source}: expected PackReward[] (array of {kind, count}) with known kinds ` +
        `[${[...VALID_PACK_KINDS].join(', ')}], got: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

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
  const grants = coercePackRewards(
    TURF_SIM_CONFIG.packEconomy.starterGrant,
    'turf-sim.json packEconomy.starterGrant',
  );
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
  return coercePackRewards(
    rewards,
    `turf-sim.json packEconomy.rewards.${difficulty}.${suddenDeath ? 'suddenDeath' : 'base'}`,
  );
}
