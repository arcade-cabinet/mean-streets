import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { resolvePhase, __debug_dominances } from '../resolve';
import type {
  PlayerState,
  StackedCard,
  ToughCard,
  Turf,
  TurfGameState,
  WeaponCard,
} from '../types';

// ── fixtures ────────────────────────────────────────────────

function mkTough(overrides: Partial<ToughCard> = {}): ToughCard {
  return {
    kind: 'tough',
    id: overrides.id ?? 't-1',
    name: overrides.name ?? 'Grunt',
    tagline: '',
    archetype: overrides.archetype ?? 'brawler',
    affiliation: overrides.affiliation ?? 'freelance',
    power: overrides.power ?? 5,
    resistance: overrides.resistance ?? 5,
    rarity: overrides.rarity ?? 'common',
    abilities: overrides.abilities ?? [],
  };
}

function mkWeapon(overrides: Partial<WeaponCard> = {}): WeaponCard {
  return {
    kind: 'weapon',
    id: overrides.id ?? 'w-1',
    name: overrides.name ?? 'Shiv',
    category: overrides.category ?? 'bladed',
    power: overrides.power ?? 2,
    resistance: overrides.resistance ?? 1,
    rarity: overrides.rarity ?? 'common',
    abilities: overrides.abilities ?? [],
  };
}

function sc(card: ToughCard | WeaponCard, faceUp = true): StackedCard {
  return { card, faceUp };
}

function turf(id: string, stack: StackedCard[]): Turf {
  return { id, stack, sickTopIdx: null, closedRanks: false };
}

function emptyPlayer(turfs: Turf[]): PlayerState {
  return {
    turfs,
    deck: [],
    discard: [],
    toughsInPlay: turfs.length,
    actionsRemaining: 0,
    pending: null,
    queued: [],
    turnEnded: true,
  };
}

function emptyMemory() {
  return {
    lastGoal: null, lastActionKind: null, consecutivePasses: 0,
    failedPlans: 0, blockedLanes: {}, pressuredLanes: {},
    laneRoles: {}, focusLane: null, focusRole: null,
  };
}

function mkState(A: Turf[], B: Turf[]): TurfGameState {
  return {
    config: {
      difficulty: 'medium', suddenDeath: false,
      turfCount: A.length, actionsPerTurn: 3, firstTurnActions: 5,
    },
    players: { A: emptyPlayer(A), B: emptyPlayer(B) },
    firstPlayer: 'A', turnNumber: 1, phase: 'action',
    aiState: { A: 'idle', B: 'idle' }, aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyMemory(), B: emptyMemory() },
    plannerTrace: [], policySamples: [],
    rng: createRng(1), seed: 1, winner: null, endReason: null,
    metrics: {
      turns: 0, draws: 0, retreats: 0, closedRanksEnds: 0,
      directStrikes: 0, pushedStrikes: 0, fundedRecruits: 0,
      kills: 0, spiked: 0, seizures: 0, busts: 0,
      cardsPlayed: 0, cardsDiscarded: 0,
      toughsPlayed: 0, modifiersPlayed: 0, passes: 0,
      goalSwitches: 0, failedPlans: 0,
      stallTurns: 0, deadHandTurns: 0,
      policyGuidedActions: 0, totalActions: 0, firstStrike: null,
    },
  };
}

// ── tests ───────────────────────────────────────────────────

describe('resolvePhase — dominance ordering', () => {
  it('higher-dominance strike resolves first', () => {
    // A strikes B with a massive power advantage; B counters with a
    // weaker strike. After dominance sort A should resolve first.
    const A = [turf('a1', [sc(mkTough({ id: 'aT', power: 20, resistance: 5 }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT', power: 4, resistance: 4 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });
    state.players.B.queued.push({
      kind: 'direct_strike', side: 'B', turfIdx: 0, targetTurfIdx: 0,
    });

    const ranked = __debug_dominances(state);
    expect(ranked).toHaveLength(2);
    const aDom = ranked.find(r => r.queued.side === 'A')!.dominance;
    const bDom = ranked.find(r => r.queued.side === 'B')!.dominance;
    expect(aDom).toBeGreaterThan(bDom);
  });

  it('resolvePhase clears queued arrays and flips turnEnded flags', () => {
    const A = [turf('a1', [sc(mkTough({ id: 'aT', power: 10 }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT' }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.A.queued).toHaveLength(0);
    expect(state.players.B.queued).toHaveLength(0);
    expect(state.players.A.turnEnded).toBe(false);
    expect(state.players.B.turnEnded).toBe(false);
  });

  it('kills are recorded in metrics after resolve', () => {
    const A = [turf('a1', [sc(mkTough({ id: 'aT', power: 20 }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT', resistance: 3 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    resolvePhase(state);
    expect(state.metrics.kills).toBeGreaterThanOrEqual(1);
    expect(state.metrics.directStrikes).toBeGreaterThanOrEqual(1);
  });

  it('seized turfs are removed from defender', () => {
    // A has enough to kill B's only tough on the only turf → seize.
    const A = [turf('a1', [sc(mkTough({ power: 50 }))])];
    const B = [turf('b1', [sc(mkTough({ resistance: 1 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.B.turfs).toHaveLength(0);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('total_seizure');
    expect(state.metrics.seizures).toBeGreaterThanOrEqual(1);
  });

  it('turnNumber advances after resolve', () => {
    const A = [turf('a1', [sc(mkTough({ id: 'aT' }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT' }))])];
    const state = mkState(A, B);
    const before = state.turnNumber;

    resolvePhase(state);

    expect(state.turnNumber).toBe(before + 1);
    expect(state.phase).toBe('action');
  });

  it('pending cards are discarded when resolve fires', () => {
    const A = [turf('a1', [sc(mkTough({ id: 'aT' }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT' }))])];
    const state = mkState(A, B);
    // Stuck pending modifier (no tough to tuck under elsewhere).
    state.players.A.pending = mkWeapon({ id: 'stuck' });

    resolvePhase(state);

    expect(state.players.A.pending).toBeNull();
    expect(state.players.A.discard.some(c => c.id === 'stuck')).toBe(true);
    expect(state.metrics.cardsDiscarded).toBeGreaterThanOrEqual(1);
  });

  it('ties in dominance are resolved without error (defender favored via baked-in inertia)', () => {
    // A hits B, B hits A, both have equal dominance. No throw, both
    // resolve in stable order.
    const A = [turf('a1', [sc(mkTough({ id: 'aT', power: 5, resistance: 5 }))])];
    const B = [turf('b1', [sc(mkTough({ id: 'bT', power: 5, resistance: 5 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });
    state.players.B.queued.push({
      kind: 'direct_strike', side: 'B', turfIdx: 0, targetTurfIdx: 0,
    });

    expect(() => resolvePhase(state)).not.toThrow();
  });
});

describe('resolvePhase — intangibles firing order', () => {
  it('legendary counter cancels a strike before tangibles apply', () => {
    // Defender carries a `counter` ability on a legendary weapon — the
    // attacker's queued strike should be canceled before resolving.
    const A = [turf('a1', [sc(mkTough({ power: 20 }))])];
    const B = [
      turf('b1', [
        sc(mkTough({ id: 'bT', resistance: 3 })),
        sc(
          mkWeapon({
            id: 'shield',
            rarity: 'legendary',
            abilities: ['PARRY'],
          }),
        ),
      ]),
    ];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 0,
    });

    resolvePhase(state);

    // Defender tough survives — counter intercepted the strike.
    expect(state.players.B.turfs[0]?.stack.some(e => e.card.id === 'bT')).toBe(true);
  });
});
