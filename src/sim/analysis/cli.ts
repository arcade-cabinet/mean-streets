import { join } from 'node:path';
import { generateTurfCardPools } from '../turf/catalog';
import { saveBalanceHistory } from '../turf/balance';
import type { CardEffectEstimate } from './effects';
import {
  createBenchmarkReport,
  deriveLockRecommendations,
  estimateCardEffects,
  runCuratedSweep,
  runSeededBenchmark,
  summarizeLockRecommendations,
  writeAnalysisJson,
} from './index';
import type { LockRecommendation } from './locking';

const BALANCE_HISTORY_PATH = join(process.cwd(), 'sim', 'reports', 'turf', 'balance-history.json');

interface CardDescriptor {
  label: string;
  family: string;
  type: 'crew' | 'weapon' | 'drug' | 'backpack';
}

interface SelectedPairingSummary {
  forcedIds: string[];
  winRateDelta: number;
}

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function printLockSummary(summary: {
  totalCards: number;
  unmeasured: number;
  unstable: number;
  provisionallyStable: number;
  locked: number;
  runnerReserveStartRiskCards: string[];
  volatilityOnlyUnstableCards: string[];
}): void {
  console.log('\nLock Summary');
  console.log(`  Total Cards:                ${summary.totalCards}`);
  console.log(`  Locked:                     ${summary.locked}`);
  console.log(`  Provisionally Stable:       ${summary.provisionallyStable}`);
  console.log(`  Unstable:                   ${summary.unstable}`);
  console.log(`  Unmeasured:                 ${summary.unmeasured}`);
  console.log(
    `  Reserve-Start Risk Cards:   ${summary.runnerReserveStartRiskCards.length}`,
  );
  if (summary.runnerReserveStartRiskCards.length > 0) {
    console.log(
      `  Reserve-Start Risk IDs:     ${summary.runnerReserveStartRiskCards.join(', ')}`,
    );
  }
  console.log(
    `  Volatility-Only Unstable:   ${summary.volatilityOnlyUnstableCards.length}`,
  );
  if (summary.volatilityOnlyUnstableCards.length > 0) {
    console.log(
      `  Volatility-Only IDs:        ${summary.volatilityOnlyUnstableCards.join(', ')}`,
    );
  }
}

function printVolatilityOnlyGuidance(
  summary: {
    volatilityOnlyUnstableCards: string[];
  },
  profile: 'quick' | 'standard' | 'release',
): void {
  if (summary.volatilityOnlyUnstableCards.length === 0) return;
  if (profile !== 'quick') return;
  console.log('\nTriage Note');
  console.log(
    '  Quick-profile volatility-only cards should be confirmed with a deeper focus run before balance changes.',
  );
  console.log(
    `  Suggested next step: pnpm exec tsx src/sim/analysis/cli.ts focus --profile standard --cards ${summary.volatilityOnlyUnstableCards.join(',')}`,
  );
}

function resolveCardDescriptors(
  catalogSeed: number,
): Map<string, CardDescriptor> {
  const pools = generateTurfCardPools(catalogSeed, { allUnlocked: true });
  const descriptors = new Map<string, CardDescriptor>();
  for (const card of pools.crew) {
    descriptors.set(card.id, {
      label: `${card.displayName} [crew:${card.archetype}/${card.affiliation}]`,
      family: `crew:${card.archetype}`,
      type: 'crew',
    });
  }
  for (const card of pools.weapons) {
    descriptors.set(card.id, {
      label: `${card.name} [weapon:${card.category}/+${card.bonus}]`,
      family: `weapon:${card.category}/+${card.bonus}`,
      type: 'weapon',
    });
  }
  for (const card of pools.drugs) {
    descriptors.set(card.id, {
      label: `${card.name} [drug:${card.category}/${card.potency}]`,
      family: `drug:${card.category}/${card.potency}`,
      type: 'drug',
    });
  }
  for (const card of pools.backpacks) {
    descriptors.set(card.id, {
      label: `${card.name} [backpack:${card.size}]`,
      family: `backpack:${card.size}`,
      type: 'backpack',
    });
  }
  return descriptors;
}

