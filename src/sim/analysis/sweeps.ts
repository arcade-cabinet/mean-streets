import { createRng } from '../cards/rng';
import { generateTurfCardPools } from '../turf/catalog';
import { playTurfGame } from '../turf/game';
import { trainPolicyArtifact, TURF_SIM_CONFIG } from '../turf/ai';
import { DEFAULT_TURF_CONFIG, type TurfGameResult } from '../turf/types';

export interface ForcedPermutationResult {
  forcedIds: string[];
  games: number;
  winSeries: number[];
  turnSeries: number[];
  fundedSeries: number[];
  pushedSeries: number[];
  directSeries: number[];
  winRateA: number;
  medianTurns: number;
  p90Turns: number;
  fundedAttacks: number;
  pushedAttacks: number;
  directAttacks: number;
}

export interface CuratedSweepResult {
  shape: keyof typeof TURF_SIM_CONFIG.sweepProfiles;
  profile: keyof typeof TURF_SIM_CONFIG.analysisProfiles;
  permutations: ForcedPermutationResult[];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function runForcedPermutation(
  forcedIds: string[],
  games: number,
  catalogSeed: number,
  runSeed: number,
): ForcedPermutationResult {
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
    warmupEpisodes.push(playTurfGame(DEFAULT_TURF_CONFIG, seed, {
      pools,
      deckPolicyA: { forceIncludeIds: forcedIds },
      capturePolicySamples: true,
      explorationRate: epsilon,
    }));
    epsilon = Math.max(TURF_SIM_CONFIG.training.epsilonMin, epsilon * TURF_SIM_CONFIG.training.epsilonDecay);
  }

  const policyArtifact = trainPolicyArtifact(
    warmupEpisodes.map(result => result.policySamples ?? []),
    TURF_SIM_CONFIG.version,
  );

  const results: TurfGameResult[] = [];
  for (let i = 0; i < evalGames; i++) {
    const seed = runRng.int(1, 2147483646);
    results.push(playTurfGame(DEFAULT_TURF_CONFIG, seed, {
      pools,
      deckPolicyA: { forceIncludeIds: forcedIds },
      policyArtifact,
    }));
  }

  const wins = results.map(result => (result.winner === 'A' ? 1 : 0));
  const turns = results.map(result => result.turnCount).sort((a, b) => a - b);
  const fundedSeries = results.map(result => result.metrics.fundedAttacks);
  const pushedSeries = results.map(result => result.metrics.pushedAttacks);
  const directSeries = results.map(result => result.metrics.directAttacks);

  return {
    forcedIds,
    games: results.length,
    winSeries: wins,
    turnSeries: results.map(result => result.turnCount),
    fundedSeries,
    pushedSeries,
    directSeries,
    winRateA: average(wins),
    medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
    p90Turns: turns[Math.floor(turns.length * 0.9)] ?? 0,
    fundedAttacks: average(fundedSeries),
    pushedAttacks: average(pushedSeries),
    directAttacks: average(directSeries),
  };
}

function selectAnchors<T extends { id: string }>(items: T[], count: number): string[] {
  return items.slice(0, Math.max(0, count)).map(item => item.id);
}

export function runCuratedSweep(
  shape: keyof typeof TURF_SIM_CONFIG.sweepProfiles,
  profile: keyof typeof TURF_SIM_CONFIG.analysisProfiles = 'quick',
  catalogSeed = TURF_SIM_CONFIG.benchmarkProfiles.smoke.catalogSeed,
): CuratedSweepResult {
  const sweepProfile = TURF_SIM_CONFIG.sweepProfiles[shape];
  const analysisProfile = TURF_SIM_CONFIG.analysisProfiles[profile];
  const benchmarkProfile = TURF_SIM_CONFIG.benchmarkProfiles[analysisProfile.profile];
  const pools = generateTurfCardPools(catalogSeed, { allUnlocked: true });
  const crewIds = selectAnchors(pools.crew, sweepProfile.crewCount);
  const weaponIds = selectAnchors(pools.weapons, sweepProfile.weaponCount);
  const drugIds = selectAnchors(pools.drugs, sweepProfile.drugCount);
  const permutations: ForcedPermutationResult[] = [];
  let permutationIndex = 0;

  for (const crewId of crewIds.length > 0 ? crewIds : [undefined]) {
    for (const weaponId of weaponIds.length > 0 ? weaponIds : [undefined]) {
      for (const drugId of drugIds.length > 0 ? drugIds : [undefined]) {
        const forcedIds = [crewId, weaponId, drugId].filter((value): value is string => Boolean(value));
        if (forcedIds.length === 0) continue;
        permutations.push(runForcedPermutation(
          forcedIds,
          benchmarkProfile.games,
          catalogSeed,
          benchmarkProfile.runSeed + permutationIndex,
        ));
        permutationIndex++;
      }
    }
  }

  return { shape, profile, permutations };
}
