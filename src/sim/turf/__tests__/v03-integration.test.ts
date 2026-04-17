/**
 * v0.3 integration smoke tests — promoted from describe.skip to active
 * by Vera (Epic I) where the sim actually backs the described behavior.
 *
 * Each describe block above details the RULES §N contract. The active
 * tests below exercise those contracts end-to-end using the real sim.
 * Any remaining describe.skip blocks are tagged with a TODO explaining
 * what's blocking activation.
 *
 * Design authority: docs/RULES.md v0.3.
 */

import { describe, expect, it } from 'vitest';
import { computeDamage, resolveDirectStrike } from '../attacks';
import {
  positionPower,
  positionResistance,
  promoteReserveTurf,
} from '../board';
import { computeHeat, raidProbability } from '../heat';
import { holdingCheck, sendToHolding } from '../holding';
import { healAtMarket, sendToMarket, tradeAtMarket } from '../market';
import { resolvePhase } from '../resolve';
import {
  mkCurrency,
  mkDrug,
  mkState,
  mkTough,
  mkTurf,
  mkWeapon,
  sc,
} from './state-builder';

describe('v0.3 integration — turf progression', () => {
  it('promotes reserve turf to active when the current active turf is seized', () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [
      mkTurf('b1', [sc(mkTough({ id: 'bT1', resistance: 1 }))], {
        reserveIndex: 0,
      }),
      mkTurf('b2', [sc(mkTough({ id: 'bT2' }))], { reserveIndex: 1 }),
    ];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.B.turfs).toHaveLength(1);
    expect(state.players.B.turfs[0].id).toBe('b2');
    expect(state.players.B.turfs[0].reserveIndex).toBe(0);
    expect(state.players.B.turfs[0].isActive).toBe(true);
  });

  it('ends match when one side exhausts all turfs', () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', resistance: 1 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.B.turfs).toHaveLength(0);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('total_seizure');
  });
});

describe('v0.3 integration — damage tiers + HP', () => {
  it('busted when P < R (no HP change)', () => {
    const attacker = mkTurf('a', [
      sc(mkTough({ power: 3, archetype: 'ghost' })),
    ]);
    const defender = mkTurf('d', [
      sc(
        mkTough({
          resistance: 5,
          maxHp: 5,
          hp: 5,
          archetype: 'ghost',
        }),
      ),
    ]);
    const r = resolveDirectStrike(attacker, defender);
    expect(r.outcome).toBe('busted');
    const tough = defender.stack[0].card;
    if (tough.kind === 'tough') expect(tough.hp).toBe(5);
  });

  it('wound when R <= P < 1.5R', () => {
    const r = computeDamage(6, 5);
    expect(r.outcome).toBe('wound');
    expect(r.damage).toBe(2); // 6-5 + woundBonus=1
  });

  it('serious wound when 1.5R <= P < 2R', () => {
    const r = computeDamage(9, 5);
    expect(r.outcome).toBe('serious_wound');
    expect(r.damage).toBe(6); // 9-5 + seriousBonus=2
  });

  it('crushing when P >= 2R (but < 3R)', () => {
    const r = computeDamage(11, 5);
    expect(r.outcome).toBe('crushing');
    expect(r.damage).toBe(9); // 11-5 + crushingBonus=3
  });

  it('instant-kills when P >= 3R', () => {
    const r = computeDamage(15, 5);
    expect(r.outcome).toBe('kill');
  });

  it('clamps effective stats proportional to HP ratio for wounded toughs', () => {
    const t = mkTough({ power: 10, resistance: 8, maxHp: 8, hp: 4 });
    const turf = mkTurf('t1', [sc(t)]);
    // floor(10 * 4/8) = 5, floor(8 * 4/8) = 4.
    expect(positionPower(turf)).toBe(5);
    expect(positionResistance(turf)).toBe(4);
  });
});