function selectRelevantSweepShapes(
  selectedCardIds: string[],
  descriptors: Map<string, CardDescriptor>,
): Array<'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug'> {
  const selectedTypes = new Set(
    selectedCardIds
      .map((cardId) => descriptors.get(cardId)?.type)
      .filter(
        (type): type is 'crew' | 'weapon' | 'drug' | 'backpack' =>
          type !== undefined,
      ),
  );

  const shapes: Array<
    'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug'
  > = [];

  if (selectedTypes.has('crew')) {
    shapes.push('crew_weapon', 'crew_drug', 'crew_weapon_drug');
  }
  if (selectedTypes.has('weapon')) {
    if (!shapes.includes('crew_weapon')) shapes.push('crew_weapon');
    if (!shapes.includes('weapon_drug')) shapes.push('weapon_drug');
    if (!shapes.includes('crew_weapon_drug')) shapes.push('crew_weapon_drug');
  }
  if (selectedTypes.has('drug')) {
    if (!shapes.includes('crew_drug')) shapes.push('crew_drug');
    if (!shapes.includes('weapon_drug')) shapes.push('weapon_drug');
    if (!shapes.includes('crew_weapon_drug')) shapes.push('crew_weapon_drug');
  }
  if (selectedTypes.has('backpack')) {
    if (!shapes.includes('crew_weapon_drug')) shapes.push('crew_weapon_drug');
  }

  return shapes.length > 0
    ? shapes
    : ['crew_weapon', 'crew_drug', 'weapon_drug', 'crew_weapon_drug'];
}

function printUnstableRecommendations(
  recommendations: LockRecommendation[],
  descriptors: Map<string, CardDescriptor>,
): void {
  const unstable = recommendations.filter(
    (recommendation) => recommendation.state === 'unstable',
  );
  if (unstable.length === 0) return;
  console.log('\nUnstable Cards');
  for (const recommendation of unstable) {
    const label =
      descriptors.get(recommendation.cardId)?.label ?? recommendation.cardId;
    console.log(`  ${recommendation.cardId}  ${label}`);
    for (const reason of recommendation.reasons) {
      console.log(`    - ${reason}`);
    }
  }
}

function createUnstableDetails(
  recommendations: LockRecommendation[],
  descriptors: Map<string, CardDescriptor>,
): Array<{ cardId: string; label: string; family: string; reasons: string[] }> {
  return recommendations
    .filter((recommendation) => recommendation.state === 'unstable')
    .map((recommendation) => ({
      cardId: recommendation.cardId,
      label:
        descriptors.get(recommendation.cardId)?.label ?? recommendation.cardId,
      family: descriptors.get(recommendation.cardId)?.family ?? 'unknown',
      reasons: recommendation.reasons,
    }));
}

function createUnstableFamilySummary(
  unstableDetails: Array<{
    cardId: string;
    label: string;
    family: string;
    reasons: string[];
  }>,
): Array<{ family: string; count: number; cardIds: string[] }> {
  const families = new Map<
    string,
    { family: string; count: number; cardIds: string[] }
  >();
  for (const detail of unstableDetails) {
    const existing = families.get(detail.family);
    if (existing) {
      existing.count++;
      existing.cardIds.push(detail.cardId);
      continue;
    }
    families.set(detail.family, {
      family: detail.family,
      count: 1,
      cardIds: [detail.cardId],
    });
  }
  return [...families.values()].sort(
    (a, b) => b.count - a.count || a.family.localeCompare(b.family),
  );
}

function printUnstableFamilySummary(
  familySummary: Array<{ family: string; count: number; cardIds: string[] }>,
): void {
  if (familySummary.length === 0) return;
  console.log('\nUnstable Families');
  for (const family of familySummary) {
    console.log(`  ${family.family}  (${family.count})`);
    console.log(`    ${family.cardIds.join(', ')}`);
  }
}

