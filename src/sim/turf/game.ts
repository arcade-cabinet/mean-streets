import type { Rng } from '../cards/rng';
import { createRng, randomSeed } from '../cards/rng';
import { TURF_SIM_CONFIG } from './ai/config';
import { createTurf, resetTurfIdCounter } from './board';
import {
  actionsForTurn,
  emptyMetrics,
  emptyPlannerMemory,
  stepAction,
} from './environment';
import type {
  Card,
  GameConfig,
  PlayerState,
  TurfAction,
  TurfGameState,
  TurfMetrics,
  WarStats,
} from './types';
import { DEFAULT_GAME_CONFIG } from './types';

// ── Match State ───────────────────────────────────────────

export interface MatchState {
  game: TurfGameState;
  turnCount: number;
  maxTurns: number;
}

// ── Player initialization ─────────────────────────────────

function createPlayer(config: GameConfig, deck: Card[], rng: Rng): PlayerState {
  const turfs = Array.from({ length: config.turfCount }, (_, i) =>
    createTurf({ isActive: i === 0, reserveIndex: i }),
  );
  const shuffled = rng.shuffle([...deck]);
  return {
    turfs,
    deck: shuffled,
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: config.firstTurnActions,
    pending: null,
    queued: [],
    turnEnded: false,
  };
}

function loadMythicIds(): string[] {
  // Canonical ids matching the authored mythic cards in
  // config/raw/cards/mythics/ (mythic-01 … mythic-10).
  return [
    'mythic-01',
    'mythic-02',
    'mythic-03',
    'mythic-04',
    'mythic-05',
    'mythic-06',
    'mythic-07',
    'mythic-08',
    'mythic-09',
    'mythic-10',
  ];
}

function emptyWarStats(): WarStats {
  return { seizures: [] };
}

function createGameState(
  config: GameConfig,
  seed: number,
  deckA: Card[],
  deckB: Card[],
): TurfGameState {
  const rng = createRng(seed);
  resetTurfIdCounter();
  return {
    config,
    players: {
      A: createPlayer(config, deckA, rng),
      B: createPlayer(config, deckB, rng),
    },
    firstPlayer: 'A',
    turnNumber: 1,
    phase: 'action',
    aiState: { A: 'idle', B: 'idle' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
    plannerTrace: [],
    policySamples: [],
    rng,
    seed,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
    heat: 0,
    blackMarket: [],
    holding: { A: [], B: [] },
    lockup: { A: [], B: [] },
    mythicPool: loadMythicIds(),
    mythicAssignments: {},
    warStats: emptyWarStats(),
  };
}

// ── Core API ──────────────────────────────────────────────

export function createMatch(
  config: GameConfig = DEFAULT_GAME_CONFIG,
  options: {
    seed?: number;
    deckA?: Card[];
    deckB?: Card[];
    maxTurns?: number;
  } = {},
): MatchState {
  const seed = options.seed ?? randomSeed();
  const deckA = options.deckA ?? [];
  const deckB = options.deckB ?? [];
  const game = createGameState(config, seed, deckA, deckB);
  game.players.A.actionsRemaining = actionsForTurn(config, 1, 'A');
  game.players.B.actionsRemaining = actionsForTurn(config, 1, 'B');
  return {
    game,
    turnCount: 0,
    maxTurns: options.maxTurns ?? TURF_SIM_CONFIG.gameDefaults.maxTurns,
  };
}

export function runTurn(
  match: MatchState,
  actionsA: TurfAction[],
  actionsB: TurfAction[],
): MatchState {
  const { game } = match;
  match.turnCount++;

  applySide(game, actionsA, 'A');
  applySide(game, actionsB, 'B');

  if (!game.winner) {
    if (!game.players.A.turnEnded)
      stepAction(game, { kind: 'end_turn', side: 'A' });
    if (!game.players.B.turnEnded)
      stepAction(game, { kind: 'end_turn', side: 'B' });
  }
  return match;
}

function applySide(
  game: TurfGameState,
  actions: TurfAction[],
  side: 'A' | 'B',
): void {
  const player = game.players[side];
  for (const action of actions) {
    if (game.winner) break;
    if (player.turnEnded) break;
    if (
      player.actionsRemaining <= 0 &&
      action.kind !== 'end_turn' &&
      action.kind !== 'discard' &&
      action.kind !== 'pass'
    ) {
      break;
    }
    stepAction(game, { ...action, side });
  }
}

export function isGameOver(match: MatchState): 'A' | 'B' | null {
  const { game } = match;
  if (game.winner) return game.winner;

  const aEmpty = game.players.A.turfs.length === 0;
  const bEmpty = game.players.B.turfs.length === 0;

  if (aEmpty && bEmpty) {
    game.winner = null;
    game.endReason = 'draw';
    return null;
  }
  if (aEmpty) {
    game.winner = 'B';
    game.endReason = 'total_seizure';
    return 'B';
  }
  if (bEmpty) {
    game.winner = 'A';
    game.endReason = 'total_seizure';
    return 'A';
  }

  if (match.turnCount >= match.maxTurns) {
    const turfsA = game.players.A.turfs.length;
    const turfsB = game.players.B.turfs.length;
    if (turfsA !== turfsB) {
      game.winner = turfsA > turfsB ? 'A' : 'B';
    } else {
      // Equal turfs at timeout: coin-flip using the game's seeded rng so
      // results are deterministic per seed but not systematically biased.
      game.winner = game.rng.next() < 0.5 ? 'A' : 'B';
    }
    game.endReason = 'timeout';
    return game.winner;
  }
  return null;
}

// ── Metrics helpers ───────────────────────────────────────

export function matchMetrics(match: MatchState): TurfMetrics {
  return match.game.metrics;
}

export function matchSeed(match: MatchState): number {
  return match.game.seed;
}
