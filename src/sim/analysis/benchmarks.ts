import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runSeededBenchmark,
  type BenchmarkRun,
  type BenchmarkSummary,
} from '../turf/benchmark';
import { TURF_SIM_CONFIG } from '../turf/ai/config';

export interface BenchmarkReport extends BenchmarkSummary {
  timestamp: string;
}

export interface ConvergenceResult {
  converged: boolean;
  iterations: number;
  winRateSeries: number[];
  /**
   * The last observed winrate, or `null` when the series is empty.
   * Prior implementations returned `0` for empty, which was
   * indistinguishable from a real 0% winrate and misled logging /
   * autobalance gating callers.
   */
  finalWinRate: number | null;
  consecutiveInBand: number;
}

export function createBenchmarkReport(run: BenchmarkRun): BenchmarkReport {
  return {
    timestamp: new Date().toISOString(),
    ...run.summary,
  };
}

export function writeBenchmarkReport(
  run: BenchmarkRun,
  reportName?: string,
): string {
  const reportDir = join(
    process.cwd(), 'sim', 'reports', 'analysis', 'benchmarks',
  );
  mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = reportName ?? `benchmark-${run.summary.profile}-${ts}.json`;
  const path = join(reportDir, filename);
  writeFileSync(path, JSON.stringify(createBenchmarkReport(run), null, 2));
  return path;
}

export function checkConvergence(
  winRateSeries: number[],
): ConvergenceResult {
  const cfg = (TURF_SIM_CONFIG as {
    autobalance?: {
      convergence?: {
        winRateMin?: number;
        winRateMax?: number;
        consecutiveRunsRequired?: number;
        maxIterations?: number;
      };
    };
  }).autobalance?.convergence ?? {};
  const minWr = cfg.winRateMin ?? 0.48;
  const maxWr = cfg.winRateMax ?? 0.52;
  const required = cfg.consecutiveRunsRequired ?? 3;

  let consecutive = 0;
  for (const wr of winRateSeries) {
    if (wr >= minWr && wr <= maxWr) {
      consecutive++;
    } else {
      consecutive = 0;
    }
  }

  return {
    converged: consecutive >= required,
    iterations: winRateSeries.length,
    winRateSeries,
    finalWinRate: winRateSeries.length > 0 ? winRateSeries[winRateSeries.length - 1] : null,
    consecutiveInBand: consecutive,
  };
}

export { runSeededBenchmark };
