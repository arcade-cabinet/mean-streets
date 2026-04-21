import type { Card, DifficultyTier, Rarity } from '../../sim/turf/types';
import type { PackInstance, PackKind, PackReward } from '../../sim/packs/types';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generatePack, starterGrant } from '../../sim/packs/generator';
import {
  loadProfile,
  saveProfile,
  type StoredCardInstance,
  type StoredCardInventoryItem,
} from './storage';
import { loadCollectibleCards } from '../../sim/cards/catalog';

// ── v0.3 CardInstance migration ─────────────────────────────
// Each unlocked card carries (rolledRarity, unlockDifficulty) per §2/§3.
// For backward compat with pre-v0.3 saves we keep `unlockedCardIds` as
// the source of truth for *which* cards are unlocked and store per-id
// instance metadata in a sidecar `cardInstances` map. When we load, any
// cardId without an instance record uses (baseRarity, 'easy') defaults.
const DEFAULT_UNLOCK_DIFFICULTY: DifficultyTier = 'easy';
const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'legendary',
  'mythic',
];
const DIFFICULTY_ORDER: DifficultyTier[] = [
  'easy',
  'medium',
  'hard',
  'nightmare',
  'ultra-nightmare',
];

export interface CollectionInventoryEntry {
  card: Card;
  unlockDifficulty: DifficultyTier;
}

export interface MergeCollectionResult {
  cardId: string;
  fromRarity: Rarity;
  toRarity: Rarity;
  unlockDifficulty: DifficultyTier;
}

function defaultInstanceForCard(card: Card): StoredCardInstance {
  return {
    rolledRarity: card.rarity,
    unlockDifficulty: DEFAULT_UNLOCK_DIFFICULTY,
  };
}

function inventoryItemForCard(
  card: Card,
  unlockDifficulty: DifficultyTier = DEFAULT_UNLOCK_DIFFICULTY,
): StoredCardInventoryItem {
  return {
    cardId: card.id,
    rolledRarity: card.rarity,
    unlockDifficulty,
  };
}

function cloneInventoryItem(
  item: StoredCardInventoryItem,
): StoredCardInventoryItem {
  return { ...item };
}

function cloneCard(card: Card): Card {
  if (card.kind === 'tough') {
    return {
      ...card,
      abilities: [...card.abilities],
    };
  }
  if (card.kind === 'currency') {
    return {
      ...card,
      abilities: card.abilities ? [...card.abilities] : undefined,
    };
  }
  return {
    ...card,
    abilities: [...card.abilities],
  };
}

function applyInstance(
  card: Card,
  instance: StoredCardInstance | undefined,
): Card {
  const cloned = cloneCard(card);
  if (!instance) return cloned;
  // Rarity on Card is the *rolled* rarity per v0.3 (the authored base
  // rarity lives in the raw catalog; once an instance is minted the
  // runtime card carries the rolled tier). We stamp the stored rarity
  // onto a fresh copy so the catalog snapshot stays pristine.
  return { ...cloned, rarity: instance.rolledRarity as Rarity };
}

function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

function difficultyRank(difficulty: DifficultyTier): number {
  return DIFFICULTY_ORDER.indexOf(difficulty);
}

function compareInventoryItems(
  a: StoredCardInventoryItem,
  b: StoredCardInventoryItem,
): number {
  return (
    rarityRank(a.rolledRarity as Rarity) - rarityRank(b.rolledRarity as Rarity) ||
    difficultyRank(a.unlockDifficulty as DifficultyTier) -
      difficultyRank(b.unlockDifficulty as DifficultyTier)
  );
}

function nextMergeRarity(rarity: Rarity): Rarity | null {
  if (rarity === 'legendary' || rarity === 'mythic') return null;
  const next = RARITY_ORDER[rarityRank(rarity) + 1];
  return next ?? null;
}

