import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackInstance } from '../../../sim/packs';
import { openRewardPackInstances } from '../collection';
import type { PlayerProfile } from '../storage';
import * as generator from '../../../sim/packs/generator';
import * as storage from '../storage';

describe('collection reward opening', () => {
  let current: PlayerProfile;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    current = {
      unlockedCardIds: ['card-001'],
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

  it('passes the war unlock difficulty through to pack generation', async () => {
    const generateSpy = vi
      .spyOn(generator, 'generatePack')
      .mockReturnValue([]);
    const rewardPacks: PackInstance[] = [
      {
        id: 'reward-pack-01',
        kind: 'single',
        cards: [],
        openedAt: null,
      },
    ];

    await openRewardPackInstances(rewardPacks, 'nightmare', 123);

    expect(generateSpy).toHaveBeenCalledWith(
      'single',
      [],
      expect.any(Object),
      { unlockDifficulty: 'nightmare' },
    );
  });
});
