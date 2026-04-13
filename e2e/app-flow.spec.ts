import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function buildDeck(page: Page) {
  const crewCards = page.locator('button[data-card-type="crew"]:not([disabled])');
  const weaponCards = page.locator('button[data-card-type="weapon"]:not([disabled])');
  const drugCards = page.locator('button[data-card-type="product"]:not([disabled])');
  const cashCards = page.locator('button[data-card-type="cash"]:not([disabled])');

  for (let index = 0; index < 25; index += 1) {
    await crewCards.nth(index).click();
  }

  for (let index = 0; index < 19; index += 1) {
    await weaponCards.nth(index).click();
  }
  for (let index = 0; index < 3; index += 1) {
    await drugCards.nth(index).click();
  }
  for (let index = 0; index < 3; index += 1) {
    await cashCards.nth(index).click();
  }
}

test('core flow reaches combat after building a legal deck', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await page.getByTestId('new-game-button').click();

  await expect(page.getByTestId('deckbuilder-screen')).toBeVisible();
  await buildDeck(page);

  await expect(page.getByTestId('start-game-button')).toBeEnabled();
  await page.getByTestId('start-game-button').click();

  await expect(page.getByTestId('buildup-screen')).toBeVisible();
  await page.getByTestId('strike-button').click();

  await expect(page.getByTestId('combat-screen')).toBeVisible({ timeout: 3000 });
});
