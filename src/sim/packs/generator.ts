import type { Rng } from '../cards/rng';
import type { Card, CardCategory, CardInstance, DifficultyTier, Rarity } from '../turf/types';
import { loadToughCards } from '../cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../turf/generators';
import { TURF_SIM_CONFIG } from '../turf/ai/config';
import type { PackKind, PackReward } from './types';
import { PACK_SIZE } from './types';

// v0.3 pack economy — per RULES §2 / §3:
//   - Per-slot pull rate picks a card by BASE rarity.
//   - Once the card is picked, its instance rarity rolls up from the
//     base per a per-base distribution.
//   - Mythic cards never appear in packs (0% pull rate).
// Tunables live in src/data/ai/turf-sim.json under packEconomy.*

// Load tunables from JSON (src/data/ai/turf-sim.json packEconomy.*).
const _pe = TURF_SIM_CONFIG.packEconomy;

const BASE_RARITY_WEIGHTS: Record<Rarity, number> = _pe.baseRarityWeights as Record<Rarity, number>;

// Per-base roll distributions (probability that a card picked at BASE
// rarity rolls UP to a specific tier). Numbers sum to 1.0 per base.
const ROLL_DISTRIBUTIONS: Record<Rarity, Partial<Record<Rarity, number>>> =
  _pe.rollDistributions as Record<Rarity, Partial<Record<Rarity, number>>>;

const _diffMult = _pe.difficultyRewardMult as Partial<Record<DifficultyTier, number>>;
const DIFFICULTY_TIERS: DifficultyTier[] = ['easy', 'medium', 'hard', 'nightmare', 'ultra-nightmare'];
for (const tier of DIFFICULTY_TIERS) {
  if (_diffMult[tier] == null) {
    throw new Error(
      `turf-sim.json packEconomy.difficultyRewardMult is missing entry for "${tier}". ` +
      `All difficulty multipliers must be configured explicitly — no silent fallback allowed.`,
    );
  }
}
const DIFFICULTY_REWARD_MULT = _diffMult as Record<DifficultyTier, number>;

const VALID_PACK_KINDS: ReadonlySet<string> = new Set([
  'single', 'triple', 'standard',
]);

