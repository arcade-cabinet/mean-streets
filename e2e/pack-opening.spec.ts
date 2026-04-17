import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

test.describe('pack opening flow', () => {
  // Pack opening is no longer directly reachable from the main menu
  // (simplified to 3 buttons: New Game, Load Game, Cards). The pack
  // opening component is thoroughly tested via Vitest browser tests.
  // These E2E specs are skipped until a fixture route is added.
  test.skip(true, 'pack opening not reachable from menu — covered by browser tests');

  test('sealed → reveal → summary → done', async ({ page }, testInfo) => {
    await page.goto('/');
    await activate(page.getByTestId('pack-open-btn'), testInfo);
    await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({ timeout: 5_000 });
  });
});