function resolveSummaryMap(
  inventory: StoredCardInventoryItem[],
): Record<string, StoredCardInstance> {
  const bestById = new Map<string, StoredCardInventoryItem>();
  for (const item of inventory) {
    const current = bestById.get(item.cardId);
    if (!current || compareInventoryItems(item, current) > 0) {
      bestById.set(item.cardId, item);
    }
  }
  return Object.fromEntries(
    [...bestById.entries()].map(([cardId, item]) => [
      cardId,
      {
        rolledRarity: item.rolledRarity,
        unlockDifficulty: item.unlockDifficulty,
      },
    ]),
  );
}

// ── Card Preferences ────────────────────────────────────────────────────────
//
// CardPreference controls per-card enable/disable and priority bias (1–10).
// Stored as a flat Record<cardId, CardPreference> on the player profile via
// a separate preferences namespace so that preference reads/writes do NOT
// interfere with unlockedCardIds serialization.
//
// Migration: cards that have no entry yet receive defaults (enabled=true,
// priority=5) when preferences are first loaded, and again when new card ids
// appear in the collection that aren't yet tracked.

export interface CardPreference {
  cardId: string;
  enabled: boolean;
  priority: number; // 1–10; default 5
}

const DEFAULT_PRIORITY = 5;

function defaultPref(cardId: string): CardPreference {
  return { cardId, enabled: true, priority: DEFAULT_PRIORITY };
}

function legacyPreferenceKey(cardId: string): string | null {
  const [legacyKey] = cardId.split('::');
  return legacyKey !== cardId ? legacyKey : null;
}

// Preferences are stored in the profile under a dedicated key so the existing
// `unlockedCardIds` shape is never mutated by preference writes.
const PREFS_PROFILE_KEY = 'cardPreferences';

// Access the raw preferences map from the profile (internally typed extension).
type ProfileWithPrefs =
  ReturnType<typeof loadProfile> extends Promise<infer P>
    ? P & { [PREFS_PROFILE_KEY]?: Record<string, CardPreference> }
    : never;

async function loadRawPrefs(): Promise<Record<string, CardPreference>> {
  const profile = (await loadProfile()) as ProfileWithPrefs;
  return (profile[PREFS_PROFILE_KEY] as Record<string, CardPreference>) ?? {};
}

async function saveRawPrefs(
  prefs: Record<string, CardPreference>,
): Promise<void> {
  const profile = (await loadProfile()) as ProfileWithPrefs;
  (profile as unknown as Record<string, unknown>)[PREFS_PROFILE_KEY] = prefs;
  await saveProfile(profile);
}

/**
 * Load preferences for all given card ids, filling in defaults for any
 * card that has no stored preference yet (migration path).
 */
export async function loadPreferences(
  cardIds: string[],
): Promise<CardPreference[]> {
  const raw = await loadRawPrefs();
  return cardIds.map((id) => {
    const direct = raw[id];
    if (direct) return direct;
    const legacyKey = legacyPreferenceKey(id);
    const legacy = legacyKey ? raw[legacyKey] : undefined;
    if (!legacy) return defaultPref(id);
    return { ...legacy, cardId: id };
  });
}

/**
 * Persist updated preferences. Uses withProfileLock to avoid races with
 * other collection writes.
 */
export async function savePreferences(prefs: CardPreference[]): Promise<void> {
  return withProfileLock(async () => {
    const raw = await loadRawPrefs();
    for (const p of prefs) {
      raw[p.cardId] = { ...p, priority: Math.max(1, Math.min(10, p.priority)) };
    }
    await saveRawPrefs(raw);
  });
}

/**
 * Update a single card's preference (toggle enabled or change priority).
 */
export async function updatePreference(pref: CardPreference): Promise<void> {
  return savePreferences([pref]);
}

// Lazily build the catalog pool and cache its id→card map. The pool is
// deterministic (toughs from compiled JSON, weapons/drugs/currency from
// seeded generators with no arg) so one build is enough for the process
// lifetime — every prior call to `resolveCardIds` rebuilt ~200 cards
// plus a Map, turning an O(1) lookup into an O(n) allocation spike
// hot-called from loadCollection / addCardsToCollection.
let cachedPoolMap: Map<string, Card> | null = null;

