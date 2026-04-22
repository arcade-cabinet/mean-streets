import type { Rng } from '../../sim/cards/rng';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generatePack, starterGrant } from '../../sim/packs/generator';
import type { PackInstance, PackReward } from '../../sim/packs/types';
import type {
  CardInstance,
  Card,
  DifficultyTier,
  Rarity,
} from '../../sim/turf/types';
import { loadCollectibleCards } from '../../sim/cards/catalog';
import { getDatabase, withDatabaseWriteLock } from './database';

/**
 * AI progression mirror (RULES §3 / §13.2).
 *
 * The AI's collection grows in parallel with the player's — every
 * reward the AI earns goes here. Stored under a separate SQLite
 * namespace so a collection-wipe on the player profile doesn't
 * stomp the AI's accumulated progress (and vice versa).
 */
export interface AIProfileData {
  aiCollection: CardInstance[];
  aiMythicAssignments: Record<string, string>;
  aiWarWinCount: number;
  aiPendingPacks: PackInstance[];
  aiPerfectWarFallbackCount: number;
}

export interface AIRewardOpenOptions {
  permadeath?: boolean;
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
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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
  const now = new Date().toISOString();
  await withDatabaseWriteLock(async (db) => {
    await db.run(
      `INSERT INTO app_kv(namespace, item_key, value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace, item_key)
        DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [AI_NS, AI_KEY, JSON.stringify(data), now],
    );
  });
}

/** Load the AI profile, seeding defaults on first read. */
export async function loadAIProfile(): Promise<AIProfileData> {
  const existing = await rawGet();
  // Spread defaults first so fields added post-launch don't throw on
  // old rows lacking those keys.
  return existing
    ? { ...DEFAULT_AI_PROFILE, ...existing }
    : { ...DEFAULT_AI_PROFILE };
}

/** Persist the AI profile blob. */
export async function saveAIProfile(data: AIProfileData): Promise<void> {
  return withAIProfileLock(() => rawSet(data));
}

function fullPool(): Card[] {
  return loadCollectibleCards();
}

let cachedPoolMap: Map<string, Card> | null = null;

function poolMap(): Map<string, Card> {
  if (cachedPoolMap !== null) return cachedPoolMap;
  cachedPoolMap = new Map(fullPool().map((card) => [card.id, card]));
  return cachedPoolMap;
}

function asInstance(card: Card, difficulty: DifficultyTier): CardInstance {
  return {
    cardId: card.id,
    rolledRarity: card.rarity,
    unlockDifficulty: difficulty,
  };
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

function resolveAIInstance(instance: CardInstance): Card | null {
  const base = poolMap().get(instance.cardId);
  if (!base) return null;
  return { ...base, rarity: instance.rolledRarity as Rarity };
}

export async function loadAICollection(): Promise<Card[]> {
  const profile = await loadAIProfile();
  const cards: Card[] = [];
  for (const instance of profile.aiCollection) {
    const resolved = resolveAIInstance(instance);
    if (resolved) cards.push(resolved);
  }
  return cards;
}

/** Queue PackInstances for the AI to open later. */
export async function addPendingPacksToAI(
  packs: PackInstance[],
): Promise<void> {
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
  options: AIRewardOpenOptions = {},
): Promise<CardInstance[]> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    if (profile.aiPendingPacks.length === 0) return [];
    const rng = createRng(seed ?? randomSeed());
    // Mirror the player reward opener: duplicate-owned cards must stay
    // eligible so AI merge progression remains possible, but cards
    // opened earlier in this same batch remain excluded.
    const running: Card[] = [];
    const fresh: CardInstance[] = [];
    for (const pack of profile.aiPendingPacks) {
      const cards = generatePack(pack.kind, running, rng, {
        unlockDifficulty,
        permadeath: options.permadeath,
      });
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
        kind: r.kind,
        cards: [],
        openedAt: null,
      });
    }
  }
  return packs;
}

/**
 * Return the mythic card ids currently owned by the AI (RULES §11).
 * Derived from `aiMythicAssignments` entries assigned to side 'B'
 * (AI always plays as side B in App.tsx matches).
 */
export async function loadAIOwedMythicIds(): Promise<string[]> {
  const profile = await loadAIProfile();
  return Object.entries(profile.aiMythicAssignments)
    .filter(([, side]) => side === 'B')
    .map(([id]) => id);
}

/**
 * Persist the AI's mythic assignments after a war.
 * Only records owned by 'B' are the AI's; 'A' entries are cleared
 * since the player profile tracks those.
 */
export async function saveAIMythicAssignments(
  assignments: Record<string, 'A' | 'B'>,
  unlockDifficulty: DifficultyTier = 'easy',
): Promise<void> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    // Only preserve AI-owned ('B') mythics; player-owned go into PlayerProfile.
    const aiAssignments: Record<string, string> = {};
    const existingById = new Map(
      profile.aiCollection.map((instance) => [instance.cardId, instance]),
    );
    const nextMythics: CardInstance[] = [];
    for (const [id, side] of Object.entries(assignments)) {
      if (side !== 'B') continue;
      aiAssignments[id] = 'B';
      nextMythics.push(
        existingById.get(id) ?? {
          cardId: id,
          rolledRarity: 'mythic',
          unlockDifficulty,
        },
      );
    }
    profile.aiMythicAssignments = aiAssignments;
    profile.aiCollection = [
      ...profile.aiCollection.filter((instance) => !/^mythic-\d+$/.test(instance.cardId)),
      ...nextMythics,
    ];
    await rawSet(profile);
  });
}

export async function incrementAIPerfectWarFallbackCount(): Promise<number> {
  return withAIProfileLock(async () => {
    const profile = (await rawGet()) ?? { ...DEFAULT_AI_PROFILE };
    profile.aiPerfectWarFallbackCount += 1;
    await rawSet(profile);
    return profile.aiPerfectWarFallbackCount;
  });
}

/** Reset hook for tests. */
export async function resetAIProfileForTests(): Promise<void> {
  if (isTestEnv()) {
    testStore.clear();
    return;
  }
  await withDatabaseWriteLock(async (db) => {
    await db.run('DELETE FROM app_kv WHERE namespace = ?', [AI_NS]);
  });
}
