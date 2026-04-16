#!/usr/bin/env node
/**
 * migrate-v01-to-v02.mjs
 *
 * Transforms v0.1 authored card JSON files to v0.2 format.
 * Idempotent — skips files already in v0.2 format (detected by `kind` field).
 *
 * Changes applied:
 *   Toughs:  type→kind, displayName→name, abilityText→abilities[], add rarity[], drop unlockCondition:null, drop runner fields
 *   Weapons: type→kind, displayName→name, bonus→power, abilityText→abilities[], add rarity[], add resistance[], drop offense/defense split
 *   Drugs:   type→kind, displayName→name, potency→power, abilityText→abilities[], add rarity[], add resistance[]
 *
 * Usage: node scripts/migrate-v01-to-v02.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const DRY_RUN = process.argv.includes('--dry-run');

let migrated = 0;
let skipped = 0;
let errors = 0;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would write ${path}`);
    return;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function migrateTough(data) {
  if (data.kind === 'tough') return null;
  const out = {
    id: data.id,
    kind: 'tough',
    name: data.displayName || data.name,
    ...(data.tagline ? { tagline: data.tagline } : {}),
    archetype: data.archetype,
    affiliation: data.affiliation,
    power: Array.isArray(data.power) ? data.power : data.power != null ? [data.power] : [1],
    resistance: Array.isArray(data.resistance) ? data.resistance : data.resistance != null ? [data.resistance] : [1],
    rarity: Array.isArray(data.rarity) ? data.rarity : ['common'],
    abilities: data.abilities
      ? data.abilities
      : data.abilityText
        ? [data.abilityText]
        : [],
    unlocked: data.unlocked ?? true,
    locked: data.locked ?? false,
    ...(data.draft != null ? { draft: data.draft } : {}),
  };
  return out;
}

function migrateWeapon(data) {
  if (data.kind === 'weapon') return null;
  const powerVal = data.bonus ?? data.power;
  const out = {
    id: data.id,
    kind: 'weapon',
    name: data.displayName || data.name,
    category: data.category,
    power: Array.isArray(powerVal) ? powerVal : [powerVal ?? 1],
    resistance: Array.isArray(data.resistance) ? data.resistance : [data.resistance ?? 1],
    rarity: Array.isArray(data.rarity) ? data.rarity : ['common'],
    abilities: data.abilities
      ? data.abilities
      : data.abilityText
        ? [data.abilityText]
        : data.offenseAbility && data.defenseAbility
          ? [data.offenseAbility, data.defenseAbility]
          : [],
    unlocked: data.unlocked ?? true,
    locked: data.locked ?? false,
    ...(data.draft != null ? { draft: data.draft } : {}),
  };
  return out;
}

function migrateDrug(data) {
  if (data.kind === 'drug') return null;
  const powerVal = data.potency ?? data.power;
  const out = {
    id: data.id,
    kind: 'drug',
    name: data.displayName || data.name,
    category: data.category,
    power: Array.isArray(powerVal) ? powerVal : [powerVal ?? 1],
    resistance: Array.isArray(data.resistance) ? data.resistance : [data.resistance ?? 1],
    rarity: Array.isArray(data.rarity) ? data.rarity : ['common'],
    abilities: data.abilities
      ? data.abilities
      : data.abilityText
        ? [data.abilityText]
        : data.offenseAbility && data.defenseAbility
          ? [data.offenseAbility, data.defenseAbility]
          : [],
    unlocked: data.unlocked ?? true,
    locked: data.locked ?? false,
    ...(data.draft != null ? { draft: data.draft } : {}),
  };
  return out;
}

function processDir(dir, kind, migrateFn) {
  if (!existsSync(dir)) {
    console.log(`  [skip] ${dir} does not exist`);
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const path = join(dir, file);
    try {
      const data = readJson(path);
      const result = migrateFn(data);
      if (result === null) {
        skipped++;
        continue;
      }
      writeJson(path, result);
      migrated++;
    } catch (err) {
      console.error(`  [error] ${kind}/${file}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`[migrate-v01-to-v02] ${DRY_RUN ? '(dry run) ' : ''}migrating authored cards...`);

processDir(join(RAW_DIR, 'toughs'), 'toughs', migrateTough);
processDir(join(RAW_DIR, 'weapons'), 'weapons', migrateWeapon);
processDir(join(RAW_DIR, 'drugs'), 'drugs', migrateDrug);

console.log(`[migrate-v01-to-v02] done: ${migrated} migrated, ${skipped} already v0.2, ${errors} errors`);
if (errors > 0) process.exitCode = 1;
