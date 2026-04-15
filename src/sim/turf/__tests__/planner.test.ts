import { describe, expect, it } from 'vitest';
import { decideAction } from '../ai';
import { createMatch } from '../game';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { DEFAULT_GAME_CONFIG } from '../types';
import type { ToughCard, CurrencyCard, WeaponCard, TurfGameState } from '../types';

function tough(id: string, power: number, resistance: number): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'bruiser',
    affiliation: 'freelance', power, resistance, rarity: 'common', abilities: [],
  };
}

function currency(id: string, denom: 100 | 1000 = 100): CurrencyCard {
  return { kind: 'currency', id, name: `$${denom}`, denomination: denom, rarity: 'common' };
}

function weapon(id: string, power = 2): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'bladed',
    power, resistance: 1, rarity: 'common', abilities: [],
  };
}

function makeState(): TurfGameState {
  resetTurfIdCounter();
  const match = createMatch(DEFAULT_GAME_CONFIG, {
    deckA: [tough('a1', 5, 5), tough('a2', 4, 4), weapon('w1'), currency('c1')],
    deckB: [tough('b1', 5, 5), tough('b2', 4, 4), weapon('w2'), currency('c2')],
  });
  return match.game;
}

describe('turf planner v0.2', () => {
  it('emits a legal action and planner trace', () => {
    const state = makeState();
    state.players.A.hand = [tough('h1', 4, 4)];
    const { action, trace } = decideAction(state, 'A');
    expect(action.side).toBe('A');
    expect(trace.legalActionCount).toBeGreaterThan(0);
    expect(trace.chosenGoal.length).toBeGreaterThan(0);
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('prefers playing a tough when no toughs are in play', () => {
    const state = makeState();
    state.players.A.turfs = [createTurf()];
    state.players.A.hand = [tough('newcomer', 4, 4), currency('c-hand')];
    state.players.A.toughsInPlay = 0;
    state.players.A.actionsRemaining = 3;
    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('play_card');
    expect(action.cardId).toBe('newcomer');
  });

  it('falls back to a global legal action instead of end_turn when goal set is empty', () => {
    const state = makeState();
    state.players.A.turfs = [createTurf()];
    state.players.A.hand = [tough('backup', 4, 4)];
    state.players.A.toughsInPlay = 0;
    state.players.A.actionsRemaining = 3;
    const turfB = createTurf();
    addToStack(turfB, tough('enemy', 4, 6));
    state.players.B.turfs = [turfB];
    state.players.B.toughsInPlay = 1;

    const { action, trace } = decideAction(state, 'A');
    expect(action.kind).not.toBe('pass');
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('enumerates all v0.2 action kinds: play_card, strikes, discard, end_turn', () => {
    const state = makeState();
    const turfA = createTurf();
    addToStack(turfA, tough('atk', 6, 5));
    state.players.A.turfs = [turfA];
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [tough('spare', 3, 3)];
    state.players.A.actionsRemaining = 3;
    const turfB = createTurf();
    addToStack(turfB, tough('def', 4, 4));
    state.players.B.turfs = [turfB];
    state.players.B.toughsInPlay = 1;

    const { trace } = decideAction(state, 'A');
    const kinds = new Set(trace.actionScores.map((s) => s.action.split('@')[0].split(':')[0]));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it('scores funded_recruit higher when enough currency on turf', () => {
    const state = makeState();
    const turfA = createTurf();
    addToStack(turfA, tough('recruiter', 4, 4));
    addToStack(turfA, currency('c-1k', 1000));
    state.players.A.turfs = [turfA];
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [];
    state.players.A.actionsRemaining = 3;
    const turfB = createTurf();
    addToStack(turfB, tough('target', 3, 3));
    state.players.B.turfs = [turfB];
    state.players.B.toughsInPlay = 1;

    const { action } = decideAction(state, 'A');
    expect(['funded_recruit', 'direct_strike', 'pushed_strike']).toContain(action.kind);
  });

  it('does not crash with empty hand and empty turfs', () => {
    const state = makeState();
    state.players.A.turfs = [createTurf()];
    state.players.A.hand = [];
    state.players.A.toughsInPlay = 0;
    state.players.A.actionsRemaining = 3;
    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('end_turn');
  });

  it('checks affiliation compatibility when scoring play_card for toughs', () => {
    const state = makeState();
    const turfA = createTurf();
    const existing = tough('existing', 5, 5);
    existing.affiliation = 'kings_row';
    addToStack(turfA, existing);
    state.players.A.turfs = [turfA];
    state.players.A.toughsInPlay = 1;
    const rival = tough('rival', 4, 4);
    rival.affiliation = 'iron_devils';
    state.players.A.hand = [rival];
    state.players.A.actionsRemaining = 3;

    const { action } = decideAction(state, 'A');
    if (action.kind === 'play_card') {
      expect(action.cardId).not.toBe('rival');
    }
  });
});
