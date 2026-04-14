import { describe, expect, it } from 'vitest';
import { generateTurfCardPools } from '../catalog';
import { resolvePackedBackpack, resolvePackedDeck } from '../pack-resolver';

describe('resolvePackedBackpack', () => {
  it('resolves a 4-slot player-packed backpack into a runtime BackpackCard', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const packed = {
      slots: [
        pools.weapons[0]!.id,
        pools.drugs[0]!.id,
        pools.cash[0]!.id,
        pools.weapons[1]!.id,
      ],
    };

    const runtime = resolvePackedBackpack(packed, 0, pools);

    expect(runtime).not.toBeNull();
    expect(runtime?.payload).toHaveLength(4);
    expect(runtime?.size).toBe(4);
    expect(runtime?.id).toBe('player-pack-01');
  });

  it('drops unknown ids, keeps the rest, returns null if all unknown', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const packed = {
      slots: ['__nope__', pools.weapons[0]!.id, '__also-nope__'],
    };

    const runtime = resolvePackedBackpack(packed, 0, pools);
    expect(runtime?.payload).toHaveLength(1);

    const empty = resolvePackedBackpack({ slots: ['__nope__'] }, 0, pools);
    expect(empty).toBeNull();
  });

  it('size clamps to the authored 1..4 range', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const wide = {
      slots: [
        pools.weapons[0]!.id,
        pools.weapons[1]!.id,
        pools.weapons[2]!.id,
        pools.weapons[3]!.id,
        pools.weapons[4]!.id,
        pools.weapons[5]!.id,
      ],
    };
    const runtime = resolvePackedBackpack(wide, 0, pools);
    // size is the authored ceiling; payload still carries all 6 items.
    expect(runtime?.size).toBe(4);
    expect(runtime?.payload).toHaveLength(6);
  });
});

describe('resolvePackedDeck', () => {
  it('resolves crew + backpacks into a runtime DeckTemplate', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });

    const snapshot = {
      crewIds: pools.crew.slice(0, 5).map((c) => c.id),
      backpacks: [
        { slots: [pools.weapons[0]!.id, pools.drugs[0]!.id] },
        { slots: [pools.cash[0]!.id, pools.weapons[1]!.id, pools.drugs[1]!.id] },
      ],
    };

    const deck = resolvePackedDeck(snapshot, pools);

    expect(deck.crew).toHaveLength(5);
    expect(deck.backpacks).toHaveLength(2);
    // Flattened modifier view aggregates every payload across all packs.
    expect(deck.modifiers).toHaveLength(5);
  });

  it('drops empty backpacks from the output', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const snapshot = {
      crewIds: [pools.crew[0]!.id],
      backpacks: [
        { slots: ['__nope__'] },
        { slots: [pools.weapons[0]!.id] },
      ],
    };
    const deck = resolvePackedDeck(snapshot, pools);
    expect(deck.backpacks).toHaveLength(1);
  });
});
