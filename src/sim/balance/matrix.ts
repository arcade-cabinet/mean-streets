/**
 * Round-robin balance matrix runner.
 * Runs every gang vs every gang (including mirrors and A/B asymmetry),
 * collects metrics, and produces a BalanceReport.
 */

import type { GameConfigData, MatchupResultData, BalanceReportData } from '../schemas';
import type { GameResult } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { playGame } from '../engine/game';
import { getAllGangIds } from '../engine/gangs';

/** Run N games of a single matchup and aggregate results. */
export function runMatchup(
  gangA: string,
  gangB: string,
  numGames: number,
  configOverrides?: Partial<GameConfigData>,
): MatchupResultData {
  const config: GameConfigData = {
    ...DEFAULT_CONFIG,
    gangA,
    gangB,
    ...configOverrides,
  };

  let winsA = 0;
  let firstMoverWins = 0;
  let stalls = 0;
  let totalTurns = 0;
  const allTurns: number[] = [];
  let totalPassRate = 0;
  let totalLockRate = 0;
  const metricSums: Record<string, number> = {};

  for (let i = 0; i < numGames; i++) {
    const result: GameResult = playGame(config);
    const m = result.metrics;

    if (result.winner === 'A') winsA++;
    if (result.winner === result.firstPlayer) firstMoverWins++;
    if (result.endReason === 'stall') stalls++;

    totalTurns += m.turns;
    allTurns.push(m.turns);
    totalPassRate += m.turns > 0 ? m.passes / m.turns : 0;
    totalLockRate += m.turns > 0 ? m.precisionLocks / m.turns : 0;

    // Accumulate all metric values
    for (const [key, val] of Object.entries(m)) {
      metricSums[key] = (metricSums[key] ?? 0) + val;
    }
  }

  allTurns.sort((a, b) => a - b);
  const n = numGames;

  // Average all metric sums
  const avgMetrics: Record<string, number> = {};
  for (const [key, sum] of Object.entries(metricSums)) {
    avgMetrics[key] = +(sum / n).toFixed(2);
  }

  return {
    gangA,
    gangB,
    games: n,
    winRateA: +(winsA / n * 100).toFixed(1),
    winRateB: +((n - winsA) / n * 100).toFixed(1),
    firstMoverWinRate: +(firstMoverWins / n * 100).toFixed(1),
    stallRate: +(stalls / n * 100).toFixed(1),
    avgTurns: +(totalTurns / n).toFixed(1),
    medianTurns: allTurns[Math.floor(n / 2)],
    avgPassRate: +(totalPassRate / n * 100).toFixed(1),
    avgPrecisionLockRate: +(totalLockRate / n * 100).toFixed(1),
    metrics: avgMetrics,
  };
}

/** Run full round-robin matrix across all registered gangs. */
export function runBalanceMatrix(
  numGames: number,
  configOverrides?: Partial<GameConfigData>,
): BalanceReportData {
  const gangIds = getAllGangIds();
  const matchups: MatchupResultData[] = [];
  const gangWins: Record<string, { wins: number; total: number }> = {};

  // Initialize win trackers
  for (const id of gangIds) {
    gangWins[id] = { wins: 0, total: 0 };
  }

  // Run every ordered pair (A vs B is different from B vs A)
  for (const gangA of gangIds) {
    for (const gangB of gangIds) {
      process.stdout.write(`  ${gangA} vs ${gangB}...`);
      const start = Date.now();
      const result = runMatchup(gangA, gangB, numGames, configOverrides);
      const elapsed = Date.now() - start;
      process.stdout.write(` ${result.winRateA}/${result.winRateB} (${elapsed}ms)\n`);

      matchups.push(result);

      // Track aggregate win rates
      gangWins[gangA].wins += result.winRateA * numGames / 100;
      gangWins[gangA].total += numGames;
      gangWins[gangB].wins += result.winRateB * numGames / 100;
      gangWins[gangB].total += numGames;
    }
  }

  // Compute per-gang aggregate win rates
  const gangRatings: Record<string, number> = {};
  for (const [id, { wins, total }] of Object.entries(gangWins)) {
    gangRatings[id] = +(wins / total * 100).toFixed(1);
  }

  // Find worst matchup (furthest from 50/50)
  let worstMatchup = { gangA: '', gangB: '', winRate: 50 };
  let worstDeviation = 0;
  for (const m of matchups) {
    if (m.gangA === m.gangB) continue; // skip mirrors
    const deviation = Math.abs(m.winRateA - 50);
    if (deviation > worstDeviation) {
      worstDeviation = deviation;
      worstMatchup = {
        gangA: m.gangA,
        gangB: m.gangB,
        winRate: m.winRateA,
      };
    }
  }

  // Check if balanced
  const issues: string[] = [];
  for (const m of matchups) {
    if (m.gangA === m.gangB) continue;
    if (m.winRateA > 55 || m.winRateA < 45) {
      issues.push(
        `${m.gangA} vs ${m.gangB}: ${m.winRateA}/${m.winRateB} (outside 45-55%)`,
      );
    }
  }
  for (const [id, rating] of Object.entries(gangRatings)) {
    if (rating > 55 || rating < 45) {
      issues.push(`${id} aggregate win rate ${rating}% (outside 45-55%)`);
    }
  }
  if (matchups.some(m => m.stallRate > 5)) {
    issues.push('Stall rate exceeds 5% in some matchups');
  }
  if (matchups.some(m => m.avgPassRate > 25)) {
    issues.push('Pass rate exceeds 25% in some matchups');
  }

  return {
    timestamp: new Date().toISOString(),
    config: configOverrides ?? {},
    gangs: gangIds,
    matchups,
    gangRatings,
    worstMatchup,
    balanced: issues.length === 0,
    issues,
  };
}
