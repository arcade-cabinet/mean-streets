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
  await assertHasAccessibleName(page, 'cards-button');

  await tap(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'First Run Brief' })).toBeVisible();
  await tap(page.getByTestId('close-tutorial-button'), testInfo);

  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  await assertHasAccessibleName(page, 'diff-start');
  await assertHasAccessibleName(page, 'diff-permadeath');

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

test('difficulty selector exposes dialog semantics and a heading', async ({ page }) => {
  await page.goto('?fixture=difficulty');
  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  const hasLandmark = await page.evaluate(() => {
    return Boolean(
      document.querySelector('[role="dialog"][aria-modal="true"]') &&
        document.querySelector('h1'),
    );
  });
  expect(hasLandmark, 'difficulty selector should expose modal dialog semantics and h1').toBe(true);
});
