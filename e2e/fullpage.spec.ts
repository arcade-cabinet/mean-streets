import type { Page } from '@playwright/test';
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.MEAN_STREETS_VISUAL_EXPORT_DIR ?? 'artifacts/visual-review';
const RUN = process.env.MEAN_STREETS_FULLPAGE === '1';
const SCREENSHOT_TIMEOUT_MS = 30_000;

async function full(page: Page, fixture: string, project: string) {
  await page.goto(`?fixture=${fixture}`);
  await page.waitForLoadState('networkidle');
  const dir = join(DIR, project, 'fullpage');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    path: join(dir, `${fixture}.png`),
    fullPage: true,
    timeout: SCREENSHOT_TIMEOUT_MS,
  });
}

test.skip(
  !RUN,
  'Use `pnpm run test:visual:fullpage` / `visual:export:fullpage*` or set MEAN_STREETS_FULLPAGE=1 to run this spec directly.',
);

test('capture full-page screenshots across every fixture', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  for (const fixture of [
    'menu',
    'difficulty',
    'deck-garage',
    'combat',
    'card',
    'pack-opening',
    'game-over',
  ] as const) {
    await full(page, fixture, project);
  }
});
