import { join } from 'node:path';
import { createRng } from '../cards/rng';
import { generateTurfCardPools, type TurfCardPools } from './catalog';
import { analyzeBalanceResults, loadBalanceHistory, type BalanceAnalysis } from './balance';
import { createMatch, isGameOver, runTurn, type MatchState } from './game';
import { decideAction, TURF_SIM_CONFIG, trainPolicyArtifact } from './ai';
import { buildAutoDeck, type AutoDeckPolicy } from './deck-builder';
import { stepAction } from './environment';
import { createPolicySample, enumerateLegalActions } from './env-query';
import type { GameConfig, TurfAction, TurfGameResult, TurfGameState, TurfPolicyArtifact } from './types';
import { DEFAULT_GAME_CONFIG } from './types';

function backfillRewards(result: TurfGameResult): void {
  if (!result.policySamples) return;
  if (result.endReason === 'timeout' || !result.winner) return;
  for (const sample of result.policySamples) {
    sample.reward = sample.side === result.winner ? 1 : -1;
  }
}

type BenchmarkProfileName = keyof typeof TURF_SIM_CONFIG.benchmarkProfiles;

export interface BenchmarkSummary {
  profile: BenchmarkProfileName;
  games: number;
  catalogSeed: number;
  runSeed: number;
  warmupGames: number;
  winRateA: number;
  firstMoverWinRate: number;
  timeoutRate: number;
  avgTurns: number;
  medianTurns: number;
  p10Turns: number;
  p90Turns: number;
  failedPlans: number;
  fundedAttacks: number;
  pushedAttacks: number;
  directAttacks: number;
  policyGuidedActions: number;
  passRatePerTurn: number;
}

export interface BenchmarkRun {
  summary: BenchmarkSummary;
  results: TurfGameResult[];
  balance?: BalanceAnalysis;
}

export interface PlayGameOptions {
  pools: TurfCardPools;
  deckPolicyA?: AutoDeckPolicy;
  deckPolicyB?: AutoDeckPolicy;
  policyArtifact?: TurfPolicyArtifact;
  capturePolicySamples?: boolean;
  explorationRate?: number;
  config?: GameConfig;
}

function collectDeckIds(match: MatchState, side: 'A' | 'B'): string[] {
  const p = match.game.players[side];
  const ids: string[] = [];
  for (const c of p.deck) ids.push(c.id);
  if (p.pending) ids.push(p.pending.id);
  for (const c of p.discard) ids.push(c.id);
  for (const t of p.turfs) for (const sc of t.stack) ids.push(sc.card.id);
  return ids;
}

function extractResult(match: MatchState, seed: number): TurfGameResult {
  const g = match.game;
  return {
    winner: g.winner ?? 'A',
    endReason: g.endReason ?? 'timeout',
    firstPlayer: g.firstPlayer,
    turnCount: match.turnCount,
    metrics: g.metrics,
    seed,
    plannerTrace: g.plannerTrace,
    policySamples: g.policySamples.length > 0 ? g.policySamples : undefined,
    finalState: {
      turfsA: g.players.A.turfs.length,
      turfsB: g.players.B.turfs.length,
    },
    decks: {
      A: { cardIds: collectDeckIds(match, 'A') },
      B: { cardIds: collectDeckIds(match, 'B') },
    },
  };
}

/**
 * Build the action sequence for a single side of a single turn. Loops
 * `decideAction` → `stepAction` until the planner issues `end_turn` or the
 * budget / game ends. Actions are captured so runTurn can record them even
 * though this helper also executes them (parallel-turn flow keeps both
 * sides' mutations interleaved inside stepAction).
 */
function runSideTurn(
  state: TurfGameState,
  side: 'A' | 'B',
  opts: {
    rng: ReturnType<typeof createRng>;
    explorationRate: number;
    capturePolicySamples?: boolean;
    policyArtifact?: TurfPolicyArtifact;
  },
): void {
  const player = state.players[side];
  let iterations = 0;
  const maxIterations = 64; // hard cap against infinite loops in broken policies
  while (!player.turnEnded && !state.winner && iterations < maxIterations) {
    iterations++;

    // Exploration path — random non-terminal action.
    if (opts.explorationRate > 0 && opts.rng.next() < opts.explorationRate) {
      const legal = enumerateLegalActions(state, side);
      const nonTerminal = legal.filter(
        (a) => a.kind !== 'pass' && a.kind !== 'end_turn',
      );
      if (nonTerminal.length > 0) {
        const pick = nonTerminal[opts.rng.int(0, nonTerminal.length - 1)];
        stepAction(state, { ...pick, side });
        if (opts.capturePolicySamples) {
          state.policySamples.push(
            createPolicySample(state, side, pick, 'explore', 0),
          );
        }
        continue;
      }
    }

    const decision = decideAction(state, side, opts.policyArtifact);
    state.plannerTrace.push(decision.trace);
    stepAction(state, { ...decision.action, side });

    if (opts.capturePolicySamples) {
      state.policySamples.push(
        createPolicySample(
          state,
          side,
          decision.action,
          decision.trace.chosenGoal,
          0,
        ),
      );
    }

    if (decision.action.kind === 'end_turn') break;
  }

  // Safety: if we blew the iteration cap without ending, synthesize end_turn.
  if (!player.turnEnded && !state.winner) {
    stepAction(state, { kind: 'end_turn', side });
  }
}

