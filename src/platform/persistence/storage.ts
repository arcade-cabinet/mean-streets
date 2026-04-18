import { getDatabase, saveWebStore } from './database';

export interface CardPreset {
  id: string;
  name: string;
  cardIds: string[];
  updatedAt: string;
}

export interface DeckLoadout {
  id: string;
  name: string;
  crewIds: string[];
  modifierIds: string[];
  updatedAt: string;
}

export interface AppSettings {
  audioEnabled: boolean;
  motionReduced: boolean;
  rulesSeen: boolean;
}

/**
 * Per-instance metadata for an unlocked card (v0.3).
 *
 * `rolledRarity` is the instance-specific rarity at the time of pack-open
 * (§2 base+rolled rarity). `unlockDifficulty` is the difficulty at which
 * the instance entered the collection (§3.3 bonus reward multiplier tag).
 *
 * Stored as a map keyed by cardId alongside `unlockedCardIds` for
 * backward-compat: readers that don't know about instances still see the
 * old-shape array. Readers that do (collection.ts) join the two.
 */
export interface StoredCardInstance {
  rolledRarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
  unlockDifficulty: 'easy' | 'medium' | 'hard' | 'nightmare' | 'ultra-nightmare';
}

export interface PlayerProfile {
  unlockedCardIds: string[];
  /**
   * Optional v0.3 sidecar: per-card-id instance metadata. Omitted on old
   * saves; collection.ts fills defaults when a cardId has no instance
   * entry (baseRarity from catalog, 'easy' difficulty).
   */
  cardInstances?: Record<string, StoredCardInstance>;
  /**
   * Mythic card ids currently owned by the player (RULES §11).
   * Persisted separately so match bootstrap can exclude these from the
   * shared unassigned pool and pre-seed mythicAssignments for side 'A'.
   * A mythic id here is always also present in unlockedCardIds.
   */
  ownedMythicIds?: string[];
  wins: number;
  lastPlayedAt: string | null;
}

const SETTINGS_NAMESPACE = 'settings';
const CREW_PRESETS_NAMESPACE = 'crew-presets';
const MOD_PRESETS_NAMESPACE = 'modifier-presets';
const DECKS_NAMESPACE = 'deck-loadouts';
const PROFILE_NAMESPACE = 'profile';
const ACTIVE_RUN_NAMESPACE = 'active-run';

const DEFAULT_SETTINGS: AppSettings = {
  audioEnabled: true,
  motionReduced: false,
  rulesSeen: false,
};

const DEFAULT_PROFILE: PlayerProfile = {
  unlockedCardIds: [],
  wins: 0,
  lastPlayedAt: null,
};

let migrationPromise: Promise<void> | null = null;
const testStore = new Map<string, string>();

function isTestPersistenceEnv(): boolean {
  return typeof window !== 'undefined' && window.__MEAN_STREETS_TEST__ === true;
}

function scopedKey(namespace: string, key: string): string {
  return `${namespace}::${key}`;
}

export async function initializePersistence(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyStorage();
  }
  return migrationPromise;
}

export async function loadSettings(): Promise<AppSettings> {
  await initializePersistence();
  return (await getItem<AppSettings>(SETTINGS_NAMESPACE, 'current')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  await setItem(SETTINGS_NAMESPACE, 'current', settings);
  return settings;
}

export async function loadCrewPresets(): Promise<CardPreset[]> {
  await initializePersistence();
  return listNamespace<CardPreset>(CREW_PRESETS_NAMESPACE);
}

export async function saveCrewPreset(preset: CardPreset): Promise<CardPreset[]> {
  await setItem(CREW_PRESETS_NAMESPACE, preset.id, preset);
  return loadCrewPresets();
}

export async function loadModifierPresets(): Promise<CardPreset[]> {
  await initializePersistence();
  return listNamespace<CardPreset>(MOD_PRESETS_NAMESPACE);
}

export async function saveModifierPreset(preset: CardPreset): Promise<CardPreset[]> {
  await setItem(MOD_PRESETS_NAMESPACE, preset.id, preset);
  return loadModifierPresets();
}

export async function loadDeckLoadouts(): Promise<DeckLoadout[]> {
  await initializePersistence();
  return listNamespace<DeckLoadout>(DECKS_NAMESPACE);
}

export async function saveDeckLoadout(loadout: DeckLoadout): Promise<DeckLoadout[]> {
  await setItem(DECKS_NAMESPACE, loadout.id, loadout);
  return loadDeckLoadouts();
}

export async function loadProfile(): Promise<PlayerProfile> {
  await initializePersistence();
  const profile = (await getItem<PlayerProfile>(PROFILE_NAMESPACE, 'current')) ?? DEFAULT_PROFILE;
  // v1.0.0 migration: sudden-death was removed in favor of ultra-nightmare.
  if (profile.cardInstances) {
    let migrated = false;
    for (const instance of Object.values(profile.cardInstances)) {
      if ((instance.unlockDifficulty as string) === 'sudden-death') {
        instance.unlockDifficulty = 'ultra-nightmare';
        migrated = true;
      }
    }
    if (migrated) await saveProfile(profile);
  }
  return profile;
}

export async function saveProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  await setItem(PROFILE_NAMESPACE, 'current', profile);
  return profile;
}

