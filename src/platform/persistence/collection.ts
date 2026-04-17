import type { Card, DifficultyTier, Rarity } from '../../sim/turf/types';
import type { PackReward } from '../../sim/packs/types';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generatePack, starterGrant } from '../../sim/packs/generator';
import { loadProfile, saveProfile, type StoredCardInstance } from './storage';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';

// ── v0.3 CardInstance migration ─────────────────────────────
// Each unlocked card carries (rolledRarity, unlockDifficulty) per §2/§3.
// For backward compat with pre-v0.3 saves we keep `unlockedCardIds` as
// the source of truth for *which* cards are unlocked and store per-id
// instance metadata in a sidecar `cardInstances` map. When we load, any
// cardId without an instance record uses (baseRarity, 'easy') defaults.
const DEFAULT_UNLOCK_DIFFICULTY: DifficultyTier = 'easy';

function defaultInstanceForCard(card: Card): StoredCardInstance {
  return { rolledRarity: card.rarity, unlockDifficulty: DEFAULT_UNLOCK_DIFFICULTY };
}

function applyInstance(card: Card, instance: StoredCardInstance | undefined): Card {
  if (!instance) return card;
  // Rarity on Card is the *rolled* rarity per v0.3 (the authored base
  // rarity lives in the raw catalog; once an instance is minted the
  // runtime card carries the rolled tier). We stamp the stored rarity
  // onto a fresh copy so the catalog snapshot stays pristine.
  return { ...card, rarity: instance.rolledRarity as Rarity };
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

// Preferences are stored in the profile under a dedicated key so the existing
// `unlockedCardIds` shape is never mutated by preference writes.
const PREFS_PROFILE_KEY = 'cardPreferences';

// Access the raw preferences map from the profile (internally typed extension).
type ProfileWithPrefs = ReturnType<typeof loadProfile> extends Promise<infer P>
  ? P & { [PREFS_PROFILE_KEY]?: Record<string, CardPreference> }
  : never;

async function loadRawPrefs(): Promise<Record<string, CardPreference>> {
  const profile = (await loadProfile()) as ProfileWithPrefs;
  return (profile[PREFS_PROFILE_KEY] as Record<string, CardPreference>) ?? {};
}

async function saveRawPrefs(prefs: Record<string, CardPreference>): Promise<void> {
  const profile = (await loadProfile()) as ProfileWithPrefs;
  (profile as unknown as Record<string, unknown>)[PREFS_PROFILE_KEY] = prefs;
  await saveProfile(profile);
}

/**
 * Load preferences for all given card ids, filling in defaults for any
 * card that has no stored preference yet (migration path).
 */
export async function loadPreferences(cardIds: string[]): Promise<CardPreference[]> {
  const raw = await loadRawPrefs();
  return cardIds.map((id) => raw[id] ?? defaultPref(id));
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
  const pool: Card[] = [
    ...loadToughCards(),
    ...generateWeapons(),
    ...generateDrugs(),
    ...generateCurrency(),
  ];
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

function buildInstanceMap(cards: Card[]): Record<string, StoredCardInstance> {
  const map: Record<string, StoredCardInstance> = {};
  for (const c of cards) {
    map[c.id] = defaultInstanceForCard(c);
  }
  return map;
}

export async function loadCollection(): Promise<Card[]> {
  const profile = await loadProfile();
  if (profile.unlockedCardIds.length > 0) {
    return resolveCardIds(profile.unlockedCardIds, profile.cardInstances);
  }
  // First-run starter grant must serialize with other writers. Without
  // the lock, two concurrent `loadCollection` calls on a fresh install
  // would both see an empty collection and both produce a starter
  // grant — granting twice. `withProfileLock` ensures only the first
  // caller grants; the second sees the populated collection after the
  // first finishes.
  return withProfileLock(async () => {
    const reread = await loadProfile();
    if (reread.unlockedCardIds.length > 0) {
      return resolveCardIds(reread.unlockedCardIds, reread.cardInstances);
    }
    const rng = createRng(randomSeed());
    const cards = starterGrant(rng);
    reread.unlockedCardIds = cards.map((c) => c.id);
    // v0.3: every starter instance gets rolled rarity (from the card
    // returned by the generator) + unlockDifficulty='easy' per §3.3.
    reread.cardInstances = {
      ...(reread.cardInstances ?? {}),
      ...buildInstanceMap(cards),
    };
    await saveProfile(reread);
    return cards;
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
    profile.unlockedCardIds = cards.map(c => c.id);
    // Rewrite instance map to exactly match the saved set — drop stale
    // entries for cards no longer present, preserve instance metadata
    // for the survivors, and seed fresh defaults for brand-new ids.
    const prior = profile.cardInstances ?? {};
    const next: Record<string, StoredCardInstance> = {};
    for (const c of cards) {
      next[c.id] = prior[c.id] ?? defaultInstanceForCard(c);
    }
    profile.cardInstances = next;
    await saveProfile(profile);
  });
}

export async function addCardsToCollection(newCards: Card[]): Promise<Card[]> {
  return withProfileLock(async () => {
    const profile = await loadProfile();
    const existingIds = new Set(profile.unlockedCardIds);
    const instances: Record<string, StoredCardInstance> = { ...(profile.cardInstances ?? {}) };
    for (const card of newCards) {
      existingIds.add(card.id);
      // Only seed a default instance if this cardId doesn't already
      // have one — preserves rolled rarity on re-adds (pack dupes).
      if (!instances[card.id]) instances[card.id] = defaultInstanceForCard(card);
    }
    profile.unlockedCardIds = [...existingIds];
    profile.cardInstances = instances;
    await saveProfile(profile);
    return resolveCardIds(profile.unlockedCardIds, profile.cardInstances);
  });
}

export async function grantStarterCollection(): Promise<Card[]> {
  const rng = createRng(randomSeed());
  const cards = starterGrant(rng);
  await saveCollection(cards);
  return cards;
}

export async function openRewardPacks(
  rewards: PackReward[],
  unlockDifficulty: DifficultyTier = DEFAULT_UNLOCK_DIFFICULTY,
): Promise<Card[]> {
  const baseCollection = await loadCollection();
  const rng = createRng(randomSeed());
  const newCards: Card[] = [];
  // Running view of unlocked cards so each pack in the batch reflects
  // unlocks from prior packs in the same call (avoids stale-snapshot dupes).
  const runningCollection: Card[] = [...baseCollection];
  const seenIds = new Set(runningCollection.map(c => c.id));

  for (const reward of rewards) {
    for (let i = 0; i < reward.count; i++) {
      const packCards = generatePack(reward.kind, runningCollection, rng);
      newCards.push(...packCards);
      for (const card of packCards) {
        if (!seenIds.has(card.id)) {
          seenIds.add(card.id);
          runningCollection.push(card);
        }
      }
    }
  }

  if (newCards.length > 0) {
    await addCardsToCollectionWithDifficulty(newCards, unlockDifficulty);
  }

  return newCards;
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
    const existingIds = new Set(profile.unlockedCardIds);
    const instances: Record<string, StoredCardInstance> = { ...(profile.cardInstances ?? {}) };
    for (const card of newCards) {
      existingIds.add(card.id);
      // Pack-opened cards get the *difficulty of the winning war* per
      // §3.3. Pre-existing instances are left untouched — re-earning a
      // card doesn't upgrade its unlock-difficulty tag.
      if (!instances[card.id]) {
        instances[card.id] = { rolledRarity: card.rarity, unlockDifficulty };
      }
    }
    profile.unlockedCardIds = [...existingIds];
    profile.cardInstances = instances;
    await saveProfile(profile);
    return resolveCardIds(profile.unlockedCardIds, profile.cardInstances);
  });
}
