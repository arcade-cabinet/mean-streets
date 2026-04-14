#!/usr/bin/env node
/**
 * One-off explosion script: read src/data/cards.json and emit one JSON file
 * per crew card under config/raw/cards/toughs/.
 *
 * Each output file holds a single card record with:
 *   - scalar metadata (id, name, archetype, affiliation, unlocked, locked)
 *   - stat arrays (power: [n], resistance: [n]) — single-element baseline
 *     that autobalance appends to over time, giving us a tuning trail without
 *     committing over the history.
 *
 * Only runs at dev time. Safe to re-run; existing files in the output dir
 * are deleted first.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const SRC = join(root, 'src', 'data', 'cards.json');
const OUT = join(root, 'config', 'raw', 'cards', 'toughs');

function clearOutputDir(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith('.json')) rmSync(join(dir, entry));
    }
  } catch {
    // Directory doesn't exist yet — mkdir below handles it.
  }
  mkdirSync(dir, { recursive: true });
}

function toRawCrew(card) {
  // The active engine uses one attack/resistance pair collapsed from day/night.
  const power = Math.max(card.dayAtk, card.nightAtk);
  const resistance = Math.max(card.dayDef, card.nightDef);
  return {
    id: card.id,
    type: 'crew',
    displayName: card.displayName,
    archetype: card.archetype,
    affiliation: card.affiliation,
    power: [power],
    resistance: [resistance],
    abilityText: card.abilityDesc,
    unlocked: card.unlocked === true,
    unlockCondition: card.unlockCondition ?? null,
    locked: false,
    draft: true,
  };
}

function writeCards(cards, outDir) {
  clearOutputDir(outDir);
  for (const card of cards) {
    const file = join(outDir, `${card.id}.json`);
    writeFileSync(file, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  }
  console.log(`  wrote ${cards.length} cards to ${outDir}`);
}

function main() {
  console.log('[explode-cards] reading', SRC);
  const source = JSON.parse(readFileSync(SRC, 'utf8'));
  const raw = source.map(toRawCrew);
  writeCards(raw, OUT);
  console.log('[explode-cards] done.');
}

main();
