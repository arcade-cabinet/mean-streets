import { describe, expect, it } from 'vitest';
import { decideAction } from '../ai';
import { createInitialTurfState } from '../environment';
import { createBoard, placeCrew, placeModifier } from '../board';
import { DEFAULT_TURF_CONFIG } from '../types';
import type { CashCard, CrewCard, ProductCard, TurfGameState } from '../types';

function crew(id: string, power: number, resistance: number): CrewCard {
  return {
    type: 'crew',
    id,
    displayName: id,
    archetype: 'bruiser',
    affiliation: 'freelance',
    power,
    resistance,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

function cash(id: string): CashCard {
  return {
    type: 'cash',
    id,
    denomination: 100,
  };
}

function product(id: string): ProductCard {
  return {
    type: 'product',
    id,
    name: id,
    category: 'stimulant',
    potency: 2,
    offenseAbility: 'RUSH',
    offenseAbilityText: '',
    defenseAbility: 'REFLEXES',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  };
}

describe('turf planner', () => {
  it('emits a legal action and planner trace', () => {
    const { state } = createInitialTurfState(DEFAULT_TURF_CONFIG, 77);
    const { action, trace } = decideAction(state, 'A');

    expect(action.side).toBe('A');
    expect(trace.legalActionCount).toBeGreaterThan(0);
    expect(trace.chosenGoal.length).toBeGreaterThan(0);
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('falls back to a global legal action instead of passing when a goal-specific set is empty', () => {
    const state = {
      ...createInitialTurfState(DEFAULT_TURF_CONFIG, 1).state,
      phase: 'combat',
    } as TurfGameState;
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    state.players.A.hand.modifiers = [];
    state.players.A.hand.crew = [crew('backup', 4, 4)];
    state.players.A.board.active[0].seized = true;
    placeCrew(state.players.B.board, 0, crew('enemy', 4, 6));

    const { action, trace } = decideAction(state, 'A');
    expect(action.kind).not.toBe('pass');
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('preserves funded lane role instead of always upgrading it into a push lane', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 2).state as TurfGameState;
    state.phase = 'buildup';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('funded', 4, 4));
    placeCrew(state.players.A.board, 1, crew('fresh', 4, 4));
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [cash('cash-a'), product('prod-a')];
    state.aiMemory.A.laneRoles[0] = 'funded';

    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('stack_cash');
  });

  it('uses funded pressure goal when a funded lane is ready but no push lane exists', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 3).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('attacker', 4, 4));
    placeCrew(state.players.B.board, 0, crew('defender', 4, 4));
    placeModifier(state.players.A.board, 0, cash('cash-a'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [];

    const { trace } = decideAction(state, 'A');
    expect(trace.chosenGoal).toBe('funded_pressure');
    expect(['funded_attack', 'direct_attack']).toContain(trace.chosenAction.kind);
  });

  it('prefers attacking with the focused funded lane over a generic direct lane', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 4).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('funded-attacker', 4, 4));
    placeCrew(state.players.A.board, 1, crew('direct-attacker', 5, 4));
    placeCrew(state.players.B.board, 0, crew('defender-a', 4, 4));
    placeCrew(state.players.B.board, 1, crew('defender-b', 4, 4));
    placeModifier(state.players.A.board, 0, cash('cash-focus'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;
    state.players.A.board.active[1].turnsActive = 1;
    state.aiMemory.A.focusLane = 0;
    state.aiMemory.A.focusRole = 'funded';
    state.aiMemory.A.laneRoles[0] = 'funded';
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [];

    const { action, trace } = decideAction(state, 'A');
    expect(trace.chosenGoal).toBe('funded_pressure');
    expect(action.kind).toBe('funded_attack');
    expect(action.attackerIdx).toBe(0);
  });

  it('converts a focused funded lane into a push lane when product is available and no push exists', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 5).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('funded-attacker', 4, 4));
    placeCrew(state.players.B.board, 0, crew('defender-a', 4, 4));
    placeModifier(state.players.A.board, 0, cash('cash-focus'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;
    state.aiMemory.A.focusLane = 0;
    state.aiMemory.A.focusRole = 'funded';
    state.aiMemory.A.laneRoles[0] = 'funded';
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [product('prod-focus')];

    const { action, trace } = decideAction(state, 'A');
    expect(trace.chosenGoal).toBe('funded_pressure');
    expect(action.kind).toBe('stack_product');
    expect(action.positionIdx).toBe(0);
    expect(action.slot).toBe('offense');
  });

  it('keeps funded pressure for a profitable exchange before converting the focused lane', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 6).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('funded-attacker', 6, 4));
    placeCrew(state.players.B.board, 0, crew('defender-a', 3, 3));
    placeModifier(state.players.A.board, 0, cash('cash-focus'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;
    state.aiMemory.A.focusLane = 0;
    state.aiMemory.A.focusRole = 'funded';
    state.aiMemory.A.laneRoles[0] = 'funded';
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [product('prod-focus')];

    const { action, trace } = decideAction(state, 'A');
    expect(trace.chosenGoal).toBe('funded_pressure');
    expect(action.kind).toBe('funded_attack');
    expect(action.attackerIdx).toBe(0);
  });

  it('does not let hold_defense override a live focused funded lane too easily', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 7).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    placeCrew(state.players.A.board, 0, crew('funded-attacker', 5, 4));
    placeCrew(state.players.B.board, 0, crew('defender-a', 4, 4));
    placeCrew(state.players.B.board, 1, crew('defender-b', 5, 5));
    placeModifier(state.players.A.board, 0, cash('cash-focus'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;
    state.aiMemory.A.focusLane = 0;
    state.aiMemory.A.focusRole = 'funded';
    state.aiMemory.A.laneRoles[0] = 'funded';
    state.players.A.hand.crew = [];
    state.players.A.hand.modifiers = [];

    const { trace } = decideAction(state, 'A');
    expect(trace.chosenGoal).toBe('funded_pressure');
  });
});
