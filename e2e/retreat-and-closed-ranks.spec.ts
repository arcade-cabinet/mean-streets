import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

async function goToGame(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
}

async function expectPlayerDrawVisible(page: import('@playwright/test').Page) {
  const hudDraw = page.getByTestId('hud-draw');
  if (await hudDraw.isVisible().catch(() => false)) {
    await expect(hudDraw).toBeVisible();
    return;
  }
  await expect(page.getByTestId('slot-player-draw')).toBeVisible();
}

test('game screen mounts with end-turn button', async ({ page }, testInfo) => {
  await goToGame(page, testInfo);
  await expect(page.getByTestId('action-end_turn')).toBeVisible();
});

test('draw slot and turf lanes render at game start', async ({ page }, testInfo) => {
  await goToGame(page, testInfo);
  await expectPlayerDrawVisible(page);
  await expect(page.getByTestId('turf-lane-A')).toBeVisible();
  await expect(page.getByTestId('turf-lane-B')).toBeVisible();
});
