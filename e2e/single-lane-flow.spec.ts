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

async function activatePlayerDraw(page: Page, testInfo: TestInfo) {
  const hudDraw = page.getByTestId('hud-draw');
  if (await hudDraw.isVisible().catch(() => false)) {
    await activate(hudDraw, testInfo);
    return;
  }
  await page.getByTestId('slot-player-draw').click({ force: true });
}

async function expectPlayerDrawVisible(page: Page) {
  const hudDraw = page.getByTestId('hud-draw');
  if (await hudDraw.isVisible().catch(() => false)) {
    await expect(hudDraw).toBeVisible();
    return;
  }
  await expect(page.getByTestId('slot-player-draw')).toBeVisible();
}

async function marketCount(page: Page) {
  const text = (await page.getByTestId('slot-market').textContent()) ?? '';
  const match = text.match(/\((\d+)\)/);
  return Number(match?.[1] ?? 0);
}

test.describe('single-lane flow', () => {
  test('game screen renders exactly one active turf lane per side', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expect(page.getByTestId('turf-lane-A')).toHaveCount(1);
    await expect(page.getByTestId('turf-lane-B')).toHaveCount(1);
  });

  test('draw slot is visible at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    await expectPlayerDrawVisible(page);
  });

  test('draw creates pending or auto-routes an unplayable modifier to market', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    const initialMarketCount = await marketCount(page);
    await expect(page.getByTestId('pending-card')).toHaveCount(0);
    await activatePlayerDraw(page, testInfo);
    await expect(page.getByTestId('action-budget')).toContainText('4/5');
    await expect
      .poll(async () => {
        const hasPending = await page.getByTestId('pending-card').isVisible().catch(() => false);
        const nextMarketCount = await marketCount(page);
        return hasPending || nextMarketCount > initialMarketCount;
      }, { timeout: 5_000 })
      .toBe(true);
  });

  test('action budget is displayed and positive at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    const budget = page.getByTestId('action-budget');
    await expect(budget).toBeVisible();
    const text = await budget.textContent();
    expect(text).toMatch(/\d+\/\d+/);
  });
});
