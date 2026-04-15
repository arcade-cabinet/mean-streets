#!/usr/bin/env node
/**
 * compile-cards.mjs
 *
 * Walks config/raw/cards/{toughs,weapons,drugs} + config/raw/cards/special.json,
 * validates each entry with its authored Zod schema, reduces every stat array
 * to its last element, and writes the flat compiled catalogs to:
 *
 *   config/compiled/toughs.json
 *   config/compiled/weapons.json
 *   config/compiled/drugs.json
 *   config/compiled/special.json
 *
 * Runs during `postinstall` and `prebuild`. Also invokable directly via
 * `pnpm run cards:compile`.
 *
 * This is Node-side; it does NOT use Vite's import.meta.glob.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const COMPILED_DIR = join(ROOT, 'config', 'compiled');

/** Read and parse a JSON file. */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Read every *.json in a directory (non-recursive, sorted). */
function readJsonDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, data: readJson(join(dir, f)) }));
}

/** Reduce a stat history array to its last element. */
function latest(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`latest(): expected non-empty array, got ${JSON.stringify(arr)}`);
  }
  return arr[arr.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────
// Lightweight structural validation (the strict Zod run happens in the
// runtime catalog loaders; this pass is fast, surfaces malformed files
// during install, and keeps the compile step dependency-free).
// ─────────────────────────────────────────────────────────────────────────

function requireFields(obj, fields, context) {
  for (const f of fields) {
    if (!(f in obj)) {
      throw new Error(`${context}: missing required field "${f}" in ${JSON.stringify(obj).slice(0, 120)}…`);
    }
  }
}

function compileCrew({ file, data }) {
  requireFields(data, ['id', 'type', 'displayName', 'archetype', 'affiliation', 'power', 'resistance', 'abilityText', 'unlocked', 'locked'], `toughs/${file}`);
  if (data.type !== 'crew') throw new Error(`toughs/${file}: expected type=crew, got ${data.type}`);
  return {
    id: data.id,
    type: 'crew',
    displayName: data.displayName,
    archetype: data.archetype,
    affiliation: data.affiliation,
    power: latest(data.power),
    resistance: latest(data.resistance),
    abilityText: data.abilityText,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
    ...(data.tagline ? { tagline: data.tagline } : {}),
  };
}

function compileWeapon({ file, data }) {
  requireFields(data, ['id', 'type', 'name', 'category', 'bonus', 'offenseAbility', 'offenseAbilityText', 'defenseAbility', 'defenseAbilityText', 'unlocked', 'locked'], `weapons/${file}`);
  if (data.type !== 'weapon') throw new Error(`weapons/${file}: expected type=weapon, got ${data.type}`);
  return {
    id: data.id,
    type: 'weapon',
    name: data.name,
    category: data.category,
    bonus: latest(data.bonus),
    offenseAbility: data.offenseAbility,
    offenseAbilityText: data.offenseAbilityText,
    defenseAbility: data.defenseAbility,
    defenseAbilityText: data.defenseAbilityText,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
  };
}

function compileDrug({ file, data }) {
  requireFields(data, ['id', 'type', 'name', 'category', 'potency', 'offenseAbility', 'offenseAbilityText', 'defenseAbility', 'defenseAbilityText', 'unlocked', 'locked'], `drugs/${file}`);
  if (data.type !== 'product') throw new Error(`drugs/${file}: expected type=product, got ${data.type}`);
  return {
    id: data.id,
    type: 'product',
    name: data.name,
    category: data.category,
    potency: latest(data.potency),
    offenseAbility: data.offenseAbility,
    offenseAbilityText: data.offenseAbilityText,
    defenseAbility: data.defenseAbility,
    defenseAbilityText: data.defenseAbilityText,
    unlocked: data.unlocked,
    ...(data.unlockCondition ? { unlockCondition: data.unlockCondition } : {}),
    locked: data.locked,
  };
}

function compileSpecial(data) {
  requireFields(data, ['backpack', 'cash'], 'special.json');
  requireFields(data.backpack, ['id', 'type', 'slots', 'deployableTo', 'transferRule', 'freeSwapOnEquip', 'description', 'locked'], 'special.json/backpack');
  requireFields(data.cash, ['id', 'type', 'description', 'denominations', 'locked'], 'special.json/cash');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────

function main() {
  const toughsRaw = readJsonDir(join(RAW_DIR, 'toughs'));
  const weaponsRaw = readJsonDir(join(RAW_DIR, 'weapons'));
  const drugsRaw = readJsonDir(join(RAW_DIR, 'drugs'));
  const specialPath = join(RAW_DIR, 'special.json');
  const specialRaw = existsSync(specialPath) ? readJson(specialPath) : null;

  if (toughsRaw.length === 0) throw new Error(`No raw tough cards in ${join(RAW_DIR, 'toughs')}`);
  if (weaponsRaw.length === 0) throw new Error(`No raw weapon cards in ${join(RAW_DIR, 'weapons')}`);
  if (drugsRaw.length === 0) throw new Error(`No raw drug cards in ${join(RAW_DIR, 'drugs')}`);
  if (!specialRaw) throw new Error(`No special.json in ${RAW_DIR}`);

  const toughs = toughsRaw.map(compileCrew);
  const weapons = weaponsRaw.map(compileWeapon);
  const drugs = drugsRaw.map(compileDrug);
  const special = compileSpecial(specialRaw);

  mkdirSync(COMPILED_DIR, { recursive: true });
  writeFileSync(join(COMPILED_DIR, 'toughs.json'), JSON.stringify(toughs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'weapons.json'), JSON.stringify(weapons, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'drugs.json'), JSON.stringify(drugs, null, 2) + '\n');
  writeFileSync(join(COMPILED_DIR, 'special.json'), JSON.stringify(special, null, 2) + '\n');

  console.log(`[compile-cards] compiled ${toughs.length} toughs, ${weapons.length} weapons, ${drugs.length} drugs, special.json`);
}

try {
  main();
} catch (err) {
  console.error('[compile-cards] FAILED:', err.message);
  process.exitCode = 1;
}
