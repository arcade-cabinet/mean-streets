/**
 * fullpage.spec.ts — opt-in full-page capture across the four device
 * profiles. Writes into `artifacts/visual-review/` which is already
 * gitignored. Run with:
 *
 *   PW_HEADLESS=1 MEAN_STREETS_FULLPAGE=1 pnpm exec playwright test e2e/fullpage.spec.ts
 *
 * When the env var is unset the test is skipped so CI doesn't
 * accidentally thrash disk with screenshots.
 */

import type { Page } from '@playwright/test';
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.MEAN_STREETS_VISUAL_EXPORT_DIR ?? 'artifacts/visual-review';
const RUN = process.env.MEAN_STREETS_FULLPAGE === '1';

async function full(page: Page, fixture: string, project: string) {
  await page.goto(`/?fixture=${fixture}`);
  await page.waitForLoadState('networkidle');
  const dir = join(DIR, project, 'fullpage');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${fixture}.png`), fullPage: true });
}

test.skip(!RUN, 'Set MEAN_STREETS_FULLPAGE=1 to run');

test('capture full-page screenshots across every fixture', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  for (const fixture of ['menu', 'deck-garage', 'deckbuilder', 'buildup', 'combat'] as const) {
    await full(page, fixture, project);
  }
});
