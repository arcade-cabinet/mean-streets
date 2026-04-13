/**
 * Auto-balance loop.
 *
 * Generates decks from constraints, runs full round-robin matrix,
 * analyzes results, suggests adjustments, applies them, and repeats
 * until all matchups are within 45-55% or max iterations reached.
 *
 * Outputs a JSON report after each iteration.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  GANG_CONSTRAINTS,
  buildGangFromConstraints,
  suggestAdjustments,
  applyAdjustments,
  saveGangJson,
  type GangConstraints,
} from './generator';
import { runMatchup } from './matrix';
import type { MatchupResultData } from '../schemas';
import { registerGang } from '../engine/gangs';

interface IterationResult {
  iteration: number;
  constraints: Record<string, GangConstraints>;
  matchups: MatchupResultData[];
  gangRatings: Record<string, number>;
  balanced: boolean;
  issues: string[];
  adjustments: Array<{ gangId: string; parameter: string; direction: string; reason: string }>;
}

/**
 * Run the auto-balance loop.
 *
 * @param maxIterations Maximum number of balance iterations
 * @param gamesPerMatchup Games per matchup per iteration
 * @param gangIds Which gangs to include (defaults to all in GANG_CONSTRAINTS)
 */
export function autoBalance(
  maxIterations = 10,
  gamesPerMatchup = 2000,
  gangIds?: string[],
): IterationResult[] {
  const ids = gangIds ?? Object.keys(GANG_CONSTRAINTS);
  let constraints = structuredClone(GANG_CONSTRAINTS);

  // Filter to requested gangs
  const activeConstraints: Record<string, GangConstraints> = {};
  for (const id of ids) {
    if (constraints[id]) activeConstraints[id] = constraints[id];
  }
  constraints = activeConstraints;

  const reportDir = join(process.cwd(), 'sim', 'reports', 'autobalance');
  mkdirSync(reportDir, { recursive: true });

  const history: IterationResult[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    console.log(`\n╔═ ITERATION ${iter + 1}/${maxIterations} ${'═'.repeat(40)}╗`);

    // 1. Generate decks from current constraints
    console.log('Generating decks...');
    const gangs = Object.entries(constraints).map(([_id, c]) => {
      const gang = buildGangFromConstraints(c);
      // Print stat summary
      const cards = gang.cards;
      const avgDayAtk = +(cards.reduce((s, c) => s + c.dayAtk, 0) / cards.length).toFixed(1);
      const avgDayDef = +(cards.reduce((s, c) => s + c.dayDef, 0) / cards.length).toFixed(1);
      const avgNightAtk = +(cards.reduce((s, c) => s + c.nightAtk, 0) / cards.length).toFixed(1);
      const avgNightDef = +(cards.reduce((s, c) => s + c.nightDef, 0) / cards.length).toFixed(1);
      console.log(
        `  ${gang.id.padEnd(12)} ` +
        `day: ATK ${avgDayAtk} DEF ${avgDayDef} | ` +
        `night: ATK ${avgNightAtk} DEF ${avgNightDef} | ` +
        `lean: ${(constraints[gang.id].offensiveLean * 100).toFixed(0)}% ` +
        `asym: ${(constraints[gang.id].dayNightAsymmetry * 100).toFixed(0)}%`,
      );
      return gang;
    });

    // 2. Register generated gangs (replace existing)
    for (const gang of gangs) {
      registerGang(gang);
    }

    // 3. Run round-robin matrix
    console.log(`\nRunning ${ids.length}x${ids.length} matrix (${gamesPerMatchup} games each)...`);
    const matchups: MatchupResultData[] = [];
    const gangWins: Record<string, { wins: number; total: number }> = {};
    for (const id of ids) gangWins[id] = { wins: 0, total: 0 };

    for (const gangA of ids) {
      for (const gangB of ids) {
        const start = Date.now();
        const result = runMatchup(gangA, gangB, gamesPerMatchup);
        const elapsed = Date.now() - start;

        const tag = gangA === gangB ? 'mirror' : '';
        const status = (result.winRateA >= 45 && result.winRateA <= 55) || gangA === gangB
          ? '✓' : '✗';
        console.log(
          `  ${status} ${gangA} vs ${gangB}: ` +
          `${result.winRateA}/${result.winRateB} ` +
          `turns:${result.avgTurns} pass:${result.avgPassRate}% ` +
          `stall:${result.stallRate}% ${tag} (${elapsed}ms)`,
        );

        matchups.push(result);
        gangWins[gangA].wins += result.winRateA * gamesPerMatchup / 100;
        gangWins[gangA].total += gamesPerMatchup;
        gangWins[gangB].wins += result.winRateB * gamesPerMatchup / 100;
        gangWins[gangB].total += gamesPerMatchup;
      }
    }

    // 4. Compute ratings
    const gangRatings: Record<string, number> = {};
    for (const [id, { wins, total }] of Object.entries(gangWins)) {
      gangRatings[id] = +(wins / total * 100).toFixed(1);
    }

    // 5. Check balance
    const issues: string[] = [];
    for (const m of matchups) {
      if (m.gangA === m.gangB) continue;
      if (m.winRateA > 55 || m.winRateA < 45) {
        issues.push(`${m.gangA} vs ${m.gangB}: ${m.winRateA}/${m.winRateB}`);
      }
    }
    for (const [id, rating] of Object.entries(gangRatings)) {
      if (rating > 55 || rating < 45) {
        issues.push(`${id} aggregate: ${rating}%`);
      }
    }
    for (const m of matchups) {
      if (m.avgPassRate > 25) {
        issues.push(`${m.gangA} vs ${m.gangB}: pass rate ${m.avgPassRate}%`);
      }
      if (m.stallRate > 5) {
        issues.push(`${m.gangA} vs ${m.gangB}: stall rate ${m.stallRate}%`);
      }
    }

    const balanced = issues.filter(i => !i.includes('pass rate') && !i.includes('stall')).length === 0;

    console.log(`\n  Ratings: ${Object.entries(gangRatings).map(([k, v]) => `${k}:${v}%`).join(' | ')}`);
    console.log(`  Balanced: ${balanced ? '✓ YES' : '✗ NO'} (${issues.length} issues)`);

    // 6. Suggest adjustments
    const passRates = matchups.map(m => ({
      gangA: m.gangA, gangB: m.gangB, passRate: m.avgPassRate,
    }));
    const winRates = matchups.filter(m => m.gangA !== m.gangB).map(m => ({
      gangA: m.gangA, gangB: m.gangB, winRateA: m.winRateA,
    }));
    const rawAdjustments = suggestAdjustments(gangRatings, winRates, passRates);

    const iterResult: IterationResult = {
      iteration: iter + 1,
      constraints: structuredClone(constraints),
      matchups,
      gangRatings,
      balanced,
      issues,
      adjustments: rawAdjustments.map(a => ({
        gangId: a.gangId,
        parameter: a.parameter as string,
        direction: a.direction,
        reason: a.reason,
      })),
    };
    history.push(iterResult);

    // Save iteration report
    const iterPath = join(reportDir, `iter-${String(iter + 1).padStart(2, '0')}.json`);
    writeFileSync(iterPath, JSON.stringify(iterResult, null, 2));

    if (balanced) {
      console.log('\n  ✓ BALANCE ACHIEVED — saving final decks');
      const deckDir = join(process.cwd(), 'src', 'data', 'gangs');
      mkdirSync(deckDir, { recursive: true });
      for (const gang of gangs) {
        const path = saveGangJson(gang, deckDir);
        console.log(`  Saved: ${path}`);
      }
      break;
    }

    // 7. Apply adjustments for next iteration
    if (rawAdjustments.length > 0) {
      console.log('\n  Adjustments:');
      for (const adj of rawAdjustments) {
        console.log(`    ${adj.direction === 'up' ? '↑' : '↓'} ${adj.gangId}.${adj.parameter} — ${adj.reason}`);
      }
      constraints = applyAdjustments(constraints, rawAdjustments);
    } else {
      console.log('\n  No adjustments suggested — stopping');
      break;
    }
  }

  // Save full history
  const historyPath = join(reportDir, 'history.json');
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`\nFull history saved: ${historyPath}`);

  return history;
}
