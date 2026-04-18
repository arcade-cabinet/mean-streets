import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../types';
import type { Card, GameConfig, PlayerState, TurfGameState } from '../types';
import {
  actionsForTurn,
  emptyMetrics,
  emptyPlannerMemory,
  stepAction,
} from '../environment';
import { createObservation, enumerateLegalActions } from '../env-query';
import { createTurf, addToStack, resetTurfIdCounter } from '../board';
import { createRng } from '../../cards/rng';
import type { ToughCard, WeaponCard, DrugCard, CurrencyCard } from '../types';

function tough(
  id: string,
  power = 4,
  resistance = 4,
  affiliation = 'freelance',
): ToughCard {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'brawler',
    affiliation,
    power,
    resistance,
    rarity: 'common',
    abilities: [],
    maxHp: resistance,
    hp: resistance,
  };
}

function weapon(id: string, power = 3): WeaponCard {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'ranged',
    power,
    resistance: 2,
    rarity: 'common',
    abilities: [],
  };
}

function drug(id: string): DrugCard {
  return {
    kind: 'drug',
    id,
    name: id,
    category: 'stimulant',
    power: 2,
    resistance: 2,
    rarity: 'common',
    abilities: [],
  };
}

function currency(id: string, denomination: 100 | 1000 = 100): CurrencyCard {
  return { kind: 'currency', id, name: id, denomination, rarity: 'common' };
}

function makePlayer(turfs: number, pending: Card | null = null): PlayerState {
  const t = [];
  for (let i = 0; i < turfs; i++) t.push(createTurf());
  return {
    turfs: t,
    deck: [],
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: 5,
    pending,
    queued: [],
    turnEnded: false,
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
    firstPlayer: 'A',
    turnNumber: 1,
    phase: 'action',
    aiState: { A: 'idle', B: 'idle' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [],
    policySamples: [],
    rng: createRng(42),
    seed: 42,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
    heat: 0,
    blackMarket: [],
    holding: { A: [], B: [] },
    lockup: { A: [], B: [] },
    mythicPool: [],
    mythicAssignments: {},
    warStats: { seizures: [] },
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
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      actionsPerTurn: 4,
      firstTurnActions: 6,
    };
    expect(actionsForTurn(config, 1)).toBe(6);
    expect(actionsForTurn(config, 3)).toBe(4);
  });
});

describe('stepAction — play_card', () => {
  it('plays a tough onto a turf', () => {
    const state = makeState();
    const t = tough('t1');
    state.players.A.pending = t;

    const result = stepAction(state, {
      kind: 'play_card',
      side: 'A',
      turfIdx: 0,
      cardId: 't1',
    });

    expect(result.reward).toBeGreaterThan(0);
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
    expect(state.players.A.toughsInPlay).toBe(1);
    expect(state.players.A.pending).toBeNull();
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
    state.players.A.pending = w;

    const result = stepAction(state, {
      kind: 'play_card',
      side: 'A',
      turfIdx: 0,
      cardId: 'w1',
    });

    expect(result.reward).toBeGreaterThan(0);
    expect(state.players.A.turfs[0].stack).toHaveLength(2);
    expect(state.metrics.modifiersPlayed).toBe(1);
  });

  it('rejects modifier on empty turf (placement rule)', () => {
    const state = makeState();
    state.players.A.pending = weapon('w1');

    expect(() => {
      stepAction(state, {
        kind: 'play_card',
        side: 'A',
        turfIdx: 0,
        cardId: 'w1',
      });
    }).toThrow(/modifier/);
  });

  it('a failed play_card does not consume the card (atomicity)', () => {
    const state = makeState();
    state.players.A.pending = weapon('w1');
    state.players.A.toughsInPlay = 0;

    expect(() =>
      stepAction(state, {
        kind: 'play_card',
        side: 'A',
        turfIdx: 0,
        cardId: 'w1',
      }),
    ).toThrow(/modifier/);

    expect(state.players.A.pending?.id).toBe('w1');
  });

  it('rejects modifier on empty turf even if toughs exist elsewhere', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('t1'));
    state.players.A.toughsInPlay = 1;
    state.players.A.pending = weapon('w1');

    expect(() => {
      stepAction(state, {
        kind: 'play_card',
        side: 'A',
        turfIdx: 1,
        cardId: 'w1',
      });
    }).toThrow(/modifier/);
  });

  it('discards a rival-affiliation tough played onto a turf with no buffer (RULES.md §4)', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('kr', 4, 4, 'kings_row'));
    state.players.A.toughsInPlay = 1;
    state.players.A.pending = tough('id', 5, 5, 'iron_devils');

    const result = stepAction(state, {
      kind: 'play_card',
      side: 'A',
      turfIdx: 0,
      cardId: 'id',
    });

    expect(result.reason).toBe('play_card_discarded_rival');
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
    expect(state.players.A.turfs[0].stack[0].card.id).toBe('kr');
    expect(state.players.A.pending).toBeNull();
    expect(state.metrics.cardsDiscarded).toBe(1);
    expect(state.metrics.cardsPlayed).toBe(0);
    expect(state.metrics.toughsPlayed).toBe(0);
  });

  it('accepts a rival-affiliation tough when a currency buffer is present', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('kr', 4, 4, 'kings_row'));
    addToStack(state.players.A.turfs[0], {
      kind: 'currency',
      id: 'c1',
      name: '$1000',
      denomination: 1000,
      rarity: 'common',
    });
    state.players.A.toughsInPlay = 1;
    state.players.A.pending = tough('id', 5, 5, 'iron_devils');

    const result = stepAction(state, {
      kind: 'play_card',
      side: 'A',
      turfIdx: 0,
      cardId: 'id',
    });

    expect(result.reason).not.toBe('play_card_discarded_rival');
    expect(state.players.A.turfs[0].stack).toHaveLength(3);
    expect(state.metrics.toughsPlayed).toBe(1);
  });
});

