/**
 * Preview the generated card pool.
 * Run: npx tsx src/sim/cards/preview.ts
 */

import { generateAllCards, printCardPoolSummary } from './generator';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cards = generateAllCards(42, 20);

printCardPoolSummary(cards);

// Save full card pool to JSON
const outDir = join(process.cwd(), 'src', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'cards.json');
writeFileSync(outPath, JSON.stringify(cards, null, 2));
console.log(`\nFull card pool saved: ${outPath}`);
