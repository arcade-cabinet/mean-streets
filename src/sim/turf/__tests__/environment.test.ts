import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../types';
import type { Card, GameConfig, PlayerState, TurfGameState } from '../types';
import {
  actionsForTurn,
  drawPhase,
  emptyMetrics,
  emptyPlannerMemory,
  stepAction,
} from '../environment';
import {
  createObservation,
  enumerateLegalActions,
} from '../env-query';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { createRng } from '../../cards/rng';
import type { ToughCard, WeaponCard, DrugCard, CurrencyCard } from '../types';

function tough(id: string, power = 4, resistance = 4, affiliation = 'freelance'): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'bruiser',
    affiliation, power, resistance, rarity: 'common', abilities: [],
  };
}

function weapon(id: string, power = 3): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'ranged',
    power, resistance: 2, rarity: 'common', abilities: [],
  };
}

function drug(id: string): DrugCard {
  return {
    kind: 'drug', id, name: id, category: 'stimulant',
    power: 2, resistance: 2, rarity: 'common', abilities: [],
  };
}

function currency(id: string, denomination: 100 | 1000 = 100): CurrencyCard {
  return { kind: 'currency', id, name: id, denomination, rarity: 'common' };
}

function makePlayer(turfs: number, handCards: Card[] = []): PlayerState {
  const t = [];
  for (let i = 0; i < turfs; i++) t.push(createTurf());
  return {
    turfs: t, hand: [...handCards], deck: [], discard: [],
    toughsInPlay: 0, actionsRemaining: 5,
  };
}

function makeState(overrides: Partial<TurfGameState> = {}): TurfGameState {
  resetTurfIdCounter();
  return {
    config: { ...DEFAULT_GAME_CONFIG },
    players: {
      A: makePlayer(2),
      B: makePlayer(2),
    },
    turnSide: 'A',
    firstPlayer: 'A',
    turnNumber: 1,
    phase: 'combat',
    hasStruck: { A: false, B: false },
    aiState: { A: 'BUILDING', B: 'BUILDING' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [],
    policySamples: [],
    rng: createRng(42),
    seed: 42,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
    ...overrides,
  };
}

describe('actionsForTurn', () => {
  it('returns firstTurnActions for turn 1', () => {
    expect(actionsForTurn(DEFAULT_GAME_CONFIG, 1)).toBe(5);
  });

  it('returns actionsPerTurn for turn 2+', () => {
    expect(actionsForTurn(DEFAULT_GAME_CONFIG, 2)).toBe(3);
    expect(actionsForTurn(DEFAULT_GAME_CONFIG, 10)).toBe(3);
  });

  it('respects custom config', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG, actionsPerTurn: 4, firstTurnActions: 6 };
    expect(actionsForTurn(config, 1)).toBe(6);
    expect(actionsForTurn(config, 3)).toBe(4);
  });
});

describe('stepAction — play_card', () => {
  it('plays a tough onto a turf', () => {
    const state = makeState();
    const t = tough('t1');
    state.players.A.hand = [t];

    const result = stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 't1' });

    expect(result.reward).toBe(1);
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
    expect(state.players.A.toughsInPlay).toBe(1);
    expect(state.players.A.hand).toHaveLength(0);
    expect(state.metrics.toughsPlayed).toBe(1);
    expect(state.metrics.cardsPlayed).toBe(1);
    expect(state.players.A.actionsRemaining).toBe(4);
  });

  it('plays a modifier onto a turf with a tough', () => {
    const state = makeState();
    const t = tough('t1');
    const w = weapon('w1');
    addToStack(state.players.A.turfs[0], t);
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [w];

    const result = stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });

    expect(result.reward).toBe(0.75);
    expect(state.players.A.turfs[0].stack).toHaveLength(2);
    expect(state.metrics.modifiersPlayed).toBe(1);
  });

  it('rejects modifier with no toughs in play (draw-gate)', () => {
    const state = makeState();
    state.players.A.hand = [weapon('w1')];

    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' });
    }).toThrow('Draw-gate');
  });

  it('a failed play_card does not consume the card from hand (atomicity)', () => {
    // Regression pin: prior impl removed the card before validating
    // preconditions, leaving the card neither on a turf nor in hand
    // when the validation threw. Now the validation happens first.
    const state = makeState();
    state.players.A.hand = [weapon('w1')];
    state.players.A.toughsInPlay = 0; // draw-gate will fire

    expect(() =>
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'w1' }),
    ).toThrow('Draw-gate');

    // Card is still in hand after the failed action
    expect(state.players.A.hand).toHaveLength(1);
    expect(state.players.A.hand[0].id).toBe('w1');
  });

  it('rejects modifier on empty turf even if toughs exist elsewhere', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('t1'));
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [weapon('w1')];

    expect(() => {
      stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 1, cardId: 'w1' });
    }).toThrow('Cannot play modifier on empty turf');
  });

  it('discards a rival-affiliation tough played onto a turf with no buffer (RULES.md §4)', () => {
    // Turf has a kings_row tough. Playing an iron_devils tough (rival)
    // onto the same turf with no buffer (no currency, no mediator) must
    // discard the incoming card rather than violate the turf rule.
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('kr', 4, 4, 'kings_row'));
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [tough('id', 5, 5, 'iron_devils')];

    const result = stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'id' });

    // Rival discarded — still counts as an action spent, card is not in
    // the stack, metric records a discard (not a play).
    expect(result.reason).toBe('play_card_discarded_rival');
    expect(state.players.A.turfs[0].stack).toHaveLength(1); // only original kr
    expect(state.players.A.turfs[0].stack[0].id).toBe('kr');
    expect(state.players.A.hand).toHaveLength(0);
    expect(state.metrics.cardsDiscarded).toBe(1);
    expect(state.metrics.cardsPlayed).toBe(0);
    expect(state.metrics.toughsPlayed).toBe(0);
  });

  it('accepts a rival-affiliation tough when a currency buffer is present', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('kr', 4, 4, 'kings_row'));
    addToStack(state.players.A.turfs[0], {
      kind: 'currency', id: 'c1', name: '$1000', denomination: 1000, rarity: 'common',
    });
    state.players.A.toughsInPlay = 1;
    state.players.A.hand = [tough('id', 5, 5, 'iron_devils')];

    const result = stepAction(state, { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'id' });

    expect(result.reason).not.toBe('play_card_discarded_rival');
    expect(state.players.A.turfs[0].stack).toHaveLength(3);
    expect(state.metrics.toughsPlayed).toBe(1);
  });
});

