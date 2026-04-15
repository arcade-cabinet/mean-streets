import { expect, test } from '@playwright/test';
import type { Locator, TestInfo } from '@playwright/test';

async function activate(target: Locator, testInfo: TestInfo) {
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  if (testInfo.project.use.hasTouch) {
    await target.tap({ force: true });
    return;
  }
  await target.click({ force: true });
}

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

    for (let i = 0; i < 5; i++) {
      const stage = page.getByTestId('pack-reveal-stage');
      await activate(stage, testInfo);
      await page.waitForTimeout(400);
    }

    await expect(page.getByTestId('pack-summary-grid')).toBeVisible({ timeout: 5_000 });
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
