import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

// Five base tiers, plus a separate Permadeath modifier in the center of row 2.
const TIERS = [
  'easy',
  'medium',
  'hard',
  'nightmare',
  'ultra-nightmare',
] as const;

test.describe('difficulty grid', () => {
  test('fixture renders all 5 tier tiles and the permadeath modifier', async ({ page }) => {
    await page.goto('?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    for (const tier of TIERS) {
      await expect(page.getByTestId(`diff-tile-${tier}`)).toBeVisible();
    }
    await expect(page.getByTestId('diff-permadeath')).toBeVisible();
  });

  test('old Sudden Death tier is absent', async ({ page }) => {
    await page.goto('?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    await expect(page.getByTestId('diff-tile-sudden-death')).toHaveCount(0);
  });

  test('selecting a tile highlights it and enables start', async ({ page }, testInfo) => {
    await page.goto('?fixture=difficulty');
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

  test('permadeath toggles for normal tiers and is forced by Ultra Nightmare', async ({ page }, testInfo) => {
    await page.goto('?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    const permadeath = page.getByTestId('diff-permadeath');
    await expect(permadeath).toHaveAttribute('aria-checked', 'false');

    await activate(permadeath, testInfo);
    await expect(permadeath).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('diff-permadeath-warning')).toBeVisible();

    await activate(permadeath, testInfo);
    await expect(permadeath).toHaveAttribute('aria-checked', 'false');

    await activate(page.getByTestId('diff-tile-ultra-nightmare'), testInfo);
    await expect(permadeath).toHaveAttribute('aria-checked', 'true');
    await expect(permadeath).toHaveAttribute('aria-disabled', 'true');
  });

  test('grid tiles fit within viewport on all device profiles', async ({ page }) => {
    await page.goto('?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      bodySW: document.body.scrollWidth,
      innerW: window.innerWidth,
    }));
    expect(overflow.bodySW).toBeLessThanOrEqual(overflow.innerW + 2);
  });

  test('back button is visible', async ({ page }) => {
    await page.goto('?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();
    await expect(page.getByTestId('diff-back')).toBeVisible();
  });
});
