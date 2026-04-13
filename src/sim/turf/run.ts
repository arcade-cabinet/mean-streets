/**
 * Run turf war balance simulations.
 * Usage: npx tsx src/sim/turf/run.ts [--games N]
 */

import { playTurfGame } from './game';
import { DEFAULT_TURF_CONFIG, type TurfMetrics, type TurfGameResult } from './types';
import { randomSeed } from '../cards/rng';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const gamesIdx = args.indexOf('--games');
const numGames = gamesIdx >= 0 ? parseInt(args[gamesIdx + 1], 10) : 5000;

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║  MEAN STREETS — Turf War Balance Simulation  ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`\nGames: ${numGames}`);

const start = Date.now();
const results: TurfGameResult[] = [];
const outliers: TurfGameResult[] = [];

for (let i = 0; i < numGames; i++) {
  const seed = randomSeed();
  const result = playTurfGame(DEFAULT_TURF_CONFIG, seed);
  results.push(result);

  // Track outliers: games that are unusually long or short
  if (result.turnCount > 100 || result.turnCount < 5) {
    outliers.push(result);
  }
}

const elapsed = Date.now() - start;

// ── Aggregate metrics ────────────────────────────────────────

const n = numGames;
const winsA = results.filter(r => r.winner === 'A').length;
const firstMoverWins = results.filter(r => r.winner === r.firstPlayer).length;
const seizureWins = results.filter(r => r.endReason === 'total_seizure').length;
const timeouts = results.filter(r => r.endReason === 'timeout').length;

const allTurns = results.map(r => r.turnCount).sort((a, b) => a - b);
const avgTurns = +(allTurns.reduce((a, b) => a + b, 0) / n).toFixed(1);
const medianTurns = allTurns[Math.floor(n / 2)];
const p10Turns = allTurns[Math.floor(n * 0.1)];
const p90Turns = allTurns[Math.floor(n * 0.9)];

function avgMetric(key: keyof TurfMetrics): number {
  return +(results.reduce((s, r) => s + r.metrics[key], 0) / n).toFixed(1);
}

console.log(`\nCompleted in ${elapsed}ms`);
console.log('\n── OVERALL ──');
console.log(`  Win Rate A/B:      ${(winsA / n * 100).toFixed(1)}/${((n - winsA) / n * 100).toFixed(1)}%`);
console.log(`  1st Mover Win:     ${(firstMoverWins / n * 100).toFixed(1)}%`);
console.log(`  Seizure Wins:      ${(seizureWins / n * 100).toFixed(1)}%`);
console.log(`  Timeouts:          ${(timeouts / n * 100).toFixed(1)}%`);
console.log(`  Avg Turns:         ${avgTurns}`);
console.log(`  Median Turns:      ${medianTurns}`);
console.log(`  10th/90th pctile:  ${p10Turns} / ${p90Turns}`);

// Buildup stats
const avgBuildupA = +(results.reduce((s, r) => s + r.metrics.buildupRoundsA, 0) / n).toFixed(1);
const avgBuildupB = +(results.reduce((s, r) => s + r.metrics.buildupRoundsB, 0) / n).toFixed(1);
const avgCombatRounds = +(results.reduce((s, r) => s + r.metrics.combatRounds, 0) / n).toFixed(1);
const avgTotalActions = +(results.reduce((s, r) => s + r.metrics.totalActions, 0) / n).toFixed(1);
const firstStrikeA = results.filter(r => r.metrics.firstStrike === 'A').length;
const firstStrikeB = results.filter(r => r.metrics.firstStrike === 'B').length;

console.log('\n── ROUND STRUCTURE ──');
console.log(`  Avg Buildup A:     ${avgBuildupA} rounds`);
console.log(`  Avg Buildup B:     ${avgBuildupB} rounds`);
console.log(`  Avg Combat Rounds: ${avgCombatRounds}`);
console.log(`  Avg Total Actions: ${avgTotalActions}`);
console.log(`  First Strike A:    ${(firstStrikeA / n * 100).toFixed(1)}%`);
console.log(`  First Strike B:    ${(firstStrikeB / n * 100).toFixed(1)}%`);