function getPoolMap(): Map<string, Card> {
  if (cachedPoolMap !== null) return cachedPoolMap;
  const pool = loadCollectibleCards();
  cachedPoolMap = new Map(pool.map((c) => [c.id, c]));
  return cachedPoolMap;
}

function resolveCardIds(
  ids: string[],
  instances: Record<string, StoredCardInstance> | undefined,
): Card[] {
  const poolMap = getPoolMap();
  const out: Card[] = [];
  for (const id of ids) {
    const base = poolMap.get(id);
    if (!base) continue;
    out.push(applyInstance(base, instances?.[id]));
  }
  return out;
}

function hasStoredCollection(
  profile: Awaited<ReturnType<typeof loadProfile>>,
): boolean {
  return (profile.cardInventory?.length ?? 0) > 0 || profile.unlockedCardIds.length > 0;
}

function loadLegacyInventory(
  ids: string[],
  instances: Record<string, StoredCardInstance> | undefined,
): StoredCardInventoryItem[] {
  const poolMap = getPoolMap();
  const inventory: StoredCardInventoryItem[] = [];
  for (const id of ids) {
    const base = poolMap.get(id);
    if (!base) continue;
    const item = instances?.[id] ?? defaultInstanceForCard(base);
    inventory.push({
      cardId: id,
      rolledRarity: item.rolledRarity,
      unlockDifficulty: item.unlockDifficulty,
    });
  }
  return inventory;
}

function loadInventoryFromProfile(
  profile: Awaited<ReturnType<typeof loadProfile>>,
): StoredCardInventoryItem[] {
  if (profile.cardInventory && profile.cardInventory.length > 0) {
    return profile.cardInventory.map(cloneInventoryItem);
  }
  return loadLegacyInventory(profile.unlockedCardIds, profile.cardInstances);
}

function resolveInventoryCards(
  inventory: StoredCardInventoryItem[],
): CollectionInventoryEntry[] {
  const poolMap = getPoolMap();
  const out: CollectionInventoryEntry[] = [];
  for (const item of inventory) {
    const base = poolMap.get(item.cardId);
    if (!base) continue;
    out.push({
      card: applyInstance(base, item),
      unlockDifficulty: item.unlockDifficulty as DifficultyTier,
    });
  }
  return out;
}

function resolveSummaryCards(inventory: StoredCardInventoryItem[]): Card[] {
  const summary = resolveSummaryMap(inventory);
  return resolveCardIds(Object.keys(summary), summary);
}

function syncProfileCollectionState(
  profile: Awaited<ReturnType<typeof loadProfile>>,
  inventory: StoredCardInventoryItem[],
): void {
  profile.cardInventory = inventory.map(cloneInventoryItem);
  profile.cardInstances = resolveSummaryMap(inventory);
  profile.unlockedCardIds = Object.keys(profile.cardInstances);
}

export async function loadCollection(): Promise<Card[]> {
  const profile = await loadProfile();
  if (hasStoredCollection(profile)) {
    return resolveSummaryCards(loadInventoryFromProfile(profile));
  }
  // First-run starter grant must serialize with other writers. Without
  // the lock, two concurrent `loadCollection` calls on a fresh install
  // would both see an empty collection and both produce a starter
  // grant — granting twice. `withProfileLock` ensures only the first
  // caller grants; the second sees the populated collection after the
  // first finishes.
  return withProfileLock(async () => {
    const reread = await loadProfile();
    if (hasStoredCollection(reread)) {
      return resolveSummaryCards(loadInventoryFromProfile(reread));
    }
    const rng = createRng(randomSeed());
    const cards = starterGrant(rng);
    const inventory = cards.map((card) => inventoryItemForCard(card));
    syncProfileCollectionState(reread, inventory);
    await saveProfile(reread);
    return resolveSummaryCards(inventory);
  });
}

export async function loadCollectionInventory(): Promise<CollectionInventoryEntry[]> {
  const profile = await loadProfile();
  if (!hasStoredCollection(profile)) {
    await loadCollection();
    const refreshed = await loadProfile();
    return resolveInventoryCards(loadInventoryFromProfile(refreshed));
  }
  return resolveInventoryCards(loadInventoryFromProfile(profile));
}

