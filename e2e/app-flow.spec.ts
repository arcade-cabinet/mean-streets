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

test('menu → difficulty → game flow works on the live app', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await expect(page.locator('.menu-backdrop')).toHaveCSS('background-image', /hero\.png/);
  await expect(page.getByTestId('new-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeDisabled();
  await expect(page.getByTestId('collection-button')).toBeVisible();
  await expect(page.getByTestId('open-pack-button')).toBeVisible();

  await activate(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await activate(page.getByTestId('close-rules-button'), testInfo);

  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);

  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('action-budget')).toBeVisible();
  await expect(page.getByTestId('hand-row')).toBeVisible();
  await expect(page.getByTestId('turf-view')).toBeVisible();
  await expect(page.getByTestId('action-end_turn')).toBeVisible();
});

test('collection flow navigates and returns to menu', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('collection-button'), testInfo);
  await expect(page.getByTestId('collection-screen')).toBeVisible();
  await expect(page.getByTestId('collection-progress')).toBeVisible();

  await activate(page.getByTestId('coll-cat-tough'), testInfo);
  await activate(page.getByTestId('coll-rarity-rare'), testInfo);
  await expect(page.getByTestId('collection-filtered-count')).toBeVisible();

  await activate(page.getByTestId('collection-back'), testInfo);
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
});

test('pack opening flow: sealed → reveal → summary → back to collection', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('open-pack-button'), testInfo);
  await expect(page.getByTestId('pack-opening-screen')).toBeVisible();
  await expect(page.getByTestId('pack-open-btn')).toBeVisible();

  // Open the pack — enters reveal phase
  await activate(page.getByTestId('pack-open-btn'), testInfo);
  await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({ timeout: 5_000 });

  // Advance through card reveals by tapping the reveal stage until summary appears.
  // Bound the loop at 10 clicks — default pack size is 5 cards.
  for (let i = 0; i < 10; i++) {
    const summary = page.getByTestId('pack-summary-stats');
    if (await summary.isVisible().catch(() => false)) break;
    await activate(page.getByTestId('pack-reveal-stage'), testInfo);
  }

  await expect(page.getByTestId('pack-summary-stats')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('pack-summary-grid')).toBeVisible();
  await expect(page.getByTestId('pack-done-btn')).toBeVisible();

  await activate(page.getByTestId('pack-done-btn'), testInfo);
  await expect(page.getByTestId('collection-screen')).toBeVisible();
});

test('difficulty back button returns to menu', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  await activate(page.getByTestId('diff-back'), testInfo);
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
});
