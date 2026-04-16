import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
import {
  commitAutobalanceIteration,
  gitWorkingTreeClean,
  runAutobalanceIteration,
  type AutobalanceEdit,
} from './autobalance';

const BALANCE_HISTORY_PATH = join(
  process.cwd(), 'sim', 'reports', 'turf', 'balance-history.json',
);

interface CardDescriptor {
  label: string;
  family: string;
  type: 'tough' | 'weapon' | 'drug';
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

function getArgList(flag: string): string[] {
  const value = getArg(flag);
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function printLockSummary(summary: {
  totalCards: number;
  unmeasured: number;
  unstable: number;
  provisionallyStable: number;
  locked: number;
  volatilityOnlyUnstableCards: string[];
}): void {
  console.log('\nLock Summary');
  console.log(`  Total Cards:                ${summary.totalCards}`);
  console.log(`  Locked:                     ${summary.locked}`);
  console.log(`  Provisionally Stable:       ${summary.provisionallyStable}`);
  console.log(`  Unstable:                   ${summary.unstable}`);
  console.log(`  Unmeasured:                 ${summary.unmeasured}`);
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
  summary: { volatilityOnlyUnstableCards: string[] },
  profile: 'quick' | 'standard' | 'release',
): void {
  if (summary.volatilityOnlyUnstableCards.length === 0) return;
  if (profile !== 'quick') return;
  console.log('\nTriage Note');
  console.log(
    '  Quick-profile volatility-only cards should be confirmed with a deeper focus run.',
  );
  console.log(
    `  Suggested: pnpm exec tsx src/sim/analysis/cli.ts focus --profile standard --cards ${summary.volatilityOnlyUnstableCards.join(',')}`,
  );
}

function resolveCardDescriptors(
  catalogSeed: number,
): Map<string, CardDescriptor> {
  const pools = generateTurfCardPools(catalogSeed, { allUnlocked: true });
  const descriptors = new Map<string, CardDescriptor>();
  for (const card of pools.crew) {
    descriptors.set(card.id, {
      label: `${card.name} [tough:${card.archetype}/${card.affiliation}]`,
      family: `tough:${card.archetype}`,
      type: 'tough',
    });
  }
  for (const card of pools.weapons) {
    descriptors.set(card.id, {
      label: `${card.name} [weapon:${card.category}/+${card.power}]`,
      family: `weapon:${card.category}/+${card.power}`,
      type: 'weapon',
    });
  }
  for (const card of pools.drugs) {
    descriptors.set(card.id, {
      label: `${card.name} [drug:${card.category}/${card.power}]`,
      family: `drug:${card.category}/${card.power}`,
      type: 'drug',
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
      .map(id => descriptors.get(id)?.type)
      .filter((t): t is 'tough' | 'weapon' | 'drug' => t !== undefined),
  );
  const shapes: Array<'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug'> = [];
  if (selectedTypes.has('tough')) {
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
  return shapes.length > 0
    ? shapes
    : ['crew_weapon', 'crew_drug', 'weapon_drug', 'crew_weapon_drug'];
}

function printUnstableRecommendations(
  recommendations: LockRecommendation[],
  descriptors: Map<string, CardDescriptor>,
): void {
  const unstable = recommendations.filter(r => r.state === 'unstable');
  if (unstable.length === 0) return;
  console.log('\nUnstable Cards');
  for (const rec of unstable) {
    const label = descriptors.get(rec.cardId)?.label ?? rec.cardId;
    console.log(`  ${rec.cardId}  ${label}`);
    for (const reason of rec.reasons) {
      console.log(`    - ${reason}`);
    }
  }
}

function createUnstableDetails(
  recommendations: LockRecommendation[],
  descriptors: Map<string, CardDescriptor>,
): Array<{ cardId: string; label: string; family: string; reasons: string[] }> {
  return recommendations
    .filter(r => r.state === 'unstable')
    .map(r => ({
      cardId: r.cardId,
      label: descriptors.get(r.cardId)?.label ?? r.cardId,
      family: descriptors.get(r.cardId)?.family ?? 'unknown',
      reasons: r.reasons,
    }));
}

function createUnstableFamilySummary(
  unstableDetails: Array<{ cardId: string; family: string }>,
): Array<{ family: string; count: number; cardIds: string[] }> {
  const families = new Map<string, { family: string; count: number; cardIds: string[] }>();
  for (const detail of unstableDetails) {
    const existing = families.get(detail.family);
    if (existing) {
      existing.count++;
      existing.cardIds.push(detail.cardId);
    } else {
      families.set(detail.family, {
        family: detail.family, count: 1, cardIds: [detail.cardId],
      });
    }
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
  cardIds: string[];
}> {
  const families = new Map<string, {
    family: string; count: number; totalWinRateDelta: number;
    maxAbsWinRateDelta: number; cardIds: string[];
  }>();
  for (const effect of effects) {
    const family = descriptors.get(effect.cardId)?.family ?? 'unknown';
    const existing = families.get(family);
    if (existing) {
      existing.count++;
      existing.totalWinRateDelta += effect.winRateDelta;
      existing.maxAbsWinRateDelta = Math.max(
        existing.maxAbsWinRateDelta, Math.abs(effect.winRateDelta),
      );
      existing.cardIds.push(effect.cardId);
    } else {
      families.set(family, {
        family, count: 1,
        totalWinRateDelta: effect.winRateDelta,
        maxAbsWinRateDelta: Math.abs(effect.winRateDelta),
        cardIds: [effect.cardId],
      });
    }
  }
  return [...families.values()]
    .map(e => ({
      family: e.family, count: e.count,
      averageWinRateDelta: e.totalWinRateDelta / e.count,
      maxAbsWinRateDelta: e.maxAbsWinRateDelta,
      cardIds: e.cardIds,
    }))
    .sort((a, b) => b.maxAbsWinRateDelta - a.maxAbsWinRateDelta || b.count - a.count);
}

function printTopFamilyEffects(
  families: Array<{
    family: string; count: number; averageWinRateDelta: number;
    maxAbsWinRateDelta: number;
  }>,
): void {
  const top = families.slice(0, 6);
  if (top.length === 0) return;
  console.log('\nTop Family Effects');
  for (const fam of top) {
    console.log(
      `  ${fam.family}  count=${fam.count}  avgΔ=${fam.averageWinRateDelta.toFixed(4)}  max|Δ|=${fam.maxAbsWinRateDelta.toFixed(4)}`,
    );
  }
}

function createUnstablePairingSummary(
  unstableCardIds: string[],
  permutations: Array<{ forcedIds: string[]; winRateA: number }>,
  baselineWinRate: number,
): SelectedPairingSummary[] {
  return permutations
    .filter(p => p.forcedIds.some(id => unstableCardIds.includes(id)))
    .map(p => ({ forcedIds: p.forcedIds, winRateDelta: p.winRateA - baselineWinRate }))
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
    const labels = pairing.forcedIds.map(id => descriptors.get(id)?.label ?? id);
    console.log(`  ${pairing.forcedIds.join(' + ')}  Δ${pairing.winRateDelta.toFixed(4)}`);
    console.log(`    ${labels.join('  |  ')}`);
  }
}

function createSelectedPairingSummary(
  selectedCardIds: string[],
  permutations: Array<{ forcedIds: string[]; winRateA: number }>,
  baselineWinRate: number,
): SelectedPairingSummary[] {
  return permutations
    .filter(p => p.forcedIds.some(id => selectedCardIds.includes(id)))
    .map(p => ({ forcedIds: p.forcedIds, winRateDelta: p.winRateA - baselineWinRate }))
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
  }
}

function logPhase(message: string): void {
  console.log(`\n[analysis] ${message}`);
}

function writeProgressArtifact(
  group: string,
  fileName: string,
  payload: Record<string, unknown>,
): void {
  writeAnalysisJson(group, fileName, {
    updatedAt: new Date().toISOString(),
    ...payload,
  });
}

export function parseCommand(argv: string[]): string {
  // The verb is always the leading positional token:
  //     cli.ts <verb> --flag value --flag value ...
  // Flags-only invocations (`cli.ts --profile release`) previously mis-parsed
  // `release` as the verb because the old code stripped all `--*` tokens and
  // picked the first remaining arg — which happened to be a flag value.
  // Fix: if argv[0] is missing or itself a flag, default to 'benchmark'.
  const first = argv[0];
  if (first === undefined || first.startsWith('--')) {
    return 'benchmark';
  }
  return first;
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));

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
      | 'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug';
    const profile = (getArg('--profile') ?? 'quick') as 'quick' | 'standard' | 'release';
    logPhase(`sweep shape=${shape} profile=${profile}`);
    const sweep = runCuratedSweep(shape, profile);
    const path = writeAnalysisJson('sweeps', `sweep-${shape}-${profile}.json`, sweep);
    console.log(path);
    return;
  }

  if (command === 'lock') {
    const profile = (getArg('--profile') ?? 'standard') as 'quick' | 'standard' | 'release';
    const baselineProfile = profile === 'release' ? 'release' : profile === 'standard' ? 'ci' : 'smoke';
    const progressFile = `lock-${profile}.progress.json`;
    logPhase(`lock profile=${profile} baseline=${baselineProfile}`);

    logPhase('running seeded benchmark');
    const baseline = runSeededBenchmark(baselineProfile, { includeBalance: true });
    writeProgressArtifact('locks', progressFile, {
      phase: 'baseline_complete', profile, baselineProfile,
    });

    const sweepShapes = ['crew_weapon', 'crew_drug', 'weapon_drug', 'crew_weapon_drug'] as const;
    const allSweeps = sweepShapes.flatMap(shape => {
      logPhase(`running curated sweep ${shape}`);
      return runCuratedSweep(shape, profile, baseline.summary.catalogSeed).permutations;
    });

    logPhase(`estimating effects across ${allSweeps.length} permutations`);
    const effects = estimateCardEffects(baseline, allSweeps, profile);
    const locks = deriveLockRecommendations(effects);
    const summary = summarizeLockRecommendations(locks);
    const descriptors = resolveCardDescriptors(baseline.summary.catalogSeed);
    const familyEffectSummary = createFamilyEffectSummary(effects.cardEffects, descriptors);
    const unstableDetails = createUnstableDetails(locks.recommendations, descriptors);
    const unstableFamilySummary = createUnstableFamilySummary(unstableDetails);
    const unstablePairingSummary = createUnstablePairingSummary(
      unstableDetails.map(d => d.cardId), allSweeps, baseline.summary.winRateA,
    );
    const path = writeAnalysisJson('locks', `lock-${profile}.json`, {
      benchmark: createBenchmarkReport(baseline),
      effects, locks, summary,
      familyEffectSummary, unstableDetails, unstableFamilySummary, unstablePairingSummary,
    });
    writeProgressArtifact('locks', progressFile, {
      phase: 'complete', profile, baselineProfile, outputPath: path, summary,
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
    const profile = (getArg('--profile') ?? 'quick') as 'quick' | 'standard' | 'release';
    const selectedCardIds = getArgList('--cards');
    if (selectedCardIds.length === 0) {
      throw new Error('focus requires --cards card-001,drug-01');
    }
    const baselineProfile = profile === 'release' ? 'release' : profile === 'standard' ? 'ci' : 'smoke';
    logPhase(`focus profile=${profile} baseline=${baselineProfile} cards=${selectedCardIds.join(',')}`);
    const baseline = runSeededBenchmark(baselineProfile, { includeBalance: true });
    const descriptors = resolveCardDescriptors(baseline.summary.catalogSeed);
    const shapes = selectRelevantSweepShapes(selectedCardIds, descriptors);
    const sweeps = shapes.flatMap(shape => {
      logPhase(`running curated sweep ${shape}`);
      return runCuratedSweep(shape, profile, baseline.summary.catalogSeed).permutations;
    });
    const effects = estimateCardEffects(baseline, sweeps, profile);
    const focusedEffects = effects.cardEffects.filter(e => selectedCardIds.includes(e.cardId));
    const pairingSummary = createSelectedPairingSummary(selectedCardIds, sweeps, baseline.summary.winRateA);
    const path = writeAnalysisJson(
      'focus',
      `focus-${profile}-${selectedCardIds.join('-')}.json`,
      { benchmark: createBenchmarkReport(baseline), focusedEffects, pairingSummary },
    );
    printFocusedEffects(focusedEffects, descriptors);
    printUnstablePairingSummary(pairingSummary, descriptors);
    console.log(path);
    return;
  }

  if (command === 'autobalance') {
    const profile = (getArg('--profile') ?? 'standard') as 'quick' | 'standard' | 'release';
    const baselineProfile = profile === 'release' ? 'release' : profile === 'standard' ? 'ci' : 'smoke';
    const iterations = Number.parseInt(getArg('--iterations') ?? '1', 10);
    const noCommit = process.argv.includes('--no-commit');
    const dryRun = process.argv.includes('--dry-run');
    const maxEditsArg = getArg('--max-edits');
    const maxEdits = maxEditsArg ? Number.parseInt(maxEditsArg, 10) : undefined;

    logPhase(`autobalance profile=${profile} iterations=${iterations} commit=${!noCommit} dryRun=${dryRun}`);

    if (!dryRun && !noCommit) {
      const clean = gitWorkingTreeClean();
      if (!clean.clean) {
        console.error('[autobalance] refusing: working tree has uncommitted changes.');
        if (clean.details) console.error(clean.details);
        process.exit(2);
      }
    }

    const allEdits: AutobalanceEdit[] = [];
    for (let iter = 1; iter <= iterations; iter++) {
      logPhase(`iteration ${iter}/${iterations}: benchmark + sweeps`);
      const baseline = runSeededBenchmark(baselineProfile, { includeBalance: true });
      const sweepShapes = ['crew_weapon', 'crew_drug', 'weapon_drug', 'crew_weapon_drug'] as const;
      const sweeps = sweepShapes.flatMap(shape =>
        runCuratedSweep(shape, profile, baseline.summary.catalogSeed).permutations,
      );
      const effects = estimateCardEffects(baseline, sweeps, profile);
      const locks = deriveLockRecommendations(effects);
      const summary = summarizeLockRecommendations(locks);
      printLockSummary(summary);

      const result = runAutobalanceIteration(locks, effects, { dryRun, maxEdits });
      console.log(
        `[autobalance] iter ${iter}: edits=${result.edits.length} clamped=${result.clamped.length} skipped=${result.skipped.length}`,
      );
      for (const edit of result.edits) {
        console.log(`  ${edit.cardId}  ${edit.stat} ${edit.from}→${edit.to}  (${edit.direction})  -- ${edit.reason}`);
      }

      if (result.edits.length === 0) {
        console.log('[autobalance] catalog stable — stopping iteration loop.');
        break;
      }

      if (!dryRun) {
        logPhase('recompiling card catalog');
        const compile = spawnSync('node', ['scripts/compile-cards.mjs'], {
          cwd: process.cwd(), encoding: 'utf8', stdio: 'inherit',
        });
        if (compile.status !== 0) throw new Error('compile-cards.mjs failed');
      }

      if (!dryRun && !noCommit) {
        const commit = commitAutobalanceIteration(result.edits, { iteration: iter });
        if (commit.committed) {
          console.log(`[autobalance] committed iter ${iter} -> ${commit.sha}`);
        } else if (commit.stderr) {
          console.log(`[autobalance] commit skipped: ${commit.stderr.trim()}`);
        }
      }
      allEdits.push(...result.edits);
    }
    writeAnalysisJson('autobalance', `autobalance-${profile}.json`, {
      completedAt: new Date().toISOString(),
      profile, baselineProfile, iterations,
      totalEdits: allEdits.length, edits: allEdits,
    });
    return;
  }

  throw new Error(`Unknown analysis command: ${command}`);
}

function isDirectInvocation(): boolean {
  // Only execute main() when this file is the entry point, not when
  // imported by tests. Use a basename equality check rather than
  // `.includes('cli.ts')` — the loose form false-matches paths like
  // `my-cli.ts` or `cli.ts.map`.
  const entry = process.argv[1];
  if (!entry) return false;
  const base = basename(entry);
  return base === 'cli.ts' || base === 'cli.js' || base === 'cli.mjs';
}

if (isDirectInvocation()) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
