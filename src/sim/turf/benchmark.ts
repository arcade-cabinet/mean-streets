import { join } from 'node:path';
import { createRng } from '../cards/rng';
import { generateTurfCardPools } from './catalog';
import { analyzeBalanceResults, loadBalanceHistory, type BalanceAnalysis } from './balance';
import { playTurfGame } from './game';
import { TURF_SIM_CONFIG, trainPolicyArtifact } from './ai';
import { DEFAULT_TURF_CONFIG, type TurfGameResult } from './types';

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
  reserveCrewPlacements: number;
  backpacksEquipped: number;
  runnerDeployments: number;
  payloadDeployments: number;
  runnerOpportunityTurns: number;
  runnerOpportunityTaken: number;
  runnerOpportunityMissed: number;
  runnerReserveOpportunityTurns: number;
  runnerReserveOpportunityTaken: number;
  runnerReserveOpportunityMissed: number;
  runnerEquipOpportunityTurns: number;
  runnerEquipOpportunityTaken: number;
  runnerEquipOpportunityMissed: number;
  runnerDeployOpportunityTurns: number;
  runnerDeployOpportunityTaken: number;
  runnerDeployOpportunityMissed: number;
  runnerPayloadOpportunityTurns: number;
  runnerPayloadOpportunityTaken: number;
  runnerPayloadOpportunityMissed: number;
  runnerOpportunityUseRate: number;
  runnerReserveStartUseRate: number;
  passRatePerTurn: number;
}

export interface BenchmarkRun {
  summary: BenchmarkSummary;
  results: TurfGameResult[];
  balance?: BalanceAnalysis;
}

function average(results: TurfGameResult[], selector: (result: TurfGameResult) => number): number {
  return results.reduce((sum, result) => sum + selector(result), 0) / Math.max(1, results.length);
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
    const result = playTurfGame(DEFAULT_TURF_CONFIG, seed, {
      pools,
      capturePolicySamples: true,
      explorationRate: epsilon,
    });
    warmupEpisodes.push(result);
    epsilon = Math.max(TURF_SIM_CONFIG.training.epsilonMin, epsilon * TURF_SIM_CONFIG.training.epsilonDecay);
  }

  const policyArtifact = trainPolicyArtifact(
    warmupEpisodes.map(result => result.policySamples ?? []),
    TURF_SIM_CONFIG.version,
  );

  const results: TurfGameResult[] = [];
  for (let i = 0; i < evalGames; i++) {
    const seed = runRng.int(1, 2147483646);
    results.push(playTurfGame(DEFAULT_TURF_CONFIG, seed, { pools, policyArtifact }));
  }

  const turns = results.map(result => result.turnCount).sort((a, b) => a - b);
  const winsA = results.filter(result => result.winner === 'A').length;
  const firstMoverWins = results.filter(result => result.winner === result.firstPlayer).length;
  const timeouts = results.filter(result => result.endReason === 'timeout').length;
  const totalTurns = results.reduce((sum, result) => sum + result.turnCount, 0);
  const totalPasses = results.reduce((sum, result) => sum + result.metrics.passes, 0);

  const summary: BenchmarkSummary = {
    profile,
    games: results.length,
    catalogSeed,
    runSeed,
    warmupGames,
    winRateA: winsA / Math.max(1, results.length),
    firstMoverWinRate: firstMoverWins / Math.max(1, results.length),
    timeoutRate: timeouts / Math.max(1, results.length),
    avgTurns: average(results, result => result.turnCount),
    medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
    p10Turns: turns[Math.floor(turns.length * 0.1)] ?? 0,
    p90Turns: turns[Math.floor(turns.length * 0.9)] ?? 0,
    failedPlans: average(results, result => result.metrics.failedPlans),
    fundedAttacks: average(results, result => result.metrics.fundedAttacks),
    pushedAttacks: average(results, result => result.metrics.pushedAttacks),
    directAttacks: average(results, result => result.metrics.directAttacks),
    policyGuidedActions: average(results, result => result.metrics.policyGuidedActions),
    reserveCrewPlacements: average(results, result => result.metrics.reserveCrewPlaced),
    backpacksEquipped: average(results, result => result.metrics.backpacksEquipped),
    runnerDeployments: average(results, result => result.metrics.runnerDeployments),
    payloadDeployments: average(results, result => result.metrics.payloadDeployments),
    runnerOpportunityTurns: average(results, result => result.metrics.runnerOpportunityTurns),
    runnerOpportunityTaken: average(results, result => result.metrics.runnerOpportunityTaken),
    runnerOpportunityMissed: average(results, result => result.metrics.runnerOpportunityMissed),
    runnerReserveOpportunityTurns: average(results, result => result.metrics.runnerReserveOpportunityTurns),
    runnerReserveOpportunityTaken: average(results, result => result.metrics.runnerReserveOpportunityTaken),
    runnerReserveOpportunityMissed: average(results, result => result.metrics.runnerReserveOpportunityMissed),
    runnerEquipOpportunityTurns: average(results, result => result.metrics.runnerEquipOpportunityTurns),
    runnerEquipOpportunityTaken: average(results, result => result.metrics.runnerEquipOpportunityTaken),
    runnerEquipOpportunityMissed: average(results, result => result.metrics.runnerEquipOpportunityMissed),
    runnerDeployOpportunityTurns: average(results, result => result.metrics.runnerDeployOpportunityTurns),
    runnerDeployOpportunityTaken: average(results, result => result.metrics.runnerDeployOpportunityTaken),
    runnerDeployOpportunityMissed: average(results, result => result.metrics.runnerDeployOpportunityMissed),
    runnerPayloadOpportunityTurns: average(results, result => result.metrics.runnerPayloadOpportunityTurns),
    runnerPayloadOpportunityTaken: average(results, result => result.metrics.runnerPayloadOpportunityTaken),
    runnerPayloadOpportunityMissed: average(results, result => result.metrics.runnerPayloadOpportunityMissed),
    runnerOpportunityUseRate:
      average(results, result =>
        result.metrics.runnerOpportunityTurns > 0
          ? result.metrics.runnerOpportunityTaken / result.metrics.runnerOpportunityTurns
          : 0,
      ),
    runnerReserveStartUseRate:
      average(results, result =>
        result.metrics.runnerReserveOpportunityTurns > 0
          ? result.metrics.runnerReserveOpportunityTaken / result.metrics.runnerReserveOpportunityTurns
          : 0,
      ),
    passRatePerTurn: totalPasses / Math.max(1, totalTurns),
  };

  let balance: BalanceAnalysis | undefined;
  if (options.includeBalance) {
    const historyPath = join(process.cwd(), 'sim', 'reports', 'turf', 'balance-history.json');
    balance = analyzeBalanceResults(results, pools, loadBalanceHistory(historyPath));
  }

  return { summary, results, balance };
}