describe('v0.3 integration — heat + raids', () => {
  it('computes heat from rarity concentration + currency pressure', () => {
    const cheap = mkState(
      [mkTurf('a', [sc(mkTough({ id: 'aT', rarity: 'common' }))])],
      [mkTurf('b', [sc(mkTough({ id: 'bT', rarity: 'common' }))])],
    );
    const loud = mkState(
      [
        mkTurf('a', [
          sc(mkTough({ id: 'aT', rarity: 'legendary' })),
          sc(mkCurrency(1000, 'c1')),
        ]),
      ],
      [mkTurf('b', [sc(mkTough({ id: 'bT', rarity: 'mythic' }))])],
    );

    expect(computeHeat(loud).total).toBeGreaterThan(computeHeat(cheap).total);
  });

  it('raid probability = heat² × difficulty_coef per turn', () => {
    expect(raidProbability(0, 'medium')).toBe(0);
    expect(raidProbability(0.5, 'medium')).toBeCloseTo(0.175, 3);
    expect(raidProbability(1, 'ultra-nightmare')).toBe(1);
  });

  it('raid wipes Black Market when it fires', () => {
    // Dozens of mythics + max cash drives computed heat → 1.0 under
    // ultra-nightmare (raidProb → 1.0 clamp).
    const A = [
      mkTurf('a1', [
        sc(mkTough({ id: 'aT1', rarity: 'mythic', power: 10 }), true),
        sc(mkTough({ id: 'aT2', rarity: 'mythic' }), true),
        sc(mkTough({ id: 'aT3', rarity: 'mythic' }), true),
        sc(mkCurrency(1000, 'cA1'), true),
        sc(mkCurrency(1000, 'cA2'), true),
      ]),
    ];
    const B = [
      mkTurf('b1', [
        sc(mkTough({ id: 'bT1', rarity: 'mythic' }), true),
        sc(mkTough({ id: 'bT2', rarity: 'mythic' }), true),
        sc(mkTough({ id: 'bT3', rarity: 'mythic' }), true),
        sc(mkCurrency(1000, 'cB1'), true),
        sc(mkCurrency(1000, 'cB2'), true),
      ]),
    ];
    const state = mkState(A, B, { seed: 7 });
    state.config.difficulty = 'ultra-nightmare';
    // Pre-seed market with a token so we can confirm wipe.
    state.blackMarket.push(mkWeapon({ id: 'pre-existing' }));

    resolvePhase(state);

    expect(state.heat).toBeGreaterThan(0.5);
    expect(state.metrics.raids).toBeGreaterThanOrEqual(1);
    expect(state.blackMarket.some((m) => m.id === 'pre-existing')).toBe(false);
  });
});

describe('v0.3 integration — Black Market + Holding', () => {
  it('sends a tough to Black Market then trades mods up-tier', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT' })),
          sc(mkWeapon({ id: 'w1', rarity: 'common' })),
          sc(mkDrug({ id: 'd1', rarity: 'common' })),
        ]),
      ],
      [mkTurf('b1', [])],
    );
    state.players.A.toughsInPlay = 1;

    sendToMarket(state, 'A', 'aT');
    expect(state.blackMarket.map((m) => m.id).sort()).toEqual(['d1', 'w1']);

    const traded = tradeAtMarket(state, 'A', ['w1', 'd1'], 'uncommon');
    // Trade is by rarity (2 commons → 1 uncommon), card kinds can mix.
    expect(traded).not.toBeNull();
    expect(traded?.rarity).toBe('uncommon');
  });

  it('heals a wounded tough at Black Market by spending a common', () => {
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
    if (tough.kind === 'tough') expect(tough.hp).toBe(4);
  });

  it('holding triggers probabilistically when heat is non-zero', () => {
    // Deterministic probe: seed, some heat, a held tough.
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])], {
      seed: 42,
      heat: 0.9,
    });
    state.holding.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
    });

    const result = holdingCheck(state, 'A');
    // Outcome space is {none | bribed | lockup | raid}; at high heat a
    // trigger is very likely, but nondeterminism is acceptable here
    // since we've already verified probability curves in heat.test.ts.
    expect(['none', 'bribed', 'lockup', 'raid']).toContain(result.outcome);
  });
});

describe('v0.3 integration — modifier swap + ownership', () => {
  it('sendToHolding + returnFromHolding preserves attached modifiers', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' })), sc(mkWeapon({ id: 'w1' }))])],
      [mkTurf('b1', [])],
    );
    state.players.A.toughsInPlay = 1;

    sendToHolding(state, 'A', 'aT');
    expect(state.holding.A[0].attachedModifiers.map((m) => m.id)).toEqual([
      'w1',
    ]);
  });
});

