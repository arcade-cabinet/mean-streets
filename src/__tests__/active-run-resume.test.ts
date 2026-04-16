import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import { GameState, PlayerA, PlayerB } from '../ecs/traits';
import { DEFAULT_GAME_CONFIG } from '../sim/turf/types';
import type { GameConfig } from '../sim/turf/types';

/**
 * Regression test for Bug J — ActiveRunState must persist enough info to
 * reconstruct the exact same starting world on resume. Saving a `deck:
 * undefined` with no seed caused the default-deck builder to reshuffle with
 * a fresh seed, producing a different game on reload.
 *
 * This test pins the contract: given the same (config, seed) pair — which
 * is what handleSelectDifficulty now saves to ActiveRunState — the resumed
 * world reproduces the original deck/hand exactly.
 */

interface ActiveRunStateShape {
  phase: 'combat';
  config: GameConfig;
  seed: number;
}

function handsAndDecks(world: ReturnType<typeof createGameWorld>) {
  const aEntity = world.queryFirst(PlayerA);
  const bEntity = world.queryFirst(PlayerB);
  const pA = aEntity!.get(PlayerA)!;
  const pB = bEntity!.get(PlayerB)!;
  return {
    aHand: pA.hand.map(c => c.id),
    aDeck: pA.deck.map(c => c.id),
    bHand: pB.hand.map(c => c.id),
    bDeck: pB.deck.map(c => c.id),
  };
}

function gameSeed(world: ReturnType<typeof createGameWorld>): number {
  const e = world.queryFirst(GameState);
  return e!.get(GameState)!.seed;
}

describe('ActiveRunState resume (Bug J regression)', () => {
  it('persists config + seed so resume reproduces the exact starting deck', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG };
    const seed = 123456;

    // Initial difficulty-start path: seed is generated, saved to active run.
    const original = createGameWorld(config, seed);
    const activeRun: ActiveRunStateShape = { phase: 'combat', config, seed };

    // Round-trip as JSON to mimic persistence layer.
    const roundTripped = JSON.parse(JSON.stringify(activeRun)) as ActiveRunStateShape;

    // Resume path: createGameWorld(config, seed) with the restored values.
    const resumed = createGameWorld(roundTripped.config, roundTripped.seed);

    const originalSnapshot = handsAndDecks(original);
    const resumedSnapshot = handsAndDecks(resumed);

    expect(resumedSnapshot).toEqual(originalSnapshot);
    expect(gameSeed(resumed)).toBe(seed);
    expect(gameSeed(original)).toBe(seed);
  });

  it('omitting seed produces a non-deterministic world (documents the bug)', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG };
    // Without a seed, two worlds will almost certainly differ. This pins the
    // reason we MUST persist the seed rather than relying on defaults.
    const worldA = createGameWorld(config);
    const worldB = createGameWorld(config);
    const a = handsAndDecks(worldA);
    const b = handsAndDecks(worldB);
    // Extremely unlikely to match by chance; if it does the test is a flake,
    // but across 25+25 cards the odds are negligible.
    expect(a).not.toEqual(b);
  });
});
