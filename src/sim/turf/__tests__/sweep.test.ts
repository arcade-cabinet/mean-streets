import { describe, expect, it } from 'vitest';
import { generateTurfCardPools } from '../catalog';
import { runPermutationSweep } from '../sweep';
import { createRng } from '../../cards/rng';
import { buildAutoDeck } from '../deck-builder';

describe('permutation sweep', () => {
  it('builds forced-inclusion decks deterministically', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const rngA = createRng(1234);
    const rngB = createRng(1234);
    const forcedIds = [pools.crew[0].id, pools.weapons[0].id, pools.drugs[0].id];

    const deckA = buildAutoDeck(pools, rngA, { forceIncludeIds: forcedIds });
    const deckB = buildAutoDeck(pools, rngB, { forceIncludeIds: forcedIds });

    expect(deckA.crew.map(card => card.id)).toEqual(deckB.crew.map(card => card.id));
    expect(deckA.modifiers.map(card => card.id)).toEqual(deckB.modifiers.map(card => card.id));
    expect(deckA.backpacks.map(card => card.id)).toEqual(deckB.backpacks.map(card => card.id));
    for (const id of forcedIds) {
      expect(deckA.crew.some(card => card.id === id) || deckA.modifiers.some(card => card.id === id)).toBe(true);
    }
  });

  it('runs deterministic permutation sweeps over targeted crew/weapon/drug anchors', { timeout: 45000 }, () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const crewIds = pools.crew.slice(0, 2).map(card => card.id);
    const weaponIds = pools.weapons.slice(0, 2).map(card => card.id);
    const drugIds = [pools.drugs[0].id];

    const first = runPermutationSweep({
      profile: 'smoke',
      crewIds,
      weaponIds,
      drugIds,
    });
    const second = runPermutationSweep({
      profile: 'smoke',
      crewIds,
      weaponIds,
      drugIds,
    });

    expect(first).toEqual(second);
    expect(first.permutations).toHaveLength(4);
    expect(first.permutations.every(result => result.forcedIds.length === 3)).toBe(true);
  });
});
