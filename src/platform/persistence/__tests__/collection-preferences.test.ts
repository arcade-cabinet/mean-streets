import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerProfile } from '../storage';
import { loadPreferences, savePreferences, updatePreference } from '../collection';
import * as storage from '../storage';

// Tests for the CardPreference read/write path added in v0.2.
// The preferences are stored as a side-car key on the player profile
// (PREFS_PROFILE_KEY = 'cardPreferences') so they never interfere with
// unlockedCardIds serialisation.

type AugmentedProfile = PlayerProfile & { cardPreferences?: Record<string, unknown> };

function makeProfile(overrides: Partial<AugmentedProfile> = {}): AugmentedProfile {
  return {
    unlockedCardIds: [],
    wins: 0,
    lastPlayedAt: null,
    ...overrides,
  };
}

describe('loadPreferences', () => {
  let current: AugmentedProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = makeProfile();
    loadSpy = vi.spyOn(storage, 'loadProfile').mockImplementation(async () => {
      await Promise.resolve();
      return JSON.parse(JSON.stringify(current));
    });
    saveSpy = vi.spyOn(storage, 'saveProfile').mockImplementation(async (p: PlayerProfile): Promise<PlayerProfile> => {
      await Promise.resolve();
      current = JSON.parse(JSON.stringify(p));
      return current;
    });
  });

  afterEach(() => {
    loadSpy.mockRestore();
    saveSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns defaults for card ids with no stored preference (migration)', async () => {
    const prefs = await loadPreferences(['card-a', 'card-b']);
    expect(prefs).toHaveLength(2);
    expect(prefs[0]).toEqual({ cardId: 'card-a', enabled: true, priority: 5 });
    expect(prefs[1]).toEqual({ cardId: 'card-b', enabled: true, priority: 5 });
  });

  it('returns stored values when preferences exist', async () => {
    current.cardPreferences = {
      'card-a': { cardId: 'card-a', enabled: false, priority: 3 },
    };
    const prefs = await loadPreferences(['card-a', 'card-b']);
    expect(prefs[0]).toEqual({ cardId: 'card-a', enabled: false, priority: 3 });
    // card-b has no stored pref → default
    expect(prefs[1]).toEqual({ cardId: 'card-b', enabled: true, priority: 5 });
  });

  it('falls back to legacy raw card ids when reading bucket-key preferences', async () => {
    current.cardPreferences = {
      'card-a': { cardId: 'card-a', enabled: false, priority: 3 },
    };

    const prefs = await loadPreferences(['card-a::legendary']);

    expect(prefs[0]).toEqual({
      cardId: 'card-a::legendary',
      enabled: false,
      priority: 3,
    });
  });

  it('returns empty array when no ids requested', async () => {
    const prefs = await loadPreferences([]);
    expect(prefs).toEqual([]);
  });
});

describe('savePreferences', () => {
  let current: AugmentedProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = makeProfile();
    loadSpy = vi.spyOn(storage, 'loadProfile').mockImplementation(async () => {
      await Promise.resolve();
      return JSON.parse(JSON.stringify(current));
    });
    saveSpy = vi.spyOn(storage, 'saveProfile').mockImplementation(async (p: PlayerProfile): Promise<PlayerProfile> => {
      await Promise.resolve();
      current = JSON.parse(JSON.stringify(p));
      return current;
    });
  });

  afterEach(() => {
    loadSpy.mockRestore();
    saveSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('persists enabled=false and custom priority', async () => {
    await savePreferences([{ cardId: 'card-x', enabled: false, priority: 2 }]);
    const saved = (current as AugmentedProfile).cardPreferences ?? {};
    expect(saved['card-x']).toEqual({ cardId: 'card-x', enabled: false, priority: 2 });
  });

  it('clamps priority to 1–10 on save', async () => {
    await savePreferences([
      { cardId: 'low', enabled: true, priority: 0 },
      { cardId: 'high', enabled: true, priority: 99 },
    ]);
    const saved = (current as AugmentedProfile).cardPreferences ?? {};
    expect(saved['low']).toMatchObject({ priority: 1 });
    expect(saved['high']).toMatchObject({ priority: 10 });
  });

  it('merges into existing preferences without overwriting unrelated entries', async () => {
    current.cardPreferences = {
      'already-there': { cardId: 'already-there', enabled: true, priority: 8 },
    };
    await savePreferences([{ cardId: 'new-card', enabled: false, priority: 4 }]);
    const saved = (current as AugmentedProfile).cardPreferences ?? {};
    expect(saved['already-there']).toMatchObject({ priority: 8 });
    expect(saved['new-card']).toMatchObject({ enabled: false, priority: 4 });
  });

  it('does not mutate unlockedCardIds when saving preferences', async () => {
    current.unlockedCardIds = ['some-id'];
    await savePreferences([{ cardId: 'some-id', enabled: false, priority: 7 }]);
    expect(current.unlockedCardIds).toEqual(['some-id']);
  });

  it('savePreferences serialises concurrent writes without losing data', async () => {
    // Fire 5 concurrent saves, each for a different cardId.
    const calls = Array.from({ length: 5 }, (_, i) =>
      savePreferences([{ cardId: `card-${i}`, enabled: true, priority: i + 1 }]),
    );
    await Promise.all(calls);
    const saved = (current as AugmentedProfile).cardPreferences ?? {};
    for (let i = 0; i < 5; i++) {
      expect(saved[`card-${i}`]).toMatchObject({ priority: i + 1 });
    }
  });
});

describe('updatePreference', () => {
  let current: AugmentedProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = makeProfile();
    loadSpy = vi.spyOn(storage, 'loadProfile').mockImplementation(async () => {
      await Promise.resolve();
      return JSON.parse(JSON.stringify(current));
    });
    saveSpy = vi.spyOn(storage, 'saveProfile').mockImplementation(async (p: PlayerProfile): Promise<PlayerProfile> => {
      await Promise.resolve();
      current = JSON.parse(JSON.stringify(p));
      return current;
    });
  });

  afterEach(() => {
    loadSpy.mockRestore();
    saveSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('updates a single card preference via updatePreference helper', async () => {
    await updatePreference({ cardId: 'solo', enabled: false, priority: 9 });
    const saved = (current as AugmentedProfile).cardPreferences ?? {};
    expect(saved['solo']).toEqual({ cardId: 'solo', enabled: false, priority: 9 });
  });
});
