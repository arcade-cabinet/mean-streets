import { describe, expect, it } from 'vitest';
import {
  healAtMarket,
  sendToMarket,
  tradeAtMarket,
  wipeMarket,
  turfCashTotal,
  modsBelongingTo,
} from '../market';
import {
  mkCurrency,
  mkDrug,
  mkState,
  mkTough,
  mkTurf,
  mkWeapon,
  sc,
} from './state-builder';

describe('sendToMarket', () => {
  it('sends a tough to discard and its modifiers to the Black Market', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT' })),
          sc(mkWeapon({ id: 'w1' })),
          sc(mkDrug({ id: 'd1' })),
        ]),
      ],
      [mkTurf('b1', [sc(mkTough({ id: 'bT' }))])],
    );
    state.players.A.toughsInPlay = 1;

    sendToMarket(state, 'A', 'aT');

    expect(state.players.A.turfs[0].stack).toHaveLength(0);
    expect(state.players.A.discard.some((c) => c.id === 'aT')).toBe(true);
    expect(state.blackMarket.map((m) => m.id).sort()).toEqual(['d1', 'w1']);
    expect(state.players.A.toughsInPlay).toBe(0);
  });

  it('no-op when tough id not found', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' }))])],
      [mkTurf('b1', [])],
    );
    sendToMarket(state, 'A', 'nonexistent');
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
  });
});

describe('tradeAtMarket', () => {
  it('trades 2 commons for an uncommon', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.blackMarket.push(
      mkWeapon({ id: 'w1', rarity: 'common' }),
      mkWeapon({ id: 'w2', rarity: 'common' }),
    );

    const got = tradeAtMarket(state, 'A', ['w1', 'w2'], 'uncommon');

    expect(got).not.toBeNull();
    expect(got?.rarity).toBe('uncommon');
    expect(state.blackMarket).toHaveLength(0);
  });

  it('rejects when offeredMods.length !== tradePairs (2)', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.blackMarket.push(mkWeapon({ id: 'w1', rarity: 'common' }));

    expect(tradeAtMarket(state, 'A', ['w1'], 'uncommon')).toBeNull();
  });

  it('rejects when offered mods span mixed rarities', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.blackMarket.push(
      mkWeapon({ id: 'w1', rarity: 'common' }),
      mkWeapon({ id: 'w2', rarity: 'uncommon' }),
    );

    expect(tradeAtMarket(state, 'A', ['w1', 'w2'], 'rare')).toBeNull();
    // Cards rolled back to the market.
    expect(state.blackMarket).toHaveLength(2);
  });

  it('rejects when target rarity is not one step above (or two steps)', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.blackMarket.push(
      mkWeapon({ id: 'w1', rarity: 'common' }),
      mkWeapon({ id: 'w2', rarity: 'common' }),
    );

    // Target "legendary" from commons is invalid.
    expect(tradeAtMarket(state, 'A', ['w1', 'w2'], 'legendary')).toBeNull();
  });
});

describe('healAtMarket', () => {
  it('heals a wounded tough with 1 common sacrifice for +2 HP', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT', resistance: 5, maxHp: 5, hp: 2 })),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    state.blackMarket.push(mkWeapon({ id: 'scrap', rarity: 'common' }));

    const ok = healAtMarket(state, 'A', 'aT', ['scrap']);

    expect(ok).toBe(true);
    const tough = state.players.A.turfs[0].stack[0].card;
    expect(tough.kind).toBe('tough');
    if (tough.kind === 'tough') expect(tough.hp).toBe(4); // 2 + 2 HP
  });

  it('refuses to heal mythic toughs', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(
            mkTough({
              id: 'aT',
              rarity: 'mythic',
              resistance: 6,
              maxHp: 6,
              hp: 3,
            }),
          ),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    state.blackMarket.push(mkWeapon({ id: 'scrap', rarity: 'common' }));
    expect(healAtMarket(state, 'A', 'aT', ['scrap'])).toBe(false);
  });

  it('clamps HP to maxHp when small heal would overshoot', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT', resistance: 3, maxHp: 3, hp: 2 })),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    state.blackMarket.push(mkWeapon({ id: 'scrap', rarity: 'common' }));

    healAtMarket(state, 'A', 'aT', ['scrap']);
    const tough = state.players.A.turfs[0].stack[0].card;
    if (tough.kind === 'tough') expect(tough.hp).toBe(3); // clamped
  });

  it('full-heal path: 2 matching-rarity sacrifices restore hp to maxHp', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(
            mkTough({
              id: 'aT',
              rarity: 'rare',
              resistance: 8,
              maxHp: 8,
              hp: 1,
            }),
          ),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    state.blackMarket.push(
      mkWeapon({ id: 'w1', rarity: 'rare' }),
      mkWeapon({ id: 'w2', rarity: 'rare' }),
    );

    const ok = healAtMarket(state, 'A', 'aT', ['w1', 'w2']);
    expect(ok).toBe(true);
    const tough = state.players.A.turfs[0].stack[0].card;
    if (tough.kind === 'tough') expect(tough.hp).toBe(8);
  });
});

describe('wipeMarket', () => {
  it('empties the shared Black Market pool', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.blackMarket.push(mkWeapon({ id: 'w1' }), mkDrug({ id: 'd1' }));
    wipeMarket(state);
    expect(state.blackMarket).toHaveLength(0);
  });
});

describe('turfCashTotal / modsBelongingTo', () => {
  it('sums currency on a given turf', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT' })),
          sc(mkCurrency(100)),
          sc(mkCurrency(1000)),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    expect(turfCashTotal(state.players.A, 0)).toBe(1100);
  });

  it('returns modifiers bound to a tough by owner', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' })), sc(mkWeapon({ id: 'w1' }))])],
      [mkTurf('b1', [])],
    );

    const mods = modsBelongingTo(state, 'A', 'aT');
    expect(mods.map((m) => m.id)).toEqual(['w1']);
  });
});
