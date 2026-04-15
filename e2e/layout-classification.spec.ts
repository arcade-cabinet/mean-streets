/**
 * layout-classification.spec.ts
 *
 * Pins the expected data-layout attribute for each Playwright device
 * profile so future changes to platform/layout.ts can't silently
 * mis-classify a profile and break CSS selectors that target it.
 *
 * The 'folded' posture used to match Pixel 7 via a dimension heuristic;
 * this spec prevents that regression from coming back.
 */

import { expect, test } from '@playwright/test';

const EXPECTED: Record<string, string> = {
  'iphone-14': 'phone-portrait',
  'pixel-7': 'phone-portrait',
  'ipad-pro-landscape': 'tablet-landscape',
  'desktop-chromium': 'tablet-landscape',
};

test('data-layout matches expectation for this project', async ({ page }, testInfo) => {
  const expected = EXPECTED[testInfo.project.name];
  test.skip(!expected, `no expectation pinned for ${testInfo.project.name}`);

  await page.goto('/?fixture=menu');
  await page.waitForLoadState('networkidle');
  const layoutId = await page.evaluate(() => document.documentElement.dataset.layout);
  expect(layoutId, `${testInfo.project.name} should resolve to ${expected}`).toBe(expected);
});
