import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthoredToughSchema,
  AuthoredWeaponSchema,
  AuthoredDrugSchema,
  CompiledToughSchema,
  CompiledWeaponSchema,
  CompiledDrugSchema,
  CompiledCardSchema,
  RaritySchema,
  latestStat,
  latestRarity,
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
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.json'))
    .sort();
}

describe('RaritySchema', () => {
  it('accepts valid rarities', () => {
    expect(RaritySchema.parse('common')).toBe('common');
    expect(RaritySchema.parse('rare')).toBe('rare');
    expect(RaritySchema.parse('legendary')).toBe('legendary');
  });

  it('rejects invalid values', () => {
    expect(RaritySchema.safeParse('epic').success).toBe(false);
  });
});

describe('authored card schemas', () => {
  it('every tough file parses as AuthoredToughSchema', () => {
    const dir = join(RAW_DIR, 'toughs');
    const files = listJson(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const data = readJson(join(dir, file));
      const res = AuthoredToughSchema.safeParse(data);
      if (!res.success) {
        throw new Error(
          `toughs/${file} failed:\n${JSON.stringify(res.error.issues, null, 2)}`,
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
          `weapons/${file} failed:\n${JSON.stringify(res.error.issues, null, 2)}`,
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
          `drugs/${file} failed:\n${JSON.stringify(res.error.issues, null, 2)}`,
        );
      }
    }
  });
});

describe('compiled card catalog', () => {
  it('compiled toughs.json entries parse as CompiledToughSchema', () => {
    const data = readJson(join(COMPILED_DIR, 'toughs.json')) as unknown[];
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledToughSchema.parse(entry);
    }
  });

  it('compiled weapons.json entries parse as CompiledWeaponSchema', () => {
    const data = readJson(join(COMPILED_DIR, 'weapons.json')) as unknown[];
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledWeaponSchema.parse(entry);
    }
  });

  it('compiled drugs.json entries parse as CompiledDrugSchema', () => {
    const data = readJson(join(COMPILED_DIR, 'drugs.json')) as unknown[];
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      CompiledDrugSchema.parse(entry);
    }
  });

  it('all compiled cards parse with unified CompiledCardSchema', () => {
    const toughs = readJson(join(COMPILED_DIR, 'toughs.json')) as unknown[];
    const weapons = readJson(join(COMPILED_DIR, 'weapons.json')) as unknown[];
    const drugs = readJson(join(COMPILED_DIR, 'drugs.json')) as unknown[];
    const currency = readJson(join(COMPILED_DIR, 'currency.json')) as unknown[];
    const all = [...toughs, ...weapons, ...drugs, ...currency];
    expect(all.length).toBeGreaterThan(0);
    // Sanity: the aggregate should include at least one of each kind so a
    // future regression that drops a compiled artifact (e.g. currency
    // missing) surfaces here rather than as a quiet zero-count branch.
    expect(currency.length).toBeGreaterThan(0);
    for (const entry of all) {
      CompiledCardSchema.parse(entry);
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

describe('latestRarity helper', () => {
  it('returns the last rarity from a history', () => {
    expect(latestRarity(['common', 'rare'])).toBe('rare');
    expect(latestRarity(['legendary'])).toBe('legendary');
  });

  it('throws on empty array', () => {
    expect(() => latestRarity([])).toThrow();
  });
});