function createFamilyEffectSummary(
  effects: CardEffectEstimate[],
  descriptors: Map<string, CardDescriptor>,
): Array<{
  family: string;
  count: number;
  averageWinRateDelta: number;
  maxAbsWinRateDelta: number;
  averageReserveStartRateDelta: number;
  cardIds: string[];
}> {
  const families = new Map<
    string,
    {
      family: string;
      count: number;
      totalWinRateDelta: number;
      maxAbsWinRateDelta: number;
      totalReserveStartRateDelta: number;
      cardIds: string[];
    }
  >();

  for (const effect of effects) {
    const family = descriptors.get(effect.cardId)?.family ?? 'unknown';
    const existing = families.get(family);
    if (existing) {
      existing.count++;
      existing.totalWinRateDelta += effect.winRateDelta;
      existing.maxAbsWinRateDelta = Math.max(
        existing.maxAbsWinRateDelta,
        Math.abs(effect.winRateDelta),
      );
      existing.totalReserveStartRateDelta +=
        effect.runnerReserveStartUseRateDelta;
      existing.cardIds.push(effect.cardId);
      continue;
    }
    families.set(family, {
      family,
      count: 1,
      totalWinRateDelta: effect.winRateDelta,
      maxAbsWinRateDelta: Math.abs(effect.winRateDelta),
      totalReserveStartRateDelta: effect.runnerReserveStartUseRateDelta,
      cardIds: [effect.cardId],
    });
  }

  return [...families.values()]
    .map((entry) => ({
      family: entry.family,
      count: entry.count,
      averageWinRateDelta: entry.totalWinRateDelta / entry.count,
      maxAbsWinRateDelta: entry.maxAbsWinRateDelta,
      averageReserveStartRateDelta:
        entry.totalReserveStartRateDelta / entry.count,
      cardIds: entry.cardIds,
    }))
    .sort(
      (a, b) =>
        b.maxAbsWinRateDelta - a.maxAbsWinRateDelta || b.count - a.count,
    );
}

function printTopFamilyEffects(
  families: Array<{
    family: string;
    count: number;
    averageWinRateDelta: number;
    maxAbsWinRateDelta: number;
    averageReserveStartRateDelta: number;
    cardIds: string[];
  }>,
): void {
  const top = families.slice(0, 6);
  if (top.length === 0) return;
  console.log('\nTop Family Effects');
  for (const family of top) {
    console.log(
      `  ${family.family}  count=${family.count}  avgΔ=${family.averageWinRateDelta.toFixed(4)}  max|Δ|=${family.maxAbsWinRateDelta.toFixed(4)}  avg reserveΔ=${family.averageReserveStartRateDelta.toFixed(4)}`,
    );
  }
}

function createUnstablePairingSummary(
  unstableCardIds: string[],
  permutations: Array<{ forcedIds: string[]; winRateA: number }>,
  baselineWinRate: number,
): SelectedPairingSummary[] {
  return permutations
    .filter((permutation) =>
      permutation.forcedIds.some((id) => unstableCardIds.includes(id)),
    )
    .map((permutation) => ({
      forcedIds: permutation.forcedIds,
      winRateDelta: permutation.winRateA - baselineWinRate,
    }))
    .sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta))
    .slice(0, 8);
}

function printUnstablePairingSummary(
  pairings: SelectedPairingSummary[],
  descriptors: Map<string, CardDescriptor>,
): void {
  if (pairings.length === 0) return;
  console.log('\nTop Unstable Pairings');
  for (const pairing of pairings) {
    const labels = pairing.forcedIds.map(
      (id) => descriptors.get(id)?.label ?? id,
    );
    console.log(
      `  ${pairing.forcedIds.join(' + ')}  Δ${pairing.winRateDelta.toFixed(4)}`,
    );
    console.log(`    ${labels.join('  |  ')}`);
  }
}

function getArgList(flag: string): string[] {
  const value = getArg(flag);
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createSelectedPairingSummary(
  selectedCardIds: string[],
  permutations: Array<{ forcedIds: string[]; winRateA: number }>,
  baselineWinRate: number,
): SelectedPairingSummary[] {
  return permutations
    .filter((permutation) =>
      permutation.forcedIds.some((id) => selectedCardIds.includes(id)),
    )
    .map((permutation) => ({
      forcedIds: permutation.forcedIds,
      winRateDelta: permutation.winRateA - baselineWinRate,
    }))
    .sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta))
    .slice(0, 12);
}

