import type { Rng } from '../cards/rng';
import { loadMythicPoolIds } from '../cards/catalog';

/**
 * Mythic-pool state (RULES §11, §13.4).
 *
 * The 10 authored mythics start in `unassigned`. When a mythic is
 * drawn (Perfect War) or first enters play, it moves out of
 * `unassigned` and into `assignments` keyed by cardId → owning side.
 * On combat defeat the assignment flips to the killer's side — the
 * mythic never returns to `unassigned` once it's been assigned.
 *
 * This module is the *in-game* mythic pool. The `TurfGameState`
 * carries `mythicPool: string[]` and `mythicAssignments: Record<…>`
 * which mirror this shape — `initMythicPool` returns what
 * `createMatch` should seed.
 */
export interface MythicPoolState {
  unassigned: string[];
  assignments: Record<string, 'A' | 'B'>;
}

/** Seed a fresh pool with all authored mythic ids in `unassigned`. */
export function initMythicPool(): MythicPoolState {
  return {
    unassigned: [...loadMythicPoolIds()],
    assignments: {},
  };
}

/**
 * Move a mythic from `unassigned` into `assignments` under `side`.
 *
 * Idempotent on re-assignment (if already assigned, just flips to the
 * requested side — matches the semantics of `flipMythicOnDefeat` when
 * a killer kills a mythic they already "owned" via some edge case).
 */
export function assignMythic(
  pool: MythicPoolState,
  mythicId: string,
  side: 'A' | 'B',
): void {
  const idx = pool.unassigned.indexOf(mythicId);
  if (idx >= 0) pool.unassigned.splice(idx, 1);
  pool.assignments[mythicId] = side;
}

/**
 * Flip an already-assigned mythic to the killer's side.
 *
 * If the mythic is still in `unassigned` (shouldn't happen in normal
 * combat, but possible in test setups), we *assign* it instead so
 * callers don't have to special-case the first-kill scenario.
 */
export function flipMythicOnDefeat(
  pool: MythicPoolState,
  mythicId: string,
  killerSide: 'A' | 'B',
): void {
  if (pool.unassigned.includes(mythicId)) {
    assignMythic(pool, mythicId, killerSide);
    return;
  }
  pool.assignments[mythicId] = killerSide;
}

/**
 * Draw a random unassigned mythic for `side`. Returns the cardId on
 * success, `null` if the pool is empty (Perfect War falls back to
 * escalating currency — see RULES §13.4).
 *
 * The draw uses the seeded RNG so reward bundles are reproducible.
 */
export function drawMythicFromPool(
  pool: MythicPoolState,
  side: 'A' | 'B',
  rng: Rng,
): string | null {
  if (pool.unassigned.length === 0) return null;
  const picked = rng.pick(pool.unassigned);
  assignMythic(pool, picked, side);
  return picked;
}

/** List every mythic currently assigned to `side`. */
export function mythicsOwnedBy(
  pool: MythicPoolState,
  side: 'A' | 'B',
): string[] {
  return Object.entries(pool.assignments)
    .filter(([, s]) => s === side)
    .map(([id]) => id);
}
