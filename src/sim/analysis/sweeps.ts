import { createRng } from '../cards/rng';
import { TURF_SIM_CONFIG, trainPolicyArtifact } from '../turf/ai';
import { generateTurfCardPools } from '../turf/catalog';
import { playTurfGame } from '../turf/game';
import { DEFAULT_TURF_CONFIG, type TurfGameResult } from '../turf/types';

export interface ForcedPermutationResult {
  forcedIds: string[];
  games: number;
  winSeries: number[];
  turnSeries: number[];
  fundedSeries: number[];
  pushedSeries: number[];
  directSeries: number[];
  reserveCrewSeries: number[];
  backpackSeries: number[];
  runnerSeries: number[];
  payloadSeries: number[];
  runnerOpportunitySeries: number[];
  runnerOpportunityTakenSeries: number[];
  runnerReserveOpportunitySeries: number[];
  runnerReserveTakenSeries: number[];
  winRateA: number;
  medianTurns: number;
  p90Turns: number;
  fundedAttacks: number;
  pushedAttacks: number;
  directAttacks: number;
  reserveCrewPlacements: number;
  backpacksEquipped: number;
  runnerDeployments: number;
  payloadDeployments: number;
  runnerOpportunityUseRate: number;
  runnerReserveStartUseRate: number;
}

export interface CuratedSweepResult {
  shape: keyof typeof TURF_SIM_CONFIG.sweepProfiles;
  profile: keyof typeof TURF_SIM_CONFIG.analysisProfiles;
  permutations: ForcedPermutationResult[];
}

export interface CuratedSweepProgress {
  shape: keyof typeof TURF_SIM_CONFIG.sweepProfiles;
  completed: number;
  total: number;
  forcedIds: string[];
}

function average(values: number[]): number {
  return (
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  );
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
    warmupEpisodes.push(
      playTurfGame(DEFAULT_TURF_CONFIG, seed, {
        pools,
        deckPolicyA: { forceIncludeIds: forcedIds },
        capturePolicySamples: true,
        explorationRate: epsilon,
      }),
    );
    epsilon = Math.max(
      TURF_SIM_CONFIG.training.epsilonMin,
      epsilon * TURF_SIM_CONFIG.training.epsilonDecay,
    );
  }

  const policyArtifact = trainPolicyArtifact(
    warmupEpisodes.map((result) => result.policySamples ?? []),
    TURF_SIM_CONFIG.version,
  );

  const results: TurfGameResult[] = [];
  for (let i = 0; i < evalGames; i++) {
    const seed = runRng.int(1, 2147483646);
    results.push(
      playTurfGame(DEFAULT_TURF_CONFIG, seed, {
        pools,
        deckPolicyA: { forceIncludeIds: forcedIds },
        policyArtifact,
      }),
    );
  }

  const wins = results.map((result) => (result.winner === 'A' ? 1 : 0));
  const turns = results.map((result) => result.turnCount).sort((a, b) => a - b);
  const fundedSeries = results.map((result) => result.metrics.fundedAttacks);
  const pushedSeries = results.map((result) => result.metrics.pushedAttacks);
  const directSeries = results.map((result) => result.metrics.directAttacks);
  const reserveCrewSeries = results.map(
    (result) => result.metrics.reserveCrewPlaced,
  );
  const backpackSeries = results.map(
    (result) => result.metrics.backpacksEquipped,
  );
  const runnerSeries = results.map(
    (result) => result.metrics.runnerDeployments,
  );
  const payloadSeries = results.map(
    (result) => result.metrics.payloadDeployments,
  );
  const runnerOpportunitySeries = results.map(
    (result) => result.metrics.runnerOpportunityTurns,
  );
  const runnerOpportunityTakenSeries = results.map(
    (result) => result.metrics.runnerOpportunityTaken,
  );
  const runnerReserveOpportunitySeries = results.map(
    (result) => result.metrics.runnerReserveOpportunityTurns,
  );
  const runnerReserveTakenSeries = results.map(
    (result) => result.metrics.runnerReserveOpportunityTaken,
  );

  return {
    forcedIds,
    games: results.length,
    winSeries: wins,
    turnSeries: results.map((result) => result.turnCount),
    fundedSeries,
    pushedSeries,
    directSeries,
    reserveCrewSeries,
    backpackSeries,
    runnerSeries,
    payloadSeries,
    runnerOpportunitySeries,
    runnerOpportunityTakenSeries,
    runnerReserveOpportunitySeries,
    runnerReserveTakenSeries,
    winRateA: average(wins),
    medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
    p90Turns: turns[Math.floor(turns.length * 0.9)] ?? 0,
    fundedAttacks: average(fundedSeries),
    pushedAttacks: average(pushedSeries),
    directAttacks: average(directSeries),
    reserveCrewPlacements: average(reserveCrewSeries),
    backpacksEquipped: average(backpackSeries),
    runnerDeployments: average(runnerSeries),
    payloadDeployments: average(payloadSeries),
    runnerOpportunityUseRate: average(
      results.map((result) =>
        result.metrics.runnerOpportunityTurns > 0
          ? result.metrics.runnerOpportunityTaken /
            result.metrics.runnerOpportunityTurns
          : 0,
      ),
    ),
    runnerReserveStartUseRate: average(
      results.map((result) =>
        result.metrics.runnerReserveOpportunityTurns > 0
          ? result.metrics.runnerReserveOpportunityTaken /
            result.metrics.runnerReserveOpportunityTurns
          : 0,
      ),
    ),
  };
}

