// Shared v0.3 test state builder. Produces a fully-populated TurfGameState
// so tests don't have to re-spell every new field (heat, holding, lockup,
// blackMarket, mythicPool, warStats, etc.).
//
// Use these helpers over ad-hoc factories to stay in sync with sim types.
import { createRng } from '../../cards/rng';
import { emptyMetrics, emptyPlannerMemory } from '../environment';
import type {
  CurrencyCard,
  DrugCard,
  PlayerState,
  StackedCard,
  ToughCard,
  Turf,
  TurfGameState,
  WeaponCard,
} from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';

// ── Card factories ────────────────────────────────────────────

export function mkTough(overrides: Partial<ToughCard> = {}): ToughCard {
  const resistance = overrides.resistance ?? 5;
  const maxHp = overrides.maxHp ?? resistance;
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Grunt',
    tagline: overrides.tagline ?? '',
    archetype: overrides.archetype ?? 'brawler',
    affiliation: overrides.affiliation ?? 'freelance',
    power: overrides.power ?? 5,
    resistance,
    rarity: overrides.rarity ?? 'common',
    abilities: overrides.abilities ?? [],
    maxHp,
    hp: overrides.hp ?? maxHp,
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

export function mkCurrency(
  denomination: 100 | 1000 = 100,
  id = `cash-${denomination}`,
): CurrencyCard {
  return {
    kind: 'currency',
    id,
    name: `$${denomination}`,
    denomination,
    rarity: 'common',
  };
}

// ── Stack helpers ─────────────────────────────────────────────

export function sc(
  card: ToughCard | WeaponCard | DrugCard | CurrencyCard,
  faceUp = true,
  owner?: string,
): StackedCard {
  return { card, faceUp, owner };
}

export function mkTurf(
  id: string,
  stack: StackedCard[] = [],
  opts: { reserveIndex?: number; closedRanks?: boolean } = {},
): Turf {
  const reserveIndex = opts.reserveIndex ?? 0;
  // Assign owner if missing: walk the stack, tough declares itself owner,
  // modifiers inherit the most recent tough above them.
  let lastTough: string | null = null;
  const normalized = stack.map((entry) => {
    if (entry.card.kind === 'tough') {
      lastTough = entry.card.id;
      return { ...entry, owner: entry.owner ?? entry.card.id };
    }
    return { ...entry, owner: entry.owner ?? lastTough ?? entry.card.id };
  });
  return {
    id,
    stack: normalized,
    sickTopIdx: null,
    closedRanks: opts.closedRanks ?? false,
    isActive: reserveIndex === 0,
    reserveIndex,
  };
}

// ── State builder ─────────────────────────────────────────────

export function mkPlayer(turfs: Turf[]): PlayerState {
  let toughsInPlay = 0;
  for (const t of turfs) {
    for (const entry of t.stack) {
      if (entry.card.kind === 'tough') toughsInPlay++;
    }
  }
  return {
    turfs,
    deck: [],
    discard: [],
    toughsInPlay,
    actionsRemaining: 3,
    pending: null,
    queued: [],
    turnEnded: false,
  };
}

export interface MkStateOpts {
  seed?: number;
  heat?: number;
  phase?: 'action' | 'resolve';
}

/** Build a fully-populated v0.3 TurfGameState for unit tests. */
export function mkState(
  A: Turf[],
  B: Turf[],
  opts: MkStateOpts = {},
): TurfGameState {
  const seed = opts.seed ?? 1;
  return {
    config: { ...DEFAULT_GAME_CONFIG, turfCount: Math.max(A.length, B.length) },
    players: { A: mkPlayer(A), B: mkPlayer(B) },
    firstPlayer: 'A',
    turnNumber: 1,
    phase: opts.phase ?? 'action',
    aiState: { A: 'idle', B: 'idle' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [],
    policySamples: [],
    rng: createRng(seed),
    seed,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
    heat: opts.heat ?? 0,
    blackMarket: [],
    holding: { A: [], B: [] },
    lockup: { A: [], B: [] },
    mythicPool: [],
    mythicAssignments: {},
    warStats: { seizures: [] },
  };
}
