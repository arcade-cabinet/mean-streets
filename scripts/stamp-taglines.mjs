#!/usr/bin/env node
/**
 * stamp-taglines.mjs
 *
 * Adds a `tagline` field to every tough card in config/raw/cards/toughs/
 * whose draft flag is still true. Tagline is chosen from a per-archetype
 * seed list and deterministically shuffled by card id so every card gets
 * a stable, unique-ish line without a hand-curation pass.
 *
 * Idempotent: cards that already have a tagline are left alone. Pass
 * --force to overwrite.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TOUGHS_DIR = join(ROOT, 'config', 'raw', 'cards', 'toughs');

const FORCE = process.argv.includes('--force');

/** Per-archetype tagline pool. Every card picks one by hashing its id. */
const TAGLINES = {
  bruiser: [
    'Hits first. Hits last. Hits hardest.',
    'Your rules do not apply here.',
    'Made for breaking things.',
    'Walks through walls of people.',
    'Never learned to pull a punch.',
  ],
  snitch: [
    'Your secrets pay the rent.',
    'Knows who has been talking.',
    'Sells the truth by the ounce.',
    'Trades whispers for wins.',
    'Carries more names than a phone book.',
  ],
  lookout: [
    'Sees trouble before it arrives.',
    'Reads rooftops like road signs.',
    'Eyes everywhere, always.',
    'Knows when to call you back.',
    'Nothing moves without their say.',
  ],
  enforcer: [
    'Collects debts no one remembers.',
    'Teaches lessons in single syllables.',
    'Grudges have a long memory.',
    'Makes the point with a closed fist.',
    'Works the edges of the neighborhood.',
  ],
  ghost: [
    'Here and gone before you blink.',
    'The one you do not see coming.',
    'Moves through the gaps.',
    'Never stood in the same spot twice.',
    'You will know them by their absence.',
  ],
  arsonist: [
    'Brings fire to problems.',
    'If it burns, they are smiling.',
    'Leaves the block a little louder.',
    'Asks forgiveness, never permission.',
    'Makes a mess and calls it progress.',
  ],
  shark: [
    'Smells the weak one first.',
    'Finishes what others start.',
    'Patient as a Friday night.',
    'Only moves when the blood is in the water.',
    'Has never met a fair fight.',
  ],
  fence: [
    'Turns a punch into a payday.',
    'Every problem has a price.',
    'Knows a guy who knows a guy.',
    'Liquidates the uncomfortable.',
    'Makes your loss their inventory.',
  ],
  medic: [
    'Stitches back what the block takes.',
    'Keeps the crew on its feet.',
    'Seen worse. Fixed worse.',
    'Calm in ways that scare people.',
    'Does the work no one thanks you for.',
  ],
  wheelman: [
    'Knows every alley by name.',
    'Out before the sirens turn the corner.',
    'Moves people like weather.',
    'Idles hot and always ready.',
    'Runs the lane like it is theirs.',
  ],
  hustler: [
    'Turns nothing into something, twice.',
    'Closes deals under streetlamps.',
    'Palms more than they flash.',
    'Smiles like a man with a plan.',
    'Plays the long game in short pants.',
  ],
  sniper: [
    'One shot. One line you will remember.',
    'Waits. Breathes. Ends it.',
    'Picks the day they end it.',
    'Holds the block by the breath.',
    'Has a view you do not want to be in.',
  ],
  fixer: [
    'Makes the problem disappear.',
    'Knows a guy for every problem.',
    'Cleans up what others leave behind.',
    'Turns a crisis into a transaction.',
    'Handles the paperwork nobody writes down.',
  ],
};

function hashSeed(cardId) {
  let h = 5381;
  for (let i = 0; i < cardId.length; i++) h = ((h << 5) + h + cardId.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickTagline(cardId, archetype) {
  const pool = TAGLINES[archetype];
  if (!pool) return null;
  return pool[hashSeed(cardId) % pool.length];
}

function main() {
  const files = readdirSync(TOUGHS_DIR).filter((f) => f.endsWith('.json')).sort();
  let stamped = 0;
  let skipped = 0;
  let unchanged = 0;
  for (const file of files) {
    const path = join(TOUGHS_DIR, file);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (!FORCE && typeof raw.tagline === 'string' && raw.tagline.length > 0) {
      unchanged++;
      continue;
    }
    const tagline = pickTagline(raw.id, raw.archetype);
    if (!tagline) {
      skipped++;
      continue;
    }
    raw.tagline = tagline;
    writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
    stamped++;
  }
  console.log(`[stamp-taglines] stamped=${stamped} skipped=${skipped} unchanged=${unchanged}`);
}

main();
