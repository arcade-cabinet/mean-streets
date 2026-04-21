import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerProfile } from '../storage';
import {
  loadCollection,
  loadPlayerOwnedMythicIds,
  syncPlayerMythicOwnership,
} from '../collection';
import * as storage from '../storage';

describe('collection mythic persistence', () => {
  let current: PlayerProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = {
      unlockedCardIds: [],
      wins: 0,
      lastPlayedAt: null,
    };
    loadSpy = vi.spyOn(storage, 'loadProfile').mockImplementation(async () =>
      JSON.parse(JSON.stringify(current)),
    );
    saveSpy = vi
      .spyOn(storage, 'saveProfile')
      .mockImplementation(async (profile: PlayerProfile) => {
        current = JSON.parse(JSON.stringify(profile));
        return current;
      });
  });

  afterEach(() => {
    loadSpy.mockRestore();
    saveSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('syncs owned mythics into unlocked ids and resolves them from the collection catalog', async () => {
    await syncPlayerMythicOwnership(['mythic-01'], 'hard');

    expect(current.ownedMythicIds).toEqual(['mythic-01']);
    expect(current.unlockedCardIds).toContain('mythic-01');
    expect(current.cardInstances?.['mythic-01']).toEqual({
      rolledRarity: 'mythic',
      unlockDifficulty: 'hard',
    });

    const collection = await loadCollection();
    const mythic = collection.find((card) => card.id === 'mythic-01');
    expect(mythic).toMatchObject({
      id: 'mythic-01',
      kind: 'tough',
      rarity: 'mythic',
    });
  });

  it('falls back to unlocked mythic ids on older profiles without ownedMythicIds', async () => {
    current.unlockedCardIds = ['card-001', 'mythic-02'];

    await expect(loadPlayerOwnedMythicIds()).resolves.toEqual(['mythic-02']);
  });

  it('removes mythics no longer owned from the live collection', async () => {
    current.ownedMythicIds = ['mythic-01'];
    current.unlockedCardIds = ['card-001', 'mythic-01'];
    current.cardInstances = {
      'card-001': {
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
      'mythic-01': {
        rolledRarity: 'mythic',
        unlockDifficulty: 'hard',
      },
    };
    current.cardInventory = [
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
      {
        cardId: 'mythic-01',
        rolledRarity: 'mythic',
        unlockDifficulty: 'hard',
      },
    ];

    await syncPlayerMythicOwnership([], 'nightmare');

    expect(current.ownedMythicIds).toEqual([]);
    expect(current.unlockedCardIds).toEqual(['card-001']);
    expect(current.cardInstances).toEqual({
      'card-001': {
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
    });
    expect(current.cardInventory).toEqual([
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
    ]);
  });

  it('returns fresh card copies when resolving unlocked cards from the cached catalog', async () => {
    current.unlockedCardIds = ['card-001'];

    const [first] = await loadCollection();
    const [second] = await loadCollection();

    expect(first).not.toBe(second);
    if (first.kind !== 'currency' && second.kind !== 'currency') {
      first.abilities.push('MUTATED');
      expect(second.abilities).not.toContain('MUTATED');
    }
  });
});
