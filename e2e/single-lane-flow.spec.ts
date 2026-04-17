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

test.describe('single-lane flow', () => {
  test('game screen renders exactly one active turf lane per side', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('turf-lane-A')).toHaveCount(1);
    await expect(page.getByTestId('turf-lane-B')).toHaveCount(1);
  });

  test('draw slot is visible at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('slot-player-draw')).toBeVisible();
  });

  test('draw populates a pending card slot', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('pending-card')).toHaveCount(0);
    await activate(page.getByTestId('slot-player-draw'), testInfo);
    await expect(page.getByTestId('pending-card')).toBeVisible({ timeout: 5_000 });
  });

  test('action budget is displayed and positive at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    const budget = page.getByTestId('action-budget');
    await expect(budget).toBeVisible();
    const text = await budget.textContent();
    expect(text).toMatch(/\d+\/\d+/);
  });
});
