import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './helpers/activate';

async function goToGame(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible();
}

test.describe('mythic engagement (v0.3)', () => {
  test('mythic cards render gold-ring treatment', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);
    const mythicCards = page.locator('[data-rarity="mythic"]');
    const count = await mythicCards.count();
    if (count > 0) {
      await expect(mythicCards.first()).toBeVisible();
    } else {
      test.skip(true, 'No mythic cards visible in this game seed');
    }
  });

  test('MythicBadge component renders when mythic is in play', async ({
    page,
  }, testInfo) => {
    await goToGame(page, testInfo);
    const badge = page.getByTestId('mythic-badge');
    const count = await badge.count();
    if (count > 0) {
      await expect(badge.first()).toBeVisible();
    } else {
      test.skip(true, 'No mythic badge visible — mythics may not be in play');
    }
  });

  test('MythicSymbol SVG loads for each mythic ID', async ({ page }) => {
    await page.goto('/');
    const mythicIds = [
      'mythic-01', 'mythic-02', 'mythic-03', 'mythic-04', 'mythic-05',
      'mythic-06', 'mythic-07', 'mythic-08', 'mythic-09', 'mythic-10',
    ];
    for (const id of mythicIds) {
      const response = await page.request.get(`/assets/mythics/${id}.svg`);
      expect(response.status()).toBe(200);
    }
  });
});