export async function loadActiveRun<T>(): Promise<T | null> {
  await initializePersistence();
  return getItem<T>(ACTIVE_RUN_NAMESPACE, 'current');
}

export async function saveActiveRun<T>(run: T | null): Promise<void> {
  if (run === null) {
    await deleteItem(ACTIVE_RUN_NAMESPACE, 'current');
    return;
  }
  await setItem(ACTIVE_RUN_NAMESPACE, 'current', run);
}

export async function resetPersistenceForTests(): Promise<void> {
  testStore.clear();
  if (isTestPersistenceEnv()) {
    migrationPromise = null;
    return;
  }

  const db = await getDatabase();
  await db.execute('DELETE FROM app_kv;');
  await saveWebStore();
  migrationPromise = null;
}

function safeParse<T>(raw: string, source: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[persistence] discarding corrupted value from ${source}:`, error);
    return null;
  }
}

async function listNamespace<T extends { updatedAt?: string }>(namespace: string): Promise<T[]> {
  if (isTestPersistenceEnv()) {
    return Array.from(testStore.entries())
      .filter(([key]) => key.startsWith(`${namespace}::`))
      .map(([key, value]) => safeParse<T>(value, key))
      .filter((parsed): parsed is T => parsed !== null)
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  }

  const db = await getDatabase();
  const result = await db.query(
    'SELECT value FROM app_kv WHERE namespace = ? ORDER BY updated_at DESC',
    [namespace],
  );
  return (result.values ?? [])
    .map((row) => safeParse<T>(String(row.value), namespace))
    .filter((parsed): parsed is T => parsed !== null);
}

async function getItem<T>(namespace: string, key: string): Promise<T | null> {
  if (isTestPersistenceEnv()) {
    const value = testStore.get(scopedKey(namespace, key));
    return value ? safeParse<T>(value, scopedKey(namespace, key)) : null;
  }

  const db = await getDatabase();
  const result = await db.query(
    'SELECT value FROM app_kv WHERE namespace = ? AND item_key = ? LIMIT 1',
    [namespace, key],
  );
  const row = result.values?.[0];
  return row ? safeParse<T>(String(row.value), `${namespace}::${key}`) : null;
}

async function setItem<T>(namespace: string, key: string, value: T): Promise<void> {
  if (isTestPersistenceEnv()) {
    testStore.set(scopedKey(namespace, key), JSON.stringify(value));
    return;
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO app_kv(namespace, item_key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(namespace, item_key)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [namespace, key, JSON.stringify(value), now],
  );
  await saveWebStore();
}

async function deleteItem(namespace: string, key: string): Promise<void> {
  if (isTestPersistenceEnv()) {
    testStore.delete(scopedKey(namespace, key));
    return;
  }

  const db = await getDatabase();
  await db.run('DELETE FROM app_kv WHERE namespace = ? AND item_key = ?', [namespace, key]);
  await saveWebStore();
}

async function namespaceCount(namespace: string): Promise<number> {
  if (isTestPersistenceEnv()) {
    return Array.from(testStore.keys()).filter((key) => key.startsWith(`${namespace}::`)).length;
  }

  const db = await getDatabase();
  const result = await db.query('SELECT COUNT(*) as count FROM app_kv WHERE namespace = ?', [namespace]);
  return Number(result.values?.[0]?.count ?? 0);
}

async function migrateLegacyStorage(): Promise<void> {
  if ((await namespaceCount(SETTINGS_NAMESPACE)) === 0) {
    await setItem(SETTINGS_NAMESPACE, 'current', DEFAULT_SETTINGS);
  }

  if ((await namespaceCount(CREW_PRESETS_NAMESPACE)) === 0) {
    // Namespace exists once the table is present; no seed data required.
  }

  if ((await namespaceCount(MOD_PRESETS_NAMESPACE)) === 0) {
    // Namespace exists once the table is present; no seed data required.
  }

  if ((await namespaceCount(DECKS_NAMESPACE)) === 0) {
    // Namespace exists once the table is present; no seed data required.
  }

  if ((await namespaceCount(PROFILE_NAMESPACE)) === 0) {
    await setItem(PROFILE_NAMESPACE, 'current', DEFAULT_PROFILE);
  }
}