function printFocusedEffects(
  effects: CardEffectEstimate[],
  descriptors: Map<string, CardDescriptor>,
): void {
  if (effects.length === 0) return;
  console.log('\nFocused Cards');
  for (const effect of effects) {
    const label = descriptors.get(effect.cardId)?.label ?? effect.cardId;
    console.log(`  ${effect.cardId}  ${label}`);
    console.log(
      `    winΔ=${effect.winRateDelta.toFixed(4)}  volatility=${effect.volatility.toFixed(4)}  p=${effect.winRatePValue.toFixed(4)}`,
    );
    console.log(
      `    turnsΔ=${effect.medianTurnDelta.toFixed(4)}  fundedΔ=${effect.fundedDelta.toFixed(4)}  pushedΔ=${effect.pushedDelta.toFixed(4)}  directΔ=${effect.directDelta.toFixed(4)}`,
    );
    console.log(
      `    reserveΔ=${effect.reserveCrewDelta.toFixed(4)}  backpacksΔ=${effect.backpacksEquippedDelta.toFixed(4)}  runnersΔ=${effect.runnerDeploymentsDelta.toFixed(4)}  payloadΔ=${effect.payloadDeploymentsDelta.toFixed(4)}`,
    );
    console.log(
      `    runnerUseΔ=${effect.runnerOpportunityUseRateDelta.toFixed(4)}  reserveStartΔ=${effect.runnerReserveStartUseRateDelta.toFixed(4)}`,
    );
  }
}

function logPhase(message: string): void {
  console.log(`\n[analysis] ${message}`);
}

function writeProgressArtifact(
  group: 'locks' | 'focus',
  fileName: string,
  payload: Record<string, unknown>,
): void {
  writeAnalysisJson(group, fileName, {
    updatedAt: new Date().toISOString(),
    ...payload,
  });
}

function writeSweepProgress(
  group: 'locks' | 'focus',
  fileName: string,
  payload: {
    profile: 'quick' | 'standard' | 'release';
    baselineProfile: 'smoke' | 'ci' | 'release';
    shape: 'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug';
    completed: number;
    total: number;
    forcedIds: string[];
    permutationCount?: number;
    selectedCardIds?: string[];
  },
): void {
  writeProgressArtifact(group, fileName, {
    phase: 'sweep_in_progress',
    ...payload,
  });
}

