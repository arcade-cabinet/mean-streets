import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  assignMythic,
  drawMythicFromPool,
  flipMythicOnDefeat,
  initMythicPool,
  mythicsOwnedBy,
} from '../../packs/mythic-pool';
import { resolvePhase } from '../resolve';
import { mkState, mkTough, mkTurf, sc } from './state-builder';

describe('initMythicPool', () => {
  it('returns an unassigned pool with no assignments', () => {
    const pool = initMythicPool();
    expect(pool.unassigned.length).toBeGreaterThan(0);
    expect(Object.keys(pool.assignments)).toHaveLength(0);
  });

  it('pool contains duplicate-free ids', () => {
    const pool = initMythicPool();
    const set = new Set(pool.unassigned);
    expect(set.size).toBe(pool.unassigned.length);
  });
});

describe('assignMythic', () => {
  it('moves an id out of unassigned and into assignments', () => {
    const pool = initMythicPool();
    const first = pool.unassigned[0];
    assignMythic(pool, first, 'A');
    expect(pool.unassigned).not.toContain(first);
    expect(pool.assignments[first]).toBe('A');
  });

  it('is idempotent on re-assignment (flips side)', () => {
    const pool = initMythicPool();
    const first = pool.unassigned[0];
    assignMythic(pool, first, 'A');
    assignMythic(pool, first, 'B');
    expect(pool.assignments[first]).toBe('B');
  });
});

describe('flipMythicOnDefeat', () => {
  it('flips an already-assigned mythic to the killer', () => {
    const pool = initMythicPool();
    const m = pool.unassigned[0];
    assignMythic(pool, m, 'B');
    flipMythicOnDefeat(pool, m, 'A');
    expect(pool.assignments[m]).toBe('A');
  });

  it('assigns on first kill when the mythic was still unassigned', () => {
    const pool = initMythicPool();
    const m = pool.unassigned[0];
    flipMythicOnDefeat(pool, m, 'B');
    expect(pool.unassigned).not.toContain(m);
    expect(pool.assignments[m]).toBe('B');
  });
});

describe('drawMythicFromPool', () => {
  it('draws a random unassigned mythic and assigns it to the side', () => {
    const pool = initMythicPool();
    const rng = createRng(12345);
    const initialCount = pool.unassigned.length;

    const drawn = drawMythicFromPool(pool, 'A', rng);

    expect(drawn).not.toBeNull();
    expect(pool.unassigned).toHaveLength(initialCount - 1);
    expect(pool.assignments[drawn!]).toBe('A');
  });

  it('returns null when the unassigned pool is empty', () => {
    const pool = initMythicPool();
    const rng = createRng(1);
    // Drain the pool.
    for (const id of [...pool.unassigned]) assignMythic(pool, id, 'A');
    expect(drawMythicFromPool(pool, 'B', rng)).toBeNull();
  });

  it('deterministic given seed', () => {
    const rng1 = createRng(999);
    const rng2 = createRng(999);
    const poolA = initMythicPool();
    const poolB = initMythicPool();
    expect(drawMythicFromPool(poolA, 'A', rng1)).toBe(
      drawMythicFromPool(poolB, 'A', rng2),
    );
  });
});

describe('combat-path mythic flip', () => {
  it('flips mythic ownership to killer side when a mythic tough is killed in combat', () => {
    const mythicId = 'mythic-01';
    const mythicTough = mkTough({
      id: mythicId,
      rarity: 'mythic',
      power: 3,
      resistance: 1,
      maxHp: 1,
      hp: 1,
    });
    // B has the mythic assigned to them already.
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mythicTough)])];
    const state = mkState(A, B);
    state.mythicAssignments[mythicId] = 'B';
    // mythicPool represents unassigned; since already assigned, exclude it.

    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    // The mythic should now belong to A (the killer).
    expect(state.mythicAssignments[mythicId]).toBe('A');
    expect(state.metrics.mythicsFlipped).toBe(1);
  });

  it('does not increment mythicsFlipped for non-mythic kills', () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', rarity: 'legendary', resistance: 1, hp: 1, maxHp: 1 }))])];
    const state = mkState(A, B);

    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.metrics.mythicsFlipped).toBe(0);
  });

  it('assigns a previously-unassigned mythic to the killer on first kill', () => {
    const mythicId = 'mythic-02';
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
    const state = mkState(A, B);
    // Mythic is unassigned (in mythicPool as unassigned).
    state.mythicPool = [mythicId];

    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.mythicAssignments[mythicId]).toBe('A');
    expect(state.mythicPool).not.toContain(mythicId);
    expect(state.metrics.mythicsFlipped).toBe(1);
  });
});

describe('mythicsOwnedBy', () => {
  it('lists only ids assigned to the given side', () => {
    const pool = initMythicPool();
    const [m1, m2, m3] = pool.unassigned;
    assignMythic(pool, m1, 'A');
    assignMythic(pool, m2, 'B');
    assignMythic(pool, m3, 'A');

    expect(mythicsOwnedBy(pool, 'A').sort()).toEqual([m1, m3].sort());
    expect(mythicsOwnedBy(pool, 'B')).toEqual([m2]);
  });

  it('returns empty when nothing is owned', () => {
    const pool = initMythicPool();
    expect(mythicsOwnedBy(pool, 'A')).toEqual([]);
  });
});
