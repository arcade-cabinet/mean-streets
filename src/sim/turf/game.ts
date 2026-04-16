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
  const turfs = Array.from({ length: config.turfCount }, () => createTurf());
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
  // Seed both players' per-turn action budgets off turn 1 = firstTurnActions.
  game.players.A.actionsRemaining = actionsForTurn(config, 1, 'A');
  game.players.B.actionsRemaining = actionsForTurn(config, 1, 'B');
  return {
    game,
    turnCount: 0,
    maxTurns: options.maxTurns ?? TURF_SIM_CONFIG.gameDefaults.maxTurns,
  };
}

/**
 * Apply a full turn for both players. Each side's sequence is played in
 * order until that side's `turnEnded` flag flips. Resolve phase is
 * automatically triggered inside `stepAction` when both sides' `turnEnded`
 * is true (the last `end_turn` fires it).
 *
 * Either side may end first; the other's remaining queue is then applied
 * against post-resolve state (which is unusual but safe — tests should
 * avoid it). Normal flow: both lists terminate in `end_turn`.
 */
export function runTurn(
  match: MatchState,
  actionsA: TurfAction[],
  actionsB: TurfAction[],
): MatchState {
  const { game } = match;
  match.turnCount++;

  applySide(game, actionsA, 'A');
  applySide(game, actionsB, 'B');

  // If neither `end_turn` was issued, manually trigger the resolve phase
  // by synthesising end_turn for any side whose turnEnded stayed false.
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
