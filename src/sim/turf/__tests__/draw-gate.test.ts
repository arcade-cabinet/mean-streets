import { describe, expect, it } from 'vitest';
import type { Card, ToughCard, WeaponCard, DrugCard, CurrencyCard, TurfGameState } from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';
import { stepAction, emptyMetrics, emptyPlannerMemory } from '../environment';
import { enumerateLegalActions, playerHasToughInPlay, isModifierCard } from '../env-query';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { createRng } from '../../cards/rng';

function tough(id: string, power = 4, resistance = 4): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'bruiser',
    affiliation: 'freelance', power, resistance, rarity: 'common', abilities: [],
  };
}

function weapon(id: string): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'bladed',
    power: 3, resistance: 1, rarity: 'common', abilities: [],
  };
}

function drug(id: string): DrugCard {
  return {
    kind: 'drug', id, name: id, category: 'stimulant',
    power: 2, resistance: 1, rarity: 'common', abilities: [],
  };
}

function currency(id: string): CurrencyCard {
  return { kind: 'currency', id, name: '$100', denomination: 100, rarity: 'common' };
}

function makeState(handCards: Card[], turfCards: Card[][] = [[]]): TurfGameState {
  resetTurfIdCounter();
  const turfs = turfCards.map(cards => {
    const t = createTurf();
    for (const c of cards) addToStack(t, c);
    return t;
  });
  const toughsInPlay = turfs.reduce(
    (sum, t) => sum + t.stack.filter(c => c.kind === 'tough').length, 0,
  );
  return {
    config: { ...DEFAULT_GAME_CONFIG },
    players: {
      A: { turfs, hand: [...handCards], deck: [], discard: [], toughsInPlay, actionsRemaining: 5 },
      B: { turfs: [createTurf()], hand: [], deck: [], discard: [], toughsInPlay: 0, actionsRemaining: 5 },
    },
    turnSide: 'A', firstPlayer: 'A', turnNumber: 1, phase: 'combat',
    hasStruck: { A: false, B: false },
    aiState: { A: 'idle', B: 'idle' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [], policySamples: [],
    rng: createRng(42), seed: 42,
    winner: null, endReason: null, metrics: emptyMetrics(),
  };
}

describe('isModifierCard', () => {
  it('weapon is a modifier', () => expect(isModifierCard(weapon('w1'))).toBe(true));
  it('drug is a modifier', () => expect(isModifierCard(drug('d1'))).toBe(true));
  it('currency is a modifier', () => expect(isModifierCard(currency('c1'))).toBe(true));
  it('tough is NOT a modifier', () => expect(isModifierCard(tough('t1'))).toBe(false));
});

describe('playerHasToughInPlay', () => {
  it('false when all turfs empty', () => {
    const state = makeState([]);
    expect(playerHasToughInPlay(state.players.A)).toBe(false);
  });

  it('true when any turf has a tough', () => {
    const state = makeState([], [[tough('t1')]]);
    expect(playerHasToughInPlay(state.players.A)).toBe(true);
  });
});

describe('draw-gate enforcement in stepAction', () => {
  it('allows playing a tough with no toughs in play', () => {
    const state = makeState([tough('t1')]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 't1' });
    }).not.toThrow();
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
  });

  it('rejects weapon when no toughs in play', () => {
    const state = makeState([weapon('w1')]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });
    }).toThrow('Draw-gate');
  });

  it('rejects drug when no toughs in play', () => {
    const state = makeState([drug('d1')]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'd1' });
    }).toThrow('Draw-gate');
  });

  it('rejects currency when no toughs in play', () => {
    const state = makeState([currency('c1')]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'c1' });
    }).toThrow('Draw-gate');
  });

  it('allows weapon when tough already on turf', () => {
    const state = makeState([weapon('w1')], [[tough('t1')]]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });
    }).not.toThrow();
  });

  it('rejects modifier on empty turf even when toughs exist elsewhere', () => {
    const state = makeState([weapon('w1')], [[tough('t1')], []]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 1, cardId: 'w1' });
    }).toThrow('Cannot play modifier on empty turf');
  });
});

describe('draw-gate enforcement in enumerateLegalActions', () => {
  it('excludes modifier play_card when no toughs in play', () => {
    const state = makeState([weapon('w1'), drug('d1'), currency('c1')]);
    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');
    expect(playActions).toHaveLength(0);
  });

  it('includes tough play_card when no toughs in play', () => {
    const state = makeState([tough('t1')]);
    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');
    expect(playActions.length).toBeGreaterThan(0);
  });

  it('includes modifier play_card once tough is on a turf', () => {
    const state = makeState([weapon('w1')], [[tough('t1')]]);
    const actions = enumerateLegalActions(state, 'A');
    const playWeapon = actions.filter(a => a.kind === 'play_card' && a.cardId === 'w1');
    expect(playWeapon.length).toBeGreaterThan(0);
  });

  it('modifier play_card only targets turfs that have toughs', () => {
    const state = makeState([weapon('w1')], [[tough('t1')], []]);
    const actions = enumerateLegalActions(state, 'A');
    const playWeapon = actions.filter(a => a.kind === 'play_card' && a.cardId === 'w1');
    expect(playWeapon.every(a => a.turfIdx === 0)).toBe(true);
  });
});
