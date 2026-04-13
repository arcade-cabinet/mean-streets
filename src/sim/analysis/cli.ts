import {
  createBenchmarkReport,
  deriveLockRecommendations,
  estimateCardEffects,
  runCuratedSweep,
  runSeededBenchmark,
  writeAnalysisJson,
} from './index';

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const [command = 'benchmark'] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (command === 'benchmark') {
    const profile = (getArg('--profile') ?? 'ci') as 'smoke' | 'ci' | 'release';
    const run = runSeededBenchmark(profile, { includeBalance: true });
    const path = writeAnalysisJson('benchmarks', `benchmark-${profile}.json`, createBenchmarkReport(run));
    console.log(path);
    return;
  }

  if (command === 'sweep') {
    const shape = (getArg('--shape') ?? 'crew_weapon') as 'crew_weapon' | 'crew_drug' | 'weapon_drug' | 'crew_weapon_drug';
    const profile = (getArg('--profile') ?? 'quick') as 'quick' | 'standard' | 'release';
    const sweep = runCuratedSweep(shape, profile);
    const path = writeAnalysisJson('sweeps', `sweep-${shape}-${profile}.json`, sweep);
    console.log(path);
    return;
  }

  if (command === 'lock') {
    const profile = (getArg('--profile') ?? 'standard') as 'quick' | 'standard' | 'release';
    const baselineProfile = profile === 'release' ? 'release' : profile === 'standard' ? 'ci' : 'smoke';
    const baseline = runSeededBenchmark(baselineProfile, { includeBalance: true });
    const sweeps = [
      ...runCuratedSweep('crew_weapon', profile).permutations,
      ...runCuratedSweep('crew_drug', profile).permutations,
      ...runCuratedSweep('weapon_drug', profile).permutations,
      ...runCuratedSweep('crew_weapon_drug', profile).permutations,
    ];
    const effects = estimateCardEffects(baseline, sweeps, profile);
    const locks = deriveLockRecommendations(effects);
    const path = writeAnalysisJson('locks', `lock-${profile}.json`, {
      benchmark: createBenchmarkReport(baseline),
      effects,
      locks,
    });
    console.log(path);
    return;
  }

  throw new Error(`Unknown analysis command: ${command}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
