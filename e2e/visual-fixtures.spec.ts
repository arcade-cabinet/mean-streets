import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

const EXPORT_DIR = process.env.MEAN_STREETS_VISUAL_EXPORT_DIR;

async function captureFixture(
  page: Page,
  testInfo: TestInfo,
  fixture: string,
  targetTestId: string,
) {
  await page.goto(`/?fixture=${fixture}`);
  const target = page.getByTestId(targetTestId);
  await expect(target).toBeVisible();

  const path = testInfo.outputPath(`${fixture}.png`);
  await target.screenshot({ path });
  await testInfo.attach(`${fixture}-screenshot`, {
    path,
    contentType: 'image/png',
  });

  if (EXPORT_DIR) {
    const exportPath = join(EXPORT_DIR, testInfo.project.name, `${fixture}.png`);
    mkdirSync(dirname(exportPath), { recursive: true });
    await target.screenshot({ path: exportPath });
  }
}

test('captures main menu fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'menu', 'main-menu-screen');
});

test('captures deck garage fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'deck-garage', 'deck-garage-screen');
});

test('captures deckbuilder fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'deckbuilder', 'deckbuilder-screen');
});

test('captures buildup fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'buildup', 'buildup-screen');
});

test('captures combat fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'combat', 'combat-screen');
});

test('captures crew card fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'crew-card', 'fixture-crew-card');
});

test('captures modifier badge fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'modifier-badges', 'fixture-modifier-badges');
});
