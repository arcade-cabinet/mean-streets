import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSeededBenchmark, type BenchmarkRun, type BenchmarkSummary } from '../turf/benchmark';

export interface BenchmarkReport extends BenchmarkSummary {
  timestamp: string;
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
  const reportDir = join(process.cwd(), 'sim', 'reports', 'analysis', 'benchmarks');
  mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = reportName ?? `benchmark-${run.summary.profile}-${ts}.json`;
  const path = join(reportDir, filename);
  writeFileSync(path, JSON.stringify(createBenchmarkReport(run), null, 2));
  return path;
}

export { runSeededBenchmark };
