import { afterEach, describe, it, expect, vi } from 'vitest';
import { createGameWorld } from '../ecs/world';
import { endTurnAction } from '../ecs/actions';
import { GameState, PlayerA, PlayerB, ActionBudget } from '../ecs/traits';
import { DEFAULT_GAME_CONFIG } from '../sim/turf/types';
import { actionsForTurn } from '../sim/turf/environment';
import * as environment from '../sim/turf/environment';

const SEED = 1337;

// Bug A — endTurnAction MUST delegate sim state mutation through the
// environment module (stepAction + advanceTurn). Directly mutating
// turnSide / turnNumber / draws / actions from the ECS layer violates
// the v0.2 stack-redesign contract: ECS actions delegate to stepAction
// and never touch board/attack primitives directly.
describe('endTurnAction delegates to stepAction + advanceTurn', () => {
  // Restore all vi.spyOn mocks between tests. Without this, a failure
  // inside the test body would skip the inline .mockRestore() calls and
  // leak spies into the next test (breaking stepAction/advanceTurn
  // observability site-wide).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls stepAction with an end_turn action for the outgoing side', () => {
    const stepSpy = vi.spyOn(environment, 'stepAction');
    const advanceSpy = vi.spyOn(environment, 'advanceTurn');

    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const gsBefore = entity.get(GameState)!;
    const outgoingSide = gsBefore.turnSide;

    endTurnAction(world);

    // stepAction was called with an end_turn action keyed to the
    // outgoing side (not the new side).
    const endTurnCalls = stepSpy.mock.calls.filter(
      ([, action]) => action.kind === 'end_turn',
    );
    expect(endTurnCalls.length).toBeGreaterThan(0);
    expect(endTurnCalls[0][1]).toMatchObject({
      kind: 'end_turn',
      side: outgoingSide,
    });

    // advanceTurn performed the transition (side swap + turn++).
    expect(advanceSpy).toHaveBeenCalledTimes(1);
  });

  it('advances turnNumber and turnSide consistently (no double-advance)', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const gs = entity.get(GameState)!;

    const startTurn = gs.turnNumber;
    const startSide = gs.turnSide;

    endTurnAction(world);

    // Exactly one turn passed. If the ECS layer were still mutating
    // turnNumber alongside stepAction/advanceTurn, we'd see a +2 jump.
    expect(gs.turnNumber).toBe(startTurn + 1);
    expect(gs.turnSide).toBe(startSide === 'A' ? 'B' : 'A');

    endTurnAction(world);

    expect(gs.turnNumber).toBe(startTurn + 2);
    expect(gs.turnSide).toBe(startSide);
  });

  it('resets ActionBudget to actionsForTurn(config, turnNumber, side) for the incoming side', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const budgetEntity = world.queryFirst(ActionBudget)!;
    const gs = entity.get(GameState)!;

    endTurnAction(world);

    const incomingSide = gs.turnSide;
    const expected = actionsForTurn(gs.config, gs.turnNumber, incomingSide);
    const budget = budgetEntity.get(ActionBudget)!;
    expect(budget.remaining).toBe(expected);
    expect(budget.total).toBe(expected);
    expect(budget.turnNumber).toBe(gs.turnNumber);
    expect(gs.players[incomingSide].actionsRemaining).toBe(expected);
  });
});

// Bug B — Player B's opening action budget was incorrectly set to
// config.firstTurnActions. A strikes first per rules, so B must have
// 0 actions until advanceTurn fires for B's first turn.
describe('initial action budget respects starting-player rule', () => {
  it('player B starts with 0 actionsRemaining (A goes first)', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerB)!;
    const pB = entity.get(PlayerB)!;
    expect(pB.actionsRemaining).toBe(0);
  });

  it('player A starts with the full first-turn budget', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(PlayerA)!;
    const pA = entity.get(PlayerA)!;
    const expected = actionsForTurn(DEFAULT_GAME_CONFIG, 1, 'A');
    expect(pA.actionsRemaining).toBe(expected);
  });

  it("player B's first turn receives actionsForTurn(config, 2, 'B')", () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const budgetEntity = world.queryFirst(ActionBudget)!;
    const gs = entity.get(GameState)!;

    endTurnAction(world);

    expect(gs.turnSide).toBe('B');
    const expected = actionsForTurn(gs.config, gs.turnNumber, 'B');
    expect(budgetEntity.get(ActionBudget)!.remaining).toBe(expected);
  });
});

// Bug C — actionsForTurn is 1-based. The initial ActionBudget must
// reflect turn 1 (firstTurnActions), not turn 0.
describe('turn-1 opening budget matches config.firstTurnActions', () => {
  it('ActionBudget.total equals config.firstTurnActions on turn 1', () => {
    const world = createGameWorld(undefined, SEED);
    const budgetEntity = world.queryFirst(ActionBudget)!;
    const budget = budgetEntity.get(ActionBudget)!;

    // DEFAULT difficulty = 'medium' has 0 actionBonus / 0 penalty, so
    // the configured firstTurnActions is the expected value verbatim.
    expect(budget.total).toBe(DEFAULT_GAME_CONFIG.firstTurnActions);
    expect(budget.remaining).toBe(DEFAULT_GAME_CONFIG.firstTurnActions);
  });

  it('GameState.turnNumber is initialized to 1 (not 0)', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(GameState)!;
    const gs = entity.get(GameState)!;
    expect(gs.turnNumber).toBe(1);
  });

  it('ActionBudget.turnNumber mirrors GameState.turnNumber at spawn', () => {
    const world = createGameWorld(undefined, SEED);
    const gs = world.queryFirst(GameState)!.get(GameState)!;
    const budget = world.queryFirst(ActionBudget)!.get(ActionBudget)!;
    expect(budget.turnNumber).toBe(gs.turnNumber);
  });
});
