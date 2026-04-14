/**
 * Validates every raw tuning-history file against its authored Zod schema.
 * Also smoke-tests the compiled catalogs against the runtime flat schema.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthoredCrewSchema,
  AuthoredWeaponSchema,
  AuthoredDrugSchema,
  CardSpecialSchema,
  CompiledCrewSchema,
  CompiledWeaponSchema,
  CompiledDrugSchema,
  latestStat,
} from './schemas';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const COMPILED_DIR = join(ROOT, 'config', 'compiled');

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f: string) => f.endsWith('.json')).sort();
}

describe('authored card schemas', () => {
  it('every tough file parses as AuthoredCrewSchema', () => {
    const dir = join(RAW_DIR, 'toughs');
    const files = listJson(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const data = readJson(join(dir, file));
      const res = AuthoredCrewSchema.safeParse(data);
      if (!res.success) {
        throw new Error(
          `toughs/${file} failed Zod parse:\n${JSON.stringify(res.error.issues, null, 2)}`,
        );
      }
    }
  });

  it('every weapon file parses as AuthoredWeaponSchema', () => {
    const dir = join(RAW_DIR, 'weapons');
    const files = listJson(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const data = readJson(join(dir, file));
      const res = AuthoredWeaponSchema.safeParse(data);
      if (!res.success) {
        throw new Error(
          `weapons/${file} failed Zod parse:\n${JSON.stringify(res.error.issues, null, 2)}`,
        );
      }
    }
  });

  it('every drug file parses as AuthoredDrugSchema', () => {
    const dir = join(RAW_DIR, 'drugs');
    const files = listJson(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const data = readJson(join(dir, file));
      const res = AuthoredDrugSchema.safeParse(data);
      if (!res.success) {
        throw new Error(
          `drugs/${file} failed Zod parse:\n${JSON.stringify(res.error.issues, null, 2)}`,
        );
      }
    }
  });

  it('special.json parses as CardSpecialSchema', () => {
    const data = readJson(join(RAW_DIR, 'special.json'));
    const res = CardSpecialSchema.safeParse(data);
    if (!res.success) {
      throw new Error(
        `special.json failed Zod parse:\n${JSON.stringify(res.error.issues, null, 2)}`,
      );
    }
  });
});

describe('compiled card catalog', () => {
  it('compiled toughs.json parses as CompiledCrewSchema[]', () => {
    const data = readJson(join(COMPILED_DIR, 'toughs.json')) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledCrewSchema.parse(entry);
    }
  });

  it('compiled weapons.json parses as CompiledWeaponSchema[]', () => {
    const data = readJson(join(COMPILED_DIR, 'weapons.json')) as unknown[];
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledWeaponSchema.parse(entry);
    }
  });

  it('compiled drugs.json parses as CompiledDrugSchema[]', () => {
    const data = readJson(join(COMPILED_DIR, 'drugs.json')) as unknown[];
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledDrugSchema.parse(entry);
    }
  });
});

describe('latestStat helper', () => {
  it('returns the last element of a history array', () => {
    expect(latestStat([1, 2, 3])).toBe(3);
    expect(latestStat([7])).toBe(7);
  });

  it('throws on empty array', () => {
    expect(() => latestStat([])).toThrow();
  });
});
