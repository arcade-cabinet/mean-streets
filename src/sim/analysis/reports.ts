import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeAnalysisJson(
  category: string,
  name: string,
  payload: unknown,
): string {
  const reportDir = join(process.cwd(), 'sim', 'reports', 'analysis', category);
  mkdirSync(reportDir, { recursive: true });
  const path = join(reportDir, name);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}
