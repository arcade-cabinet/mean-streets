/**
 * validate-raw-cards.ts
 *
 * Walks config/raw/cards/ and runs each file through its Zod schema.
 * Exits non-zero and prints offenders when any file is malformed.
 *
 * Invoked via `pnpm run cards:validate`.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import {
  AuthoredCurrencySchema,
  AuthoredDrugSchema,
  AuthoredMythicSchema,
  AuthoredToughSchema,
  AuthoredWeaponSchema,
} from '../src/sim/cards/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');
const SPRITES_DIR = join(ROOT, 'raw-assets', 'sprites');

const TOUGH_LAYER_CATEGORIES = {
  body: ['bodies'],
  head: ['bodies'],
  torso: ['torsos', 'bodies'],
  arms: ['arms', 'weapons', 'torsos', 'contraband'],
  legs: ['legs', 'torsos', 'back'],
  back: ['back', 'legs', 'contraband', 'weapons'],
} as const;

const WEAPON_LAYER_CATEGORIES = {
  primary: ['weapons', 'contraband', 'arms', 'torsos'],
  support: ['weapons', 'contraband', 'arms', 'torsos'],
  backdrop: ['weapons', 'contraband', 'arms', 'torsos'],
  badge: ['weapons', 'contraband', 'arms', 'torsos'],
} as const;

const ITEM_LAYER_CATEGORIES = {
  primary: ['contraband', 'weapons'],
  support: ['contraband', 'weapons'],
  backdrop: ['contraband', 'weapons'],
  badge: ['contraband', 'weapons'],
} as const;

type LayerCategories = Record<string, readonly string[]>;

interface Offender {
  file: string;
  issues: string[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.json'))
    .sort();
}

function formatIssues(err: { issues: { path: PropertyKey[]; message: string }[] } | undefined): string[] {
  const issues = err?.issues ?? [];
  return issues.map((i) => `  • ${i.path.map(String).join('.') || '<root>'}: ${i.message}`);
}

function patternsForLayer(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

const spriteStemCache = new Map<string, string[]>();

function spriteStems(category: string): string[] {
  if (!spriteStemCache.has(category)) {
    const dir = join(SPRITES_DIR, category);
    const stems = existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => file.endsWith('.png'))
          .map((file) => file.replace(/\.png$/, ''))
      : [];
    spriteStemCache.set(category, stems);
  }
  return spriteStemCache.get(category) ?? [];
}

function hasMatchingSprite(categories: readonly string[], pattern: string): boolean {
  return categories.some((category) =>
    spriteStems(category).some(
      (stem) => stem === pattern || stem.startsWith(`${pattern}-`),
    ),
  );
}

function validateStackPortraitAssets(
  data: { portrait?: { layers?: Record<string, unknown> } },
  layerCategories: LayerCategories,
): string[] {
  const layers = data.portrait?.layers ?? {};
  const issues: string[] = [];

  for (const [role, value] of Object.entries(layers)) {
    const categories = layerCategories[role];
    if (!categories) continue;

    for (const pattern of patternsForLayer(value)) {
      if (!hasMatchingSprite(categories, pattern)) {
        issues.push(
          `  • portrait.layers.${role}: unknown sprite pattern "${pattern}"`,
        );
      }
    }
  }

  return issues;
}

function validateCustomPortraitAsset(data: {
  portrait?: { sprite?: unknown };
}): string[] {
  const sprite = data.portrait?.sprite;
  if (typeof sprite !== 'string') return [];
  const spritePath = join(SPRITES_DIR, 'mythics', `${sprite}.png`);
  return existsSync(spritePath)
    ? []
    : [`  • portrait.sprite: missing mythic sprite "${sprite}.png"`];
}

function portraitAssetIssues(label: string, data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const card = data as {
    portrait?: {
      layers?: Record<string, unknown>;
      sprite?: unknown;
    };
  };
  if (label === 'toughs') {
    return validateStackPortraitAssets(card, TOUGH_LAYER_CATEGORIES);
  }
  if (label === 'weapons') {
    return validateStackPortraitAssets(card, WEAPON_LAYER_CATEGORIES);
  }
  if (label === 'drugs' || label === 'currency') {
    return validateStackPortraitAssets(card, ITEM_LAYER_CATEGORIES);
  }
  if (label === 'mythics') {
    return validateCustomPortraitAsset(card);
  }
  return [];
}

function validateDir(
  label: string,
  dir: string,
  schema: ZodType<unknown>,
): Offender[] {
  const offenders: Offender[] = [];
  for (const file of listJson(dir)) {
    const data = readJson(join(dir, file));
    const res = schema.safeParse(data);
    if (!res.success) {
      offenders.push({
        file: `${label}/${file}`,
        issues: formatIssues(res.error),
      });
      continue;
    }

    const assetIssues = portraitAssetIssues(label, res.data);
    if (assetIssues.length > 0) {
      offenders.push({
        file: `${label}/${file}`,
        issues: assetIssues,
      });
    }
  }
  return offenders;
}

function main(): void {
  const offenders: Offender[] = [
    ...validateDir('toughs', join(RAW_DIR, 'toughs'), AuthoredToughSchema),
    ...validateDir('weapons', join(RAW_DIR, 'weapons'), AuthoredWeaponSchema),
    ...validateDir('drugs', join(RAW_DIR, 'drugs'), AuthoredDrugSchema),
    ...validateDir('currency', join(RAW_DIR, 'currency'), AuthoredCurrencySchema),
    ...validateDir('mythics', join(RAW_DIR, 'mythics'), AuthoredMythicSchema),
  ];

  if (offenders.length === 0) {
    console.log('[validate-raw-cards] all raw card files valid.');
    return;
  }

  console.error(`[validate-raw-cards] ${offenders.length} offender(s):`);
  for (const o of offenders) {
    console.error(`\n  ✖ ${o.file}`);
    for (const line of o.issues) console.error(line);
  }
  process.exit(1);
}

main();
