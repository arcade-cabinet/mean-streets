import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './helpers/activate';

async function goToGame(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
}

test.describe('Market and Holding HUD slots', () => {
  test('market slot renders in HUD bar', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('slot-market')).toBeVisible();
  });

  test('holding slot renders in HUD bar', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('slot-holding')).toBeVisible();
  });

  test('tapping market slot opens market modal', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await activate(page.getByTestId('slot-market'), testInfo);
    await expect(page.getByTestId('black-market-modal-A')).toBeVisible({ timeout: 5_000 });
  });

  test('tapping holding slot opens holding modal', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await activate(page.getByTestId('slot-holding'), testInfo);
    await expect(page.getByTestId('holding-panel-A')).toBeVisible({ timeout: 5_000 });
  });
});
