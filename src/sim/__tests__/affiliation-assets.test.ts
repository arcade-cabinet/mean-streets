import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import affiliationData from '../../data/pools/affiliations.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..');
const ASSETS_DIR = join(ROOT, 'public', 'assets', 'affiliations');

const allAffiliations = [
  ...affiliationData.affiliations,
  affiliationData.freelance,
];

describe('affiliation SVG assets', () => {
  it('has an SVG file for every authored affiliation', () => {
    for (const aff of allAffiliations) {
      const svgPath = join(ASSETS_DIR, `${aff.id}.svg`);
      if (!existsSync(svgPath)) {
        throw new Error(`missing SVG for affiliation '${aff.id}' at ${svgPath}`);
      }
    }
  });

  it('every SVG file is well-formed (xml root, viewBox)', () => {
    for (const aff of allAffiliations) {
      const svgPath = join(ASSETS_DIR, `${aff.id}.svg`);
      const content = readFileSync(svgPath, 'utf8');
      expect(content, `${aff.id}.svg`).toMatch(/<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(content, `${aff.id}.svg`).toMatch(/viewBox="0 0 64 64"/);
      expect(content, `${aff.id}.svg`).toMatch(/<\/svg>/);
    }
  });
});
