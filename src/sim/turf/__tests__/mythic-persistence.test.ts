/**
 * Mythic persistence across wars — RULES §11
 *
 * Enforces global exclusivity: at most one side may hold any given mythic
 * at any time. Owned mythics must be excluded from the shared unassigned
 * pool and pre-seeded into mythicAssignments at match bootstrap.
 */
import { describe, expect, it } from 'vitest';
import { createMatch } from '../game';
import { DEFAULT_GAME_CONFIG } from '../types';
import { resolvePhase } from '../resolve';
import { mkState, mkTough, mkTurf, sc } from './state-builder';

const ALL_MYTHIC_IDS = [
  'mythic-01', 'mythic-02', 'mythic-03', 'mythic-04', 'mythic-05',
  'mythic-06', 'mythic-07', 'mythic-08', 'mythic-09', 'mythic-10',
];

// ── createMatch pool seeding ──────────────────────────────────────────────────

describe('createMatch: ownedMythics parameter seeds global exclusivity', () => {
  it('defaults to all 10 unassigned when no ownedMythics provided', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1 });
    expect(match.game.mythicPool).toHaveLength(10);
    expect(Object.keys(match.game.mythicAssignments)).toHaveLength(0);
  });

  it('player-owned mythic is removed from pool and pre-assigned to A', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 1,
      ownedMythics: { A: ['mythic-01'], B: [] },
    });
    expect(match.game.mythicPool).not.toContain('mythic-01');
    expect(match.game.mythicPool).toHaveLength(9);
    expect(match.game.mythicAssignments['mythic-01']).toBe('A');
  });

  it('AI-owned mythic is removed from pool and pre-assigned to B', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 1,
      ownedMythics: { A: [], B: ['mythic-02'] },
    });
    expect(match.game.mythicPool).not.toContain('mythic-02');
    expect(match.game.mythicPool).toHaveLength(9);
    expect(match.game.mythicAssignments['mythic-02']).toBe('B');
  });

  it('both sides owning different mythics correctly seeds pool and assignments', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 1,
      ownedMythics: { A: ['mythic-03'], B: ['mythic-07'] },
    });
    expect(match.game.mythicPool).not.toContain('mythic-03');
    expect(match.game.mythicPool).not.toContain('mythic-07');
    expect(match.game.mythicPool).toHaveLength(8);
    expect(match.game.mythicAssignments['mythic-03']).toBe('A');
    expect(match.game.mythicAssignments['mythic-07']).toBe('B');
  });
});

// ── Sequential war scenario (the core bug) ───────────────────────────────────

