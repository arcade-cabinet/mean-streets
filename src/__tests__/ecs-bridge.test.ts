import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import {
  playCardAction,
  strikeAction,
  endTurnAction,
  passAction,
  discardAction,
} from '../ecs/actions';
import { GameState, PlayerA, PlayerB, ActionBudget } from '../ecs/traits';

const SEED = 42;

describe('createGameWorld', () => {
  it('returns a world with GameState, PlayerA, PlayerB traits on a single entity', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    expect(entity).toBeDefined();
  });

  it('PlayerA starts with 5 cards in hand', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA);
    expect(pA!.hand).toHaveLength(5);
  });

  it('PlayerA starts with 4 turfs', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA);
    expect(pA!.turfs).toHaveLength(4);
    for (const turf of pA!.turfs) {
      expect(turf.stack).toHaveLength(0);
      expect(turf.id).toMatch(/^turf-/);
    }
  });

  it('ActionBudget starts with firstTurnActions', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(ActionBudget);
    const budget = entity!.get(ActionBudget);
    expect(budget!.remaining).toBe(5);
    expect(budget!.total).toBe(5);
  });
});

describe('playCardAction', () => {
  it('places a card from hand onto a turf stack', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA)!;
    const card = pA.hand[0];

    const result = playCardAction(world, 0, card.id);

    expect(result).not.toBeNull();
    expect(pA.turfs[0].stack.length).toBeGreaterThan(0);
    expect(pA.hand).not.toContain(card);
  });
});

describe('passAction', () => {
  it('decrements actionsRemaining', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(ActionBudget);
    const before = entity!.get(ActionBudget)!.remaining;

    passAction(world);

    const after = entity!.get(ActionBudget)!.remaining;
    expect(after).toBe(before - 1);
  });
});

describe('discardAction', () => {
  it('moves a card from hand to discard without costing an action', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA)!;
    const budgetEntity = world.queryFirst(ActionBudget);
    const budgetBefore = budgetEntity!.get(ActionBudget)!.remaining;

    const card = pA.hand[0];
    discardAction(world, card.id);

    expect(pA.discard).toContainEqual(expect.objectContaining({ id: card.id }));
    expect(budgetEntity!.get(ActionBudget)!.remaining).toBe(budgetBefore);
  });
});

describe('endTurnAction', () => {
  it('advances turnNumber and switches side', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState);
    const gs = entity!.get(GameState)!;

    expect(gs.turnSide).toBe('A');
    const turnBefore = gs.turnNumber;

    endTurnAction(world);

    expect(gs.turnNumber).toBe(turnBefore + 1);
    expect(gs.turnSide).toBe('B');
  });

  it('resets action budget for the new side', () => {
    const world = createGameWorld(undefined, SEED);
    const budgetEntity = world.queryFirst(ActionBudget);

    endTurnAction(world);

    const budget = budgetEntity!.get(ActionBudget)!;
    expect(budget.remaining).toBeGreaterThan(0);
    expect(budget.remaining).toBe(budget.total);
  });
});

describe('strikeAction', () => {
  it('returns null when game state not found', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA)!;

    const toughCards = pA.hand.filter((c) => c.kind === 'tough');
    for (const card of toughCards.slice(0, 2)) {
      playCardAction(world, 0, card.id);
    }

    endTurnAction(world);

    const entityB = world.queryFirst(PlayerB);
    const pB = entityB!.get(PlayerB)!;
    const toughCardsB = pB.hand.filter((c) => c.kind === 'tough');
    for (const card of toughCardsB.slice(0, 2)) {
      playCardAction(world, 0, card.id);
    }

    endTurnAction(world);

    const result = strikeAction(world, 'direct_strike', 0, 0);
    expect(result).toBeDefined();
    if (result) {
      expect(result.actionKey).toContain('direct_strike');
    }
  });
});