async function main(): Promise<void> {
  const [command = 'benchmark'] = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'));
  if (command === 'benchmark') {
    const profile = (getArg('--profile') ?? 'ci') as 'smoke' | 'ci' | 'release';
    logPhase(`benchmark profile=${profile}`);
    const run = runSeededBenchmark(profile, { includeBalance: true });
    const path = writeAnalysisJson(
      'benchmarks',
      `benchmark-${profile}.json`,
      createBenchmarkReport(run),
    );
    console.log(path);
    return;
  }

  if (command === 'sweep') {
    const shape = (getArg('--shape') ?? 'crew_weapon') as
      | 'crew_weapon'
      | 'crew_drug'
      | 'weapon_drug'
      | 'crew_weapon_drug';
    const profile = (getArg('--profile') ?? 'quick') as
      | 'quick'
      | 'standard'
      | 'release';
    logPhase(`sweep shape=${shape} profile=${profile}`);
    const sweep = runCuratedSweep(shape, profile);
    const path = writeAnalysisJson(
      'sweeps',
      `sweep-${shape}-${profile}.json`,
      sweep,
    );
    console.log(path);
    return;
  }

  if (command === 'lock') {
    const profile = (getArg('--profile') ?? 'standard') as
      | 'quick'
      | 'standard'
      | 'release';
    const baselineProfile =
      profile === 'release'
        ? 'release'
        : profile === 'standard'
          ? 'ci'
          : 'smoke';
    const progressFile = `lock-${profile}.progress.json`;
    logPhase(`lock profile=${profile} baseline=${baselineProfile}`);
    writeProgressArtifact('locks', progressFile, {
      phase: 'starting',
      profile,
      baselineProfile,
    });
    logPhase('running seeded benchmark');
    const baseline = runSeededBenchmark(baselineProfile, {
      includeBalance: true,
    });
    writeProgressArtifact('locks', progressFile, {
      phase: 'baseline_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
    });
    logPhase('running curated sweep crew_weapon');
    const crewWeapon = runCuratedSweep(
      'crew_weapon',
      profile,
      baseline.summary.catalogSeed,
      (progress) =>
        writeSweepProgress('locks', progressFile, {
          profile,
          baselineProfile,
          shape: progress.shape,
          completed: progress.completed,
          total: progress.total,
          forcedIds: progress.forcedIds,
          permutationCount: progress.completed,
        }),
    ).permutations;
    writeProgressArtifact('locks', progressFile, {
      phase: 'crew_weapon_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
      permutationCount: crewWeapon.length,
    });
    logPhase('running curated sweep crew_drug');
    const crewDrug = runCuratedSweep(
      'crew_drug',
      profile,
      baseline.summary.catalogSeed,
      (progress) =>
        writeSweepProgress('locks', progressFile, {
          profile,
          baselineProfile,
          shape: progress.shape,
          completed: progress.completed,
          total: progress.total,
          forcedIds: progress.forcedIds,
          permutationCount: crewWeapon.length + progress.completed,
        }),
    ).permutations;
    writeProgressArtifact('locks', progressFile, {
      phase: 'crew_drug_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
      permutationCount: crewWeapon.length + crewDrug.length,
    });
    logPhase('running curated sweep weapon_drug');
    const weaponDrug = runCuratedSweep(
      'weapon_drug',
      profile,
      baseline.summary.catalogSeed,
      (progress) =>
        writeSweepProgress('locks', progressFile, {
          profile,
          baselineProfile,
          shape: progress.shape,
          completed: progress.completed,
          total: progress.total,
          forcedIds: progress.forcedIds,
          permutationCount:
            crewWeapon.length + crewDrug.length + progress.completed,
        }),
    ).permutations;
    writeProgressArtifact('locks', progressFile, {
      phase: 'weapon_drug_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
      permutationCount: crewWeapon.length + crewDrug.length + weaponDrug.length,
    });
    logPhase('running curated sweep crew_weapon_drug');
    const crewWeaponDrug = runCuratedSweep(
      'crew_weapon_drug',
      profile,
      baseline.summary.catalogSeed,
      (progress) =>
        writeSweepProgress('locks', progressFile, {
          profile,
          baselineProfile,
          shape: progress.shape,
          completed: progress.completed,
          total: progress.total,
          forcedIds: progress.forcedIds,
          permutationCount:
            crewWeapon.length +
            crewDrug.length +
            weaponDrug.length +
            progress.completed,
        }),
    ).permutations;
    const sweeps = [
      ...crewWeapon,
      ...crewDrug,
      ...weaponDrug,
      ...crewWeaponDrug,
    ];
    writeProgressArtifact('locks', progressFile, {
      phase: 'sweeps_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
      permutationCount: sweeps.length,
    });
    logPhase(`estimating effects across ${sweeps.length} permutations`);
    const effects = estimateCardEffects(baseline, sweeps, profile, (progress) =>
      writeProgressArtifact('locks', progressFile, {
        phase: 'effects_in_progress',
        profile,
        baselineProfile,
        permutationCount: sweeps.length,
        completedEffects: progress.completed,
        totalEffects: progress.total,
        cardId: progress.cardId,
      }),
    );
    writeProgressArtifact('locks', progressFile, {
      phase: 'effects_complete',
      profile,
      baselineProfile,
      benchmark: createBenchmarkReport(baseline),
      permutationCount: sweeps.length,
      effectCount: effects.cardEffects.length,
    });
    logPhase('deriving lock recommendations');
    const locks = deriveLockRecommendations(effects);
    const summary = summarizeLockRecommendations(locks);
    const descriptors = resolveCardDescriptors(baseline.summary.catalogSeed);
    const familyEffectSummary = createFamilyEffectSummary(
      effects.cardEffects,
      descriptors,
    );
    const unstableDetails = createUnstableDetails(
      locks.recommendations,
      descriptors,
    );
    const unstableFamilySummary = createUnstableFamilySummary(unstableDetails);
    const unstablePairingSummary = createUnstablePairingSummary(
      unstableDetails.map((detail) => detail.cardId),
      sweeps,
      baseline.summary.winRateA,
    );
    const path = writeAnalysisJson('locks', `lock-${profile}.json`, {
      benchmark: createBenchmarkReport(baseline),
      effects,
      locks,
      summary,
      familyEffectSummary,
      unstableDetails,
      unstableFamilySummary,
      unstablePairingSummary,
    });
    writeProgressArtifact('locks', progressFile, {
      phase: 'complete',
      profile,
      baselineProfile,
      outputPath: path,
      summary,
    });
    printLockSummary(summary);
    printVolatilityOnlyGuidance(summary, profile);
    printTopFamilyEffects(familyEffectSummary);
    printUnstableRecommendations(locks.recommendations, descriptors);
    printUnstableFamilySummary(unstableFamilySummary);
    printUnstablePairingSummary(unstablePairingSummary, descriptors);
    if (process.argv.includes('--persist') && baseline.balance) {
      saveBalanceHistory(BALANCE_HISTORY_PATH, baseline.balance.history);
      console.log(`[analysis] balance-history persisted -> ${BALANCE_HISTORY_PATH}`);
    }
    console.log(path);
    return;
  }

  if (command === 'focus') {
    const profile = (getArg('--profile') ?? 'quick') as
      | 'quick'
      | 'standard'
      | 'release';
    const selectedCardIds = getArgList('--cards');
    if (selectedCardIds.length === 0) {
      throw new Error('focus requires --cards card-001,drug-01');
    }

    const baselineProfile =
      profile === 'release'
        ? 'release'
        : profile === 'standard'
          ? 'ci'
          : 'smoke';
    const progressFile = `focus-${profile}-${selectedCardIds.join('-')}.progress.json`;
    logPhase(
      `focus profile=${profile} baseline=${baselineProfile} cards=${selectedCardIds.join(',')}`,
    );
    const baseline = runSeededBenchmark(baselineProfile, {
      includeBalance: true,
    });
    writeProgressArtifact('focus', progressFile, {
      phase: 'baseline_complete',
      profile,
      baselineProfile,
      selectedCardIds,
      benchmark: createBenchmarkReport(baseline),
    });
    const descriptors = resolveCardDescriptors(baseline.summary.catalogSeed);
    const shapes = selectRelevantSweepShapes(selectedCardIds, descriptors);
    const sweeps = shapes.flatMap((shape) => {
      logPhase(`running curated sweep ${shape}`);
      return runCuratedSweep(
        shape,
        profile,
        baseline.summary.catalogSeed,
        (progress) =>
          writeSweepProgress('focus', progressFile, {
            profile,
            baselineProfile,
            shape: progress.shape,
            completed: progress.completed,
            total: progress.total,
            forcedIds: progress.forcedIds,
            permutationCount: progress.completed,
            selectedCardIds,
          }),
      ).permutations;
    });
    writeProgressArtifact('focus', progressFile, {
      phase: 'sweeps_complete',
      profile,
      baselineProfile,
      selectedCardIds,
      shapes,
      permutationCount: sweeps.length,
    });
    logPhase(`estimating effects across ${sweeps.length} permutations`);
    const effects = estimateCardEffects(baseline, sweeps, profile, (progress) =>
      writeProgressArtifact('focus', progressFile, {
        phase: 'effects_in_progress',
        profile,
        baselineProfile,
        selectedCardIds,
        permutationCount: sweeps.length,
        completedEffects: progress.completed,
        totalEffects: progress.total,
        cardId: progress.cardId,
      }),
    );
    const focusedEffects = effects.cardEffects.filter((effect) =>
      selectedCardIds.includes(effect.cardId),
    );
    const pairingSummary = createSelectedPairingSummary(
      selectedCardIds,
      sweeps,
      baseline.summary.winRateA,
    );
    const path = writeAnalysisJson(
      'focus',
      `focus-${profile}-${selectedCardIds.join('-')}.json`,
      {
        benchmark: createBenchmarkReport(baseline),
        focusedEffects,
        pairingSummary,
      },
    );
    writeProgressArtifact('focus', progressFile, {
      phase: 'complete',
      profile,
      baselineProfile,
      selectedCardIds,
      outputPath: path,
      focusedCardCount: focusedEffects.length,
    });
    printFocusedEffects(focusedEffects, descriptors);
    printUnstablePairingSummary(pairingSummary, descriptors);
    console.log(path);
    return;
  }

  throw new Error(`Unknown analysis command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
