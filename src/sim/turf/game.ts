import type {
  Card,
  GameConfig,
  PlayerState,
  TurfAction,
  TurfGameState,
  TurfMetrics,
} from './types';
import { DEFAULT_GAME_CONFIG } from './types';
import { createRng, randomSeed } from '../cards/rng';
import type { Rng } from '../cards/rng';
import { createTurf, resetTurfIdCounter } from './board';
import {
  actionsForTurn,
  drawPhase,
  emptyMetrics,
  emptyPlannerMemory,
  stepAction,
} from './environment';
import { TURF_SIM_CONFIG } from './ai/config';

// ── Match State ───────────────────────────────────────────

export interface MatchState {
  game: TurfGameState;
  turnCount: number;
  maxTurns: number;
}

// ── Player initialization ─────────────────────────────────

function createPlayer(config: GameConfig, deck: Card[], rng: Rng): PlayerState {
  const turfs = Array.from({ length: config.turfCount }, () => createTurf());
  const shuffled = rng.shuffle([...deck]);
  return {
    turfs,
    hand: [],
    deck: shuffled,
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: 0,
  };
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
    turnSide: 'A',
    firstPlayer: 'A',
    turnNumber: 0,
    phase: 'combat',
    hasStruck: { A: false, B: false },
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
  return {
    game,
    turnCount: 0,
    maxTurns: options.maxTurns ?? TURF_SIM_CONFIG.gameDefaults.maxTurns,
  };
}

export function runTurn(
  match: MatchState,
  actions: TurfAction[],
): MatchState {
  const { game } = match;
  match.turnCount++;
  game.turnNumber++;
  game.metrics.turns++;

  const side = game.turnSide;
  const player = game.players[side];

  drawPhase(game, side);

  player.actionsRemaining = actionsForTurn(game.config, game.turnNumber, side);

  for (const action of actions) {
    if (player.actionsRemaining <= 0 && action.kind !== 'discard' && action.kind !== 'end_turn') break;
    if (game.winner) break;
    stepAction(game, { ...action, side });
  }

  game.turnSide = side === 'A' ? 'B' : 'A';
  return match;
}

export function isGameOver(match: MatchState): 'A' | 'B' | null {
  const { game } = match;
  if (game.winner) return game.winner;

  if (game.players.A.turfs.length === 0) {
    game.winner = 'B';
    game.endReason = 'total_seizure';
    return 'B';
  }
  if (game.players.B.turfs.length === 0) {
    game.winner = 'A';
    game.endReason = 'total_seizure';
    return 'A';
  }

  if (match.turnCount >= match.maxTurns) {
    const turfsA = game.players.A.turfs.length;
    const turfsB = game.players.B.turfs.length;
    game.winner = turfsA >= turfsB ? 'A' : 'B';
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
