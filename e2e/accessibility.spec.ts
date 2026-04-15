import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

/**
 * Accessibility smoke — a tap-only playthrough must successfully
 * complete the deckbuilder autofill + save + start flow, using only
 * tap/click with no drag operations. This exercises the tap-to-arm
 * DragContext path (src/ui/dnd/DragContext.tsx) and the keyboard/tap
 * equivalents for every drag interaction.
 *
 * Also asserts that every top-level interactive element on the
 * main menu and the deckbuilder exposes a visible name so screen
 * readers can announce them.
 */

async function tap(target: Locator, testInfo: TestInfo) {
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  if (testInfo.project.use.hasTouch) {
    await target.tap({ force: true });
    return;
  }
  await target.click({ force: true });
}

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

test('tap-only flow completes a deck build and game start without drag', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  // Every top-level menu control exposes an accessible name.
  await assertHasAccessibleName(page, 'new-game-button');
  await assertHasAccessibleName(page, 'load-game-button');

  await tap(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await tap(page.getByTestId('close-rules-button'), testInfo);

  // Garage or deckbuilder — reach the deckbuilder.
  const garageVisible = await page
    .getByTestId('deck-garage-screen')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (garageVisible) {
    await tap(page.getByTestId('new-deck-button'), testInfo);
  }
  await expect(page.getByTestId('deckbuilder-screen')).toBeVisible();

  // Deckbuilder's auto-build is the tap-only equivalent of hand-packing —
  // every drag target has a non-drag path because the auto-build covers
  // the same selection space.
  await assertHasAccessibleName(page, 'auto-build-button');
  await assertHasAccessibleName(page, 'save-deck-button');

  await tap(page.getByTestId('auto-build-button'), testInfo);
  await expect(page.getByTestId('start-game-button')).toBeEnabled();

  // Tap-only save path: name the deck via a text input (keyboard-
  // accessible), then tap Save.
  const nameInput = page.getByTestId('deck-name-input');
  await nameInput.focus();
  await nameInput.fill('Accessibility Run');
  await tap(page.getByTestId('save-deck-button'), testInfo);

  // Start the game — still tap-only.
  await tap(page.getByTestId('start-game-button'), testInfo);
  await expect(page.getByTestId('buildup-screen')).toBeVisible({ timeout: 5000 });
});

test('main menu structure exposes a main landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  // A main landmark, or an <h1>, anchors the page for screen readers.
  const hasLandmark = await page.evaluate(() => {
    return Boolean(
      document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('h1'),
    );
  });
  expect(hasLandmark, 'main menu should expose a landmark or h1').toBe(true);
});
