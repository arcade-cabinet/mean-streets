import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activate as tap } from './helpers/activate';

async function assertHasAccessibleName(page: Page, testId: string) {
  const el = page.getByTestId(testId);
  await expect(el).toBeVisible();
  const name = await el.evaluate((node) => {
    const aria = node.getAttribute('aria-label');
    if (aria && aria.length > 0) return aria;
    const text = (node.textContent ?? '').trim();
    if (text.length > 0) return text;
    if (node instanceof HTMLImageElement && node.alt.length > 0) return node.alt;
    const labelledBy = node.getAttribute('aria-labelledby');
    if (labelledBy) {
      const refs = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .filter(Boolean);
      if (refs.length > 0) return refs.join(' ');
    }
    return '';
  });
  expect(name.length, `${testId} must expose an accessible name`).toBeGreaterThan(0);
}

test('tap-only flow completes menu → difficulty → game start without drag', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await assertHasAccessibleName(page, 'new-game-button');
  await assertHasAccessibleName(page, 'load-game-button');
  await assertHasAccessibleName(page, 'collection-button');
  await assertHasAccessibleName(page, 'open-pack-button');

  await tap(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await tap(page.getByTestId('close-rules-button'), testInfo);

  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  await assertHasAccessibleName(page, 'diff-start');

  await tap(page.getByTestId('diff-tile-easy'), testInfo);
  await tap(page.getByTestId('diff-start'), testInfo);

  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
  await assertHasAccessibleName(page, 'action-end_turn');
});

test('main menu structure exposes a main landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  const hasLandmark = await page.evaluate(() => {
    return Boolean(
      document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('h1'),
    );
  });
  expect(hasLandmark, 'main menu should expose a landmark or h1').toBe(true);
});

test('difficulty screen exposes a main landmark', async ({ page }) => {
  await page.goto('/?fixture=difficulty');
  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  const hasLandmark = await page.evaluate(() => {
    return Boolean(
      document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('h1'),
    );
  });
  expect(hasLandmark, 'difficulty screen should expose a landmark or h1').toBe(true);
});

test('pack opening is keyboard navigable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.hasTouch === true, 'keyboard test — desktop only');

  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await page.getByTestId('open-pack-button').click();
  await expect(page.getByTestId('pack-opening-screen')).toBeVisible();

  const openBtn = page.getByTestId('pack-open-btn');
  await expect(openBtn).toBeVisible();
  await openBtn.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('pack-reveal-stage')).toBeVisible({ timeout: 5_000 });

  // Press Space up to 10 times to advance through every revealed card.
  // Stop as soon as `pack-done-btn` appears — no hardcoded sleeps;
  // waiting on the actual state change is both faster and more robust
  // to reveal-animation timing drift across CI runners.
  const summaryBtn = page.getByTestId('pack-done-btn');
  for (let i = 0; i < 10; i++) {
    if (await summaryBtn.isVisible().catch(() => false)) break;
    await page.keyboard.press('Space');
  }

  await expect(summaryBtn).toBeVisible({ timeout: 5_000 });
});
