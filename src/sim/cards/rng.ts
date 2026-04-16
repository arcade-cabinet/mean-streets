import seedrandom from 'seedrandom';

/**
 * Seedable PRNG for reproducible simulations.
 * `seedrandom` is the single active random source for runtime and sim code.
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
  const startSeed = seed;
  const generator = seedrandom(String(seed));

  function next(): number {
    return generator.quick();
  }

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      // A TypeScript signature returning `T` claims non-null. Empty
      // input silently yielded `undefined` and corrupted downstream
      // logic. Throw explicitly so the bug surfaces at the callsite
      // rather than as a mystery null-deref further in.
      if (arr.length === 0) {
        throw new Error('rng.pick: cannot pick from an empty array');
      }
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle,
    get seed() { return startSeed; },
  };
}

/** Generate a random seed. */
export function randomSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return 1 + (values[0] % 2147483646);
}
