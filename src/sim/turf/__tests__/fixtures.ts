// Fixture factories for abilities tests — v0.3 types.ts shape.
// Bypass board/environment (mid-rewrite) so tests exercise abilities.ts
// in isolation.
import { createRng } from '../../cards/rng';
import type {
  CurrencyCard,
  DrugCard,
  PlayerState,
  StackedCard,
  ToughCard,
  Turf,
  TurfGameState,
  TurfMetrics,
  WeaponCard,
} from '../types';

export function mkTough(overrides: Partial<ToughCard> = {}): ToughCard {
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
    maxHp: overrides.maxHp ?? overrides.resistance ?? 5,
    hp: overrides.hp ?? overrides.resistance ?? 5,
  };
}

export function mkWeapon(overrides: Partial<WeaponCard> = {}): WeaponCard {
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

export function mkDrug(overrides: Partial<DrugCard> = {}): DrugCard {
  return {
    kind: 'drug',
    id: overrides.id ?? 'd-1',
    name: overrides.name ?? 'Speed',
    category: overrides.category ?? 'stim',
    power: overrides.power ?? 1,
    resistance: overrides.resistance ?? 0,
    rarity: overrides.rarity ?? 'common',
    abilities: overrides.abilities ?? [],
  };
}

export function mkCurrency(denomination: 100 | 1000, id: string): CurrencyCard {
  return {
    kind: 'currency',
    id,
    name: `$${denomination}`,
    denomination,
    rarity: 'common',
  };
}

export function up(
  card: ToughCard | WeaponCard | DrugCard | CurrencyCard,
  faceUp = true,
): StackedCard {
  return { card, faceUp };
}

export function mkTurf(
  id: string,
  stack: StackedCard[],
  reserveIndex = 0,
): Turf {
  return {
    id,
    stack,
    sickTopIdx: null,
    closedRanks: false,
    isActive: reserveIndex === 0,
    reserveIndex,
  };
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

function emptyMetrics(): TurfMetrics {
  return {
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
    raids: 0,
    marketTrades: 0,
    marketHeals: 0,
    modifierSwaps: 0,
    mythicsFlipped: 0,
    bribesAccepted: 0,
    bribesFailed: 0,
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

export function mkState(A: Turf[], B: Turf[], seed = 1): TurfGameState {
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
    aiMemory: { A: emptyMemory(), B: emptyMemory() },
    plannerTrace: [],
    policySamples: [],
    rng: createRng(seed),
    seed,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
    heat: 0.5,
    blackMarket: [],
    holding: { A: [], B: [] },
    lockup: { A: [], B: [] },
    mythicPool: [],
    mythicAssignments: {},
    warStats: { seizures: [] },
  };
}
