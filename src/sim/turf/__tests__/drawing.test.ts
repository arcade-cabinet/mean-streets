import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { addToStack, createTurf, resetTurfIdCounter } from '../board';
import { emptyMetrics, emptyPlannerMemory, stepAction } from '../environment';
import { resolvePhase } from '../resolve';
import { DEFAULT_GAME_CONFIG } from '../types';
import type {
  Card,
  PlayerState,
  ToughCard,
  TurfGameState,
  WeaponCard,
} from '../types';

function tough(id: string, power = 4, resistance = 4): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'brawler',
    affiliation: 'freelance', power, resistance, rarity: 'common', abilities: [],
  };
}

function weapon(id: string): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'bladed',
    power: 2, resistance: 1, rarity: 'common', abilities: [],
  };
}

function makePlayer(turfsCount: number, pending: Card | null = null): PlayerState {
  const turfs = [];
  for (let i = 0; i < turfsCount; i++) turfs.push(createTurf());
  return {
    turfs, deck: [], discard: [], toughsInPlay: 0,
    actionsRemaining: 5, pending, queued: [], turnEnded: false,
  };
}

function mkState(): TurfGameState {
  resetTurfIdCounter();
  return {
    config: { ...DEFAULT_GAME_CONFIG },
    players: { A: makePlayer(2), B: makePlayer(2) },
    firstPlayer: 'A', turnNumber: 1, phase: 'action',
    aiState: { A: 'idle', B: 'idle' }, aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [], policySamples: [],
    rng: createRng(42), seed: 42, winner: null, endReason: null,
    metrics: emptyMetrics(),
  };
}

describe('drawing as an action', () => {
  it('draw moves a card from deck top to pending slot', () => {
    const state = mkState();
    state.players.A.deck = [tough('d1'), tough('d2')];

    stepAction(state, { kind: 'draw', side: 'A' });

    expect(state.players.A.pending?.id).toBe('d1');
    expect(state.players.A.deck.map(c => c.id)).toEqual(['d2']);
  });

  it('draw costs exactly one action', () => {
    const state = mkState();
    state.players.A.deck = [tough('d1')];
    const before = state.players.A.actionsRemaining;

    stepAction(state, { kind: 'draw', side: 'A' });

    expect(state.players.A.actionsRemaining).toBe(before - 1);
  });

  it('draw increments the draws metric', () => {
    const state = mkState();
    state.players.A.deck = [tough('d1')];
    stepAction(state, { kind: 'draw', side: 'A' });
    expect(state.metrics.draws).toBe(1);
  });

  it('throws when pending slot already occupied', () => {
    const state = mkState();
    state.players.A.pending = tough('already');
    state.players.A.deck = [tough('d1')];

    expect(() =>
      stepAction(state, { kind: 'draw', side: 'A' }),
    ).toThrow(/pending/);
  });

  it('throws when deck is empty', () => {
    const state = mkState();
    expect(() =>
      stepAction(state, { kind: 'draw', side: 'A' }),
    ).toThrow(/empty/);
  });
});

describe('pending-slot placement lifecycle', () => {
  it('playing a card from pending clears the pending slot', () => {
    const state = mkState();
    state.players.A.pending = tough('t1');

    stepAction(state, {
      kind: 'play_card', side: 'A', turfIdx: 0, cardId: 't1',
    });

    expect(state.players.A.pending).toBeNull();
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
  });

  it('discarding the pending slot clears it without cost', () => {
    const state = mkState();
    state.players.A.pending = weapon('burn');
    const before = state.players.A.actionsRemaining;

    stepAction(state, { kind: 'discard', side: 'A', cardId: 'burn' });

    expect(state.players.A.pending).toBeNull();
    expect(state.players.A.actionsRemaining).toBe(before);
    expect(state.players.A.discard.some(c => c.id === 'burn')).toBe(true);
  });

  it('a stuck modifier in pending at resolve time is discarded — not returned', () => {
    const state = mkState();
    // No toughs anywhere → modifier cannot be placed legally.
    state.players.A.pending = weapon('orphan');
    state.players.A.turnEnded = true;
    state.players.B.turnEnded = true;

    resolvePhase(state);

    expect(state.players.A.pending).toBeNull();
    expect(state.players.A.discard.some(c => c.id === 'orphan')).toBe(true);
    // Critically: the card is NOT back on the deck.
    expect(state.players.A.deck.some(c => c.id === 'orphan')).toBe(false);
  });

  it('a tough in pending at resolve is also discarded (can\'t be held)', () => {
    const state = mkState();
    state.players.A.pending = tough('held-over');
    state.players.A.turnEnded = true;
    state.players.B.turnEnded = true;

    resolvePhase(state);

    expect(state.players.A.pending).toBeNull();
    expect(state.players.A.discard.some(c => c.id === 'held-over')).toBe(true);
  });
});