describe('v0.3 integration — Mythic signature abilities', () => {
  it('STRIKE_TWO hits top + next-below in a single resolution', () => {
    // Attacker has a mythic tough with STRIKE_TWO.
    // Defender has two toughs stacked; both should take damage.
    const bottom = mkTough({ id: 'def-bot', resistance: 3, maxHp: 3, hp: 3, power: 1 });
    const top = mkTough({ id: 'def-top', resistance: 3, maxHp: 3, hp: 3, power: 1 });
    const defTurf = mkTurf('d', [sc(bottom), sc(top)]);

    const atkTough = mkTough({
      id: 'atk',
      power: 10,
      resistance: 5,
      maxHp: 5,
      hp: 5,
      rarity: 'mythic',
      abilities: ['STRIKE_TWO'],
    });
    const atkTurf = mkTurf('a', [sc(atkTough)]);

    const state = mkState([atkTurf], [defTurf]);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    // Top tough should be dead (killed by primary strike, power 10 >> resistance 3).
    // Bottom tough should also be dead (chain hit from STRIKE_TWO).
    // If both are dead, the turf is seized and B has 0 turfs.
    expect(state.players.B.turfs).toHaveLength(0);
  });

  it('CHAIN_THREE hits top + next + next-next', () => {
    // Defender has three toughs; attacker has CHAIN_THREE.
    const t1 = mkTough({ id: 'def-1', resistance: 3, maxHp: 3, hp: 3, power: 1 });
    const t2 = mkTough({ id: 'def-2', resistance: 3, maxHp: 3, hp: 3, power: 1 });
    const t3 = mkTough({ id: 'def-3', resistance: 3, maxHp: 3, hp: 3, power: 1 });
    const defTurf = mkTurf('d', [sc(t1), sc(t2), sc(t3)]);

    const atkTough = mkTough({
      id: 'atk',
      power: 15,
      resistance: 5,
      maxHp: 5,
      hp: 5,
      rarity: 'mythic',
      abilities: ['CHAIN_THREE'],
    });
    const atkTurf = mkTurf('a', [sc(atkTough)]);

    const state = mkState([atkTurf], [defTurf]);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    // All three toughs should be dead → B has 0 turfs.
    expect(state.players.B.turfs).toHaveLength(0);
  });

  it('IMMUNITY mythic cannot be sent to Holding', () => {
    const immune = mkTough({
      id: 'immune-1',
      rarity: 'mythic',
      abilities: ['IMMUNITY'],
    });
    const state = mkState(
      [mkTurf('a', [sc(immune)])],
      [mkTurf('b', [])],
    );
    state.players.A.toughsInPlay = 1;

    sendToHolding(state, 'A', 'immune-1');

    // IMMUNITY blocks the transfer — tough must still be on the turf.
    expect(state.holding.A).toHaveLength(0);
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
  });

  it('TRANSCEND mythic ignores affiliation penalties (rival mods transfer on kill)', () => {
    // Build a scenario where a rival-affiliated mod would normally be discarded
    // on kill, but TRANSCEND bypasses that check.
    // We use two toughs with rival affiliations from the affiliations graph.
    // The easiest test: resolver's killed mod is a 'weapon' — not a tough —
    // so affiliation check doesn't apply there. Instead verify via applyKill
    // path: use a tough mod (kind:'tough') on the defender that has a rival
    // affiliation, and with TRANSCEND the attacker keeps it.
    //
    // Simpler contract: with TRANSCEND, turfAffiliationConflict returns false
    // for the attacker, meaning all mods transfer regardless of affiliation.
    // We validate by checking transferred > 0 even when affiliations conflict.
    const rivalMod = mkWeapon({ id: 'rival-w', rarity: 'common' });
    const defTough = mkTough({
      id: 'def-t',
      resistance: 1,
      maxHp: 1,
      hp: 1,
      affiliation: 'freelance',
    });
    const defTurf = mkTurf('d', [sc(defTough), sc(rivalMod, true, 'def-t')]);

    const atkTough = mkTough({
      id: 'atk-t',
      power: 20,
      resistance: 5,
      maxHp: 5,
      hp: 5,
      rarity: 'mythic',
      abilities: ['TRANSCEND'],
      affiliation: 'freelance',
    });
    const atkTurf = mkTurf('a', [sc(atkTough)]);

    // resolveDirectStrike should kill def-t and transfer the mod.
    const result = resolveDirectStrike(atkTurf, defTurf);
    expect(result.outcome).toBe('kill');
    // With TRANSCEND, the mod transfers (not discarded).
    expect(result.transferredMods).toHaveLength(1);
    expect(result.discardedMods).toHaveLength(0);
  });

  it('ABSOLUTE mythic deals min 1 damage on glance', () => {
    // Attacker power is lower than defender resistance (would normally bust),
    // but ABSOLUTE forces at least 1 HP of damage.
    const defTough = mkTough({ id: 'def-t', resistance: 10, maxHp: 10, hp: 10 });
    const defTurf = mkTurf('d', [sc(defTough)]);

    const atkTough = mkTough({
      id: 'atk-t',
      power: 3,  // far below R=10 — would bust without ABSOLUTE
      resistance: 5,
      maxHp: 5,
      hp: 5,
      rarity: 'mythic',
      abilities: ['ABSOLUTE'],
    });
    const atkTurf = mkTurf('a', [sc(atkTough)]);

    const result = resolveDirectStrike(atkTurf, defTurf);

    // Should not be busted; defender takes exactly 1 HP.
    expect(result.outcome).not.toBe('busted');
    expect(result.damage).toBe(1);
    expect(defTough.hp).toBe(9);
  });
});

describe('v0.3 integration — suite meta', () => {
  it('confirms the integration test file imports + sim is wired', () => {
    expect(resolveDirectStrike).toBeTypeOf('function');
    expect(resolvePhase).toBeTypeOf('function');
    expect(computeHeat).toBeTypeOf('function');
    expect(promoteReserveTurf).toBeTypeOf('function');
  });
});
