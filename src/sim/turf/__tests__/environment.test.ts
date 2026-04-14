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
import type { BackpackCard, CashCard, CrewCard, TurfGameState, WeaponCard } from '../types';

function clearHands(state: TurfGameState): void {
  for (const side of ['A', 'B'] as const) {
    state.players[side].crewDraw = [];
    state.players[side].modifierDraw = [];
    state.players[side].backpackDraw = [];
    state.players[side].hand.crew = [];
    state.players[side].hand.modifiers = [];
    state.players[side].hand.backpacks = [];
  }
}

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

function backpack(id: string): BackpackCard {
  return {
    type: 'backpack',
    id,
    name: id,
    icon: 'crate',
    size: 2,
    payload: [cash(`${id}-cash`), weapon(`${id}-weapon`)],
    unlocked: true,
    locked: false,
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
    clearHands(first);
    clearHands(second);

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
    clearHands(first);
    clearHands(second);

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
    clearHands(state);

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
    clearHands(state);

    placeCrew(state.players.A.board, 0, crew('attacker'));
    placeCrew(state.players.B.board, 0, crew('defender'));
    placeModifier(state.players.A.board, 0, weapon('gun-1'), 'offense');
    state.players.A.board.active[0].turnsActive = 1;

    stepAction(state, { kind: 'direct_attack', side: 'A', attackerIdx: 0, targetIdx: 0 });

    expect(state.aiMemory.A.laneRoles[0]).toBeUndefined();
    expect(state.aiMemory.A.focusLane).toBeNull();
    expect(state.aiMemory.A.focusRole).toBeNull();
  });

  it('enumerates and executes reserve crew, backpack equip, and runner deployment during buildup', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 11).state as TurfGameState;
    state.phase = 'buildup';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    clearHands(state);
    state.players.A.hand.crew = [crew('runner-seed')];
    state.players.A.hand.backpacks = [backpack('pack-a')];

    const reserveCrewAction = enumerateLegalActions(state, 'A').find(action => action.kind === 'place_reserve_crew');
    expect(reserveCrewAction).toBeTruthy();
    stepAction(state, reserveCrewAction!);
    expect(state.players.A.board.reserve[0].crew?.id).toBe('runner-seed');

    const equipAction = enumerateLegalActions(state, 'A').find(action => action.kind === 'equip_backpack');
    expect(equipAction).toBeTruthy();
    stepAction(state, equipAction!);

    // RULES.md §7: equipping a backpack to a reserve grants a FREE
    // swap into active. The runner now sits in the first empty
    // active slot, not on the reserve row.
    expect(state.players.A.board.active[0].crew?.id).toBe('runner-seed');
    expect(state.players.A.board.active[0].backpack?.id).toBe('pack-a');
    expect(state.players.A.board.active[0].runner).toBe(true);
    expect(state.players.A.board.reserve[0].crew).toBeNull();
  });

  it('deploys payload from an active runner backpack into board slots', () => {
    const state = createInitialTurfState(DEFAULT_TURF_CONFIG, 12).state as TurfGameState;
    state.phase = 'buildup';
    state.players.A.board = createBoard('A', 5, 5);
    state.players.B.board = createBoard('B', 5, 5);
    clearHands(state);
    state.players.A.hand.crew = [crew('runner-seed')];
    state.players.A.hand.backpacks = [backpack('pack-b')];

    stepAction(state, enumerateLegalActions(state, 'A').find(action => action.kind === 'place_reserve_crew')!);
    // equip already lands the runner in active via the §7 free swap;
    // no separate deploy_runner step needed.
    stepAction(state, enumerateLegalActions(state, 'A').find(action => action.kind === 'equip_backpack')!);

    const payloadAction = enumerateLegalActions(state, 'A').find(action => action.kind === 'deploy_payload' && action.slot === 'offense');
    expect(payloadAction).toBeTruthy();
    stepAction(state, payloadAction!);

    const lane = state.players.A.board.active[0];
    expect(lane.payloadRemaining).toBe(1);
    expect(Boolean(lane.cashLeft) || Boolean(lane.weaponTop)).toBe(true);
  });
});
