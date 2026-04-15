import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

async function activate(target: Locator, testInfo: TestInfo) {
  // Wait for the target to be both attached and stable before we
  // try to dispatch — flaky on CI WebKit/xvfb where animations push
  // the element around in the brief moment between location and tap.
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  if (testInfo.project.use.hasTouch) {
    await target.tap({ force: true });
    return;
  }
  await target.click({ force: true });
}

async function buildDeck(page: Page, testInfo: TestInfo) {
  await activate(page.getByTestId('auto-build-button'), testInfo);
  await expect(page.getByTestId('start-game-button')).toBeEnabled();
}

async function enterDeckWorkshop(page: Page, testInfo: TestInfo) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (await page.getByTestId('deckbuilder-screen').isVisible().catch(() => false)) {
      return;
    }
    if (await page.getByTestId('deck-garage-screen').isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(100);
  }

  const garage = page.getByTestId('deck-garage-screen');
  if (await garage.isVisible().catch(() => false)) {
    await activate(page.getByTestId('new-deck-button'), testInfo);
  }
  await expect(page.getByTestId('deckbuilder-screen')).toBeVisible();
}

test('menu, new-game, deck build, save, and load flow works on the live app', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await expect(page.locator('.menu-backdrop')).toHaveCSS('background-image', /hero\.png/);
  await expect(page.getByTestId('new-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeDisabled();

  await activate(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await activate(page.getByTestId('close-rules-button'), testInfo);

  await enterDeckWorkshop(page, testInfo);
  await buildDeck(page, testInfo);
  await page.getByTestId('deck-name-input').fill('Night Shift');
  await page.getByTestId('deck-name-input').blur();
  const saveButton = page.getByTestId('save-deck-button');
  await expect(saveButton).toBeEnabled();
  await activate(saveButton, testInfo);

  const startButton = page.getByTestId('start-game-button');
  await expect(startButton).toBeEnabled();
  await activate(startButton, testInfo);

  await expect(page.getByTestId('buildup-screen')).toBeVisible();
  await page.goto('/');

  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeEnabled();
  await activate(page.getByTestId('load-game-button'), testInfo);

  await expect(page.getByTestId('buildup-screen')).toBeVisible({ timeout: 3000 });
});
