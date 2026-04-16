import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import {
  applyTangibles,
  runIntangiblesPhase,
  stackCardsByRarityDesc,
} from '../abilities';
import type {
  CurrencyCard,
  PlayerState,
  QueuedAction,
  StackedCard,
  ToughCard,
  Turf,
  TurfGameState,
  WeaponCard,
} from '../types';

// Minimal fixture factories — bypass board/environment (those are
// mid-rewrite) so tests exercise `abilities.ts` in isolation.

function mkTough(overrides: Partial<ToughCard> = {}): ToughCard {
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Grunt',
    tagline: 'test',
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

function mkCurrency(denomination: 100 | 1000, id: string): CurrencyCard {
  return {
    kind: 'currency',
    id,
    name: `$${denomination}`,
    denomination,
    rarity: 'common',
  };
}

function up(
  card: ToughCard | WeaponCard | CurrencyCard,
  faceUp = true,
): StackedCard {
  return { card, faceUp };
}

function mkTurf(id: string, stack: StackedCard[]): Turf {
  return { id, stack, sickTopIdx: null, closedRanks: false };
}

function emptyPlayer(turfs: Turf[]): PlayerState {
  return {
    turfs,
    deck: [],
    discard: [],
    toughsInPlay: turfs.length,
    actionsRemaining: 3,
    pending: null,
    queued: [],
    turnEnded: false,
  };
}

function mkState(A: Turf[], B: Turf[]): TurfGameState {
  return {
    config: {
      difficulty: 'medium',
      suddenDeath: false,
      turfCount: 3,
      actionsPerTurn: 3,
      firstTurnActions: 5,
    },
    players: { A: emptyPlayer(A), B: emptyPlayer(B) },
    firstPlayer: 'A',
    turnNumber: 1,
    phase: 'resolve',
    aiState: { A: 'idle', B: 'idle' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: {
      A: emptyMemory(),
      B: emptyMemory(),
    },
    plannerTrace: [],
    policySamples: [],
    rng: createRng(1),
    seed: 1,
    winner: null,
    endReason: null,
    metrics: {
      turns: 0,
      draws: 0,
      retreats: 0,
      closedRanksEnds: 0,
      directStrikes: 0,
      pushedStrikes: 0,
      fundedRecruits: 0,
      kills: 0,
      spiked: 0,
      seizures: 0,
      busts: 0,
      cardsPlayed: 0,
      cardsDiscarded: 0,
      toughsPlayed: 0,
      modifiersPlayed: 0,
      passes: 0,
      goalSwitches: 0,
      failedPlans: 0,
      stallTurns: 0,
      deadHandTurns: 0,
      policyGuidedActions: 0,
      totalActions: 0,
      firstStrike: null,
    },
  };
}

function emptyMemory() {
  return {
    lastGoal: null,
    lastActionKind: null,
    consecutivePasses: 0,
    failedPlans: 0,
    blockedLanes: {},
    pressuredLanes: {},
    laneRoles: {},
    focusLane: null,
    focusRole: null,
  };
}

const Q: QueuedAction = {
  kind: 'direct_strike',
  side: 'A',
  turfIdx: 0,
  targetTurfIdx: 0,
};

// ── Counter ─────────────────────────────────────────────────

describe('runIntangiblesPhase — counter', () => {
  it('cancels the strike and consumes the PARRY weapon', () => {
    const attacker = mkTurf('a', [up(mkTough({ id: 'ta' }))]);
    const parry = mkWeapon({ id: 'parry', abilities: ['PARRY'] });
    const defender = mkTurf('d', [up(mkTough({ id: 'td' })), up(parry)]);
    const state = mkState([attacker], [defender]);

    const out = runIntangiblesPhase(state, Q);

    expect(out.kind).toBe('canceled');
    if (out.kind === 'canceled') expect(out.reason).toBe('countered');
    // PARRY weapon consumed.
    expect(defender.stack.some((sc) => sc.card.id === 'parry')).toBe(false);
  });

  it('proceeds when defender has no counter-tagged weapon', () => {
    const attacker = mkTurf('a', [up(mkTough())]);
    const defender = mkTurf('d', [up(mkTough())]);
    const state = mkState([attacker], [defender]);

    expect(runIntangiblesPhase(state, Q).kind).toBe('proceed');
  });
});

// ── Bribe ───────────────────────────────────────────────────

describe('runIntangiblesPhase — bribe', () => {
  it('cancels when defender has ≥ $500 currency and affiliations are loyal', () => {
    // kings_row is loyal to cobalt_syndicate.
    const attacker = mkTurf('a', [up(mkTough({ affiliation: 'kings_row' }))]);
    const defender = mkTurf('d', [
      up(mkTough({ affiliation: 'cobalt_syndicate' })),
      up(mkCurrency(1000, 'cash')),
    ]);
    const state = mkState([attacker], [defender]);

    const out = runIntangiblesPhase(state, Q);
    expect(out.kind).toBe('canceled');
    if (out.kind === 'canceled') expect(out.reason).toBe('bribed');
    expect(defender.stack.some((sc) => sc.card.id === 'cash')).toBe(false);
  });

  it('proceeds when affiliations are not loyal (even with cash)', () => {
    // kings_row vs iron_devils → rival, not loyal.
    const attacker = mkTurf('a', [up(mkTough({ affiliation: 'kings_row' }))]);
    const defender = mkTurf('d', [
      up(mkTough({ affiliation: 'iron_devils' })),
      up(mkCurrency(1000, 'cash')),
    ]);
    const state = mkState([attacker], [defender]);

    expect(runIntangiblesPhase(state, Q).kind).toBe('proceed');
  });

  it('proceeds when currency total is below $500', () => {
    const attacker = mkTurf('a', [up(mkTough({ affiliation: 'kings_row' }))]);
    const defender = mkTurf('d', [
      up(mkTough({ affiliation: 'kings_row' })), // self-loyal OK
      up(mkCurrency(100, 'coin-a')),
      up(mkCurrency(100, 'coin-b')),
    ]);
    const state = mkState([attacker], [defender]);

    expect(runIntangiblesPhase(state, Q).kind).toBe('proceed');
  });
});

// ── Tangibles & helper sanity ───────────────────────────────

describe('applyTangibles', () => {
  it('sums LACERATE (+1 atk) from attacker bladed weapon', () => {
    const attacker = mkTurf('a', [
      up(mkTough()),
      up(mkWeapon({ abilities: ['LACERATE'] })),
    ]);
    const defender = mkTurf('d', [up(mkTough())]);

    const bonus = applyTangibles(attacker, defender);
    expect(bonus.atkPowerDelta).toBe(1);
    expect(bonus.defResistDelta).toBe(0);
  });

  it('sets ignoreResistance when attacker has bruiser archetype', () => {
    const attacker = mkTurf('a', [up(mkTough({ archetype: 'bruiser' }))]);
    const defender = mkTurf('d', [up(mkTough())]);

    const bonus = applyTangibles(attacker, defender);
    expect(bonus.ignoreResistance).toBe(true);
  });

  it('sets targetOverride to bottom for shark, anywhere for ghost', () => {
    const shark = applyTangibles(
      mkTurf('a', [up(mkTough({ archetype: 'shark' }))]),
      mkTurf('d', [up(mkTough())]),
    );
    expect(shark.targetOverride).toBe('bottom');

    const ghost = applyTangibles(
      mkTurf('a', [up(mkTough({ archetype: 'ghost' }))]),
      mkTurf('d', [up(mkTough())]),
    );
    expect(ghost.targetOverride).toBe('anywhere');
  });
});

describe('stackCardsByRarityDesc', () => {
  it('sorts legendary → rare → common, stable within ties', () => {
    const t1 = mkTough({ id: 't1', rarity: 'common' });
    const t2 = mkTough({ id: 't2', rarity: 'legendary' });
    const t3 = mkTough({ id: 't3', rarity: 'rare' });
    const t4 = mkTough({ id: 't4', rarity: 'common' });
    const turf = mkTurf('x', [up(t1), up(t2), up(t3), up(t4)]);

    const sorted = stackCardsByRarityDesc(turf);
    expect(sorted.map((sc) => sc.card.id)).toEqual(['t2', 't3', 't1', 't4']);
  });
});