export function playSimulatedGame(
  seed: number,
  opts: PlayGameOptions,
): TurfGameResult {
  const rng = createRng(seed);
  const deckA = buildAutoDeck(opts.pools, rng, opts.deckPolicyA);
  const deckB = buildAutoDeck(opts.pools, rng, opts.deckPolicyB);
  const config = opts.config ?? DEFAULT_GAME_CONFIG;
  const match = createMatch(config, { seed, deckA, deckB });
  const exploreRate = opts.explorationRate ?? 0;

  while (!isGameOver(match)) {
    match.turnCount++;

    // Both sides take their turn in parallel (no alternating side); the
    // resolve phase fires automatically inside `end_turn` when both
    // `turnEnded` flags are true.
    runSideTurn(match.game, 'A', {
      rng,
      explorationRate: exploreRate,
      capturePolicySamples: opts.capturePolicySamples,
      policyArtifact: opts.policyArtifact,
    });
    if (match.game.winner) break;
    runSideTurn(match.game, 'B', {
      rng,
      explorationRate: exploreRate,
      capturePolicySamples: opts.capturePolicySamples,
      policyArtifact: opts.policyArtifact,
    });

    isGameOver(match);
  }

  return extractResult(match, seed);
}

/** Preserved export — callers may pass manually-constructed action lists. */
export function runScriptedTurn(
  match: MatchState,
  actionsA: TurfAction[],
  actionsB: TurfAction[],
): MatchState {
  return runTurn(match, actionsA, actionsB);
}

function average(
  results: TurfGameResult[],
  selector: (result: TurfGameResult) => number,
): number {
  return results.reduce((sum, r) => sum + selector(r), 0) / Math.max(1, results.length);
}

export function runSeededBenchmark(
  profile: BenchmarkProfileName,
  options: {
    includeBalance?: boolean;
    overrides?: Partial<Pick<BenchmarkSummary, 'games' | 'catalogSeed' | 'runSeed'>>;
  } = {},
): BenchmarkRun {
  const profileConfig = TURF_SIM_CONFIG.benchmarkProfiles[profile];
  const games = options.overrides?.games ?? profileConfig.games;
  const catalogSeed = options.overrides?.catalogSeed ?? profileConfig.catalogSeed;
  const runSeed = options.overrides?.runSeed ?? profileConfig.runSeed;
  const pools = generateTurfCardPools(catalogSeed, { allUnlocked: true });
  const runRng = createRng(runSeed);
  const warmupGames = Math.min(
    TURF_SIM_CONFIG.training.warmupGames,
    Math.max(16, Math.floor(games * 0.2)),
  );
  const evalGames = Math.max(1, games - warmupGames);
  const warmupEpisodes: TurfGameResult[] = [];
  let epsilon = TURF_SIM_CONFIG.training.epsilonStart;

  for (let i = 0; i < warmupGames; i++) {
    const seed = runRng.int(1, 2147483646);
    const result = playSimulatedGame(seed, {
      pools,
      capturePolicySamples: true,
      explorationRate: epsilon,
    });
    backfillRewards(result);
    warmupEpisodes.push(result);
    epsilon = Math.max(
      TURF_SIM_CONFIG.training.epsilonMin,
      epsilon * TURF_SIM_CONFIG.training.epsilonDecay,
    );
  }

  const policyArtifact = trainPolicyArtifact(
    warmupEpisodes.map(r => r.policySamples ?? []),
    TURF_SIM_CONFIG.version,
  );

  const results: TurfGameResult[] = [];
  for (let i = 0; i < evalGames; i++) {
    const seed = runRng.int(1, 2147483646);
    results.push(playSimulatedGame(seed, { pools, policyArtifact }));
  }

  const turns = results.map(r => r.turnCount).sort((a, b) => a - b);
  const winsA = results.filter(r => r.winner === 'A').length;
  const firstMoverWins = results.filter(r => r.winner === r.firstPlayer).length;
  const timeouts = results.filter(r => r.endReason === 'timeout').length;
  const totalTurns = results.reduce((sum, r) => sum + r.turnCount, 0);
  const totalPasses = results.reduce((sum, r) => sum + r.metrics.passes, 0);

  const summary: BenchmarkSummary = {
    profile,
    games: results.length,
    catalogSeed,
    runSeed,
    warmupGames,
    winRateA: winsA / Math.max(1, results.length),
    firstMoverWinRate: firstMoverWins / Math.max(1, results.length),
    timeoutRate: timeouts / Math.max(1, results.length),
    avgTurns: average(results, r => r.turnCount),
    medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
    p10Turns: turns[Math.floor(turns.length * 0.1)] ?? 0,
    p90Turns: turns[Math.floor(turns.length * 0.9)] ?? 0,
    failedPlans: average(results, r => r.metrics.failedPlans),
    fundedAttacks: average(results, r => r.metrics.fundedRecruits),
    pushedAttacks: average(results, r => r.metrics.pushedStrikes),
    directAttacks: average(results, r => r.metrics.directStrikes),
    policyGuidedActions: average(results, r => r.metrics.policyGuidedActions),
    passRatePerTurn: totalPasses / Math.max(1, totalTurns),
  };

  let balance: BalanceAnalysis | undefined;
  if (options.includeBalance) {
    const historyPath = join(
      process.cwd(), 'sim', 'reports', 'turf', 'balance-history.json',
    );
    balance = analyzeBalanceResults(results, pools, loadBalanceHistory(historyPath));
  }

  return { summary, results, balance };
}
