import { join } from 'node:path';
import { createRng } from '../cards/rng';
import { generateTurfCardPools, type TurfCardPools } from './catalog';
import { analyzeBalanceResults, loadBalanceHistory, type BalanceAnalysis } from './balance';
import { createMatch, isGameOver, type MatchState } from './game';
import { decideAction, TURF_SIM_CONFIG, trainPolicyArtifact } from './ai';
import { buildAutoDeck, type AutoDeckPolicy } from './deck-builder';
import { stepAction, drawPhase, actionsForTurn } from './environment';
import { createPolicySample, enumerateLegalActions } from './env-query';
import type { GameConfig, TurfGameResult, TurfPolicyArtifact } from './types';
import { DEFAULT_GAME_CONFIG } from './types';

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
  for (const c of p.hand) ids.push(c.id);
  for (const c of p.discard) ids.push(c.id);
  for (const t of p.turfs) for (const c of t.stack) ids.push(c.id);
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
    const side = match.game.turnSide;
    match.turnCount++;
    match.game.turnNumber++;
    match.game.metrics.turns++;
    drawPhase(match.game, side);
    match.game.players[side].actionsRemaining = actionsForTurn(
      match.game.config, match.game.turnNumber, side,
    );

    while (match.game.players[side].actionsRemaining > 0 && !match.game.winner) {
      if (exploreRate > 0 && rng.next() < exploreRate) {
        const legal = enumerateLegalActions(match.game, side);
        const nonPass = legal.filter(a => a.kind !== 'pass' && a.kind !== 'end_turn');
        if (nonPass.length > 0) {
          const pick = nonPass[rng.int(0, nonPass.length - 1)];
          stepAction(match.game, { ...pick, side });
          if (opts.capturePolicySamples) {
            match.game.policySamples.push(
              createPolicySample(match.game, side, pick, 'explore', 0),
            );
          }
          continue;
        }
      }

      const decision = decideAction(match.game, side, opts.policyArtifact);
      match.game.plannerTrace.push(decision.trace);
      stepAction(match.game, { ...decision.action, side });

      if (opts.capturePolicySamples) {
        match.game.policySamples.push(
          createPolicySample(
            match.game, side, decision.action,
            decision.trace.chosenGoal, 0,
          ),
        );
      }

      if (decision.action.kind === 'end_turn') break;
    }

    match.game.turnSide = side === 'A' ? 'B' : 'A';
    isGameOver(match);
  }

  return extractResult(match, seed);
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
    warmupEpisodes.push(playSimulatedGame(seed, {
      pools,
      capturePolicySamples: true,
      explorationRate: epsilon,
    }));
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
