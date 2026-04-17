import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

test('cards screen renders gallery with cards', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('cards-button'), testInfo);
  await expect(page.getByTestId('cards-screen')).toBeVisible();

  const cards = page.locator('.cards-gallery-item');
  await expect(cards.first()).toBeVisible({ timeout: 5_000 });
  expect(await cards.count()).toBeGreaterThan(0);
});

test('cards screen exits back to menu', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('cards-button'), testInfo);
  await expect(page.getByTestId('cards-screen')).toBeVisible();
  await activate(page.getByTestId('cards-back'), testInfo);
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
});