function selectAnchorsByGroup<T extends { id: string }>(
  items: T[],
  count: number,
  groupKey: (item: T) => string,
): string[] {
  if (count <= 0) return [];
  const groups = new Map<string, T[]>();
  const groupOrder: string[] = [];
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(item);
  }

  const selected: string[] = [];
  let round = 0;
  while (selected.length < count) {
    let pickedAny = false;
    for (const key of groupOrder) {
      const group = groups.get(key) ?? [];
      const item = group[round];
      if (!item) continue;
      selected.push(item.id);
      pickedAny = true;
      if (selected.length >= count) break;
    }
    if (!pickedAny) break;
    round++;
  }
  return selected;
}

export function runCuratedSweep(
  shape: keyof typeof TURF_SIM_CONFIG.sweepProfiles,
  profile: keyof typeof TURF_SIM_CONFIG.analysisProfiles = 'quick',
  catalogSeed = TURF_SIM_CONFIG.benchmarkProfiles.smoke.catalogSeed,
  onProgress?: (progress: CuratedSweepProgress) => void,
): CuratedSweepResult {
  const sweepProfile = TURF_SIM_CONFIG.sweepProfiles[shape];
  const analysisProfile = TURF_SIM_CONFIG.analysisProfiles[profile];
  const benchmarkProfile =
    TURF_SIM_CONFIG.benchmarkProfiles[analysisProfile.profile];
  const pools = generateTurfCardPools(catalogSeed, { allUnlocked: true });
  const crewIds = selectAnchorsByGroup(
    pools.crew,
    sweepProfile.crewCount,
    (card) => card.archetype,
  );
  const weaponIds = selectAnchorsByGroup(
    pools.weapons,
    sweepProfile.weaponCount,
    (card) => card.category,
  );
  const drugIds = selectAnchorsByGroup(
    pools.drugs,
    sweepProfile.drugCount,
    (card) => card.category,
  );
  const permutations: ForcedPermutationResult[] = [];
  let permutationIndex = 0;
  const total =
    Math.max(1, crewIds.length || 1) *
    Math.max(1, weaponIds.length || 1) *
    Math.max(1, drugIds.length || 1);

  for (const crewId of crewIds.length > 0 ? crewIds : [undefined]) {
    for (const weaponId of weaponIds.length > 0 ? weaponIds : [undefined]) {
      for (const drugId of drugIds.length > 0 ? drugIds : [undefined]) {
        const forcedIds = [crewId, weaponId, drugId].filter(
          (value): value is string => Boolean(value),
        );
        if (forcedIds.length === 0) continue;
        permutations.push(
          runForcedPermutation(
            forcedIds,
            benchmarkProfile.games,
            catalogSeed,
            benchmarkProfile.runSeed + permutationIndex,
          ),
        );
        permutationIndex++;
        onProgress?.({
          shape,
          completed: permutationIndex,
          total,
          forcedIds,
        });
      }
    }
  }

  return { shape, profile, permutations };
}
