import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../sim/turf/types';
import type { PlayerProfile } from '../storage';
import { addCardsToCollection, saveCollection } from '../collection';
import * as storage from '../storage';

// Regression pin: prior impl of saveCollection / addCardsToCollection did
// read-modify-write on profile.unlockedCardIds. When two async calls
// interleaved across `await`, the later writer could overwrite the earlier
// writer's update — lost pack rewards. The fix serializes through a
// single-slot promise chain; this test confirms N concurrent adds all
// land in the final profile.

function toughCard(id: string): Card {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 5,
    resistance: 5,
    rarity: 'common',
    abilities: [],
  };
}

describe('collection concurrency', () => {
  let current: PlayerProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = {
      unlockedCardIds: [],
      wins: 0,
      lastPlayedAt: null,
    };
    // Every load returns a DEEP COPY of current — like the real persistence.
    loadSpy = vi.spyOn(storage, 'loadProfile').mockImplementation(async () => {
      // Simulate a small async gap so concurrent calls actually interleave
      // across awaits.
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

  it('addCardsToCollection serializes — no updates lost across concurrent calls', async () => {
    // Fire 10 concurrent calls, each adding a unique card.
    const cards = Array.from({ length: 10 }, (_, i) => toughCard(`card-${i}`));
    await Promise.all(cards.map((c) => addCardsToCollection([c])));

    // All 10 card ids must be in the final profile, in any order.
    expect(current.unlockedCardIds.sort()).toEqual(cards.map((c) => c.id).sort());
  });

  it('saveCollection does not clobber an interleaved addCardsToCollection', async () => {
    current.unlockedCardIds = ['existing-1'];

    // Race: saveCollection({a, b}) and addCardsToCollection({c}) fire together.
    // Whichever wins the final save, the result must not silently drop one.
    await Promise.all([
      saveCollection([toughCard('a'), toughCard('b')]),
      addCardsToCollection([toughCard('c')]),
    ]);

    // Because saveCollection overwrites with its exact list, we accept
    // either order of serialization, but we must NOT see a partial merge.
    const ids = current.unlockedCardIds.slice().sort();
    // Valid end states:
    //  1. add ran first (merged c into existing-1) then save overwrote to [a,b]
    //  2. save ran first ([a,b]), then add merged c → [a,b,c]
    const ok =
      JSON.stringify(ids) === JSON.stringify(['a', 'b']) ||
      JSON.stringify(ids) === JSON.stringify(['a', 'b', 'c']);
    expect(ok, `unexpected final ids: ${JSON.stringify(ids)}`).toBe(true);
  });
});
