import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

test.describe('pack opening flow', () => {
  test('sealed → reveal → summary → done', async ({ page }, testInfo) => {
    await page.goto('?fixture=pack-opening');
    await activate(page.getByTestId('pack-open-btn'), testInfo);
    await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({
      timeout: 5_000,
    });

    const summaryGrid = page.getByTestId('pack-summary-grid');
    for (let i = 0; i < 20; i++) {
      if (await summaryGrid.isVisible().catch(() => false)) break;
      await activate(page.getByTestId('pack-reveal-stage'), testInfo);
    }

    await expect(summaryGrid).toBeVisible({ timeout: 5_000 });
    await activate(page.getByTestId('pack-done-btn'), testInfo);
    await expect(page.getByTestId('pack-opening-screen')).toBeVisible();
  });
});
