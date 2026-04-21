import { expect, test } from '@playwright/test';

test.describe('mythic engagement (v0.3)', () => {
  test('mythic cards render gold-ring treatment in the card fixture', async ({
    page,
  }) => {
    await page.goto('?fixture=card');
    const mythicCard = page.getByTestId('card-mythic-01');
    await expect(mythicCard).toBeVisible();
    await expect(mythicCard).toHaveAttribute('data-rarity', 'mythic');
    await expect(mythicCard).toHaveClass(/card-mythic/);
  });

  test('MythicBadge component renders on mythic cards in the card fixture', async ({
    page,
  }) => {
    await page.goto('?fixture=card');
    await expect(page.getByTestId('card-mythic-01')).toBeVisible();
    await expect(page.getByTestId('mythic-badge').first()).toBeVisible();
  });

  test('MythicSymbol SVG loads for each mythic ID', async ({ page }) => {
    await page.goto('/');
    const mythicIds = [
      'mythic-01', 'mythic-02', 'mythic-03', 'mythic-04', 'mythic-05',
      'mythic-06', 'mythic-07', 'mythic-08', 'mythic-09', 'mythic-10',
    ];
    for (const id of mythicIds) {
      const response = await page.request.get(`/mean-streets/assets/mythics/${id}.svg`);
      expect(response.status()).toBe(200);
    }
  });
});
