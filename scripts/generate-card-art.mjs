#!/usr/bin/env node
/**
 * generate-card-art.mjs — Build-time card art generator.
 *
 * Reads compiled card catalogs, pairs each card with the right
 * archetype/category silhouette template + affiliation accent color,
 * and emits src/ui/cards/cardArt.generated.ts mapping cardId → SVG string.
 *
 * Run: pnpm run cards:art (or automatically via predev/prebuild)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), 'utf-8'));
}

// Load compiled catalogs
const toughs = readJson('config/compiled/toughs.json');
const weapons = readJson('config/compiled/weapons.json');
const drugs = readJson('config/compiled/drugs.json');
const currency = readJson('config/compiled/currency.json');
const mythics = readJson('config/compiled/mythics.json');

// Load affiliation colors
const affData = readJson('src/data/pools/affiliations.json');
const colorMap = {};
for (const a of affData.affiliations) colorMap[a.id] = a.color;
colorMap[affData.freelance.id] = affData.freelance.color;

// Default colors for non-affiliated cards
const WEAPON_ACCENT = '#9CA3AF'; // steel grey
const DRUG_ACCENT = '#A78BFA';   // purple
const CURRENCY_ACCENT = '#FCD34D'; // gold

// SVG pose templates — inlined here for Node.js compatibility (no TS imports)
// These mirror the templates in src/ui/cards/art/ but as plain functions.

function silhouette(archetype, accent) {
  // Simple procedural silhouettes — distinct per archetype
  const poses = {
    bruiser: `<path d="M60 5C56 5 53 8 53 12C53 16 56 19 60 19C64 19 67 16 67 12C67 8 64 5 60 5Z" fill="#111"/><path d="M48 20L42 35L38 50L42 52L50 38L55 22Z" fill="#111"/><path d="M72 20L78 35L82 50L78 52L70 38L65 22Z" fill="#111"/><path d="M50 20L55 22L65 22L70 20L72 45L68 78L62 78L60 50L58 78L52 78L48 45Z" fill="#111"/><rect x="36" y="49" width="8" height="5" rx="2" fill="#111"/><rect x="76" y="49" width="8" height="5" rx="2" fill="#111"/><path d="M54 22L66 22L68 28L52 28Z" fill="${accent}" opacity="0.7"/>`,
    snitch: `<path d="M55 5C51 5 48 8 48 12C48 16 51 19 55 19C59 19 62 16 62 12C62 8 59 5 55 5Z" fill="#111"/><path d="M47 20L50 22L60 22L63 20L65 40L62 78L56 78L55 45L54 78L48 78L45 40Z" fill="#111"/><path d="M63 20L72 28L74 35L70 36L65 30Z" fill="#111"/><path d="M47 20L40 32L38 42L42 43L48 30Z" fill="#111"/><rect x="72" y="30" width="4" height="7" rx="1" fill="${accent}" opacity="0.8"/><line x1="85" y1="20" x2="85" y2="78" stroke="#111" stroke-width="3"/>`,
    lookout: `<path d="M65 8C61 8 58 11 58 15C58 19 61 22 65 22C69 22 72 19 72 15C72 11 69 8 65 8Z" fill="#111"/><path d="M57 23L60 25L70 25L73 23L74 42L70 78L64 78L63 48L62 78L56 78L55 42Z" fill="#111"/><path d="M73 23L82 18L86 14L88 17L80 24Z" fill="#111"/><path d="M57 23L48 35L44 48L48 49L54 35Z" fill="#111"/><circle cx="87" cy="15" r="3" fill="${accent}" opacity="0.6"/>`,
    ghost: `<defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111" stop-opacity="0.9"/><stop offset="1" stop-color="#111" stop-opacity="0.15"/></linearGradient></defs><path d="M60 8C56 8 53 11 53 15C53 19 56 22 60 22C64 22 67 19 67 15C67 11 64 8 60 8Z" fill="#111" opacity="0.85"/><path d="M50 23L55 25L65 25L70 23L72 50L68 78L52 78L48 50Z" fill="url(#gf)"/><circle cx="57" cy="14" r="1.5" fill="${accent}" opacity="0.9"/><circle cx="63" cy="14" r="1.5" fill="${accent}" opacity="0.9"/>`,
    enforcer: `<path d="M60 4C56 4 53 7 53 11C53 15 56 18 60 18C64 18 67 15 67 11C67 7 64 4 60 4Z" fill="#111"/><path d="M48 19L53 21L67 21L72 19L75 48L70 78L64 78L60 50L56 78L50 78L45 48Z" fill="#111"/><path d="M72 19L80 30L82 45L78 46L74 32Z" fill="#111"/><rect x="80" y="38" width="3" height="18" rx="1" fill="#111"/><rect x="79" y="38" width="5" height="4" rx="1" fill="${accent}" opacity="0.7"/>`,
    hustler: `<path d="M58 6C54 6 51 9 51 13C51 17 54 20 58 20C62 20 65 17 65 13C65 9 62 6 58 6Z" fill="#111"/><path d="M50 21L55 23L65 23L68 21L70 45L66 78L60 78L58 48L56 78L50 78L48 45Z" fill="#111"/><path d="M68 21L75 30L78 25L74 20Z" fill="#111"/><path d="M50 21L42 30L38 35L42 36L48 28Z" fill="#111"/><rect x="36" y="28" width="6" height="9" rx="1" fill="${accent}" opacity="0.6"/><rect x="38" y="30" width="6" height="9" rx="1" fill="${accent}" opacity="0.4"/>`,
    fixer: `<path d="M60 6C56 6 53 9 53 13C53 17 56 20 60 20C64 20 67 17 67 13C67 9 64 6 60 6Z" fill="#111"/><path d="M52 21L55 23L65 23L68 21L70 45L66 78L60 78L58 48L56 78L50 78L48 45Z" fill="#111"/><path d="M68 21L76 28L78 22L74 18Z" fill="#111"/><rect x="76" y="18" width="4" height="7" rx="1" fill="${accent}" opacity="0.8"/><path d="M52 21L44 32L40 40L44 41L50 30Z" fill="#111"/>`,
    medic: `<path d="M55 12C51 12 48 15 48 19C48 23 51 26 55 26C59 26 62 23 62 19C62 15 59 12 55 12Z" fill="#111"/><path d="M48 27L52 30L58 30L62 27L58 50L62 78L56 78L55 55L54 78L48 78L44 50Z" fill="#111"/><path d="M62 27L70 38L72 42L68 43L64 35Z" fill="#111"/><path d="M48 27L40 42L36 50L40 51L46 38Z" fill="#111"/><rect x="30" y="48" width="12" height="8" rx="2" fill="#111"/><path d="M34 50L38 50L38 54L34 54Z" fill="${accent}" opacity="0.8"/><path d="M35 49L37 49L37 55L35 55Z" fill="${accent}" opacity="0.8"/>`,
    arsonist: `<path d="M62 6C58 6 55 9 55 13C55 17 58 20 62 20C66 20 69 17 69 13C69 9 66 6 62 6Z" fill="#111"/><path d="M54 21L58 23L66 23L70 21L72 45L68 78L62 78L60 48L58 78L52 78L50 45Z" fill="#111"/><path d="M70 21L78 30L80 20L76 16Z" fill="#111"/><path d="M54 21L46 32L42 40L46 41L52 30Z" fill="#111"/><path d="M78 12C78 8 80 4 82 6C84 8 82 14 80 16C78 14 78 12 78 12Z" fill="${accent}" opacity="0.9"/>`,
    shark: `<path d="M60 15C56 15 53 18 53 22C53 26 56 29 60 29C64 29 67 26 67 22C67 18 64 15 60 15Z" fill="#111"/><path d="M48 30L52 32L68 32L72 30L74 55L70 78L50 78L46 55Z" fill="#111"/><path d="M72 30L80 38L82 34L78 28Z" fill="#111"/><rect x="78" y="30" width="6" height="8" rx="1" fill="${accent}" opacity="0.6"/><rect x="80" y="32" width="6" height="8" rx="1" fill="${accent}" opacity="0.4"/><rect x="82" y="34" width="6" height="8" rx="1" fill="${accent}" opacity="0.3"/>`,
    wheelsman: `<path d="M55 8C51 8 48 11 48 15C48 19 51 22 55 22C59 22 62 19 62 15C62 11 59 8 55 8Z" fill="#111"/><path d="M47 23L50 25L60 25L63 23L65 45L62 78L56 78L55 48L54 78L48 78L45 45Z" fill="#111"/><circle cx="55" cy="55" r="18" fill="none" stroke="#111" stroke-width="3"/><circle cx="55" cy="55" r="4" fill="#111"/><line x1="55" y1="37" x2="55" y2="44" stroke="#111" stroke-width="2"/><line x1="40" y1="62" x2="46" y2="58" stroke="#111" stroke-width="2"/><line x1="70" y1="62" x2="64" y2="58" stroke="#111" stroke-width="2"/><path d="M37 55C37 55 43 53 46 55" stroke="${accent}" stroke-width="1.5" fill="none" opacity="0.7"/>`,
    fence: `<path d="M60 6C56 6 53 9 53 13C53 17 56 20 60 20C64 20 67 17 67 13C67 9 64 6 60 6Z" fill="#111"/><path d="M50 21L55 23L65 23L70 21L72 45L68 78L52 78L48 45Z" fill="#111"/><path d="M50 21L44 30L42 35L46 36L52 28Z" fill="#111"/><path d="M70 21L76 30L78 35L74 36L68 28Z" fill="#111"/><rect x="25" y="50" width="14" height="12" rx="1" fill="#111" opacity="0.5"/><rect x="28" y="44" width="14" height="12" rx="1" fill="#111" opacity="0.6"/><rect x="26" y="52" width="10" height="4" fill="${accent}" opacity="0.5"/>`,
  };
  return poses[archetype] ?? poses.bruiser;
}

function weaponSvg(category, accent) {
  const shapes = {
    melee: `<path d="M60 10L65 12L63 55L57 55L55 12Z" fill="#111"/><rect x="50" y="55" width="20" height="4" rx="1" fill="#111"/><rect x="53" y="59" width="14" height="12" rx="2" fill="#111"/><line x1="56" y1="62" x2="56" y2="68" stroke="${accent}" stroke-width="1.5" opacity="0.7"/><line x1="60" y1="62" x2="60" y2="68" stroke="${accent}" stroke-width="1.5" opacity="0.7"/><line x1="64" y1="62" x2="64" y2="68" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>`,
    ranged: `<path d="M30 35L85 35L88 38L88 42L75 42L75 55L70 55L70 42L30 42Z" fill="#111"/><circle cx="82" cy="38" r="2" fill="${accent}" opacity="0.7"/><path d="M60 42L65 58L55 58Z" fill="#111"/>`,
    exotic: `<circle cx="40" cy="40" r="8" fill="none" stroke="#111" stroke-width="5"/><circle cx="55" cy="40" r="8" fill="none" stroke="#111" stroke-width="5"/><circle cx="70" cy="40" r="8" fill="none" stroke="#111" stroke-width="5"/><circle cx="85" cy="40" r="8" fill="none" stroke="#111" stroke-width="5"/><rect x="35" y="48" width="55" height="5" rx="2" fill="#111"/><rect x="38" y="50" width="6" height="3" fill="${accent}" opacity="0.6"/>`,
    explosive: `<path d="M55 25C55 25 50 35 50 50C50 60 55 65 60 65C65 65 70 60 70 50C70 35 65 25 65 25Z" fill="#111"/><rect x="57" y="15" width="6" height="12" rx="1" fill="#111"/><path d="M58 10C58 6 60 2 62 4C64 6 62 12 60 14C58 12 58 10 58 10Z" fill="${accent}" opacity="0.9"/>`,
  };
  return shapes[category] ?? shapes.melee;
}

function drugSvg(category, accent) {
  const shapes = {
    stimulant: `<rect x="40" y="30" width="40" height="20" rx="10" fill="#111"/><rect x="60" y="30" width="20" height="20" rx="10" fill="${accent}" opacity="0.6"/><line x1="60" y1="15" x2="60" y2="25" stroke="${accent}" stroke-width="1" opacity="0.5"/><line x1="45" y1="18" x2="50" y2="26" stroke="${accent}" stroke-width="1" opacity="0.5"/><line x1="75" y1="18" x2="70" y2="26" stroke="${accent}" stroke-width="1" opacity="0.5"/>`,
    depressant: `<path d="M50 20L55 20L55 55L65 55L65 20L70 20L70 60C70 65 65 68 60 68C55 68 50 65 50 60Z" fill="#111"/><rect x="48" y="15" width="24" height="6" rx="2" fill="#111"/><rect x="52" y="35" width="16" height="15" fill="${accent}" opacity="0.4"/>`,
    psychedelic: `<path d="M55 30C55 22 58 15 65 15C72 15 75 22 75 30C75 38 70 42 65 42C60 42 55 38 55 30Z" fill="#111"/><rect x="62" y="42" width="6" height="25" fill="#111"/><circle cx="65" cy="28" r="5" fill="${accent}" opacity="0.6"/><circle cx="65" cy="28" r="2" fill="#111"/>`,
    narcotic: `<path d="M40 30L80 30L78 60L42 60Z" fill="#111"/><line x1="40" y1="30" x2="50" y2="25" stroke="#111" stroke-width="2"/><line x1="80" y1="30" x2="70" y2="25" stroke="#111" stroke-width="2"/><path d="M55 38L65 38L65 52L55 52Z" fill="${accent}" opacity="0.5"/>`,
  };
  return shapes[category] ?? shapes.stimulant;
}

function currencySvg(denom, accent) {
  if (denom === 1000) {
    return `<rect x="28" y="22" width="64" height="36" rx="3" fill="#111" opacity="0.4"/><rect x="25" y="25" width="64" height="36" rx="3" fill="#111" opacity="0.6"/><rect x="22" y="28" width="64" height="36" rx="3" fill="#111"/><rect x="35" y="40" width="38" height="8" rx="2" fill="${accent}" opacity="0.5"/><text x="60" y="50" text-anchor="middle" fill="${accent}" font-size="14" font-weight="900" opacity="0.8">$$$</text>`;
  }
  return `<rect x="25" y="25" width="70" height="40" rx="3" fill="#111"/><rect x="30" y="30" width="60" height="30" rx="2" fill="none" stroke="${accent}" stroke-width="1" opacity="0.4"/><text x="60" y="52" text-anchor="middle" fill="${accent}" font-size="16" font-weight="900" opacity="0.7">$</text>`;
}

// Build the art map
const entries = [];

for (const card of toughs) {
  const accent = colorMap[card.affiliation] ?? '#A9A9A9';
  const inner = silhouette(card.archetype, accent);
  entries.push([card.id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${inner}</svg>`]);
}

for (const card of weapons) {
  const inner = weaponSvg(card.category, WEAPON_ACCENT);
  entries.push([card.id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${inner}</svg>`]);
}

for (const card of drugs) {
  const inner = drugSvg(card.category, DRUG_ACCENT);
  entries.push([card.id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${inner}</svg>`]);
}

for (const card of currency) {
  const inner = currencySvg(card.denomination, CURRENCY_ACCENT);
  entries.push([card.id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${inner}</svg>`]);
}

for (const card of mythics) {
  const accent = '#FFD700'; // gold for all mythics
  const inner = silhouette(card.archetype, accent);
  entries.push([card.id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${inner}</svg>`]);
}

// Write the generated module
const lines = entries.map(([id, svg]) =>
  `  ${JSON.stringify(id)}: ${JSON.stringify(svg)},`
);

const output = `// AUTO-GENERATED by scripts/generate-card-art.mjs — do not edit.
// Re-run: pnpm run cards:art
export const CARD_ART: Record<string, string> = {
${lines.join('\n')}
};
`;

const outPath = resolve(root, 'src/ui/cards/cardArt.generated.ts');
writeFileSync(outPath, output);
console.log(`[card-art] generated ${entries.length} card art entries → ${outPath}`);
