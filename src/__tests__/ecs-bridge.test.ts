/**
 * Integration tests for the ECS bridge layer.
 * Verifies that createGameWorld initialises correctly and that
 * action functions mutate world state as expected.
 */

import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import {
  placeCrewAction,
  placeModifierAction,
  directAttackAction,
  strikeAction,
  endRoundAction,
} from '../ecs/actions';
import { GameState, PlayerA, PlayerB, ScreenTrait } from '../ecs/traits';
import { placeCrew } from '../sim/turf/board';

const SEED = 42;

describe('createGameWorld', () => {
  it('returns a world with GameState, PlayerA, PlayerB traits on a single entity', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    expect(entity).toBeDefined();
  });

  it('PlayerA starts with crew cards in hand', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const pA = entity!.get(PlayerA);
    expect(pA).toBeDefined();
    expect(pA!.hand.crew.length).toBeGreaterThan(0);
  });

  it('PlayerA starts with modifier cards in hand', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const pA = entity!.get(PlayerA);
    expect(pA).toBeDefined();
    expect(pA!.hand.modifiers.length).toBeGreaterThan(0);
  });
});

describe('placeCrewAction', () => {
  it('places a crew card from hand onto board position 0 and removes it from hand', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const pA = entity!.get(PlayerA)!;
    const initialHandSize = pA.hand.crew.length;

    const placed = placeCrewAction(world, 0);

    expect(placed).toBe(true);
    expect(pA.board.active[0].crew).not.toBeNull();
    expect(pA.hand.crew.length).toBe(initialHandSize - 1);
  });

  it('returns false and leaves board unchanged when position already has crew', () => {
    const world = createGameWorld(undefined, SEED);
    placeCrewAction(world, 0);
    // Try to place again on the same occupied position
    const result = placeCrewAction(world, 0);
    expect(result).toBe(false);
  });
});

describe('placeModifierAction', () => {
  it('places a modifier in offense orientation and fills the correct slot', () => {
    const world = createGameWorld(undefined, SEED);
    // First put a crew card on position 0 (placeModifier requires crew on position)
    placeCrewAction(world, 0);

    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const pA = entity!.get(PlayerA)!;
    const initialModCount = pA.hand.modifiers.length;
    const card = pA.hand.modifiers[0];

    const placed = placeModifierAction(world, 0, 0, 'offense');

    expect(placed).toBe(true);
    expect(pA.hand.modifiers.length).toBe(initialModCount - 1);

    const pos = pA.board.active[0];
    // The offense slot depends on card type: product → drugTop, weapon → weaponTop, cash → cashLeft
    if (card.type === 'product') {
      expect(pos.drugTop).not.toBeNull();
    } else if (card.type === 'weapon') {
      expect(pos.weaponTop).not.toBeNull();
    } else if (card.type === 'cash') {
      expect(pos.cashLeft).not.toBeNull();
    }
  });
});

describe('directAttackAction', () => {
  it('returns an AttackOutcome when both attacker and target have crew and enough turnsActive', () => {
    const world = createGameWorld(undefined, SEED);

    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const pA = entity!.get(PlayerA)!;
    const pB = entity!.get(PlayerB)!;

    // Place crew on both sides and manually set turnsActive so directAttackAction sees them
    const crewA = pA.hand.crew[0];
    const crewB = pB.hand.crew[0];
    placeCrew(pA.board, 0, crewA);
    pA.board.active[0].turnsActive = 1;
    placeCrew(pB.board, 0, crewB);
    pB.board.active[0].turnsActive = 1;

    const outcome = directAttackAction(world, 0, 0);
    expect(outcome).not.toBeNull();
    expect(outcome).toHaveProperty('type');
    expect(outcome).toHaveProperty('description');
  });

  it('returns null when attacker position has no crew', () => {
    const world = createGameWorld(undefined, SEED);
    const outcome = directAttackAction(world, 0, 0);
    expect(outcome).toBeNull();
  });
});

describe('strikeAction', () => {
  it('transitions phase from buildup to combat', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const gs = entity!.get(GameState)!;

    expect(gs.phase).toBe('buildup');
    strikeAction(world);
    expect(gs.phase).toBe('combat');
  });

  it('also sets the screen to combat', () => {
    const world = createGameWorld(undefined, SEED);
    strikeAction(world);
    const screenEntity = world.queryFirst(ScreenTrait);
    const s = screenEntity!.get(ScreenTrait)!;
    expect(s.current).toBe('combat');
  });
});

describe('endRoundAction', () => {
  it('increments turnNumber by 1', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    const gs = entity!.get(GameState)!;

    const before = gs.turnNumber;
    endRoundAction(world);
    expect(gs.turnNumber).toBe(before + 1);
  });
});
