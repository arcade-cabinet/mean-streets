import { expect, test } from '@playwright/test';

test.describe('war outcome (v0.3)', () => {
  test('game-over fixture displays the winner state', async ({ page }) => {
    await page.goto('?fixture=game-over');

    await expect(page.getByTestId('gameover-screen')).toBeVisible();
    await expect(page.locator('.gameover-title')).toHaveText('Victory');
    await expect(page.locator('.gameover-title-victory')).toBeVisible();
  });

  test('game-over fixture displays the authored war outcome summary', async ({
    page,
  }) => {
    await page.goto('?fixture=game-over');

    await expect(page.getByTestId('gameover-reward-summary')).toBeVisible();
    await expect(page.getByTestId('gameover-reward-summary')).toContainText(
      'Perfect War',
    );
    await expect(page.getByTestId('gameover-reward-summary')).toContainText(
      '$1,500',
    );
  });

  test('game-over fixture displays reward cards with unlock chips', async ({
    page,
  }) => {
    await page.goto('?fixture=game-over');

    await expect(page.getByTestId('gameover-rewards')).toBeVisible();
    await expect(page.getByTestId('card-unlock-badge').first()).toHaveText(
      'H',
    );
    await expect(page.getByTestId('card-tough-fixture')).toBeVisible();
  });
});
