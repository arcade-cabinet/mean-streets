import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

const TIERS = ['easy', 'medium', 'hard', 'nightmare', 'sudden-death', 'ultra-nightmare'] as const;

test.describe('difficulty grid', () => {
  test('fixture renders all 6 tier tiles', async ({ page }) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    for (const tier of TIERS) {
      await expect(page.getByTestId(`diff-tile-${tier}`)).toBeVisible();
    }
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

  test('sudden death checkbox toggles independently', async ({ page }, testInfo) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    await activate(page.getByTestId('diff-tile-easy'), testInfo);

    const checkbox = page.getByTestId('diff-sudden-death');
    await expect(checkbox).toBeVisible();

    const initialChecked = await checkbox.isChecked();
    await activate(checkbox, testInfo);
    const afterClick = await checkbox.isChecked();
    expect(afterClick).not.toBe(initialChecked);
  });

  test('sudden death auto-locks for sudden-death tier', async ({ page }, testInfo) => {
    await page.goto('/?fixture=difficulty');
    await expect(page.getByTestId('difficulty-screen')).toBeVisible();

    await activate(page.getByTestId('diff-tile-sudden-death'), testInfo);
    const checkbox = page.getByTestId('diff-sudden-death');
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
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
