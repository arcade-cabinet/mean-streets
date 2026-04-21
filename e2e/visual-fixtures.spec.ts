import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

const EXPORT_DIR = process.env.MEAN_STREETS_VISUAL_EXPORT_DIR;
const RUN = process.env.MEAN_STREETS_VISUAL_SPECS === '1';
const SCREENSHOT_TIMEOUT_MS = 30_000;

async function captureFixture(
  page: Page,
  testInfo: TestInfo,
  fixture: string,
  targetTestId: string,
) {
  await page.goto(`/?fixture=${fixture}`);
  await page.waitForLoadState('networkidle');
  const target = page.getByTestId(targetTestId);
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded().catch(() => undefined);

  const path = testInfo.outputPath(`${fixture}.png`);
  await target.screenshot({
    animations: 'disabled',
    path,
    timeout: SCREENSHOT_TIMEOUT_MS,
  });
  await testInfo.attach(`${fixture}-screenshot`, {
    path,
    contentType: 'image/png',
  });

  if (EXPORT_DIR) {
    const exportPath = join(EXPORT_DIR, testInfo.project.name, `${fixture}.png`);
    mkdirSync(dirname(exportPath), { recursive: true });
    await target.screenshot({
      animations: 'disabled',
      path: exportPath,
      timeout: SCREENSHOT_TIMEOUT_MS,
    });
  }
}

test.skip(
  !RUN,
  'Use `pnpm run test:visual` for the supported visual lane or set MEAN_STREETS_VISUAL_SPECS=1 to run this Playwright spec directly.',
);

test.describe('@visual visual fixtures', () => {
  test('captures main menu fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'menu', 'main-menu-screen');
  });

  test('captures difficulty fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'difficulty', 'difficulty-screen');
  });

  test('captures deck garage fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'deck-garage', 'deck-garage-screen');
  });

  test('captures combat fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'combat', 'game-screen');
  });

  test('captures card fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'card', 'fixture-root');
  });

  test('captures pack opening fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'pack-opening', 'pack-opening-screen');
  });

  test('captures game over fixture screenshot', async ({ page }, testInfo) => {
    await captureFixture(page, testInfo, 'game-over', 'gameover-screen');
  });
});