export async function mergeCollectionBucket(
  cardId: string,
  rarity: Rarity,
): Promise<MergeCollectionResult | null> {
  return withProfileLock(async () => {
    const nextRarity = nextMergeRarity(rarity);
    if (!nextRarity) return null;

    const profile = await loadProfile();
    const inventory = loadInventoryFromProfile(profile);
    const matchingIndices: number[] = [];
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (item.cardId === cardId && item.rolledRarity === rarity) {
        matchingIndices.push(i);
        if (matchingIndices.length === 2) break;
      }
    }
    if (matchingIndices.length < 2) return null;

    const [first, second] = matchingIndices;
    const mergedUnlockDifficulty =
      difficultyRank(inventory[first].unlockDifficulty as DifficultyTier) >=
      difficultyRank(inventory[second].unlockDifficulty as DifficultyTier)
        ? (inventory[first].unlockDifficulty as DifficultyTier)
        : (inventory[second].unlockDifficulty as DifficultyTier);

    const nextInventory = inventory.filter(
      (_, index) => index !== first && index !== second,
    );
    nextInventory.push({
      cardId,
      rolledRarity: nextRarity,
      unlockDifficulty: mergedUnlockDifficulty,
    });

    syncProfileCollectionState(profile, nextInventory);
    await saveProfile(profile);

    return {
      cardId,
      fromRarity: rarity,
      toRarity: nextRarity,
      unlockDifficulty: mergedUnlockDifficulty,
    };
  });
}

// ── Profile update serialization ────────────────────────────
//
// `saveCollection` and `addCardsToCollection` both do read-modify-write
// on `profile.unlockedCardIds`. JS is single-threaded but async ops
// interleave across `await` points, so two concurrent calls can both
// read the same snapshot, each apply their delta, and race to save —
// the loser's changes silently vanish.
//
// Use a single-slot promise chain as a serialization lock. Every caller
// awaits the previous update before reading the profile. Any error
// inside a critical section propagates to its own caller without
// poisoning subsequent waiters (the `.catch` below resets the chain).

let profileUpdateChain: Promise<unknown> = Promise.resolve();

async function withProfileLock<T>(fn: () => Promise<T>): Promise<T> {
  const prior = profileUpdateChain.catch(() => undefined);
  const next = prior.then(() => fn());
  profileUpdateChain = next.catch(() => undefined);
  return next;
}

export async function saveCollection(cards: Card[]): Promise<void> {
  await withProfileLock(async () => {
    const profile = await loadProfile();
    const inventory = cards.map((card) => {
      const unlockDifficulty =
        (profile.cardInstances?.[card.id]?.unlockDifficulty as DifficultyTier | undefined) ??
        DEFAULT_UNLOCK_DIFFICULTY;
      return inventoryItemForCard(card, unlockDifficulty);
    });
    syncProfileCollectionState(profile, inventory);
    await saveProfile(profile);
  });
}

export async function addCardsToCollection(newCards: Card[]): Promise<Card[]> {
  return withProfileLock(async () => {
    const profile = await loadProfile();
    const inventory = loadInventoryFromProfile(profile);
    inventory.push(...newCards.map((card) => inventoryItemForCard(card)));
    syncProfileCollectionState(profile, inventory);
    await saveProfile(profile);
    return resolveSummaryCards(inventory);
  });
}

export async function grantStarterCollection(): Promise<Card[]> {
  const rng = createRng(randomSeed());
  const cards = starterGrant(rng);
  await saveCollection(cards);
  return resolveSummaryCards(cards.map((card) => inventoryItemForCard(card)));
}

export async function openRewardPacks(
  rewards: PackReward[],
  unlockDifficulty: DifficultyTier = DEFAULT_UNLOCK_DIFFICULTY,
  seed?: number,
): Promise<Card[]> {
  const packKinds: PackKind[] = [];
  for (const reward of rewards) {
    for (let i = 0; i < reward.count; i++) {
      packKinds.push(reward.kind);
    }
  }
  return openRewardPackKinds(packKinds, unlockDifficulty, seed);
}

