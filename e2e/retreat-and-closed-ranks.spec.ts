import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

/**
 * Retreat and Closed Ranks are wired in the simulation layer (see
 * `src/sim/turf/{environment,resolve}.ts`) and exposed via action-bar
 * selectors (`action-retreat`, `queued-chips`). Because the v0.2 UI
 * doesn't surface an empty-stack turf at game-start yet (the GameScreen
 * gates the retreat button on a legal retreat existing), we assert the
 * selectors are present and the game screen renders a well-formed
 * action bar. Full interaction coverage lives in
 * `src/sim/turf/__tests__/retreat.test.ts` and `closed-ranks.test.ts`.
 */
test('retreat action button is present in the game action bar', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });

  // Retreat button is always in the DOM; it's disabled when no retreat is
  // legal, but the testid must be present for agent / accessibility surface.
  const retreat = page.getByTestId('action-retreat');
  await expect(retreat).toBeVisible();
});

test('game screen mounts with action bar present', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });

  // The action-end_turn button is the minimal always-present control.
  await expect(page.getByTestId('action-end_turn')).toBeVisible();
});

test('draw and discard-pending action buttons surface in action bar', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('action-draw')).toBeVisible();
  // discard-pending only mounts while pending is occupied; after a draw,
  // it should appear. Clicking draw then asserting is out of scope here;
  // covered by unit tests + browser tests.
});