function pickCardType(rng: Rng): CardCategory {
  const weights = TURF_SIM_CONFIG.packEconomy.typeWeights;
  const total = weights.tough + weights.weapon + weights.drug + weights.currency;
  if (total <= 0) {
    throw new Error('turf-sim.json packEconomy.typeWeights must sum to > 0');
  }
  const roll = rng.next() * total;
  let cum = 0;
  for (const type of ['tough', 'weapon', 'drug', 'currency'] as const) {
    cum += weights[type];
    if (roll < cum) return type;
  }
  return 'tough';
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

function isPackRewardArray(value: unknown): value is PackReward[] {
  if (!Array.isArray(value)) return false;
  return value.every((r) => {
    if (r == null || typeof r !== 'object') return false;
    const kind = (r as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !VALID_PACK_KINDS.has(kind)) return false;
    const count = (r as { count?: unknown }).count;
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

/** Pick a base rarity per §3 drop rates (excludes mythic). */
function pickBaseRarity(rng: Rng): Rarity {
  const total =
    BASE_RARITY_WEIGHTS.common +
    BASE_RARITY_WEIGHTS.uncommon +
    BASE_RARITY_WEIGHTS.rare +
    BASE_RARITY_WEIGHTS.legendary;
  const roll = rng.next() * total;
  let cum = 0;
  for (const tier of ['common', 'uncommon', 'rare', 'legendary'] as const) {
    cum += BASE_RARITY_WEIGHTS[tier];
    if (roll < cum) return tier;
  }
  return 'legendary';
}

/**
 * Roll the instance rarity given a card's base rarity.
 *
 * The high-difficulty reward multiplier boosts the probability mass on
 * tiers ABOVE the base, proportional to (multiplier - 1). The
 * resulting weights are renormalized so the distribution remains a
 * valid PDF. Ultra-Nightmare (×2.0) effectively doubles the roll-up
 * probabilities (relative to easy's baseline).
 */
function rollInstanceRarity(base: Rarity, rng: Rng, mult: number): Rarity {
  const dist = ROLL_DISTRIBUTIONS[base];
  const entries = Object.entries(dist) as [Rarity, number][];
  if (entries.length === 1) return entries[0][0];
  // Boost upgrade tiers by the multiplier.
  const boosted = entries.map(([rarity, p]) => {
    if (rarity === base) return [rarity, p] as [Rarity, number];
    return [rarity, p * mult] as [Rarity, number];
  });
  const total = boosted.reduce((s, [, p]) => s + p, 0);
  const roll = rng.next() * total;
  let cum = 0;
  for (const [rarity, p] of boosted) {
    cum += p;
    if (roll < cum) return rarity;
  }
  return boosted[boosted.length - 1][0];
}

function getPool(category: 'tough' | 'weapon' | 'drug' | 'currency'): Card[] {
  switch (category) {
    case 'tough': return loadToughCards();
    case 'weapon': return generateWeapons();
    case 'drug': return generateDrugs();
    case 'currency': return generateCurrency();
  }
}

function cardBaseRarity(card: Card): Rarity {
  return card.rarity;
}

function stampRarity(card: Card, rarity: Rarity): Card {
  return { ...card, rarity };
}

function pickCardOfBase(
  pool: Card[],
  base: Rarity,
  rng: Rng,
  exclude: Set<string>,
): Card {
  const ofBase = pool.filter((c) => cardBaseRarity(c) === base);
  const available = ofBase.filter((c) => !exclude.has(c.id));
  if (available.length > 0) return rng.pick(available);
  if (ofBase.length > 0) return rng.pick(ofBase);
  // No card at that base in the pool (e.g. a weapon pool with no
  // legendary-base cards yet). Fall back to any-rarity pick so we
  // never hand back `undefined`.
  const anyAvailable = pool.filter((c) => !exclude.has(c.id));
  return rng.pick(anyAvailable.length > 0 ? anyAvailable : pool);
}

export interface GeneratePackOptions {
  unlockDifficulty?: DifficultyTier;
}

export function generatePack(
  kind: PackKind,
  collection: Card[],
  rng: Rng,
  options: GeneratePackOptions = {},
): Card[] {
  const size = PACK_SIZE[kind];
  const mult = DIFFICULTY_REWARD_MULT[options.unlockDifficulty ?? 'easy'];

  const cards: Card[] = [];
  const usedIds = new Set(collection.map((c) => c.id));

  for (let i = 0; i < size; i++) {
    const category = pickCardType(rng);
    const pool = getPool(category);

    if (category === 'currency') {
      const available = pool.filter((c) => !usedIds.has(c.id));
      const picked = rng.pick(available.length > 0 ? available : pool);
      cards.push(picked);
      usedIds.add(picked.id);
      continue;
    }

    const baseRarity = pickBaseRarity(rng);
    const base = pickCardOfBase(pool, baseRarity, rng, usedIds);
    const rolled = rollInstanceRarity(cardBaseRarity(base), rng, mult);
    cards.push(stampRarity(base, rolled));
    usedIds.add(base.id);
  }

  return cards;
}

/**
 * Generate a pack and return CardInstance records (rolled rarity +
 * unlock-difficulty tag) alongside the cards. Consumers that need to
 * persist instance metadata should prefer this over `generatePack`.
 */
export function generatePackInstances(
  kind: PackKind,
  collection: Card[],
  rng: Rng,
  options: GeneratePackOptions = {},
): CardInstance[] {
  const cards = generatePack(kind, collection, rng, options);
  const unlockDifficulty = options.unlockDifficulty ?? 'easy';
  return cards.map((c) => ({
    cardId: c.id,
    rolledRarity: c.rarity,
    unlockDifficulty,
  }));
}

export function starterGrant(rng: Rng): Card[] {
  const grants = coercePackRewards(
    TURF_SIM_CONFIG.packEconomy.starterGrant,
    'turf-sim.json packEconomy.starterGrant',
  );
  const cards: Card[] = [];
  for (const grant of grants) {
    for (let i = 0; i < grant.count; i++) {
      // Starter cards are granted at easy difficulty per §3.3.
      cards.push(...generatePack(grant.kind, cards, rng, { unlockDifficulty: 'easy' }));
    }
  }
  return cards;
}

/**
 * Returns per-difficulty pack rewards for a completed match.
 * The `_suddenDeath` param is kept for call-site back-compat but is
 * ignored — Sudden Death was removed in v0.3.
 */
export function matchRewardPacks(
  difficulty: string,
  _suddenDeath: boolean,
  won: boolean,
): PackReward[] {
  if (!won) return [];
  const rewardCfg = TURF_SIM_CONFIG.packEconomy.rewards;
  const tier = rewardCfg[difficulty as keyof typeof rewardCfg];
  if (!tier) return [];
  return coercePackRewards(
    tier.base,
    `turf-sim.json packEconomy.rewards.${difficulty}.base`,
  );
}

export { RARITY_ORDER };
