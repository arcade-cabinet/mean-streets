import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

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
}

test('captures main menu fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'menu', 'main-menu-screen');
});

test('captures deckbuilder fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'deckbuilder', 'deckbuilder-screen');
});

test('captures crew card fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'crew-card', 'fixture-crew-card');
});

test('captures modifier badge fixture screenshot', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'modifier-badges', 'fixture-modifier-badges');
});
