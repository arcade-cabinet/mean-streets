#!/usr/bin/env node
/**
 * retag-rarities.mjs
 *
 * v0.3 rarity rebalance pass. Takes the existing authored card catalog
 * (all currently `common`-tagged) and distributes them across the full
 * common / uncommon / rare / legendary ladder using each card's
 * current stat sum (latest `power` + latest `resistance`) as the signal
 * — strongest cards bubble up.
 *
 *   toughs  (100): 55C / 25U / 15R / 5L
 *   weapons ( 50): 28C / 12U /  8R / 2L
 *   drugs   ( 50): 28C / 12U /  8R / 2L
 *
 * Mythic base cards live in `config/raw/cards/mythics/` and are NOT
 * touched by this script — mythics are always mythic, never roll.
 *
 * For the 5 legendary toughs, we splice in a matching signature ability
 * from Kira's ABILITY_INDEX (FIELD_MEDIC / LAUNDER-ineligible on toughs /
 * just use healing chain + mythic-adjacent keys). For the 2 legendary
 * drugs we add RESUSCITATE. Legendary weapons keep their authored
 * abilities (already strong) — no signature injection there to avoid
 * colliding with existing intangibles.
 *
 * Authorial continuity: existing ability strings on non-legendary cards
 * are never removed or reordered. Only the trailing `rarity` history
 * entry is updated; authored history is preserved.
 *
 * Run: `node scripts/retag-rarities.mjs`
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');

const TARGETS = {
  toughs: { common: 55, uncommon: 25, rare: 15, legendary: 5 },
  weapons: { common: 28, uncommon: 12, rare: 8, legendary: 2 },
  drugs: { common: 28, uncommon: 12, rare: 8, legendary: 2 },
};

/** Legendary signature ability assignment by category.
 *
 * Toughs:  top-5 P+R earn one each from the healing/heat pool. These
 *          map to handlers Kira registered in ABILITY_INDEX.
 * Drugs:   top-2 P+R earn RESUSCITATE (registered self-drug handler).
 * Weapons: no new signature — existing authored abilities already
 *          stack well at legendary rolled scaling.
 */
const LEGENDARY_TOUGH_SIGNATURES = [
  'FIELD_MEDIC',
  'FIELD_MEDIC',
  'LOW_PROFILE',
  'LOW_PROFILE',
  'FIELD_MEDIC',
];
const LEGENDARY_DRUG_SIGNATURES = ['RESUSCITATE', 'RESUSCITATE'];

function readAll(dir) {
  const full = join(RAW_DIR, dir);
  return readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      file: f,
      path: join(full, f),
      data: JSON.parse(readFileSync(join(full, f), 'utf8')),
    }));
}

function statSum(entry) {
  const p = entry.data.power;
  const r = entry.data.resistance;
  const latestP = Array.isArray(p) ? p[p.length - 1] : p;
  const latestR = Array.isArray(r) ? r[r.length - 1] : r;
  return (latestP ?? 0) + (latestR ?? 0);
}

function assignTier(entries, targets, category) {
  // Descending by stat sum, tiebreak by id for determinism.
  const sorted = [...entries].sort((a, b) => {
    const d = statSum(b) - statSum(a);
    if (d !== 0) return d;
    return a.data.id.localeCompare(b.data.id);
  });
  const legCount = targets.legendary;
  const rareCount = targets.rare;
  const uncCount = targets.uncommon;

  const assignments = new Map();
  let cursor = 0;

  // Legendary
  for (let i = 0; i < legCount; i++) {
    const entry = sorted[cursor++];
    if (!entry) break;
    assignments.set(entry.data.id, 'legendary');
  }
  // Rare
  for (let i = 0; i < rareCount; i++) {
    const entry = sorted[cursor++];
    if (!entry) break;
    assignments.set(entry.data.id, 'rare');
  }
  // Uncommon
  for (let i = 0; i < uncCount; i++) {
    const entry = sorted[cursor++];
    if (!entry) break;
    assignments.set(entry.data.id, 'uncommon');
  }
  // Remainder → common
  while (cursor < sorted.length) {
    const entry = sorted[cursor++];
    assignments.set(entry.data.id, 'common');
  }

  // Attach signature abilities to legendary toughs / drugs in same
  // descending order (top stat-sum first).
  if (category === 'toughs') {
    for (let i = 0; i < legCount && i < LEGENDARY_TOUGH_SIGNATURES.length; i++) {
      const entry = sorted[i];
      if (!entry) break;
      const sig = LEGENDARY_TOUGH_SIGNATURES[i];
      if (!entry.data.abilities.includes(sig)) {
        entry.data.abilities = [...entry.data.abilities, sig];
      }
    }
  } else if (category === 'drugs') {
    for (let i = 0; i < legCount && i < LEGENDARY_DRUG_SIGNATURES.length; i++) {
      const entry = sorted[i];
      if (!entry) break;
      const sig = LEGENDARY_DRUG_SIGNATURES[i];
      if (!entry.data.abilities.includes(sig)) {
        entry.data.abilities = [...entry.data.abilities, sig];
      }
    }
  }

  return { assignments, sorted };
}

function processCategory(category) {
  const entries = readAll(category);
  const targets = TARGETS[category];
  const { assignments, sorted } = assignTier(entries, targets, category);

  const tierLog = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
  const legendaryIds = [];

  for (const entry of entries) {
    const tier = assignments.get(entry.data.id);
    if (!tier) continue;
    tierLog[tier] = (tierLog[tier] || 0) + 1;
    const history = Array.isArray(entry.data.rarity) ? entry.data.rarity : [entry.data.rarity];
    // Append new tier to history if it differs from current last.
    const last = history[history.length - 1];
    const newHistory = last === tier ? history : [...history, tier];
    entry.data.rarity = newHistory;
    if (tier === 'legendary') legendaryIds.push(entry.data.id);
    writeFileSync(entry.path, JSON.stringify(entry.data, null, 2) + '\n');
  }

  console.log(`[retag] ${category}:`, tierLog);
  if (legendaryIds.length > 0) {
    console.log(`[retag] ${category} legendary ids:`, legendaryIds.join(', '));
  }
  return { tierLog, legendaryIds, sortedTopFive: sorted.slice(0, 5).map((e) => ({
    id: e.data.id,
    name: e.data.name,
    statSum: statSum(e),
    abilities: e.data.abilities,
  })) };
}

const summary = {
  toughs: processCategory('toughs'),
  weapons: processCategory('weapons'),
  drugs: processCategory('drugs'),
};

console.log('[retag] DONE.');
console.log('[retag] legendary tough details:');
for (const t of summary.toughs.sortedTopFive) {
  console.log(`  - ${t.id} ${t.name} (P+R=${t.statSum}) → abilities=${JSON.stringify(t.abilities)}`);
}
console.log('[retag] legendary drug details:');
for (const d of summary.drugs.sortedTopFive.slice(0, 2)) {
  console.log(`  - ${d.id} ${d.name} (P+R=${d.statSum}) → abilities=${JSON.stringify(d.abilities)}`);
}
console.log('[retag] legendary weapon details:');
for (const w of summary.weapons.sortedTopFive.slice(0, 2)) {
  console.log(`  - ${w.id} ${w.name} (P+R=${w.statSum}) → abilities=${JSON.stringify(w.abilities)}`);
}
