import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import {
  drawAction,
  passAction,
  endTurnAction,
  queueStrikeAction,
} from '../ecs/actions';
import { ActionBudget, GameState, PlayerA, PlayerB } from '../ecs/traits';

const SEED = 42;

// v0.2 handless model — no hand, no turnSide. Draw into `pending`, play
// or discard it. Both sides act in parallel each turn.

describe('createGameWorld (handless v0.2)', () => {
  it('returns a world with GameState, PlayerA, PlayerB on a single entity', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState, PlayerA, PlayerB);
    expect(entity).toBeDefined();
  });

  it('PlayerA starts with no pending card and a full deck', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA)!;
    expect(pA.pending).toBeNull();
    expect(pA.queued).toEqual([]);
    expect(pA.turnEnded).toBe(false);
    expect(pA.deck.length).toBeGreaterThan(0);
  });

  it('PlayerA starts with the configured number of turfs, each empty', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA);
    const pA = entity!.get(PlayerA)!;
    expect(pA.turfs.length).toBeGreaterThan(0);
    for (const turf of pA.turfs) {
      expect(turf.stack).toHaveLength(0);
      expect(turf.id).toMatch(/^turf-/);
    }
  });

  it('Phase starts in action (not combat)', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState);
    const gs = entity!.get(GameState)!;
    expect(gs.phase).toBe('action');
  });

  it('ActionBudget starts with firstTurnActions for side A', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(ActionBudget);
    const budget = entity!.get(ActionBudget)!;
    expect(budget.remaining).toBeGreaterThan(0);
    expect(budget.total).toBe(budget.remaining);
  });
});

describe('drawAction', () => {
  it('moves top of deck into pending and costs 1 action', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA)!;
    const pA = entity.get(PlayerA)!;
    const deckBefore = pA.deck.length;
    const budgetEntity = world.queryFirst(ActionBudget)!;
    const budgetBefore = budgetEntity.get(ActionBudget)!.remaining;

    drawAction(world, 'A');

    // Card either goes to pending (tough) or auto-routes to market (modifier on empty turf)
    expect(pA.deck.length).toBe(deckBefore - 1);
    expect(budgetEntity.get(ActionBudget)!.remaining).toBe(budgetBefore - 1);
  });
});

describe('passAction', () => {
  it('decrements actionsRemaining for the chosen side', () => {
    const world = createGameWorld(undefined, SEED);
    const budgetEntity = world.queryFirst(ActionBudget)!;
    const before = budgetEntity.get(ActionBudget)!.remaining;

    passAction(world, 'A');

    expect(budgetEntity.get(ActionBudget)!.remaining).toBe(before - 1);
  });
});

describe('endTurnAction + resolvePhase', () => {
  it('sets turnEnded; when both sides end, resolvePhase advances the turn', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const gs = entity.get(GameState)!;
    const turnBefore = gs.turnNumber;

    endTurnAction(world, 'A');
    // After only A ends, turn has not yet advanced.
    expect(gs.players.A.turnEnded).toBe(true);
    expect(gs.players.B.turnEnded).toBe(false);
    expect(gs.turnNumber).toBe(turnBefore);

    endTurnAction(world, 'B');
    // Resolve fires inside stepAction — turn counter bumps, flags clear.
    expect(gs.turnNumber).toBe(turnBefore + 1);
    expect(gs.players.A.turnEnded).toBe(false);
    expect(gs.players.B.turnEnded).toBe(false);
    expect(gs.phase).toBe('action');
  });

  it('refreshes action budgets for both sides after resolve', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const gs = entity.get(GameState)!;

    // Drain A's budget a bit so the reset is observable.
    drawAction(world, 'A');
    endTurnAction(world, 'A');
    endTurnAction(world, 'B');

    const budget = world.queryFirst(ActionBudget)!.get(ActionBudget)!;
    expect(budget.remaining).toBe(gs.players.A.actionsRemaining);
    expect(budget.remaining).toBeGreaterThan(0);
  });
});

describe('queueStrikeAction', () => {
  it('appends a queued action to the player and costs 1 action', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA)!;
    const pA = entity.get(PlayerA)!;

    const before = pA.queued.length;
    const result = queueStrikeAction(world, 'A', 'direct_strike', 0, 0);

    expect(result).not.toBeNull();
    expect(pA.queued.length).toBe(before + 1);
    expect(pA.queued[before]).toMatchObject({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });
  });
});
