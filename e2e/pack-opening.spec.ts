import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

test.describe('pack opening flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  });

  test('sealed → reveal → summary → done', async ({ page }, testInfo) => {
    await activate(page.getByTestId('open-pack-button'), testInfo);
    await expect(page.getByTestId('pack-opening-screen')).toBeVisible();

    const openBtn = page.getByTestId('pack-open-btn');
    await expect(openBtn).toBeVisible();
    await activate(openBtn, testInfo);

    await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({ timeout: 5_000 });

    // Advance reveals by tapping the stage until the summary grid
    // appears. Cap iterations at 10 (pack default size is 5) and poll
    // on the actual state change rather than blind waitForTimeouts —
    // faster and robust to reveal animation drift across CI runners.
    const stage = page.getByTestId('pack-reveal-stage');
    const summaryGrid = page.getByTestId('pack-summary-grid');
    for (let i = 0; i < 10; i++) {
      if (await summaryGrid.isVisible().catch(() => false)) break;
      await activate(stage, testInfo);
    }

    await expect(summaryGrid).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('pack-summary-stats')).toBeVisible();
    await expect(page.getByTestId('pack-done-btn')).toBeVisible();

    await activate(page.getByTestId('pack-done-btn'), testInfo);
    await expect(page.getByTestId('collection-screen')).toBeVisible();
  });

  test('back button exits from sealed phase', async ({ page }, testInfo) => {
    await activate(page.getByTestId('open-pack-button'), testInfo);
    await expect(page.getByTestId('pack-opening-screen')).toBeVisible();
    await expect(page.getByTestId('pack-open-btn')).toBeVisible();

    await activate(page.getByTestId('pack-back'), testInfo);
    await expect(page.getByTestId('collection-screen')).toBeVisible();
  });

  test('pack reveal shows card with rarity styling', async ({ page }, testInfo) => {
    await activate(page.getByTestId('open-pack-button'), testInfo);
    await expect(page.getByTestId('pack-opening-screen')).toBeVisible();

    await activate(page.getByTestId('pack-open-btn'), testInfo);
    await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({ timeout: 5_000 });

    const card = page.getByTestId('pack-reveal-card-0');
    await expect(card).toBeVisible();
  });
});
