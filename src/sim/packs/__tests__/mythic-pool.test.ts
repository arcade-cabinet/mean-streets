import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  assignMythic,
  drawMythicFromPool,
  flipMythicOnDefeat,
  initMythicPool,
  mythicsOwnedBy,
} from '../mythic-pool';

describe('initMythicPool', () => {
  it('seeds with 10 unassigned authored mythics', () => {
    const pool = initMythicPool();
    expect(pool.unassigned).toHaveLength(10);
    expect(pool.assignments).toEqual({});
  });
});

describe('assignMythic', () => {
  it('moves an unassigned mythic into assignments', () => {
    const pool = initMythicPool();
    const [first] = pool.unassigned;
    assignMythic(pool, first, 'A');
    expect(pool.unassigned).not.toContain(first);
    expect(pool.assignments[first]).toBe('A');
    expect(pool.unassigned).toHaveLength(9);
  });

  it('is idempotent for an already-assigned mythic (flips side)', () => {
    const pool = initMythicPool();
    const [first] = pool.unassigned;
    assignMythic(pool, first, 'A');
    assignMythic(pool, first, 'B');
    expect(pool.assignments[first]).toBe('B');
    expect(pool.unassigned).toHaveLength(9);
  });
});

describe('flipMythicOnDefeat', () => {
  it('flips an assigned mythic to the killer side', () => {
    const pool = initMythicPool();
    const [first] = pool.unassigned;
    assignMythic(pool, first, 'A');
    flipMythicOnDefeat(pool, first, 'B');
    expect(pool.assignments[first]).toBe('B');
  });

  it('auto-assigns when flipping a mythic still in the unassigned pool', () => {
    const pool = initMythicPool();
    const [first] = pool.unassigned;
    flipMythicOnDefeat(pool, first, 'A');
    expect(pool.assignments[first]).toBe('A');
    expect(pool.unassigned).not.toContain(first);
  });
});

describe('drawMythicFromPool', () => {
  it('returns a cardId and assigns it on draw', () => {
    const pool = initMythicPool();
    const drawn = drawMythicFromPool(pool, 'A', createRng(42));
    expect(drawn).not.toBeNull();
    expect(pool.unassigned).toHaveLength(9);
    expect(pool.assignments[drawn!]).toBe('A');
  });

  it('is deterministic with the same seed', () => {
    const a = initMythicPool();
    const b = initMythicPool();
    const drawnA = drawMythicFromPool(a, 'A', createRng(99));
    const drawnB = drawMythicFromPool(b, 'A', createRng(99));
    expect(drawnA).toBe(drawnB);
  });

  it('returns null on empty pool (exhaustion fallback path)', () => {
    const pool = { unassigned: [], assignments: {} };
    expect(drawMythicFromPool(pool, 'A', createRng(1))).toBeNull();
  });

  it('draws the full pool to exhaustion', () => {
    const pool = initMythicPool();
    const drawn: string[] = [];
    while (pool.unassigned.length > 0) {
      const next = drawMythicFromPool(pool, 'A', createRng(pool.unassigned.length));
      if (next) drawn.push(next);
    }
    expect(drawn).toHaveLength(10);
    expect(drawMythicFromPool(pool, 'A', createRng(1))).toBeNull();
  });
});

describe('mythicsOwnedBy', () => {
  it('lists only the requested side’s mythics', () => {
    const pool = initMythicPool();
    const [a, b, c] = pool.unassigned;
    assignMythic(pool, a, 'A');
    assignMythic(pool, b, 'B');
    assignMythic(pool, c, 'A');
    const aMythics = mythicsOwnedBy(pool, 'A');
    const bMythics = mythicsOwnedBy(pool, 'B');
    expect(aMythics.sort()).toEqual([a, c].sort());
    expect(bMythics).toEqual([b]);
  });
});