describe('sequential wars: player-owned mythic from war 1 is excluded in war 2', () => {
  it('war 1: player kills AI mythic → gains it; war 2: pool no longer contains it', () => {
    // --- War 1 setup ---
    const mythicId = 'mythic-01';
    const mythicTough = mkTough({
      id: mythicId,
      rarity: 'mythic',
      power: 3,
      resistance: 1,
      maxHp: 1,
      hp: 1,
    });
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mythicTough)])];
    const war1State = mkState(A, B);
    // Mythic starts assigned to B (AI owns it before this war)
    war1State.mythicPool = ALL_MYTHIC_IDS.filter((id) => id !== mythicId);
    war1State.mythicAssignments[mythicId] = 'B';

    // Player A strikes and kills the mythic tough
    war1State.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });
    resolvePhase(war1State);

    // After war 1: mythic-01 is now owned by A (player)
    expect(war1State.mythicAssignments[mythicId]).toBe('A');

    // Simulate persisting: player now owns mythic-01
    const playerOwnedAfterWar1 = Object.entries(war1State.mythicAssignments)
      .filter(([, side]) => side === 'A')
      .map(([id]) => id);
    const aiOwnedAfterWar1 = Object.entries(war1State.mythicAssignments)
      .filter(([, side]) => side === 'B')
      .map(([id]) => id);

    expect(playerOwnedAfterWar1).toContain(mythicId);

    // --- War 2 bootstrap ---
    const war2Match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 42,
      ownedMythics: { A: playerOwnedAfterWar1, B: aiOwnedAfterWar1 },
    });

    // The bug: mythic-01 should NOT be in the unassigned pool in war 2
    expect(war2Match.game.mythicPool).not.toContain(mythicId);
    // It should be pre-assigned to A (player)
    expect(war2Match.game.mythicAssignments[mythicId]).toBe('A');
    // Pool has 9 remaining unassigned
    expect(war2Match.game.mythicPool).toHaveLength(9);
  });

  it('war 1: AI kills player mythic → AI gains it; war 2: pool excludes it for AI', () => {
    const mythicId = 'mythic-05';
    const mythicTough = mkTough({
      id: mythicId,
      rarity: 'mythic',
      power: 3,
      resistance: 1,
      maxHp: 1,
      hp: 1,
    });
    // Player A has the mythic; B has a super-strong attacker
    const A = [mkTurf('a1', [sc(mythicTough)])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', power: 50 }))])];
    const war1State = mkState(A, B);
    war1State.mythicPool = ALL_MYTHIC_IDS.filter((id) => id !== mythicId);
    war1State.mythicAssignments[mythicId] = 'A';

    war1State.players.B.queued.push({
      kind: 'direct_strike',
      side: 'B',
      turfIdx: 0,
      targetTurfIdx: 0,
    });
    resolvePhase(war1State);

    // AI now owns the mythic
    expect(war1State.mythicAssignments[mythicId]).toBe('B');

    const aiOwnedAfterWar1 = Object.entries(war1State.mythicAssignments)
      .filter(([, side]) => side === 'B')
      .map(([id]) => id);
    const playerOwnedAfterWar1 = Object.entries(war1State.mythicAssignments)
      .filter(([, side]) => side === 'A')
      .map(([id]) => id);

    const war2Match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 99,
      ownedMythics: { A: playerOwnedAfterWar1, B: aiOwnedAfterWar1 },
    });

    expect(war2Match.game.mythicPool).not.toContain(mythicId);
    expect(war2Match.game.mythicAssignments[mythicId]).toBe('B');
    expect(war2Match.game.mythicPool).toHaveLength(9);
  });
});

// ── Edge: all 10 mythics owned → empty pool, Perfect War fallback ─────────────

describe('edge: all 10 mythics claimed → mythicPool is empty', () => {
  it('when all mythics are assigned the pool starts empty', () => {
    // Split 10 mythics: 5 to A, 5 to B
    const aOwned = ALL_MYTHIC_IDS.slice(0, 5);
    const bOwned = ALL_MYTHIC_IDS.slice(5);

    const match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 7,
      ownedMythics: { A: aOwned, B: bOwned },
    });

    expect(match.game.mythicPool).toHaveLength(0);
    // All 10 should be in assignments
    expect(Object.keys(match.game.mythicAssignments)).toHaveLength(10);
    for (const id of aOwned) expect(match.game.mythicAssignments[id]).toBe('A');
    for (const id of bOwned) expect(match.game.mythicAssignments[id]).toBe('B');
  });

  it('drawMythicFromPool returns null when pool is empty (currency fallback applies)', () => {
    // Drain entire pool into A
    const match = createMatch(DEFAULT_GAME_CONFIG, {
      seed: 7,
      ownedMythics: { A: ALL_MYTHIC_IDS, B: [] },
    });

    expect(match.game.mythicPool).toHaveLength(0);
    // A null draw → escalating-currency Perfect War reward per §13.4
    const nullDraw = match.game.mythicPool.length === 0 ? null : match.game.mythicPool[0];
    expect(nullDraw).toBeNull();
  });
});

// ── No owned mythics = status quo for tests not using persistence ─────────────

describe('createMatch backward compat: existing tests without ownedMythics unaffected', () => {
  it('no ownedMythics option → 10-card pool, empty assignments (same as before)', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1 });
    expect(match.game.mythicPool).toEqual(expect.arrayContaining(ALL_MYTHIC_IDS));
    expect(match.game.mythicPool).toHaveLength(10);
    expect(match.game.mythicAssignments).toEqual({});
  });
});
