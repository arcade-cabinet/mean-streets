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
const SPRITES_DIR = join(ROOT, 'raw-assets', 'sprites');

const TOUGH_TEMPLATE_NAMES = new Set(['street-left', 'street-right', 'ambush', 'wall-lean']);
const TOUGH_PALETTE_NAMES = new Set(['ember', 'ash', 'rust', 'smoke']);
const ITEM_TEMPLATE_NAMES = new Set(['triptych-left', 'triptych-right', 'totem', 'fan']);
const WEAPON_PALETTE_NAMES = new Set(['steel', 'gunmetal', 'slate']);
const DRUG_PALETTE_NAMES = new Set(['violet', 'toxic', 'haze']);
const CURRENCY_PALETTE_NAMES = new Set(['brass', 'olive', 'laundered']);

const MYTHIC_PORTRAIT_SPRITES = new Map([
  ['mythic-01', 'the-silhouette'],
  ['mythic-02', 'the-accountant'],
  ['mythic-03', 'the-architect'],
  ['mythic-04', 'the-informer'],
  ['mythic-05', 'the-ghost-alt2'],
  ['mythic-06', 'the-warlord'],
  ['mythic-07', 'the-fixer-alt'],
  ['mythic-08', 'the-magistrate-alt2'],
  ['mythic-09', 'the-phantom-alt'],
  ['mythic-10', 'the-reaper'],
]);

const TOUGH_LAYER_CATEGORIES = {
  body: ['bodies'],
  head: ['bodies'],
  torso: ['torsos', 'bodies'],
  arms: ['arms', 'weapons', 'torsos', 'contraband'],
  legs: ['legs', 'torsos', 'back'],
  back: ['back', 'legs', 'contraband', 'weapons'],
};

const WEAPON_LAYER_CATEGORIES = {
  primary: ['weapons', 'contraband', 'arms', 'torsos'],
  support: ['weapons', 'contraband', 'arms', 'torsos'],
  backdrop: ['weapons', 'contraband', 'arms', 'torsos'],
  badge: ['weapons', 'contraband', 'arms', 'torsos'],
};

const ITEM_LAYER_CATEGORIES = {
  primary: ['contraband', 'weapons'],
  support: ['contraband', 'weapons'],
  backdrop: ['contraband', 'weapons'],
  badge: ['contraband', 'weapons'],
};

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

