import { describe, expect, it } from 'vitest';
import type { Card, ToughCard, WeaponCard, DrugCard, CurrencyCard, TurfGameState } from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';
import { stepAction, emptyMetrics, emptyPlannerMemory } from '../environment';
import { enumerateLegalActions, playerHasToughInPlay, isModifierCard } from '../env-query';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { createRng } from '../../cards/rng';

function tough(id: string, power = 4, resistance = 4): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'brawler',
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

/**
 * Build a minimal game state. v0.2 is handless — the single-slot `pending`
 * field replaces the hand. Tests assert via `pending` plus `play_card`.
 */
function makeState(pending: Card | null, turfCards: Card[][] = [[]]): TurfGameState {
  resetTurfIdCounter();
  const turfs = turfCards.map(cards => {
    const t = createTurf();
    for (const c of cards) addToStack(t, c);
    return t;
  });
  const toughsInPlay = turfs.reduce(
    (sum, t) => sum + t.stack.filter(sc => sc.card.kind === 'tough').length, 0,
  );
  return {
    config: { ...DEFAULT_GAME_CONFIG },
    players: {
      A: { turfs, deck: [], discard: [], toughsInPlay, actionsRemaining: 5, pending, queued: [], turnEnded: false },
      B: { turfs: [createTurf()], deck: [], discard: [], toughsInPlay: 0, actionsRemaining: 5, pending: null, queued: [], turnEnded: false },
    },
    firstPlayer: 'A', turnNumber: 1, phase: 'action',
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
    const state = makeState(null);
    expect(playerHasToughInPlay(state.players.A)).toBe(false);
  });

  it('true when any turf has a tough', () => {
    const state = makeState(null, [[tough('t1')]]);
    expect(playerHasToughInPlay(state.players.A)).toBe(true);
  });
});

describe('placement-rule enforcement in stepAction', () => {
  it('allows playing a tough with no toughs in play', () => {
    const state = makeState(tough('t1'));
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 't1' });
    }).not.toThrow();
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
  });

  it('rejects weapon when target turf is empty (placement rule)', () => {
    const state = makeState(weapon('w1'));
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });
    }).toThrow(/modifier/);
  });

  it('rejects drug when target turf is empty', () => {
    const state = makeState(drug('d1'));
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'd1' });
    }).toThrow(/modifier/);
  });

  it('rejects currency when target turf is empty', () => {
    const state = makeState(currency('c1'));
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'c1' });
    }).toThrow(/modifier/);
  });

  it('allows weapon onto a turf that has a tough', () => {
    const state = makeState(weapon('w1'), [[tough('t1')]]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });
    }).not.toThrow();
  });

  it('rejects modifier on empty turf even when toughs exist elsewhere', () => {
    const state = makeState(weapon('w1'), [[tough('t1')], []]);
    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 1, cardId: 'w1' });
    }).toThrow(/modifier/);
  });
});

describe('placement rules in enumerateLegalActions', () => {
  it('excludes modifier play_card when no turf has a tough', () => {
    const state = makeState(weapon('w1'));
    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');
    expect(playActions).toHaveLength(0);
  });

  it('includes tough play_card even when no toughs in play', () => {
    const state = makeState(tough('t1'));
    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');
    expect(playActions.length).toBeGreaterThan(0);
  });

  it('includes modifier play_card once tough is on a turf', () => {
    const state = makeState(weapon('w1'), [[tough('t1')]]);
    const actions = enumerateLegalActions(state, 'A');
    const playWeapon = actions.filter(a => a.kind === 'play_card' && a.cardId === 'w1');
    expect(playWeapon.length).toBeGreaterThan(0);
  });

  it('modifier play_card only targets turfs that have toughs', () => {
    const state = makeState(weapon('w1'), [[tough('t1')], []]);
    const actions = enumerateLegalActions(state, 'A');
    const playWeapon = actions.filter(a => a.kind === 'play_card' && a.cardId === 'w1');
    expect(playWeapon.every(a => a.turfIdx === 0)).toBe(true);
  });
});
