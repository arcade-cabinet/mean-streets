/**
 * Mean Streets — Simulation CLI entry point.
 *
 * Usage:
 *   npm run sim                           # Run balance matrix
 *   npm run sim -- --autobalance          # Auto-generate and balance decks
 *   npm run sim -- --games 5000           # Custom game count
 *   npm run sim -- --iterations 15        # Max balance iterations
 *   npm run sim -- --gangs KNUCKLES,CHAINS # Specific gangs only
 */

import { runBalanceMatrix } from './balance/matrix';
import { getAllGangIds } from './engine/gangs';
import { autoBalance } from './balance/autobalance';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function main(): void {
  const numGames = parseInt(getArg('--games') ?? '2000', 10);
  const maxIter = parseInt(getArg('--iterations') ?? '10', 10);
  const gangFilter = getArg('--gangs')?.split(',');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   MEAN STREETS — Balance Simulation Engine   ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (hasFlag('--autobalance')) {
    console.log(`Mode: AUTO-BALANCE`);
    console.log(`Max iterations: ${maxIter}`);
    console.log(`Games per matchup: ${numGames}`);
    console.log(`Gangs: ${gangFilter?.join(', ') ?? 'all'}\n`);

    const history = autoBalance(maxIter, numGames, gangFilter);
    const lastIter = history[history.length - 1];

    if (lastIter?.balanced) {
      console.log('\n✓ Auto-balance complete. Deck JSONs saved to src/data/gangs/');
    } else {
      console.log('\n✗ Auto-balance did not converge. Review sim/reports/autobalance/');
    }
    return;
  }

  // Default: run balance matrix with currently registered gangs
  const gangIds = getAllGangIds();
  console.log(`Mode: BALANCE MATRIX`);
  console.log(`Registered gangs: ${gangIds.join(', ')}`);
  console.log(`Games per matchup: ${numGames}\n`);

  const report = runBalanceMatrix(numGames);

  // Print summary
  console.log('\n── GANG RATINGS ──');
  for (const [id, rating] of Object.entries(report.gangRatings)) {
    const r = rating as number;
    const bar = '█'.repeat(Math.round(r / 2));
    const status = r >= 45 && r <= 55 ? '✓' : '✗';
    console.log(`  ${status} ${id.padEnd(12)} ${r}% ${bar}`);
  }

  console.log('\n── MATCHUP MATRIX ──');
  const header = ''.padEnd(14) + gangIds.map((g: string) => g.padStart(12)).join('');
  console.log(header);
  for (const gangA of gangIds) {
    let row = (gangA as string).padEnd(14);
    for (const gangB of gangIds) {
      const m = report.matchups.find(
        (r: { gangA: string; gangB: string }) => r.gangA === gangA && r.gangB === gangB,
      );
      const val = m ? `${m.winRateA}%` : 'N/A';
      row += val.padStart(12);
    }
    console.log(row);
  }

  if (report.issues.length > 0) {
    console.log('\n── BALANCE ISSUES ──');
    for (const issue of report.issues) {
      console.log(`  ✗ ${issue}`);
    }
  }

  console.log(`\n── VERDICT: ${report.balanced ? '✓ BALANCED' : '✗ IMBALANCED'} ──\n`);

  // Write JSON report
  const reportDir = join(process.cwd(), 'sim', 'reports');
  mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(reportDir, `balance-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved: ${reportPath}\n`);
}

main();
