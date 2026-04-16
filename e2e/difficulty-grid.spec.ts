import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

// v0.3 removed Sudden Death; 5 tiers only.
const TIERS = [
  'easy',
  'medium',
  'hard',
  'nightmare',
  'ultra-nightmare',
] as const;

test.describe('difficulty grid', () => {
  test('fixture renders all 5 tier tiles', async ({ page }) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    for (const tier of TIERS) {
      await expect(page.getByTestId(`diff-tile-${tier}`)).toBeVisible();
    }
  });

  test('v0.3 removed Sudden Death tier + checkbox', async ({ page }) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    await expect(page.getByTestId('diff-tile-sudden-death')).toHaveCount(0);
    await expect(page.getByTestId('diff-sudden-death')).toHaveCount(0);
  });

  test('selecting a tile highlights it and enables start', async ({ page }, testInfo) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    const startBtn = page.getByTestId('diff-start');
    await expect(startBtn).toBeVisible();

    for (const tier of TIERS) {
      await activate(page.getByTestId(`diff-tile-${tier}`), testInfo);
      const checked = await page.getByTestId(`diff-tile-${tier}`).getAttribute('aria-checked');
      expect(checked, `${tier} should be selected`).toBe('true');
      // After selecting any tier, start must be enabled (not just visible)
      await expect(startBtn, `start should be enabled after selecting ${tier}`).toBeEnabled();
    }
  });

  test('grid tiles fit within viewport on all device profiles', async ({ page }) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      bodySW: document.body.scrollWidth,
      innerW: window.innerWidth,
    }));
    expect(overflow.bodySW).toBeLessThanOrEqual(overflow.innerW + 2);
  });

  test('back button is visible', async ({ page }) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();
    await expect(page.getByTestId('diff-back')).toBeVisible();
  });
});
