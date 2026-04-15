import { createRng } from '../cards/rng';
import { generateTurfCardPools } from './catalog';
import { playSimulatedGame } from './benchmark';
import { TURF_SIM_CONFIG, trainPolicyArtifact } from './ai';
import type { TurfGameResult } from './types';

export interface PermutationSweepOptions {
  profile?: keyof typeof TURF_SIM_CONFIG.benchmarkProfiles;
  catalogSeed?: number;
  runSeed?: number;
  crewIds?: string[];
  weaponIds?: string[];
  drugIds?: string[];
}

export interface PermutationSummary {
  forcedIds: string[];
  games: number;
  winRateA: number;
  medianTurns: number;
  p90Turns: number;
  fundedAttacks: number;
  pushedAttacks: number;
  directAttacks: number;
}

export interface PermutationSweepResult {
  permutations: PermutationSummary[];
}

function average(
  results: TurfGameResult[],
  selector: (result: TurfGameResult) => number,
): number {
  return results.reduce((sum, r) => sum + selector(r), 0) / Math.max(1, results.length);
}

function runPermutation(
  forcedIds: string[],
  games: number,
  catalogSeed: number,
  runSeed: number,
): PermutationSummary {
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
      deckPolicyA: { forceIncludeIds: forcedIds },
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
    results.push(playSimulatedGame(seed, {
      pools,
      deckPolicyA: { forceIncludeIds: forcedIds },
      policyArtifact,
    }));
  }

  const turns = results.map(r => r.turnCount).sort((a, b) => a - b);
  const winsA = results.filter(r => r.winner === 'A').length;

  return {
    forcedIds,
    games: results.length,
    winRateA: winsA / Math.max(1, results.length),
    medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
    p90Turns: turns[Math.floor(turns.length * 0.9)] ?? 0,
    fundedAttacks: average(results, r => r.metrics.fundedRecruits),
    pushedAttacks: average(results, r => r.metrics.pushedStrikes),
    directAttacks: average(results, r => r.metrics.directStrikes),
  };
}

function combinations(ids: string[]): string[][] {
  if (ids.length === 0) return [[]];
  return ids.map(id => [id]);
}

export function runPermutationSweep(
  options: PermutationSweepOptions = {},
): PermutationSweepResult {
  const profile = options.profile ?? 'smoke';
  const profileConfig = TURF_SIM_CONFIG.benchmarkProfiles[profile];
  const games = profileConfig.games;
  const catalogSeed = options.catalogSeed ?? profileConfig.catalogSeed;
  const runSeed = options.runSeed ?? profileConfig.runSeed;
  const crewCombos = combinations(options.crewIds ?? []);
  const weaponCombos = combinations(options.weaponIds ?? []);
  const drugCombos = combinations(options.drugIds ?? []);
  const permutations: PermutationSummary[] = [];

  let permutationIndex = 0;
  for (const crewIds of crewCombos) {
    for (const weaponIds of weaponCombos) {
      for (const drugIds of drugCombos) {
        const forcedIds = [...crewIds, ...weaponIds, ...drugIds];
        permutations.push(runPermutation(
          forcedIds,
          games,
          catalogSeed,
          runSeed + permutationIndex,
        ));
        permutationIndex++;
      }
    }
  }

  return { permutations };
}