console.log('\n── ACTIONS PER GAME ──');
console.log(`  Direct Attacks:    ${avgMetric('directAttacks')}`);
console.log(`  Funded Attacks:    ${avgMetric('fundedAttacks')}`);
console.log(`  Pushed Attacks:    ${avgMetric('pushedAttacks')}`);
console.log(`  Kills:             ${avgMetric('kills')}`);
console.log(`  Flips:             ${avgMetric('flips')}`);
console.log(`  Seizures:          ${avgMetric('seizures')}`);
console.log(`  Busts:             ${avgMetric('busts')}`);
console.log(`  Weapons Drawn:     ${avgMetric('weaponsDrawn')}`);
console.log(`  Crew Placed:       ${avgMetric('crewPlaced')}`);
console.log(`  Product Played:    ${avgMetric('productPlayed')}`);
console.log(`  Cash Played:       ${avgMetric('cashPlayed')}`);
console.log(`  Positions Reclaimed: ${avgMetric('positionsReclaimed')}`);
console.log(`  Passes:            ${avgMetric('passes')}`);

// ── Issues ───────────────────────────────────────────────────

const issues: string[] = [];
const winRateA = winsA / n * 100;
if (winRateA > 55 || winRateA < 45) issues.push(`Win rate ${winRateA.toFixed(1)}% outside 45-55%`);
if (firstMoverWins / n * 100 > 55 || firstMoverWins / n * 100 < 45) issues.push(`First mover ${(firstMoverWins / n * 100).toFixed(1)}%`);
if (timeouts / n * 100 > 5) issues.push(`Timeout rate ${(timeouts / n * 100).toFixed(1)}% exceeds 5%`);
if (avgMetric('passes') / avgTurns > 0.2) issues.push(`Pass rate ${(avgMetric('passes') / avgTurns * 100).toFixed(1)}%`);

if (issues.length > 0) {
  console.log('\n── ISSUES ──');
  issues.forEach(i => console.log(`  ✗ ${i}`));
} else {
  console.log('\n── ✓ ALL METRICS PASSING ──');
}

// ── Outliers ─────────────────────────────────────────────────

if (outliers.length > 0) {
  console.log(`\n── OUTLIERS (${outliers.length} games) ──`);
  for (const o of outliers.slice(0, 5)) {
    console.log(`  seed:${o.seed} turns:${o.turnCount} winner:${o.winner} reason:${o.endReason}`);
  }
}

// ── Save report ──────────────────────────────────────────────

const report = {
  timestamp: new Date().toISOString(),
  config: DEFAULT_TURF_CONFIG,
  games: n,
  winRateA: +(winsA / n * 100).toFixed(1),
  firstMoverWinRate: +(firstMoverWins / n * 100).toFixed(1),
  seizureWinRate: +(seizureWins / n * 100).toFixed(1),
  timeoutRate: +(timeouts / n * 100).toFixed(1),
  avgTurns,
  medianTurns,
  p10Turns,
  p90Turns,
  avgMetrics: {
    directAttacks: avgMetric('directAttacks'),
    fundedAttacks: avgMetric('fundedAttacks'),
    pushedAttacks: avgMetric('pushedAttacks'),
    kills: avgMetric('kills'),
    flips: avgMetric('flips'),
    seizures: avgMetric('seizures'),
    busts: avgMetric('busts'),
    weaponsDrawn: avgMetric('weaponsDrawn'),
    crewPlaced: avgMetric('crewPlaced'),
    productPlayed: avgMetric('productPlayed'),
    cashPlayed: avgMetric('cashPlayed'),
    positionsReclaimed: avgMetric('positionsReclaimed'),
    passes: avgMetric('passes'),
  },
  issues,
  outlierSeeds: outliers.map(o => o.seed),
};

const reportDir = join(process.cwd(), 'sim', 'reports', 'turf');
mkdirSync(reportDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = join(reportDir, `balance-${ts}.json`);
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport: ${reportPath}\n`);