function requireKnownValue(value, allowed, label, context) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${context}: portrait.${label} must be a non-empty string`);
  }
  if (!allowed.has(value)) {
    throw new Error(`${context}: unknown portrait.${label} "${value}"`);
  }
}

function layerPatterns(value, role, context) {
  if (typeof value === 'string') {
    if (value.length === 0) {
      throw new Error(`${context}: portrait.layers.${role} must not be empty`);
    }
    return [value];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error(`${context}: portrait.layers.${role} must not be empty`);
    }
    for (const item of value) {
      if (typeof item !== 'string' || item.length === 0) {
        throw new Error(`${context}: portrait.layers.${role} entries must be non-empty strings`);
      }
    }
    return value;
  }
  throw new Error(`${context}: portrait.layers.${role} must be a string or non-empty string array`);
}

const spriteStemCache = new Map();

function spriteStems(category) {
  if (!spriteStemCache.has(category)) {
    const dir = join(SPRITES_DIR, category);
    const stems = existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => file.endsWith('.png'))
          .map((file) => file.replace(/\.png$/, ''))
      : [];
    spriteStemCache.set(category, stems);
  }
  return spriteStemCache.get(category);
}

function hasMatchingSprite(categories, pattern) {
  for (const category of categories) {
    for (const stem of spriteStems(category)) {
      if (stem === pattern || stem.startsWith(`${pattern}-`)) return true;
    }
  }
  return false;
}

function requireLayerAssetMatches(patterns, role, categories, context) {
  for (const pattern of patterns) {
    if (!hasMatchingSprite(categories, pattern)) {
      throw new Error(
        `${context}: portrait.layers.${role} references unknown sprite pattern "${pattern}"`,
      );
    }
  }
}

function requireStackPortrait(portrait, context, options) {
  if (!portrait || typeof portrait !== 'object') {
    throw new Error(`${context}: missing required stack portrait`);
  }
  if (portrait.mode !== 'stack') {
    throw new Error(`${context}: expected portrait.mode=stack, got ${JSON.stringify(portrait.mode)}`);
  }
  requireKnownValue(portrait.template, options.templateNames, 'template', context);
  requireKnownValue(portrait.palette, options.paletteNames, 'palette', context);

  const layers = portrait.layers;
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) {
    throw new Error(`${context}: portrait.layers must be an object`);
  }

  for (const role of Object.keys(layers)) {
    if (!options.allowedRoles.has(role)) {
      throw new Error(`${context}: unknown portrait.layers.${role}`);
    }
  }
  for (const role of options.requiredRoles) {
    if (!(role in layers)) {
      throw new Error(`${context}: missing required portrait.layers.${role}`);
    }
  }
  for (const [role, value] of Object.entries(layers)) {
    const patterns = layerPatterns(value, role, context);
    requireLayerAssetMatches(patterns, role, options.layerCategories[role], context);
  }
}

function requireCustomPortrait(portrait, context, cardId) {
  if (!portrait || typeof portrait !== 'object') {
    throw new Error(`${context}: missing required custom portrait`);
  }
  if (portrait.mode !== 'custom') {
    throw new Error(`${context}: expected portrait.mode=custom, got ${JSON.stringify(portrait.mode)}`);
  }
  if (typeof portrait.sprite !== 'string' || portrait.sprite.length === 0) {
    throw new Error(`${context}: custom portrait.sprite must be a non-empty string`);
  }
  const expected = MYTHIC_PORTRAIT_SPRITES.get(cardId);
  if (expected === undefined) {
    throw new Error(`${context}: unknown mythic id "${cardId}" has no assigned custom portrait`);
  }
  if (portrait.sprite !== expected) {
    throw new Error(`${context}: ${cardId} must use assigned custom portrait "${expected}"`);
  }
  const spritePath = join(SPRITES_DIR, 'mythics', `${portrait.sprite}.png`);
  if (!existsSync(spritePath)) {
    throw new Error(`${context}: mythic portrait sprite not found: ${spritePath}`);
  }
}

function compileTough({ file, data }) {
  requireFields(data, ['id', 'kind', 'name', 'archetype', 'affiliation', 'power', 'resistance', 'maxHp', 'hp', 'rarity', 'abilities', 'unlocked', 'locked'], `toughs/${file}`);
  if (data.kind !== 'tough') throw new Error(`toughs/${file}: expected kind=tough, got ${data.kind}`);
  requireStackPortrait(data.portrait, `toughs/${file}`, {
    templateNames: TOUGH_TEMPLATE_NAMES,
    paletteNames: TOUGH_PALETTE_NAMES,
    requiredRoles: ['body', 'torso', 'arms', 'legs'],
    allowedRoles: new Set(['body', 'head', 'torso', 'arms', 'legs', 'back']),
    layerCategories: TOUGH_LAYER_CATEGORIES,
  });
  return {
    kind: 'tough',
    id: data.id,
    name: data.name,
    ...(data.tagline ? { tagline: data.tagline } : {}),
    archetype: data.archetype,
    affiliation: data.affiliation,
    power: latest(data.power),
    resistance: latest(data.resistance),
    maxHp: data.maxHp,
    hp: data.hp,
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
  requireStackPortrait(data.portrait, `weapons/${file}`, {
    templateNames: ITEM_TEMPLATE_NAMES,
    paletteNames: WEAPON_PALETTE_NAMES,
    requiredRoles: ['primary', 'support'],
    allowedRoles: new Set(['primary', 'support', 'backdrop', 'badge']),
    layerCategories: WEAPON_LAYER_CATEGORIES,
  });
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
  requireStackPortrait(data.portrait, `drugs/${file}`, {
    templateNames: ITEM_TEMPLATE_NAMES,
    paletteNames: DRUG_PALETTE_NAMES,
    requiredRoles: ['primary', 'support'],
    allowedRoles: new Set(['primary', 'support', 'backdrop', 'badge']),
    layerCategories: ITEM_LAYER_CATEGORIES,
  });
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
  requireStackPortrait(data.portrait, `currency/${file}`, {
    templateNames: ITEM_TEMPLATE_NAMES,
    paletteNames: CURRENCY_PALETTE_NAMES,
    requiredRoles: ['primary', 'support'],
    allowedRoles: new Set(['primary', 'support', 'backdrop', 'badge']),
    layerCategories: ITEM_LAYER_CATEGORIES,
  });
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
    ['id', 'kind', 'name', 'archetype', 'affiliation', 'power', 'resistance', 'maxHp', 'hp', 'rarity', 'abilities', 'mythic_signature', 'unlocked', 'locked'],
    `mythics/${file}`,
  );
  if (data.kind !== 'tough') throw new Error(`mythics/${file}: expected kind=tough (mythics are toughs), got ${data.kind}`);
  requireCustomPortrait(data.portrait, `mythics/${file}`, data.id);
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
    maxHp: data.maxHp,
    hp: data.hp,
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