describe('stepAction — discard', () => {
  it('discards a card for free (no action cost)', () => {
    const state = makeState();
    state.players.A.hand = [weapon('w1')];

    const result = stepAction(state, { kind: 'discard', side: 'A', cardId: 'w1' });

    expect(state.players.A.actionsRemaining).toBe(5);
    expect(state.players.A.discard).toHaveLength(1);
    expect(state.metrics.cardsDiscarded).toBe(1);
    expect(result.reward).toBe(-0.25);
    expect(state.metrics.totalActions).toBe(0);
  });
});

describe('stepAction — end_turn', () => {
  it('zeroes remaining actions for free', () => {
    const state = makeState();
    state.players.A.actionsRemaining = 3;

    stepAction(state, { kind: 'end_turn', side: 'A' });

    expect(state.players.A.actionsRemaining).toBe(0);
    expect(state.metrics.totalActions).toBe(0);
  });
});

describe('stepAction — direct_strike', () => {
  it('kills when power >= resistance', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('attacker', 10, 5));
    state.players.A.toughsInPlay = 1;
    addToStack(state.players.B.turfs[0], tough('defender', 3, 5));
    state.players.B.toughsInPlay = 1;

    const result = stepAction(state, {
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    expect(result.reason).toContain('kill');
    expect(state.metrics.directStrikes).toBe(1);
    expect(state.metrics.kills).toBe(1);
    expect(state.players.B.toughsInPlay).toBe(0);
  });

  it('seizes turf when last tough killed', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('attacker', 10, 5));
    state.players.A.toughsInPlay = 1;
    addToStack(state.players.B.turfs[0], tough('defender', 3, 5));
    state.players.B.toughsInPlay = 1;

    stepAction(state, {
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    expect(state.metrics.seizures).toBe(1);
    expect(state.players.B.turfs).toHaveLength(1);
  });
});

describe('stepAction — funded_recruit', () => {
  it('recruits when enough cash', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('attacker', 5, 5));
    state.players.A.toughsInPlay = 1;
    for (let i = 0; i < 10; i++) {
      addToStack(state.players.A.turfs[0], currency(`c${i}`));
    }
    addToStack(state.players.B.turfs[0], tough('target', 3, 2));
    state.players.B.toughsInPlay = 1;

    const result = stepAction(state, {
      kind: 'funded_recruit', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    expect(result.reason).toContain('kill');
    expect(state.metrics.fundedRecruits).toBe(1);
    expect(state.players.A.toughsInPlay).toBe(2);
    expect(state.players.B.toughsInPlay).toBe(0);
  });
});

describe('stepAction — pass', () => {
  it('costs an action and records metric', () => {
    const state = makeState();

    stepAction(state, { kind: 'pass', side: 'A' });

    expect(state.players.A.actionsRemaining).toBe(4);
    expect(state.metrics.passes).toBe(1);
    expect(state.metrics.totalActions).toBe(1);
  });
});

describe('win detection', () => {
  it('declares winner when opponent has 0 turfs', () => {
    const state = makeState();
    state.players.B = makePlayer(1);
    addToStack(state.players.A.turfs[0], tough('a', 20, 5));
    state.players.A.toughsInPlay = 1;
    addToStack(state.players.B.turfs[0], tough('d', 1, 1));
    state.players.B.toughsInPlay = 1;

    const result = stepAction(state, {
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    expect(result.terminal).toBe(true);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('total_seizure');
  });
});

describe('drawPhase', () => {
  it('draws one card from deck to hand', () => {
    const state = makeState();
    state.players.A.deck = [tough('d1'), weapon('d2')];

    drawPhase(state, 'A');

    expect(state.players.A.hand).toHaveLength(1);
    expect(state.players.A.deck).toHaveLength(1);
    expect(state.players.A.hand[0].id).toBe('d1');
  });
});

describe('enumerateLegalActions', () => {
  it('excludes modifier play_card when no toughs in play', () => {
    const state = makeState();
    state.players.A.hand = [weapon('w1'), drug('d1'), currency('c1')];

    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');

    expect(playActions).toHaveLength(0);
  });

  it('includes tough play_card even when no toughs in play', () => {
    const state = makeState();
    state.players.A.hand = [tough('t1')];

    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter(a => a.kind === 'play_card');

    expect(playActions.length).toBeGreaterThan(0);
  });

  it('always includes end_turn', () => {
    const state = makeState();
    const actions = enumerateLegalActions(state, 'A');

    expect(actions[actions.length - 1].kind).toBe('end_turn');
  });
});

describe('observation', () => {
  it('builds an observation with correct turf counts', () => {
    const state = makeState();
    const obs = createObservation(state, 'A');

    expect(obs.ownTurfCount).toBe(2);
    expect(obs.opponentTurfCount).toBe(2);
    expect(obs.actionsRemaining).toBe(5);
  });
});
