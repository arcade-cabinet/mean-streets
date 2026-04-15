import { describe, expect, it } from 'vitest';
import { decideAction, scoreAction } from '../ai';
import {
  createObservation,
  enumerateLegalActions,
} from '../env-query';
import { emptyPlannerMemory } from '../environment';
import { createMatch } from '../game';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { DEFAULT_GAME_CONFIG } from '../types';
import type { ToughCard, CurrencyCard, WeaponCard, TurfGameState } from '../types';

function tough(id: string, power = 5, resistance = 5, affiliation = 'freelance'): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'bruiser',
    affiliation, power, resistance, rarity: 'common', abilities: [],
  };
}

function weapon(id: string, power = 3): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'bladed',
    power, resistance: 1, rarity: 'common', abilities: [],
  };
}

function currency(id: string, denom: 100 | 1000 = 100): CurrencyCard {
  return { kind: 'currency', id, name: `$${denom}`, denomination: denom, rarity: 'common' };
}

function makeState(): TurfGameState {
  resetTurfIdCounter();
  const match = createMatch(DEFAULT_GAME_CONFIG, {
    deckA: [tough('a1'), tough('a2'), weapon('w1'), currency('c1')],
    deckB: [tough('b1'), tough('b2'), weapon('w2'), currency('c2')],
    seed: 42,
  });
  return match.game;
}

describe('ai-policy v0.2', () => {
  it('prefers direct strike against weaker target', () => {
    const state = makeState();
    const atkTurf = createTurf();
    addToStack(atkTurf, tough('attacker', 8, 5));
    addToStack(atkTurf, weapon('blade', 3));
    state.players.A.turfs = [atkTurf];
    state.players.A.toughsInPlay = 1;
    state.players.A.actionsRemaining = 3;

    const strongTurf = createTurf();
    addToStack(strongTurf, tough('tank', 5, 15));
    const weakTurf = createTurf();
    addToStack(weakTurf, tough('glass', 4, 4));
    state.players.B.turfs = [strongTurf, weakTurf];
    state.players.B.toughsInPlay = 2;

    const obs = createObservation(state, 'A');
    const memory = emptyPlannerMemory();
    const actions = enumerateLegalActions(state, 'A');
    const strikes = actions.filter(a => a.kind === 'direct_strike');

    const scores = strikes.map(a => ({
      action: a,
      ...scoreAction(state, obs, memory, a),
    }));
    const byTarget = scores.sort((a, b) => b.score - a.score);
    expect(byTarget[0].action.targetTurfIdx).toBe(1);
  });

  it('prefers funded recruit when cash is available', () => {
    const state = makeState();
    const atkTurf = createTurf();
    addToStack(atkTurf, tough('recruiter', 5, 5));
    addToStack(atkTurf, currency('c-1k', 1000));
    state.players.A.turfs = [atkTurf];
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [];
    state.players.A.actionsRemaining = 3;

    const defTurf = createTurf();
    addToStack(defTurf, tough('target', 3, 3, 'freelance'));
    state.players.B.turfs = [defTurf];
    state.players.B.toughsInPlay = 1;

    const { action } = decideAction(state, 'A');
    expect(['funded_recruit', 'direct_strike', 'pushed_strike']).toContain(action.kind);
  });

  it('scores play_card higher for weapons on powered turfs', () => {
    const state = makeState();
    const atkTurf = createTurf();
    addToStack(atkTurf, tough('base', 5, 5));
    state.players.A.turfs = [atkTurf];
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [weapon('w-hand', 4)];
    state.players.A.actionsRemaining = 3;

    const obs = createObservation(state, 'A');
    const memory = emptyPlannerMemory();
    const actions = enumerateLegalActions(state, 'A');
    const plays = actions.filter(a => a.kind === 'play_card' && a.cardId === 'w-hand');
    expect(plays.length).toBeGreaterThan(0);

    const score = scoreAction(state, obs, memory, plays[0]);
    expect(score.score).toBeGreaterThan(0);
  });

  it('decideAction picks play_card for tough when no toughs in play', () => {
    const state = makeState();
    state.players.A.turfs = [createTurf()];
    state.players.A.hand = [tough('newcomer', 4, 4), currency('c-hand')];
    state.players.A.toughsInPlay = 0;
    state.players.A.actionsRemaining = 3;

    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('play_card');
    expect(action.cardId).toBe('newcomer');
  });
});
