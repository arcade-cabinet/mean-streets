import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { addToStack, createTurf, resetTurfIdCounter } from '../board';
import { emptyMetrics, emptyPlannerMemory, stepAction } from '../environment';
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

describe('retreat action — flip semantics', () => {
  it('swaps the chosen face-up card with the current top and flips both face-up', () => {
    const state = mkState();
    const turf = state.players.A.turfs[0];
    addToStack(turf, tough('base'));
    addToStack(turf, tough('top'));
    // Pre-condition: base (idx 0) must be face-up to be retreat-eligible.
    turf.stack[0].faceUp = true;

    stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 0 });

    // Stack: [top, base] — `top` is pushed down to idx 0, `base` rises.
    expect(turf.stack[1].card.id).toBe('base');
    expect(turf.stack[0].card.id).toBe('top');
    // Both permanently face-up after retreat.
    expect(turf.stack[0].faceUp).toBe(true);
    expect(turf.stack[1].faceUp).toBe(true);
    expect(state.metrics.retreats).toBe(1);
  });

  it('rejects retreat to the current top (same index as stack length - 1)', () => {
    const state = mkState();
    const turf = state.players.A.turfs[0];
    addToStack(turf, tough('a'));
    addToStack(turf, tough('b'));
    turf.stack[0].faceUp = true;

    expect(() =>
      stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 1 }),
    ).toThrow(/retreat/);
  });

  it('throws on empty turf', () => {
    const state = mkState();
    expect(() =>
      stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 0 }),
    ).toThrow(/empty/);
  });

  it('throws on out-of-range stackIdx', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('only'));
    expect(() =>
      stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 5 }),
    ).toThrow(/out of range/);
  });
});

describe('retreat — face-up permanence', () => {
  it('once flipped face-up, the card stays face-up through subsequent operations', () => {
    const state = mkState();
    const turf = state.players.A.turfs[0];
    addToStack(turf, tough('anchor'));
    addToStack(turf, tough('middle'));
    addToStack(turf, tough('top'));
    turf.stack[0].faceUp = true;
    turf.stack[1].faceUp = true;

    stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 0 });

    // Retreat flipped anchor+top face-up; middle remains whatever it was.
    expect(turf.stack.every(sc => sc.faceUp || sc.card.id === 'middle')).toBe(true);
  });
});

describe('retreat — no cap on number of retreats per turn', () => {
  it('multiple retreats on the same turf are all accepted (only limited by actions)', () => {
    const state = mkState();
    const turf = state.players.A.turfs[0];
    addToStack(turf, tough('a'));
    addToStack(turf, tough('b'));
    addToStack(turf, tough('c'));
    turf.stack[0].faceUp = true;
    turf.stack[1].faceUp = true;

    stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 0 });
    stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 1 });

    expect(state.metrics.retreats).toBe(2);
    expect(state.players.A.actionsRemaining).toBe(3);
  });
});

describe('retreat — modifiers remain attached to moved tough', () => {
  it('swapping toughs leaves weapon in place (modifiers don\'t migrate on retreat)', () => {
    const state = mkState();
    const turf = state.players.A.turfs[0];
    addToStack(turf, tough('anchor'));
    addToStack(turf, weapon('anchor-mod'));
    addToStack(turf, tough('top'));
    turf.stack[0].faceUp = true;
    turf.stack[1].faceUp = true;

    stepAction(state, { kind: 'retreat', side: 'A', turfIdx: 0, stackIdx: 0 });

    // The weapon stays wherever it was (idx 1). Retreat only swaps the
    // two chosen slots; mods under them are not re-parented.
    expect(turf.stack[1].card.id).toBe('anchor-mod');
  });
});
