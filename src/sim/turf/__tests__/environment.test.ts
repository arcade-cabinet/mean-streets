import { describe, expect, it } from 'vitest';
import { DEFAULT_TURF_CONFIG } from '../types';
import {
  createInitialTurfState,
  createObservation,
  enumerateLegalActions,
  normalizeActionKey,
  stepAction,
} from '../environment';
import { createBoard, placeCrew, placeModifier } from '../board';
import type { CashCard, CrewCard, TurfGameState, WeaponCard } from '../types';

function crew(id: string): CrewCard {
  return {
    type: 'crew',
    id,
    displayName: id,
    archetype: 'bruiser',
    affiliation: 'freelance',
    power: 4,
    resistance: 4,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

function weapon(id: string): WeaponCard {
  return {
    type: 'weapon',
    id,
    name: id,
    category: 'ranged',
    bonus: 3,
    offenseAbility: 'SUPPRESS',
    offenseAbilityText: '',
    defenseAbility: 'PARRY',
    defenseAbilityText: '',
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

describe('turf environment', () => {
  it('enumerates legal actions deterministically for the same seed', () => {
    const first = createInitialTurfState(DEFAULT_TURF_CONFIG, 1234);
    const second = createInitialTurfState(DEFAULT_TURF_CONFIG, 1234);

    const actionsA = enumerateLegalActions(first.state, 'A').map(normalizeActionKey);
    const actionsB = enumerateLegalActions(second.state, 'A').map(normalizeActionKey);

    expect(actionsA).toEqual(actionsB);
  });

  it('builds a stable observation state key for identical state', () => {
    const first = createInitialTurfState(DEFAULT_TURF_CONFIG, 99);
    const second = createInitialTurfState(DEFAULT_TURF_CONFIG, 99);

    expect(createObservation(first.state, 'A').stateKey).toBe(createObservation(second.state, 'A').stateKey);
  });

  it('coarsens combat state keys across equivalent tactical lane shapes', () => {
    const first = createInitialTurfState(DEFAULT_TURF_CONFIG, 3).state as TurfGameState;
    const second = createInitialTurfState(DEFAULT_TURF_CONFIG, 4).state as TurfGameState;

    first.phase = 'combat';
    second.phase = 'combat';
    first.players.A.board = createBoard('A', 5, 5);
    first.players.B.board = createBoard('B', 5, 5);
    second.players.A.board = createBoard('A', 5, 5);
    second.players.B.board = createBoard('B', 5, 5);

    placeCrew(first.players.A.board, 0, crew('a0'));
    placeCrew(second.players.A.board, 3, crew('a3'));
    placeCrew(first.players.B.board, 2, crew('b2'));
    placeCrew(second.players.B.board, 1, crew('b1'));

    placeModifier(first.players.A.board, 0, weapon('gun-1'), 'offense');
    placeModifier(second.players.A.board, 3, weapon('gun-2'), 'offense');
    placeModifier(first.players.A.board, 0, cash('cash-1'), 'offense');
    placeModifier(second.players.A.board, 3, cash('cash-2'), 'offense');

    expect(createObservation(first, 'A').stateKey).toBe(createObservation(second, 'A').stateKey);
  });

  it('coarsens focused combat state keys across equivalent tactical lane shapes', () => {
    const first = createInitialTurfState(DEFAULT_TURF_CONFIG, 3).state as TurfGameState;
    const second = createInitialTurfState(DEFAULT_TURF_CONFIG, 4).state as TurfGameState;

    first.phase = 'combat';
    second.phase = 'combat';
    first.players.A.board = createBoard('A', 5, 5);
    first.players.B.board = createBoard('B', 5, 5);
    second.players.A.board = createBoard('A', 5, 5);
    second.players.B.board = createBoard('B', 5, 5);

    placeCrew(first.players.A.board, 0, crew('a0'));
    placeCrew(second.players.A.board, 3, crew('a3'));
    placeCrew(first.players.B.board, 2, crew('b2'));
    placeCrew(second.players.B.board, 1, crew('b1'));

    placeModifier(first.players.A.board, 0, weapon('gun-1'), 'offense');
    placeModifier(second.players.A.board, 3, weapon('gun-2'), 'offense');
    placeModifier(first.players.A.board, 0, cash('cash-1'), 'offense');
    placeModifier(second.players.A.board, 3, cash('cash-2'), 'offense');

    first.aiMemory.A.focusLane = 0;
    first.aiMemory.A.focusRole = 'funded';
    second.aiMemory.A.focusLane = 3;
    second.aiMemory.A.focusRole = 'funded';

    expect(createObservation(first, 'A').stateKey).toBe(createObservation(second, 'A').stateKey);
  });

  it('distinguishes focused combat state keys from unfocused ones', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 3).state as TurfGameState;

    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);

    placeCrew(state.players.A.board, 0, crew('a0'));
    placeCrew(state.players.B.board, 2, crew('b2'));
    placeModifier(state.players.A.board, 0, weapon('gun-1'), 'offense');
    placeModifier(state.players.A.board, 0, cash('cash-1'), 'offense');

    const unfocused = createObservation(state, 'A').stateKey;
    state.aiMemory.A.focusLane = 0;
    state.aiMemory.A.focusRole = 'funded';
    const focused = createObservation(state, 'A').stateKey;

    expect(focused).not.toBe(unfocused);
  });

  it('does not mark a direct-only attack lane as funded focus after attacking', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 7).state as TurfGameState;
    state.phase = 'combat';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);

    placeCrew(state.players.A.board, 0, crew('attacker'));
    placeCrew(state.players.B.board, 0, crew('defender'));
    placeModifier(state.players.A.board, 0, weapon('gun-1'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;

    stepAction(state, { kind: 'direct_attack', side: 'A', attackerIdx: 0, targetIdx: 0 });

    expect(state.aiMemory.A.laneRoles[0]).toBeUndefined();
    expect(state.aiMemory.A.focusLane).toBeNull();
    expect(state.aiMemory.A.focusRole).toBeNull();
  });
});
