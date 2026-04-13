/**
 * Seedable PRNG for reproducible simulations.
 * Mulberry32 — fast, good distribution, 32-bit state.
 */

export interface Rng {
  /** Returns [0, 1) like Math.random(). */
  next(): number;
  /** Returns integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick random element from array. */
  pick<T>(arr: T[]): T;
  /** Fisher-Yates shuffle in place. */
  shuffle<T>(arr: T[]): T[];
  /** Current seed state (for logging/replay). */
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  const startSeed = seed;

  function next(): number {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    get seed() { return startSeed; },
  };
}

/** Generate a random seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}
