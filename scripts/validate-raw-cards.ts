/**
 * validate-raw-cards.ts
 *
 * Walks config/raw/cards/ and runs each file through its Zod schema.
 * Exits non-zero and prints offenders when any file is malformed.
 *
 * Invoked via `pnpm run cards:validate`.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import {
  AuthoredToughSchema,
  AuthoredWeaponSchema,
  AuthoredDrugSchema,
  AuthoredCurrencySchema,
} from '../src/sim/cards/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');

interface Offender {
  file: string;
  issues: string[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.json'))
    .sort();
}

function formatIssues(err: { issues: { path: PropertyKey[]; message: string }[] } | undefined): string[] {
  const issues = err?.issues ?? [];
  return issues.map((i) => `  • ${i.path.map(String).join('.') || '<root>'}: ${i.message}`);
}

function validateDir(label: string, dir: string, schema: ZodType<unknown>): Offender[] {
  const offenders: Offender[] = [];
  for (const file of listJson(dir)) {
    const data = readJson(join(dir, file));
    const res = schema.safeParse(data);
    if (!res.success) {
      offenders.push({
        file: `${label}/${file}`,
        issues: formatIssues(res.error),
      });
    }
  }
  return offenders;
}

function main(): void {
  const offenders: Offender[] = [
    ...validateDir('toughs', join(RAW_DIR, 'toughs'), AuthoredToughSchema),
    ...validateDir('weapons', join(RAW_DIR, 'weapons'), AuthoredWeaponSchema),
    ...validateDir('drugs', join(RAW_DIR, 'drugs'), AuthoredDrugSchema),
    ...validateDir('currency', join(RAW_DIR, 'currency'), AuthoredCurrencySchema),
  ];

  if (offenders.length === 0) {
    console.log('[validate-raw-cards] all raw card files valid.');
    return;
  }

  console.error(`[validate-raw-cards] ${offenders.length} offender(s):`);
  for (const o of offenders) {
    console.error(`\n  ✖ ${o.file}`);
    for (const line of o.issues) console.error(line);
  }
  process.exit(1);
}

main();