describe('stepAction — discard', () => {
  it('discards pending card for free (no action cost)', () => {
    const state = makeState();
    state.players.A.pending = weapon('w1');
    const before = state.players.A.actionsRemaining;

    const result = stepAction(state, {
      kind: 'discard',
      side: 'A',
      cardId: 'w1',
    });

    expect(state.players.A.actionsRemaining).toBe(before);
    expect(state.players.A.discard).toHaveLength(1);
    expect(state.players.A.pending).toBeNull();
    expect(state.metrics.cardsDiscarded).toBe(1);
    expect(result.reward).toBeLessThanOrEqual(0);
    expect(state.metrics.totalActions).toBe(0);
  });
});

describe('stepAction — end_turn', () => {
  it('marks turnEnded for the side without costing an action', () => {
    const state = makeState();
    state.players.A.actionsRemaining = 3;

    stepAction(state, { kind: 'end_turn', side: 'A' });

    expect(state.players.A.turnEnded).toBe(true);
    expect(state.metrics.totalActions).toBe(0);
  });
});

describe('stepAction — direct_strike (queue)', () => {
  it('queues a direct strike instead of resolving immediately', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('attacker', 10, 5));
    state.players.A.toughsInPlay = 1;
    addToStack(state.players.B.turfs[0], tough('defender', 3, 5));
    state.players.B.toughsInPlay = 1;

    const result = stepAction(state, {
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    expect(result.reason).toBe('direct_strike_queued');
    expect(state.players.A.queued).toHaveLength(1);
    expect(state.players.A.queued[0].kind).toBe('direct_strike');
  });
});

describe('stepAction — funded_recruit (queue)', () => {
  it('queues a funded recruit action', () => {
    const state = makeState();
    addToStack(state.players.A.turfs[0], tough('attacker', 5, 5));
    state.players.A.toughsInPlay = 1;
    for (let i = 0; i < 10; i++) {
      addToStack(state.players.A.turfs[0], currency(`c${i}`));
    }
    addToStack(state.players.B.turfs[0], tough('target', 3, 2));
    state.players.B.toughsInPlay = 1;

    const result = stepAction(state, {
      kind: 'funded_recruit',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    expect(result.reason).toBe('funded_recruit_queued');
    expect(state.players.A.queued).toHaveLength(1);
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
  it('declares winner via resolve phase when opponent has 0 turfs', () => {
    const state = makeState();
    state.players.B = makePlayer(1);
    addToStack(state.players.A.turfs[0], tough('a', 20, 5));
    state.players.A.toughsInPlay = 1;
    addToStack(state.players.B.turfs[0], tough('d', 1, 1));
    state.players.B.toughsInPlay = 1;

    // Queue a strike, end both turns, expect resolve phase to seize and win.
    stepAction(state, {
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });
    stepAction(state, { kind: 'end_turn', side: 'A' });
    stepAction(state, { kind: 'end_turn', side: 'B' });

    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('total_seizure');
  });
});

describe('stepAction — draw', () => {
  it('moves top of deck into pending slot', () => {
    const state = makeState();
    state.players.A.deck = [tough('d1'), weapon('d2')];

    stepAction(state, { kind: 'draw', side: 'A' });

    expect(state.players.A.pending?.id).toBe('d1');
    expect(state.players.A.deck).toHaveLength(1);
    expect(state.metrics.draws).toBe(1);
  });

  it('auto-sends modifier to market when no tough on turf', () => {
    const state = makeState();
    state.players.A.deck = [weapon('w1')];

    stepAction(state, { kind: 'draw', side: 'A' });

    expect(state.players.A.pending).toBeNull();
    expect(state.blackMarket).toHaveLength(1);
    expect(state.blackMarket[0].id).toBe('w1');
  });

  it('costs an action', () => {
    const state = makeState();
    state.players.A.deck = [tough('d1')];
    const before = state.players.A.actionsRemaining;

    stepAction(state, { kind: 'draw', side: 'A' });

    expect(state.players.A.actionsRemaining).toBe(before - 1);
  });

  it('throws if pending slot already occupied', () => {
    const state = makeState();
    state.players.A.pending = tough('already');
    state.players.A.deck = [tough('d1')];

    expect(() => stepAction(state, { kind: 'draw', side: 'A' })).toThrow(
      /pending/,
    );
  });
});

describe('enumerateLegalActions', () => {
  it('excludes modifier play_card when no toughs in play', () => {
    const state = makeState();
    state.players.A.pending = weapon('w1');

    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter((a) => a.kind === 'play_card');

    expect(playActions).toHaveLength(0);
  });

  it('includes tough play_card even when no toughs in play', () => {
    const state = makeState();
    state.players.A.pending = tough('t1');

    const actions = enumerateLegalActions(state, 'A');
    const playActions = actions.filter((a) => a.kind === 'play_card');

    expect(playActions.length).toBeGreaterThan(0);
  });

  it('always includes end_turn as last entry', () => {
    const state = makeState();
    const actions = enumerateLegalActions(state, 'A');

    expect(actions[actions.length - 1].kind).toBe('end_turn');
  });

  it('includes draw when deck is non-empty and pending is null', () => {
    const state = makeState();
    state.players.A.deck = [tough('d1')];

    const actions = enumerateLegalActions(state, 'A');
    expect(actions.some((a) => a.kind === 'draw')).toBe(true);
  });

  // Suppress unused import warnings in our fixture surface.
  it('drug/currency fixtures are well-formed', () => {
    expect(drug('d1').kind).toBe('drug');
    expect(currency('c1').kind).toBe('currency');
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
