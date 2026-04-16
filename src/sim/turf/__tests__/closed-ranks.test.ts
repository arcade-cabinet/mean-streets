import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { addToStack, createTurf, resetTurfIdCounter } from '../board';
import { emptyMetrics, emptyPlannerMemory, stepAction } from '../environment';
import { enumerateLegalActions } from '../env-query';
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
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'brawler',
    affiliation: 'freelance',
    power,
    resistance,
    rarity: 'common',
    abilities: [],
    maxHp: resistance,
    hp: resistance,
  };
}

function weapon(id: string): WeaponCard {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'bladed',
    power: 2,
    resistance: 1,
    rarity: 'common',
    abilities: [],
  };
}

function makePlayer(
  turfsCount: number,
  pending: Card | null = null,
): PlayerState {
  const turfs = [];
  for (let i = 0; i < turfsCount; i++) turfs.push(createTurf());
  return {
    turfs,
    deck: [],
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: 5,
    pending,
    queued: [],
    turnEnded: false,
  };
}

function mkState(): TurfGameState {
  resetTurfIdCounter();
  return {
    config: { ...DEFAULT_GAME_CONFIG },
    players: { A: makePlayer(2), B: makePlayer(2) },
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
  };
}

describe('closed ranks — end-of-turn flipping', () => {
  it('turf with no active tough flips to closedRanks=true on end_turn', () => {
    const state = mkState();
    stepAction(state, { kind: 'end_turn', side: 'A' });
    // Both empty-stack turfs are now in closed ranks.
    expect(state.players.A.turfs.every((t) => t.closedRanks)).toBe(true);
  });

  it('turf with a living tough is NOT in closed ranks', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('anchor'));
    state.players.A.toughsInPlay = 1;
    stepAction(state, { kind: 'end_turn', side: 'A' });
    expect(state.players.A.turfs[0].closedRanks).toBe(false);
    expect(state.players.A.turfs[1].closedRanks).toBe(true);
  });

  it('modifier-on-top at end-of-turn is popped into discard', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('anchor'));
    addToStack(state.players.A.turfs[0], weapon('stranded'));
    state.players.A.toughsInPlay = 1;

    stepAction(state, { kind: 'end_turn', side: 'A' });

    // The modifier popped; only the tough remains on top.
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
    expect(state.players.A.turfs[0].stack[0].card.id).toBe('anchor');
    expect(state.players.A.discard.some((c) => c.id === 'stranded')).toBe(true);
  });

  it('closedRanksEnds metric increments per transition into closed ranks', () => {
    const state = mkState();
    stepAction(state, { kind: 'end_turn', side: 'A' });
    expect(state.metrics.closedRanksEnds).toBe(2); // both turfs transitioned
  });

  it('re-closing an already-closed-ranks turf does not double-count', () => {
    const state = mkState();
    // Force turf 0 to already be in closed ranks.
    state.players.A.turfs[0].closedRanks = true;
    stepAction(state, { kind: 'end_turn', side: 'A' });
    // Only the non-closed turf transitions into closed ranks.
    expect(state.metrics.closedRanksEnds).toBe(1);
  });
});

describe('closed ranks — offensive restriction', () => {
  it('closed-rank turf cannot queue a strike (enumerateLegalActions excludes it)', () => {
    const state = mkState();
    // A has only one closed-ranks turf. B has a living tough.
    state.players.A.turfs = [createTurf()];
    state.players.A.turfs[0].closedRanks = true;
    // Give A a "tough" in the closed turf to isolate the closed-ranks gate.
    addToStack(state.players.A.turfs[0], tough('lurker'));
    state.players.A.toughsInPlay = 1;

    addToStack(state.players.B.turfs[0], tough('target'));
    state.players.B.toughsInPlay = 1;

    const actions = enumerateLegalActions(state, 'A');
    const strikes = actions.filter(
      (a) => a.kind === 'direct_strike' && a.turfIdx === 0,
    );
    // Even though there's a tough on the turf, closedRanks gates offense.
    expect(strikes).toHaveLength(0);
  });

  it('open-ranks turf CAN queue a strike', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('striker'));
    state.players.A.toughsInPlay = 1;
    state.players.A.turfs[0].closedRanks = false;
    addToStack(state.players.B.turfs[0], tough('target'));
    state.players.B.toughsInPlay = 1;

    const actions = enumerateLegalActions(state, 'A');
    const strikes = actions.filter(
      (a) => a.kind === 'direct_strike' && a.turfIdx === 0,
    );
    expect(strikes.length).toBeGreaterThan(0);
  });
});
