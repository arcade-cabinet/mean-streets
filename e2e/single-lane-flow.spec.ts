import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './helpers/activate';

/**
 * Single-lane turf war flow (v0.3).
 *
 * v0.3 enforces a strict single-lane engagement: only ONE active turf per
 * side is visible at a time; reserves queue behind and promote when the
 * active turf falls. Full simulation coverage lives in
 * `src/sim/turf/__tests__/`; these specs verify the UI surface is
 * consistent with the single-lane constraint.
 */

async function goToGame(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await activate(page.getByTestId('new-game-button'), testInfo);
  await activate(page.getByTestId('close-rules-button'), testInfo);
  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
}

test.describe('single-lane flow', () => {
  test('game screen renders exactly one active turf lane per side', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // Single-lane constraint: exactly one lane-A and one lane-B.
    await expect(page.getByTestId('turf-lane-A')).toHaveCount(1);
    await expect(page.getByTestId('turf-lane-B')).toHaveCount(1);

    // The turf-view wrapper is present.
    await expect(page.getByTestId('turf-view')).toBeVisible();
  });

  test('only one TurfView is present in the game board', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // Precisely one turf-view in the DOM — not two, not zero.
    await expect(page.getByTestId('turf-view')).toHaveCount(1);
  });

  test('draw action is enabled at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // Draw is the first action available on every fresh turn.
    await expect(page.getByTestId('action-draw')).toBeVisible();
    await expect(page.getByTestId('action-draw')).toBeEnabled();
  });

  test('draw populates a pending card slot', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // Before drawing, no pending card.
    await expect(page.getByTestId('pending-card')).toHaveCount(0);

    // Draw one card.
    await activate(page.getByTestId('action-draw'), testInfo);

    // Pending card slot appears after drawing.
    await expect(page.getByTestId('pending-card')).toBeVisible({ timeout: 5_000 });
  });

  test('queued-chips row absent before any strikes are queued', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // No strikes have been queued yet — the chip row should not render.
    await expect(page.getByTestId('queued-chips')).toHaveCount(0);
  });

  test('queuing a direct strike requires toughs on both sides — skipped pending fixture', async () => {
    test.skip(true,
      'TODO: deterministic setup for queuing a strike needs toughs on both turf stacks. ' +
      'Wire a combat fixture URL that places both sides, then assert queued-chip-0 appears. ' +
      'Combat logic covered by src/sim/turf/__tests__/.',
    );
  });

  test('reserves indicator absent when no reserves exist at game start on easy', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    // Easy difficulty starts with 1 turf per side — no reserves indicator
    // should be present initially.
    await expect(page.getByTestId('turf-reserves-A')).toHaveCount(0);
  });

  test('action budget is displayed and positive at game start', async ({ page }, testInfo) => {
    await goToGame(page, testInfo);

    const budget = page.getByTestId('action-budget');
    await expect(budget).toBeVisible();

    // Budget text contains a slash (e.g. "Actions: 3/3").
    const text = await budget.textContent();
    expect(text).toMatch(/\d+\/\d+/);
  });
});
