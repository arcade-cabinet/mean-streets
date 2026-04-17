import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './helpers/activate';

/**
 * Black Market and Holding panel E2E specs.
 *
 * The Black Market and Holding panels render differently on desktop/tablet
 * (inline sidebars) vs. phone (modal triggered by tap). Both paths expose
 * the same underlying `BlackMarketPanel` and `HoldingPanel` components.
 *
 * Because the panels are only populated after game actions send cards to
 * market/holding (non-trivial setup), these specs assert structural
 * presence: panels render with the correct test IDs and the trade/heal
 * affordances are present. Functional coverage lives in the sim unit tests.
 */

async function goToGame(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
}

test.describe('Black Market panel', () => {
  test('black-market panel renders on desktop/tablet (left sidebar)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone uses modal trigger, not inline sidebar — see mobile trigger test below',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone uses modal trigger, not inline sidebar',
    );

    await goToGame(page, testInfo);

    // On non-phone viewports the left sidebar is present.
    const sidebar = page.getByTestId('game-sidebar-left');
    await expect(sidebar).toBeVisible();

    // The BlackMarketPanel inside it has the expected test ID.
    const panel = page.getByTestId('black-market-panel-A');
    await expect(panel).toBeVisible();
  });

  test('black-market panel shows trade and heal buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone renders the panel in a modal — see mobile trigger test',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone renders the panel in a modal',
    );

    await goToGame(page, testInfo);

    // Trade and heal buttons are always present even when pool is empty.
    await expect(page.getByTestId('black-market-trade-btn')).toBeVisible();
    await expect(page.getByTestId('black-market-heal-btn')).toBeVisible();
  });

  test('black-market trade button is disabled when pool is empty', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone renders the panel in a modal',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone renders the panel in a modal',
    );

    await goToGame(page, testInfo);

    // No items are selected at game start → trade button disabled.
    await expect(page.getByTestId('black-market-trade-btn')).toBeDisabled();
  });

  test('black-market pool container renders (may be empty)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone renders the panel in a modal',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone renders the panel in a modal',
    );

    await goToGame(page, testInfo);

    await expect(page.getByTestId('black-market-pool')).toBeVisible();
  });

  test('mobile market trigger opens black-market modal', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch,
      'mobile trigger only renders on phone layout',
    );

    await goToGame(page, testInfo);

    const trigger = page.getByTestId('mobile-market-trigger');
    await expect(trigger).toBeVisible();

    await activate(trigger, testInfo);

    // The modal version uses data-testid="black-market-modal-A"
    await expect(page.getByTestId('black-market-modal-A')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Holding panel', () => {
  test('holding panels render on desktop/tablet (right sidebar)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone uses mobile trigger + modal',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone uses mobile trigger + modal',
    );

    await goToGame(page, testInfo);

    const sidebar = page.getByTestId('game-sidebar-right');
    await expect(sidebar).toBeVisible();

    // Two holding panels: own side (A) and opponent side (B).
    await expect(page.getByTestId('holding-panel-A')).toBeVisible();
    await expect(page.getByTestId('holding-panel-B')).toBeVisible();
  });

  test('holding panels show empty custody state at game start', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'iphone-14',
      'phone uses mobile trigger + modal',
    );
    test.skip(testInfo.project.use.hasTouch === true && testInfo.project.name === 'pixel-7',
      'phone uses mobile trigger + modal',
    );

    await goToGame(page, testInfo);

    // No toughs in custody at game start — no holding-row entries.
    const rowsA = page.locator('[data-testid^="holding-row-"]');
    await expect(rowsA).toHaveCount(0);
  });

  test('mobile custody trigger opens holding modal', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch,
      'mobile trigger only renders on phone layout',
    );

    await goToGame(page, testInfo);

    const trigger = page.getByTestId('mobile-holding-trigger');
    await expect(trigger).toBeVisible();

    await activate(trigger, testInfo);

    // The modal wrapper
    await expect(page.getByTestId('game-mobile-custody')).toBeVisible({ timeout: 5_000 });
  });
});
