#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'public', 'assets', 'card-art', 'portrait-stacks.json');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const FORCE = process.argv.includes('--force');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function stemFromSprite(sprite) {
  return sprite.split('/').at(-1).replace(/\.png$/, '');
}

function rawPathForCard(cardId) {
  if (cardId.startsWith('card-')) return join(RAW_DIR, 'toughs', `${cardId}.json`);
  if (cardId.startsWith('weap-')) return join(RAW_DIR, 'weapons', `${cardId}.json`);
  if (cardId.startsWith('drug-')) return join(RAW_DIR, 'drugs', `${cardId}.json`);
  if (cardId.startsWith('currency-')) return join(RAW_DIR, 'currency', `${cardId}.json`);
  throw new Error(`Unsupported card id: ${cardId}`);
}

function portraitFromManifest(entry) {
  const layers = {};

  for (const layer of entry.layers ?? []) {
    const sprite = stemFromSprite(layer.sprite);
    if (entry.kind === 'tough') {
      if (layer.role === 'body') layers.body = sprite;
      else if (layer.role === 'torso') layers.torso = sprite;
      else if (layer.role === 'pose') layers.legs = sprite;
      else if (layer.role === 'arms') layers.arms = sprite;
      else if (layer.role === 'back') layers.back = sprite;
    } else {
      if (layer.role === 'front') layers.primary = sprite;
      else if (layer.role === 'support') layers.support = sprite;
      else if (layer.role === 'backdrop') layers.backdrop = sprite;
      else if (layer.role === 'badge') layers.badge = sprite;
    }
  }

  return {
    mode: 'stack',
    template: entry.template,
    palette: entry.palette,
    layers,
  };
}

function main() {
  const manifest = readJson(MANIFEST_PATH);
  let updated = 0;
  let skipped = 0;

  for (const [cardId, entry] of Object.entries(manifest)) {
    const rawPath = rawPathForCard(cardId);
    const raw = readJson(rawPath);
    if (!FORCE && raw.portrait) {
      skipped += 1;
      continue;
    }
    raw.portrait = portraitFromManifest(entry);
    writeJson(rawPath, raw);
    updated += 1;
  }

  console.log(
    `[sync-portrait-definitions] synced ${updated} raw card files from portrait-stacks.json`
      + (FORCE ? ' (forced overwrite)' : `, skipped ${skipped} existing portraits`),
  );
}

main();
