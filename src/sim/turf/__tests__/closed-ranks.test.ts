import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { addToStack, createTurf, positionResistance, resetTurfIdCounter } from '../board';
import { emptyMetrics, emptyPlannerMemory, stepAction } from '../environment';
import { enumerateLegalActions } from '../env-query';
import { DEFAULT_GAME_CONFIG } from '../types';
import type {
  Card,
  DifficultyTier,
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
    toughsInPlay: 0,
    actionsRemaining: 5,
    pending,
    queued: [],
    turnEnded: false,
  };
}

function mkState(difficulty: DifficultyTier = 'medium'): TurfGameState {
  resetTurfIdCounter();
  return {
    config: { ...DEFAULT_GAME_CONFIG, difficulty },
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

describe('closed ranks — end-of-turn flipping (RULES §8.5)', () => {
  it('turf with a living tough on top sets closedRanks=true on end_turn', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('anchor'));
    state.players.A.toughsInPlay = 1;
    stepAction(state, { kind: 'end_turn', side: 'A' });
    expect(state.players.A.turfs[0].closedRanks).toBe(true);
  });

  it('empty-stack turf is NOT in closed ranks after end_turn', () => {
    const state = mkState();
    stepAction(state, { kind: 'end_turn', side: 'A' });
    // Both empty-stack turfs remain open (no tough on top).
    expect(state.players.A.turfs.every((t) => t.closedRanks)).toBe(false);
  });

  it('turf with modifier on top is NOT in closed ranks (exposed)', () => {
    const state = mkState();
    // Manually put a weapon on top with no preceding tough
    addToStack(state.players.A.turfs[0], weapon('floater'));
    stepAction(state, { kind: 'end_turn', side: 'A' });
    expect(state.players.A.turfs[0].closedRanks).toBe(false);
  });

  it('modifier-on-top at end-of-turn is popped into the Black Market, then closedRanks set', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('anchor'));
    addToStack(state.players.A.turfs[0], weapon('stranded'));
    state.players.A.toughsInPlay = 1;

    stepAction(state, { kind: 'end_turn', side: 'A' });

    // The modifier is popped first; only the tough remains on top.
    expect(state.players.A.turfs[0].stack).toHaveLength(1);
    expect(state.players.A.turfs[0].stack[0].card.id).toBe('anchor');
    expect(state.blackMarket.some((m) => m.id === 'stranded')).toBe(true);
    // After popping the modifier, top is a tough → closedRanks = true.
    expect(state.players.A.turfs[0].closedRanks).toBe(true);
  });

  it('closedRanksEnds metric increments per transition into closed ranks', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('a1'));
    addToStack(state.players.A.turfs[1], tough('a2'));
    state.players.A.toughsInPlay = 2;
    stepAction(state, { kind: 'end_turn', side: 'A' });
    expect(state.metrics.closedRanksEnds).toBe(2); // both turfs transitioned
  });

  it('re-closing an already-closed-ranks turf does not double-count', () => {
    const state = mkState();
    addToStack(state.players.A.turfs[0], tough('a1'));
    addToStack(state.players.A.turfs[1], tough('a2'));
    state.players.A.toughsInPlay = 2;
    // Force turf 0 to already be in closed ranks.
    state.players.A.turfs[0].closedRanks = true;
    stepAction(state, { kind: 'end_turn', side: 'A' });
    // Only turf[1] transitioned (turf[0] was already closed).
    expect(state.metrics.closedRanksEnds).toBe(1);
  });
});

describe('closed ranks — defensive bonus (RULES §8.5)', () => {
  it('applies +35% resistance bonus on medium when closedRanks + tough on top', () => {
    const turf = createTurf();
    addToStack(turf, tough('defender', 4, 10)); // resistance 10
    turf.closedRanks = true;
    // medium: +35% → floor(10 * 1.35) = floor(13.5) = 13
    expect(positionResistance(turf, 'medium')).toBe(13);
  });

  it('applies +50% resistance bonus on easy when closedRanks + tough on top', () => {
    const turf = createTurf();
    addToStack(turf, tough('defender', 4, 10));
    turf.closedRanks = true;
    // easy: +50% → floor(10 * 1.5) = 15
    expect(positionResistance(turf, 'easy')).toBe(15);
  });

  it('applies +5% resistance bonus on ultra-nightmare when closedRanks + tough on top', () => {
    const turf = createTurf();
    addToStack(turf, tough('defender', 4, 10));
    turf.closedRanks = true;
    // ultra-nightmare: +5% → floor(10 * 1.05) = 10
    expect(positionResistance(turf, 'ultra-nightmare')).toBe(10);
  });

  it('NO bonus when closedRanks=false', () => {
    const turf = createTurf();
    addToStack(turf, tough('defender', 4, 10));
    turf.closedRanks = false;
    expect(positionResistance(turf, 'medium')).toBe(10);
  });

  it('NO bonus when top card is a modifier (not a tough)', () => {
    const turf = createTurf();
    addToStack(turf, tough('base', 4, 10));
    addToStack(turf, weapon('top-mod'));
    turf.closedRanks = true;
    // Top is a weapon — no closed ranks bonus should apply.
    // Base resistance = 10 (tough) + 1 (weapon) = 11, no bonus.
    expect(positionResistance(turf, 'medium')).toBe(11);
  });

  it('NO bonus when no difficulty is passed (backward compat)', () => {
    const turf = createTurf();
    addToStack(turf, tough('defender', 4, 10));
    turf.closedRanks = true;
    expect(positionResistance(turf)).toBe(10);
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
