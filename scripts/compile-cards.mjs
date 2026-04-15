#!/usr/bin/env node
/**
 * compile-cards.mjs
 *
 * Walks config/raw/cards/{toughs,weapons,drugs},
 * validates each entry structurally, reduces every stat/rarity history
 * array to its last element, and writes flat compiled catalogs to:
 *
 *   config/compiled/toughs.json
 *   config/compiled/weapons.json
 *   config/compiled/drugs.json
 *   config/compiled/currency.json
 *
 * Runs during `postinstall` and `prebuild`. Also invokable directly via
 * `pnpm run cards:compile`.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const COMPILED_DIR = join(ROOT, 'config', 'compiled');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, data: readJson(join(dir, f)) }));
}

function latest(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`latest(): expected non-empty array, got ${JSON.stringify(arr)}`);
  }
  return arr[arr.length - 1];
}

function requireFields(obj, fields, context) {
  for (const f of fields) {
    if (!(f in obj)) {
      throw new Error(`${context}: missing required field "${f}"`);
    }
  }
}

function compileTough({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'archetype', 'affiliation', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `toughs/${file}`);
  if (data.kind !== 'tough') throw new Error(`toughs/${file}: expected kind=tough, got ${data.kind}`);
  return {
    kind: 'tough',
    id: data.id,
    name: data.name,
    ...(data.tagline ? { tagline: data.tagline } : {}),
    archetype: data.archetype,
    affiliation: data.affiliation,
    power: latest(data.power),
    resistance: latest(data.resistance),
    rarity: latest(data.rarity),
    abilities: data.abilities,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
  };
}

function compileWeapon({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'category', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `weapons/${file}`);
  if (data.kind !== 'weapon') throw new Error(`weapons/${file}: expected kind=weapon, got ${data.kind}`);
  return {
    kind: 'weapon',
    id: data.id,
    name: data.name,
    category: data.category,
    power: latest(data.power),
    resistance: latest(data.resistance),
    rarity: latest(data.rarity),
    abilities: data.abilities,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
  };
}

function compileDrug({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'category', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `drugs/${file}`);
  if (data.kind !== 'drug') throw new Error(`drugs/${file}: expected kind=drug, got ${data.kind}`);
  return {
    kind: 'drug',
    id: data.id,
    name: data.name,
    category: data.category,
    power: latest(data.power),
    resistance: latest(data.resistance),
    rarity: latest(data.rarity),
    abilities: data.abilities,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
  };
}

function compileCurrency({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'denomination', 'rarity', 'unlocked', 'locked'], `currency/${file}`);
  if (data.kind !== 'currency') throw new Error(`currency/${file}: expected kind=currency, got ${data.kind}`);
  return {
    kind: 'currency',
    id: data.id,
    name: data.name,
    denomination: data.denomination,
    rarity: latest(data.rarity),
    unlocked: data.unlocked,
    locked: data.locked,
  };
}

function main() {
  const toughsRaw = readJsonDir(join(RAW_DIR, 'toughs'));
  const weaponsRaw = readJsonDir(join(RAW_DIR, 'weapons'));
  const drugsRaw = readJsonDir(join(RAW_DIR, 'drugs'));
  const currencyRaw = readJsonDir(join(RAW_DIR, 'currency'));
  if (toughsRaw.length === 0) throw new Error(`No raw tough cards in ${join(RAW_DIR, 'toughs')}`);
  if (weaponsRaw.length === 0) throw new Error(`No raw weapon cards in ${join(RAW_DIR, 'weapons')}`);
  if (drugsRaw.length === 0) throw new Error(`No raw drug cards in ${join(RAW_DIR, 'drugs')}`);
  if (currencyRaw.length === 0) throw new Error(`No raw currency cards in ${join(RAW_DIR, 'currency')}`);

  const toughs = toughsRaw.map(compileTough);
  const weapons = weaponsRaw.map(compileWeapon);
  const drugs = drugsRaw.map(compileDrug);
  const currency = currencyRaw.map(compileCurrency);

  mkdirSync(COMPILED_DIR, { recursive: true });
  writeFileSync(join(COMPILED_DIR, 'toughs.json'), JSON.stringify(toughs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'weapons.json'), JSON.stringify(weapons, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'drugs.json'), JSON.stringify(drugs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'currency.json'), JSON.stringify(currency, null, 2) + '\n');

  console.log(`[compile-cards] compiled ${toughs.length} toughs, ${weapons.length} weapons, ${drugs.length} drugs, ${currency.length} currency`);
}

try {
  main();
} catch (err) {
  console.error('[compile-cards] FAILED:', err.message);
  process.exitCode = 1;
}