export async function openRewardPackInstances(
  packs: PackInstance[],
  unlockDifficulty: DifficultyTier = DEFAULT_UNLOCK_DIFFICULTY,
  seed?: number,
): Promise<Card[]> {
  return openRewardPackKinds(
    packs.map((pack) => pack.kind),
    unlockDifficulty,
    seed,
  );
}

async function openRewardPackKinds(
  packKinds: PackKind[],
  unlockDifficulty: DifficultyTier,
  seed?: number,
): Promise<Card[]> {
  const rng = createRng(seed ?? randomSeed());
  const newCards: Card[] = [];
  // Reward packs should be allowed to duplicate already-owned cards so
  // merge progression remains possible. We only exclude cards opened
  // earlier in the same reward batch to avoid obvious same-bundle repeats.
  const runningCollection: Card[] = [];
  const seenIds = new Set<string>();

  for (const kind of packKinds) {
    const packCards = generatePack(kind, runningCollection, rng, {
      unlockDifficulty,
    });
    newCards.push(...packCards);
    for (const card of packCards) {
      if (!seenIds.has(card.id)) {
        seenIds.add(card.id);
        runningCollection.push(card);
      }
    }
  }

  if (newCards.length > 0) {
    await addCardsToCollectionWithDifficulty(newCards, unlockDifficulty);
  }

  return newCards;
}

/**
 * Sync player-owned mythic ids after a war ends (RULES §11).
 *
 * Persists the new set of player-owned mythic ids to `PlayerProfile.ownedMythicIds`
 * and ensures every newly-acquired mythic is also in `unlockedCardIds` with
 * a default mythic rarity CardInstance (unlockDifficulty comes from the war).
 *
 * Does NOT touch AI assignments — those are handled by `saveAIMythicAssignments`.
 */
export async function syncPlayerMythicOwnership(
  playerMythicIds: string[],
  unlockDifficulty: import('../../sim/turf/types').DifficultyTier = 'easy',
): Promise<void> {
  return withProfileLock(async () => {
    const profile = await loadProfile();
    profile.ownedMythicIds = [...playerMythicIds];
    const inventory = loadInventoryFromProfile(profile);
    const existingById = new Map(
      inventory.map((item) => [item.cardId, item]),
    );
    const nextMythics: StoredCardInventoryItem[] = [];
    for (const id of playerMythicIds) {
      nextMythics.push(
        existingById.get(id) ?? {
          cardId: id,
          rolledRarity: 'mythic',
          unlockDifficulty,
        },
      );
    }
    syncProfileCollectionState(profile, [
      ...inventory.filter((item) => !/^mythic-\d+$/.test(item.cardId)),
      ...nextMythics,
    ]);
    await saveProfile(profile);
  });
}

/**
 * Return the mythic card ids currently owned by the player.
 * Uses the explicit `ownedMythicIds` field when present; falls back to
 * deriving from `unlockedCardIds` (backward-compat with pre-fix saves).
 */
export async function loadPlayerOwnedMythicIds(): Promise<string[]> {
  const profile = await loadProfile();
  if (profile.ownedMythicIds !== undefined) return profile.ownedMythicIds;
  // Backward-compat: infer from unlocked ids that look like mythics.
  return profile.unlockedCardIds.filter((id) => /^mythic-\d+$/.test(id));
}

/**
 * Internal variant of `addCardsToCollection` that tags new instances with
 * the given unlock difficulty. Extracted so the public `addCardsToCollection`
 * signature stays stable for existing callers (they get 'easy' by default).
 */
async function addCardsToCollectionWithDifficulty(
  newCards: Card[],
  unlockDifficulty: DifficultyTier,
): Promise<Card[]> {
  return withProfileLock(async () => {
    const profile = await loadProfile();
    const inventory = loadInventoryFromProfile(profile);
    inventory.push(
      ...newCards.map((card) => inventoryItemForCard(card, unlockDifficulty)),
    );
    syncProfileCollectionState(profile, inventory);
    await saveProfile(profile);
    return resolveSummaryCards(inventory);
  });
}
