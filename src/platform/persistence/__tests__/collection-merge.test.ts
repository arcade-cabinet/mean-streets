import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../sim/turf/types';
import type { PlayerProfile } from '../storage';
import {
  addCardsToCollection,
  loadCollection,
  loadCollectionInventory,
  mergeCollectionBucket,
} from '../collection';
import * as storage from '../storage';

function toughCard(id: string, rarity: Card['rarity'] = 'common'): Card {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 5,
    resistance: 5,
    rarity,
    abilities: [],
  };
}

describe('collection merge persistence', () => {
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

  it('preserves duplicate instances and resolves the best owned copy in the collection summary', async () => {
    await addCardsToCollection([
      toughCard('card-001', 'common'),
      toughCard('card-001', 'rare'),
    ]);

    expect(current.cardInventory).toEqual([
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
      {
        cardId: 'card-001',
        rolledRarity: 'rare',
        unlockDifficulty: 'easy',
      },
    ]);
    expect(current.cardInstances?.['card-001']).toEqual({
      rolledRarity: 'rare',
      unlockDifficulty: 'easy',
    });

    const summary = await loadCollection();
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      id: 'card-001',
      rarity: 'rare',
    });

    const inventory = await loadCollectionInventory();
    expect(inventory).toHaveLength(2);
    expect(inventory.map(({ card }) => card.rarity).sort()).toEqual([
      'common',
      'rare',
    ]);
  });

  it('merges two matching copies into the next rarity and keeps the higher unlock difficulty', async () => {
    current.unlockedCardIds = ['card-001'];
    current.cardInstances = {
      'card-001': {
        rolledRarity: 'common',
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
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'hard',
      },
    ];

    await expect(mergeCollectionBucket('card-001', 'common')).resolves.toEqual({
      cardId: 'card-001',
      fromRarity: 'common',
      toRarity: 'uncommon',
      unlockDifficulty: 'hard',
    });

    expect(current.cardInventory).toEqual([
      {
        cardId: 'card-001',
        rolledRarity: 'uncommon',
        unlockDifficulty: 'hard',
      },
    ]);
    expect(current.cardInstances?.['card-001']).toEqual({
      rolledRarity: 'uncommon',
      unlockDifficulty: 'hard',
    });
  });

  it('blocks merges when there are not two copies at the same rolled rarity', async () => {
    current.unlockedCardIds = ['card-001'];
    current.cardInstances = {
      'card-001': {
        rolledRarity: 'rare',
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
        cardId: 'card-001',
        rolledRarity: 'rare',
        unlockDifficulty: 'hard',
      },
    ];

    await expect(mergeCollectionBucket('card-001', 'common')).resolves.toBeNull();
    expect(current.cardInventory).toEqual([
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
      {
        cardId: 'card-001',
        rolledRarity: 'rare',
        unlockDifficulty: 'hard',
      },
    ]);
  });
});
