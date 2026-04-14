#!/usr/bin/env node
/**
 * One-off explosion: run the procedural weapon and drug generators once with
 * a deterministic seed, then emit one JSON file per card under
 * config/raw/cards/weapons/ and config/raw/cards/drugs/.
 *
 * From this point on, weapons and drugs are authored records just like crew
 * cards — autobalance appends to their stat arrays, and the names chosen here
 * are the baseline. A future creative pass can rename individual cards by
 * editing the JSON directly.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function clearOutputDir(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith('.json')) rmSync(join(dir, entry));
    }
  } catch {
    // fine, mkdirSync below handles
  }
  mkdirSync(dir, { recursive: true });
}

function writeCards(cards, outDir) {
  clearOutputDir(outDir);
  for (const card of cards) {
    const file = join(outDir, `${card.id}.json`);
    writeFileSync(file, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  }
  console.log(`  wrote ${cards.length} cards to ${outDir}`);
}

// Use tsx to actually execute the TS generators — simpler than re-implementing
// their logic in .mjs. The tsx script prints JSON to stdout, we parse and write.
function runGenerators() {
  const tsxArgs = ['-e', `
    import { generateWeapons, generateDrugs } from './src/sim/turf/generators.ts';
    import { createRng } from './src/sim/cards/rng.ts';
    const rng1 = createRng(42);
    const weapons = generateWeapons(rng1);
    const rng2 = createRng(42);
    const drugs = generateDrugs(rng2);
    process.stdout.write(JSON.stringify({ weapons, drugs }));
  `];
  const result = spawnSync('pnpm', ['exec', 'tsx', ...tsxArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`generator run failed with status ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function toRawWeapon(card) {
  return {
    id: card.id,
    type: 'weapon',
    name: card.name,
    category: card.category,
    bonus: [card.bonus],
    offenseAbility: card.offenseAbility,
    offenseAbilityText: card.offenseAbilityText,
    defenseAbility: card.defenseAbility,
    defenseAbilityText: card.defenseAbilityText,
    unlocked: card.unlocked === true,
    unlockCondition: card.unlockCondition ?? null,
    locked: false,
    draft: true,
  };
}

function toRawDrug(card) {
  return {
    id: card.id,
    type: 'product',
    name: card.name,
    category: card.category,
    potency: [card.potency],
    offenseAbility: card.offenseAbility,
    offenseAbilityText: card.offenseAbilityText,
    defenseAbility: card.defenseAbility,
    defenseAbilityText: card.defenseAbilityText,
    unlocked: card.unlocked === true,
    unlockCondition: card.unlockCondition ?? null,
    locked: false,
    draft: true,
  };
}

function main() {
  console.log('[explode-weapons-drugs] running generators with seed 42');
  const { weapons, drugs } = runGenerators();
  writeCards(
    weapons.map(toRawWeapon),
    join(root, 'config', 'raw', 'cards', 'weapons'),
  );
  writeCards(
    drugs.map(toRawDrug),
    join(root, 'config', 'raw', 'cards', 'drugs'),
  );
  console.log('[explode-weapons-drugs] done.');
}

main();
