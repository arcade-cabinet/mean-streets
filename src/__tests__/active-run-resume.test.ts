import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import { GameState, PlayerA, PlayerB } from '../ecs/traits';
import { DEFAULT_GAME_CONFIG } from '../sim/turf/types';
import type { Card, GameConfig, ToughCard } from '../sim/turf/types';

/**
 * Regression test for Bug J — ActiveRunState must persist enough info to
 * reconstruct the exact same starting world on resume. Match bootstrap now
 * depends on the persisted collection and garage priorities, so seed alone
 * is no longer enough to recover the original opening decks.
 *
 * This test pins the contract: the active run payload must include the exact
 * ordered starting decks, and resume must replay them without reshuffling.
 */

interface ActiveRunStateShape {
  phase: 'combat';
  config: GameConfig;
  seed: number;
  playerDeck: Card[];
  aiDeck: Card[];
}

function tough(id: string): ToughCard {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'brawler',
    affiliation: 'freelance',
    power: 5,
    resistance: 5,
    rarity: 'common',
    abilities: [],
    maxHp: 5,
    hp: 5,
  };
}

function handsAndDecks(world: ReturnType<typeof createGameWorld>) {
  const aEntity = world.queryFirst(PlayerA);
  const bEntity = world.queryFirst(PlayerB);
  const pA = aEntity!.get(PlayerA)!;
  const pB = bEntity!.get(PlayerB)!;
  // v0.2 handless model: no opening hand, deck is the full shuffled start.
  return {
    aDeck: pA.deck.map((c) => c.id),
    bDeck: pB.deck.map((c) => c.id),
  };
}

function gameSeed(world: ReturnType<typeof createGameWorld>): number {
  const e = world.queryFirst(GameState);
  return e!.get(GameState)!.seed;
}

describe('ActiveRunState resume (Bug J regression)', () => {
  it('persists config + ordered decks so resume reproduces the exact starting deck', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG };
    const seed = 123456;
    const playerDeck = [tough('p-1'), tough('p-2'), tough('p-3')];
    const aiDeck = [tough('b-1'), tough('b-2')];

    const original = createGameWorld(
      config,
      seed,
      playerDeck,
      { A: [], B: [] },
      aiDeck,
      { preserveDeckOrder: true },
    );
    const activeRun: ActiveRunStateShape = {
      phase: 'combat',
      config,
      seed,
      playerDeck,
      aiDeck,
    };

    // Round-trip as JSON to mimic persistence layer.
    const roundTripped = JSON.parse(JSON.stringify(activeRun)) as ActiveRunStateShape;

    const resumed = createGameWorld(
      roundTripped.config,
      roundTripped.seed,
      roundTripped.playerDeck,
      { A: [], B: [] },
      roundTripped.aiDeck,
      { preserveDeckOrder: true },
    );

    const originalSnapshot = handsAndDecks(original);
    const resumedSnapshot = handsAndDecks(resumed);

    expect(resumedSnapshot).toEqual(originalSnapshot);
    expect(gameSeed(resumed)).toBe(seed);
    expect(gameSeed(original)).toBe(seed);
  });

  it('preserves deck order when explicit ordered decks are provided', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG };
    const playerDeck = [tough('p-1'), tough('p-2'), tough('p-3')];
    const aiDeck = [tough('b-1'), tough('b-2')];
    const world = createGameWorld(
      config,
      77,
      playerDeck,
      { A: [], B: [] },
      aiDeck,
      { preserveDeckOrder: true },
    );
    const snapshot = handsAndDecks(world);

    expect(snapshot.aDeck).toEqual(playerDeck.map((card) => card.id));
    expect(snapshot.bDeck).toEqual(aiDeck.map((card) => card.id));
  });
});
