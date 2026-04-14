/**
 * fold-posture.spec.ts
 *
 * Simulates a dual-segment (folded open / unfolded) window via the
 * __MEAN_STREETS_VIEWPORT__ test-override hook and confirms the app
 * shell responds to data-layout="unfolded":
 *
 * - The body.data-layout attribute becomes "unfolded".
 * - The .app-shell picks up the --fold-gutter padding-inline.
 * - The responsive-alignment invariant still holds (no horizontal
 *   overflow).
 *
 * Runs only on desktop-chromium because we force viewport + posture
 * explicitly; running on a hardware-touch profile would fight the
 * real viewport.
 */

import { expect, test } from '@playwright/test';

test('unfolded posture activates fold-aware gutter + stays aligned', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'single-profile posture probe');

  await page.addInitScript(() => {
    window.__MEAN_STREETS_VIEWPORT__ = {
      width: 1280,
      height: 800,
      orientation: 'landscape',
      posture: 'unfolded',
      platform: 'web',
    };
  });

  await page.goto('/?fixture=menu');
  await page.waitForLoadState('networkidle');

  const info = await page.evaluate(() => {
    const html = document.documentElement;
    const shell = document.querySelector('.app-shell') as HTMLElement | null;
    const body = document.body;
    return {
      layoutId: html.dataset.layout,
      shellPadLeft: shell ? getComputedStyle(shell).paddingInlineStart : null,
      bodySW: body.scrollWidth,
      innerW: window.innerWidth,
    };
  });

  expect(info.layoutId).toBe('unfolded');
  // --fold-gutter is 16px per the CSS; padding-inline: var(--fold-gutter).
  expect(info.shellPadLeft).toMatch(/1[0-9]{0,2}px/);
  // No horizontal overflow even at the unfolded breakpoint.
  expect(info.bodySW).toBeLessThanOrEqual(info.innerW + 2);
});
