#!/usr/bin/env node
/**
 * compile-cards.mjs
 *
 * Walks config/raw/cards/{toughs,weapons,drugs,currency,mythics},
 * validates each entry structurally, reduces every stat/rarity history
 * array to its last element, and writes flat compiled catalogs to:
 *
 *   config/compiled/toughs.json
 *   config/compiled/weapons.json
 *   config/compiled/drugs.json
 *   config/compiled/currency.json
 *   config/compiled/mythics.json
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

function requireStackPortrait(portrait, context) {
  if (!portrait || typeof portrait !== 'object') {
    throw new Error(`${context}: missing required stack portrait`);
  }
  if (portrait.mode !== 'stack') {
    throw new Error(`${context}: expected portrait.mode=stack, got ${JSON.stringify(portrait.mode)}`);
  }
}

function requireCustomPortrait(portrait, context) {
  if (!portrait || typeof portrait !== 'object') {
    throw new Error(`${context}: missing required custom portrait`);
  }
  if (portrait.mode !== 'custom') {
    throw new Error(`${context}: expected portrait.mode=custom, got ${JSON.stringify(portrait.mode)}`);
  }
  if (typeof portrait.sprite !== 'string' || portrait.sprite.length === 0) {
    throw new Error(`${context}: custom portrait.sprite must be a non-empty string`);
  }
}

function compileTough({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'archetype', 'affiliation', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `toughs/${file}`);
  if (data.kind !== 'tough') throw new Error(`toughs/${file}: expected kind=tough, got ${data.kind}`);
  requireStackPortrait(data.portrait, `toughs/${file}`);
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
    ...(data.portrait ? { portrait: data.portrait } : {}),
  };
}

function compileWeapon({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'category', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `weapons/${file}`);
  if (data.kind !== 'weapon') throw new Error(`weapons/${file}: expected kind=weapon, got ${data.kind}`);
  requireStackPortrait(data.portrait, `weapons/${file}`);
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
    ...(data.portrait ? { portrait: data.portrait } : {}),
  };
}

function compileDrug({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'category', 'power', 'resistance', 'rarity', 'abilities', 'unlocked', 'locked'], `drugs/${file}`);
  if (data.kind !== 'drug') throw new Error(`drugs/${file}: expected kind=drug, got ${data.kind}`);
  requireStackPortrait(data.portrait, `drugs/${file}`);
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
    ...(data.portrait ? { portrait: data.portrait } : {}),
  };
}

function compileCurrency({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'denomination', 'rarity', 'unlocked', 'locked'], `currency/${file}`);
  if (data.kind !== 'currency') throw new Error(`currency/${file}: expected kind=currency, got ${data.kind}`);
  requireStackPortrait(data.portrait, `currency/${file}`);
  if (data.abilities !== undefined) {
    if (!Array.isArray(data.abilities)) {
      throw new Error(`currency/${file}: "abilities" must be an array, got ${JSON.stringify(data.abilities)}`);
    }
    if (!data.abilities.every((a) => typeof a === 'string')) {
      throw new Error(`currency/${file}: all "abilities" entries must be strings, got ${JSON.stringify(data.abilities)}`);
    }
  }
  return {
    kind: 'currency',
    id: data.id,
    name: data.name,
    denomination: data.denomination,
    rarity: latest(data.rarity),
    ...(Array.isArray(data.abilities) && data.abilities.length > 0 ? { abilities: data.abilities } : {}),
    unlocked: data.unlocked,
    locked: data.locked,
    ...(data.portrait ? { portrait: data.portrait } : {}),
  };
}

function compileMythic({ file, data }) {
  requireFields(
    data,
    ['id', 'kind', 'name', 'archetype', 'affiliation', 'power', 'resistance', 'rarity', 'abilities', 'mythic_signature', 'unlocked', 'locked'],
    `mythics/${file}`,
  );
  if (data.kind !== 'tough') throw new Error(`mythics/${file}: expected kind=tough (mythics are toughs), got ${data.kind}`);
  requireCustomPortrait(data.portrait, `mythics/${file}`);
  const rarity = latest(data.rarity);
  if (rarity !== 'mythic') throw new Error(`mythics/${file}: expected rarity=mythic, got ${rarity}`);
  return {
    kind: 'tough',
    id: data.id,
    name: data.name,
    ...(data.tagline ? { tagline: data.tagline } : {}),
    archetype: data.archetype,
    affiliation: data.affiliation,
    power: latest(data.power),
    resistance: latest(data.resistance),
    rarity,
    abilities: data.abilities,
    mythic_signature: data.mythic_signature,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
    ...(data.portrait ? { portrait: data.portrait } : {}),
  };
}

function main() {
  const toughsRaw = readJsonDir(join(RAW_DIR, 'toughs'));
  const weaponsRaw = readJsonDir(join(RAW_DIR, 'weapons'));
  const drugsRaw = readJsonDir(join(RAW_DIR, 'drugs'));
  const currencyRaw = readJsonDir(join(RAW_DIR, 'currency'));
  const mythicsRaw = readJsonDir(join(RAW_DIR, 'mythics'));
  if (toughsRaw.length === 0) throw new Error(`No raw tough cards in ${join(RAW_DIR, 'toughs')}`);
  if (weaponsRaw.length === 0) throw new Error(`No raw weapon cards in ${join(RAW_DIR, 'weapons')}`);
  if (drugsRaw.length === 0) throw new Error(`No raw drug cards in ${join(RAW_DIR, 'drugs')}`);
  if (currencyRaw.length === 0) throw new Error(`No raw currency cards in ${join(RAW_DIR, 'currency')}`);
  // Mythics are authored separately (§11 v0.3). Empty pool is legal in
  // local dev — the game treats `mythicPool` as optional — so we warn
  // locally but fail fast in CI to prevent shipping an empty catalog.
  if (mythicsRaw.length === 0) {
    if (process.env.CI) {
      throw new Error('[compile-cards] No mythic cards found in config/raw/cards/mythics/ — refusing to compile in CI with empty mythics catalog');
    }
    console.warn('[compile-cards] WARN: no mythic cards found in config/raw/cards/mythics/');
  }

  const toughs = toughsRaw.map(compileTough);
  const weapons = weaponsRaw.map(compileWeapon);
  const drugs = drugsRaw.map(compileDrug);
  const currency = currencyRaw.map(compileCurrency);
  const mythics = mythicsRaw.map(compileMythic);

  mkdirSync(COMPILED_DIR, { recursive: true });
  writeFileSync(join(COMPILED_DIR, 'toughs.json'), JSON.stringify(toughs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'weapons.json'), JSON.stringify(weapons, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'drugs.json'), JSON.stringify(drugs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'currency.json'), JSON.stringify(currency, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'mythics.json'), JSON.stringify(mythics, null, 2) + '\n');

  console.log(`[compile-cards] compiled ${toughs.length} toughs, ${weapons.length} weapons, ${drugs.length} drugs, ${currency.length} currency, ${mythics.length} mythics`);
}

try {
  main();
} catch (err) {
  console.error('[compile-cards] FAILED:', err.message);
  process.exitCode = 1;
}
