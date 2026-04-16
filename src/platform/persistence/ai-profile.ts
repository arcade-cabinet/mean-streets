import type { Rng } from '../../sim/cards/rng';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generatePack, starterGrant } from '../../sim/packs/generator';
import type { PackInstance, PackReward } from '../../sim/packs/types';
import type { CardInstance, Card, DifficultyTier } from '../../sim/turf/types';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';
import { getDatabase, saveWebStore } from './database';

/**
 * AI progression mirror (RULES §3 / §13.2).
 *
 * The AI's collection grows in parallel with the player's — every
 * reward the AI earns goes here. Stored under a separate SQLite
 * namespace so a collection-wipe on the player profile doesn't
 * stomp the AI's accumulated progress (and vice versa).
 *
 * **TODO (Vera):** `aiPerfectWarFallbackCount` is read/incremented by
 * persistence callers but rewards.ts still returns a flat $500 — the
 * escalation ($500 → $1000 → …) hasn't been wired through. Integration
 * tests should cover the first Perfect War after exhaustion and each
 * subsequent scale-up.
 */
export interface AIProfileData {
  aiCollection: CardInstance[];
  aiMythicAssignments: Record<string, string>;
  aiWarWinCount: number;
  aiPendingPacks: PackInstance[];
  aiPerfectWarFallbackCount: number;
}

const AI_NS = 'ai-profile';
const AI_KEY = 'current';

const DEFAULT_AI_PROFILE: AIProfileData = {
  aiCollection: [],
  aiMythicAssignments: {},
  aiWarWinCount: 0,
  aiPendingPacks: [],
  aiPerfectWarFallbackCount: 0,
};

let aiUpdateChain: Promise<unknown> = Promise.resolve();

async function withAIProfileLock<T>(fn: () => Promise<T>): Promise<T> {
  const prior = aiUpdateChain.catch(() => undefined);
  const next = prior.then(() => fn());
  aiUpdateChain = next.catch(() => undefined);
  return next;
}

function isTestEnv(): boolean {
  return typeof window !== 'undefined' && window.__MEAN_STREETS_TEST__ === true;
}

const testStore = new Map<string, string>();

function safeParse<T>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function rawGet(): Promise<AIProfileData | null> {
  if (isTestEnv()) return safeParse<AIProfileData>(testStore.get(AI_KEY));
  const db = await getDatabase();
  const result = await db.query(
    'SELECT value FROM app_kv WHERE namespace = ? AND item_key = ? LIMIT 1',
    [AI_NS, AI_KEY],
  );
  const row = result.values?.[0];
  return row ? safeParse<AIProfileData>(String(row.value)) : null;
}

async function rawSet(data: AIProfileData): Promise<void> {
  if (isTestEnv()) {
    testStore.set(AI_KEY, JSON.stringify(data));
    return;
  }
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO app_kv(namespace, item_key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(namespace, item_key)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [AI_NS, AI_KEY, JSON.stringify(data), now],
  );
  await saveWebStore();
}

/** Load the AI profile, seeding defaults on first read. */
export async function loadAIProfile(): Promise<AIProfileData> {
  const existing = await rawGet();
  // Spread defaults first so fields added post-launch don't throw on
  // old rows lacking those keys.
  return existing ? { ...DEFAULT_AI_PROFILE, ...existing } : { ...DEFAULT_AI_PROFILE };
}

/** Persist the AI profile blob. */
export async function saveAIProfile(data: AIProfileData): Promise<void> {
  return withAIProfileLock(() => rawSet(data));
}

function fullPool(): Card[] {
  return [
    ...loadToughCards(), ...generateWeapons(),
    ...generateDrugs(), ...generateCurrency(),
  ];
}

function asInstance(card: Card, difficulty: DifficultyTier): CardInstance {
  return { cardId: card.id, rolledRarity: card.rarity, unlockDifficulty: difficulty };
}

/** Grant the AI its starter collection (mirrors §3 player grant). */
export async function grantAIStarterCollection(
  rng: Rng = createRng(randomSeed()),
): Promise<void> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    if (profile.aiCollection.length > 0) return;
    const cards = starterGrant(rng);
    profile.aiCollection = cards.map((c) => asInstance(c, 'easy'));
    await rawSet(profile);
  });
}

/** Queue PackInstances for the AI to open later. */
export async function addPendingPacksToAI(packs: PackInstance[]): Promise<void> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    profile.aiPendingPacks = [...profile.aiPendingPacks, ...packs];
    await rawSet(profile);
  });
}

/**
 * Open every queued pending pack into the AI's collection. Cards in a
 * queued PackInstance are always empty — contents materialize here so
 * the random draw is reproducible against the current seed.
 */
export async function openPendingAIPacks(
  unlockDifficulty: DifficultyTier = 'easy',
  seed?: number,
): Promise<CardInstance[]> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    if (profile.aiPendingPacks.length === 0) return [];
    const rng = createRng(seed ?? randomSeed());
    const pool = fullPool();
    // Running view so consecutive packs in one batch reflect earlier
    // pulls (mirrors collection.ts's openRewardPacks).
    const running: Card[] = pool.filter((c) =>
      profile.aiCollection.some((ci) => ci.cardId === c.id),
    );
    const fresh: CardInstance[] = [];
    for (const pack of profile.aiPendingPacks) {
      const cards = generatePack(pack.kind, running, rng, { unlockDifficulty });
      for (const c of cards) {
        fresh.push(asInstance(c, unlockDifficulty));
        if (!running.some((r) => r.id === c.id)) running.push(c);
      }
    }
    profile.aiPendingPacks = [];
    profile.aiCollection = [...profile.aiCollection, ...fresh];
    await rawSet(profile);
    return fresh;
  });
}

/** Pending pack rewards hook for tests / sim harness. */
export async function aiPendingPacksFromRewards(
  rewards: PackReward[],
  seed?: number,
): Promise<PackInstance[]> {
  const rng = createRng(seed ?? randomSeed());
  const packs: PackInstance[] = [];
  for (const r of rewards) {
    for (let i = 0; i < r.count; i++) {
      packs.push({
        id: `ai-pack-${rng.int(100000, 999999)}`,
        kind: r.kind, cards: [], openedAt: null,
      });
    }
  }
  return packs;
}

/** Reset hook for tests. */
export async function resetAIProfileForTests(): Promise<void> {
  if (isTestEnv()) {
    testStore.clear();
    return;
  }
  const db = await getDatabase();
  await db.run('DELETE FROM app_kv WHERE namespace = ?', [AI_NS]);
  await saveWebStore();
}
