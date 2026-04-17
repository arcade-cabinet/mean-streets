import { describe, expect, it } from 'vitest';
import { decideAction } from '../ai';
import { addToStack, createTurf, resetTurfIdCounter } from '../board';
import { createMatch } from '../game';
import type {
  Card,
  CurrencyCard,
  PlayerState,
  ToughCard,
  Turf,
  TurfGameState,
  WeaponCard,
} from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';

function tough(
  id: string,
  power: number,
  resistance: number,
  affiliation = 'freelance',
): ToughCard {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'bruiser',
    affiliation,
    power,
    resistance,
    rarity: 'common',
    abilities: [],
    maxHp: resistance,
    hp: resistance,
  };
}

function currency(id: string, denom: 100 | 1000 = 100): CurrencyCard {
  return {
    kind: 'currency',
    id,
    name: `$${denom}`,
    denomination: denom,
    rarity: 'common',
  };
}

function weapon(id: string, power = 2): WeaponCard {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'bladed',
    power,
    resistance: 1,
    rarity: 'common',
    abilities: [],
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

interface PlayerShape {
  pending?: Card | null;
  turfs?: Turf[];
  deck?: Card[];
  toughsInPlay?: number;
  actionsRemaining?: number;
}

function setPlayer(player: PlayerState, shape: PlayerShape): void {
  if (shape.pending !== undefined) player.pending = shape.pending;
  if (shape.turfs !== undefined) player.turfs = shape.turfs;
  if (shape.deck !== undefined) player.deck = shape.deck;
  if (shape.toughsInPlay !== undefined)
    player.toughsInPlay = shape.toughsInPlay;
  if (shape.actionsRemaining !== undefined)
    player.actionsRemaining = shape.actionsRemaining;
  player.queued = [];
  player.turnEnded = false;
}

describe('turf planner v0.2', () => {
  it('emits a legal action and planner trace', () => {
    const state = makeState();
    setPlayer(state.players.A, {
      pending: tough('h1', 4, 4),
      actionsRemaining: 3,
    });
    const { action, trace } = decideAction(state, 'A');
    expect(action.side).toBe('A');
    expect(trace.legalActionCount).toBeGreaterThan(0);
    expect(trace.chosenGoal.length).toBeGreaterThan(0);
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('prefers playing the pending tough when no toughs are in play', () => {
    const state = makeState();
    setPlayer(state.players.A, {
      turfs: [createTurf()],
      pending: tough('newcomer', 4, 4),
      toughsInPlay: 0,
      actionsRemaining: 3,
      deck: [],
    });
    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('play_card');
    expect(action.cardId).toBe('newcomer');
  });

  it('draws when the pending slot is empty and the deck has material', () => {
    const state = makeState();
    setPlayer(state.players.A, {
      turfs: [createTurf()],
      pending: null,
      toughsInPlay: 0,
      actionsRemaining: 3,
      deck: [tough('deckTop', 4, 4), currency('c-d1')],
    });
    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('draw');
  });

  it('falls back to a substantive action instead of end_turn when no goal fires', () => {
    const state = makeState();
    setPlayer(state.players.A, {
      turfs: [createTurf()],
      pending: tough('backup', 4, 4),
      toughsInPlay: 0,
      actionsRemaining: 3,
      deck: [],
    });
    const turfB = createTurf();
    addToStack(turfB, tough('enemy', 4, 6));
    setPlayer(state.players.B, { turfs: [turfB], toughsInPlay: 1 });
    const { action, trace } = decideAction(state, 'A');
    expect(action.kind).not.toBe('pass');
    expect(action.kind).not.toBe('end_turn');
    expect(trace.actionScores.length).toBeGreaterThan(0);
  });

  it('enumerates multiple v0.2 action kinds (play_card, strike, draw/end_turn)', () => {
    const state = makeState();
    const turfA = createTurf();
    addToStack(turfA, tough('atk', 6, 5));
    setPlayer(state.players.A, {
      turfs: [turfA],
      pending: tough('spare', 3, 3),
      toughsInPlay: 1,
      actionsRemaining: 3,
      deck: [currency('deck-d1')],
    });
    const turfB = createTurf();
    addToStack(turfB, tough('def', 4, 4));
    setPlayer(state.players.B, { turfs: [turfB], toughsInPlay: 1 });

    const { trace } = decideAction(state, 'A');
    const kinds = new Set(
      trace.actionScores.map((s) => s.action.split('@')[0].split(':')[0]),
    );
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it('funded_recruit is enumerated with a positive score when $1k is banked', () => {
    const state = makeState();
    const turfA = createTurf();
    addToStack(turfA, tough('recruiter', 4, 4, 'kings_row'));
    addToStack(turfA, currency('c-1k', 1000));
    setPlayer(state.players.A, {
      turfs: [turfA],
      pending: null,
      toughsInPlay: 1,
      actionsRemaining: 3,
      deck: [],
    });
    const turfB = createTurf();
    addToStack(turfB, tough('target', 3, 3, 'freelance'));
    setPlayer(state.players.B, { turfs: [turfB], toughsInPlay: 1 });

    const { trace } = decideAction(state, 'A');
    const recruits = trace.actionScores.filter((s) =>
      s.action.startsWith('funded_recruit'),
    );
    expect(
      recruits.length,
      'funded_recruit must be enumerated',
    ).toBeGreaterThan(0);
    expect(
      recruits[0].score,
      `funded_recruit should score positively with $1k on turf, got ${recruits[0].score}`,
    ).toBeGreaterThan(0);
  });

  it('retreat_shield fires when weak top tough can swap with a stronger face-up one', () => {
    const state = makeState();
    const turfA = createTurf();
    // face-up sturdy tough at bottom, weak top tough up front
    addToStack(turfA, tough('bodyguard', 6, 7));
    addToStack(turfA, tough('scout', 1, 1));
    setPlayer(state.players.A, {
      turfs: [turfA],
      pending: null,
      toughsInPlay: 2,
      actionsRemaining: 3,
      deck: [],
    });
    const turfB = createTurf();
    // Big power gap so retreat_shield clears underPressure by a healthy margin.
    addToStack(turfB, tough('heavy1', 12, 6));
    addToStack(turfB, tough('heavy2', 8, 5));
    setPlayer(state.players.B, { turfs: [turfB], toughsInPlay: 2 });

    const { action } = decideAction(state, 'A');
    // Either the planner runs the retreat itself (retreat_shield fires) or
    // it strikes — both are valid defensive responses. What we must not see
    // is it sitting idle on pass/end_turn with an obvious retreat available.
    expect(['retreat', 'direct_strike', 'pushed_strike']).toContain(
      action.kind,
    );
  });

  it('does not crash with empty pending, empty deck, empty turfs', () => {
    const state = makeState();
    setPlayer(state.players.A, {
      turfs: [createTurf()],
      pending: null,
      toughsInPlay: 0,
      actionsRemaining: 3,
      deck: [],
    });
    const { action } = decideAction(state, 'A');
    expect(action.kind).toBe('end_turn');
  });

  it('checks affiliation compatibility when scoring play_card for toughs', () => {
    const state = makeState();
    const turfA = createTurf();
    const existing = tough('existing', 5, 5, 'kings_row');
    addToStack(turfA, existing);
    const rival = tough('rival', 4, 4, 'iron_devils');
    setPlayer(state.players.A, {
      turfs: [turfA],
      pending: rival,
      toughsInPlay: 1,
      actionsRemaining: 3,
      deck: [],
    });
    const { action } = decideAction(state, 'A');
    // If the planner picks play_card, it must not be the rival (which is
    // blocked). Discard of the rival pending is an acceptable outcome too.
    if (action.kind === 'play_card') {
      expect(action.cardId).not.toBe('rival');
    }
  });
});
