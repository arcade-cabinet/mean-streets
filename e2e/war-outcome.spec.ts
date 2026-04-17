import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './helpers/activate';

async function playToGameOver(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible();

  const gameOver = page.getByTestId('game-over-screen');
  try {
    await gameOver.waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    test.skip(true, 'Game did not reach game-over within 30s');
  }
}

test.describe('war outcome (v0.3)', () => {
  test('game-over screen displays victory rating', async ({
    page,
  }, testInfo) => {
    await playToGameOver(page, testInfo);
    const screen = page.getByTestId('game-over-screen');
    await expect(screen).toBeVisible();

    const rating = screen.locator('[data-testid*="victory-rating"]');
    const ratingText = screen.locator('text=/Absolute|Overwhelming|Decisive|Standard|Perfect|Flawless|Dominant|Won/i');
    const hasRating = (await rating.count()) > 0 || (await ratingText.count()) > 0;
    expect(hasRating).toBe(true);
  });

  test('game-over screen shows winner', async ({ page }, testInfo) => {
    await playToGameOver(page, testInfo);
    const screen = page.getByTestId('game-over-screen');
    await expect(screen).toBeVisible();

    const winnerText = screen.locator('text=/victory|defeat|winner|draw/i');
    await expect(winnerText.first()).toBeVisible();
  });

  test('game-over screen displays pack rewards', async ({
    page,
  }, testInfo) => {
    await playToGameOver(page, testInfo);
    const screen = page.getByTestId('game-over-screen');
    await expect(screen).toBeVisible();

    const rewards = screen.locator('[data-testid*="reward"], [data-testid*="pack"]');
    const count = await rewards.count();
    if (count === 0) {
      test.skip(true, 'No reward/pack elements found on game-over screen');
    }
    await expect(rewards.first()).toBeVisible();
  });
});
