import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../../../sim/cards/rng';
import type { PackInstance } from '../../../sim/packs';
import * as generator from '../../../sim/packs/generator';
import {
  addPendingPacksToAI,
  grantAIStarterCollection,
  incrementAIPerfectWarFallbackCount,
  loadAICollection,
  loadAIProfile,
  openPendingAIPacks,
  resetAIProfileForTests,
  saveAIMythicAssignments,
} from '../ai-profile';

describe('ai-profile collection bootstrap', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { __MEAN_STREETS_TEST__: true },
      configurable: true,
    });
  });

  afterEach(async () => {
    await resetAIProfileForTests();
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it('grants and resolves the AI starter collection into runtime cards', async () => {
    await grantAIStarterCollection(createRng(42));

    const collection = await loadAICollection();
    expect(collection).toHaveLength(35);
    expect(collection.some((card) => card.kind === 'tough')).toBe(true);
  });

  it('syncs AI-owned mythics into the AI collection', async () => {
    await saveAIMythicAssignments({ 'mythic-01': 'B' }, 'hard');

    const collection = await loadAICollection();
    expect(collection.find((card) => card.id === 'mythic-01')).toMatchObject({
      id: 'mythic-01',
      rarity: 'mythic',
    });
  });

  it('increments the Perfect War fallback counter atomically', async () => {
    await expect(incrementAIPerfectWarFallbackCount()).resolves.toBe(1);
    await expect(incrementAIPerfectWarFallbackCount()).resolves.toBe(2);
    await expect(loadAIProfile()).resolves.toMatchObject({
      aiPerfectWarFallbackCount: 2,
    });
  });

  it('opens pending AI packs without excluding already-owned cards from reward pulls', async () => {
    await grantAIStarterCollection(createRng(42));
    const rewardPacks: PackInstance[] = [
      {
        id: 'ai-pack-01',
        kind: 'single',
        cards: [],
        openedAt: null,
      },
    ];
    await addPendingPacksToAI(rewardPacks);
    const generateSpy = vi.spyOn(generator, 'generatePack').mockReturnValue([]);

    await openPendingAIPacks('hard', 123);

    expect(generateSpy).toHaveBeenCalledWith(
      'single',
      [],
      expect.any(Object),
      { unlockDifficulty: 'hard', permadeath: undefined },
    );
  });
});
