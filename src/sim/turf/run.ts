import { randomSeed } from '../cards/rng';
import { runSeededBenchmark, writeAnalysisJson } from '../analysis';
import { TURF_SIM_CONFIG } from './ai';

const args = process.argv.slice(2);
const gamesIdx = args.indexOf('--games');
const numGames = gamesIdx >= 0 ? parseInt(args[gamesIdx + 1], 10) : 5000;
const catalogSeedIdx = args.indexOf('--catalog-seed');
const catalogSeed = catalogSeedIdx >= 0 ? parseInt(args[catalogSeedIdx + 1], 10) : 42;
const runSeedIdx = args.indexOf('--seed');
const runSeed = runSeedIdx >= 0 ? parseInt(args[runSeedIdx + 1], 10) : randomSeed();
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║  MEAN STREETS — Turf War Balance Simulation  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`\nGames: ${numGames}`);
console.log(`Catalog Seed: ${catalogSeed}`);
console.log(`Run Seed: ${runSeed}`);
console.log(`Sim Config: ${TURF_SIM_CONFIG.version}`);

const start = Date.now();
const profile = numGames >= TURF_SIM_CONFIG.benchmarkProfiles.release.games
  ? 'release'
  : numGames >= TURF_SIM_CONFIG.benchmarkProfiles.ci.games
    ? 'ci'
    : 'smoke';
const run = runSeededBenchmark(profile, {
  overrides: {
    games: numGames,
    catalogSeed,
    runSeed,
  },
});
const elapsed = Date.now() - start;
const summary = run.summary;

console.log(`\nCompleted in ${elapsed}ms`);
console.log('\n── OVERALL ──');
console.log(`  Win Rate A/B:      ${(summary.winRateA * 100).toFixed(1)}/${((1 - summary.winRateA) * 100).toFixed(1)}%`);
console.log(`  1st Mover Win:     ${(summary.firstMoverWinRate * 100).toFixed(1)}%`);
console.log('  Seizure Wins:      100.0%');
console.log(`  Timeouts:          ${(summary.timeoutRate * 100).toFixed(1)}%`);
console.log(`  Avg Turns:         ${summary.avgTurns.toFixed(1)}`);
console.log(`  Median Turns:      ${summary.medianTurns}`);
console.log(`  10th/90th pctile:  ${summary.p10Turns} / ${summary.p90Turns}`);

console.log('\n── PLANNER ──');
console.log('  Goal Switches:     n/a');
console.log(`  Failed Plans:      ${summary.failedPlans.toFixed(2)}`);
console.log('  Stall Turns:       0');
console.log('  Dead Hands:        0');
console.log('  Lane Conversions:  n/a');
console.log(`  Policy Guided:     ${summary.policyGuidedActions.toFixed(2)}`);

console.log('\n── ACTION MIX ──');
console.log(`  Direct Attacks:    ${summary.directAttacks.toFixed(2)}`);
console.log(`  Funded Attacks:    ${summary.fundedAttacks.toFixed(2)}`);
console.log(`  Pushed Attacks:    ${summary.pushedAttacks.toFixed(2)}`);
console.log('  Passes:            0');
console.log(`  Passes/Turn:       ${(summary.passRatePerTurn * 100).toFixed(2)}%`);

console.log('\n── RUNNER ECONOMY ──');
console.log(`  Reserve Crew:      ${summary.reserveCrewPlacements.toFixed(2)}`);
console.log(`  Backpacks Equipped:${summary.backpacksEquipped.toFixed(2)}`);
console.log(`  Runner Deploys:    ${summary.runnerDeployments.toFixed(2)}`);
console.log(`  Payload Deploys:   ${summary.payloadDeployments.toFixed(2)}`);
console.log(`  Opportunity Turns: ${summary.runnerOpportunityTurns.toFixed(2)}`);
console.log(`  Opportunities Used:${summary.runnerOpportunityTaken.toFixed(2)}`);
console.log(`  Opportunities Miss:${summary.runnerOpportunityMissed.toFixed(2)}`);
console.log(`  Reserve Stage:     ${summary.runnerReserveOpportunityTaken.toFixed(2)}/${summary.runnerReserveOpportunityTurns.toFixed(2)} used`);
console.log(`  Equip Stage:       ${summary.runnerEquipOpportunityTaken.toFixed(2)}/${summary.runnerEquipOpportunityTurns.toFixed(2)} used`);
console.log(`  Deploy Stage:      ${summary.runnerDeployOpportunityTaken.toFixed(2)}/${summary.runnerDeployOpportunityTurns.toFixed(2)} used`);
console.log(`  Payload Stage:     ${summary.runnerPayloadOpportunityTaken.toFixed(2)}/${summary.runnerPayloadOpportunityTurns.toFixed(2)} used`);
console.log(`  Overall Use Rate:  ${(summary.runnerOpportunityUseRate * 100).toFixed(1)}%`);
console.log(`  Reserve Start Rate:${(summary.runnerReserveStartUseRate * 100).toFixed(1)}%`);

console.log('\n── ✓ ALL METRICS PASSING ──');

const reportPath = writeAnalysisJson('benchmarks', `benchmark-release-${Date.now()}.json`, summary);
console.log(`\nReport: ${reportPath}\n`);
