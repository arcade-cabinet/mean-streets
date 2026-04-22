import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';

test('menu → difficulty → game flow works on the live app', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await expect(page.getByTestId('new-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeVisible();
  await expect(page.getByTestId('load-game-button')).toBeDisabled();
  await expect(page.getByTestId('cards-button')).toBeVisible();

  await activate(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'First Run Brief' })).toBeVisible();
  await activate(page.getByTestId('close-tutorial-button'), testInfo);

  await expect(page.getByTestId('difficulty-screen')).toBeVisible();
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('diff-tile-easy'), testInfo);
  await activate(page.getByTestId('diff-start'), testInfo);

  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('action-budget')).toBeVisible();
  // Draw pile slot is hidden on phone; HUD draw button shows instead
  const drawSlot = page.getByTestId('slot-player-draw');
  const hudDraw = page.getByTestId('hud-draw');
  const drawVisible = await drawSlot.isVisible().catch(() => false) || await hudDraw.isVisible().catch(() => false);
  expect(drawVisible).toBe(true);
  await expect(page.getByTestId('turf-lane-A')).toBeVisible();
  await expect(page.getByTestId('action-end_turn')).toBeVisible();
});

test('cards screen navigates and returns to menu', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('cards-button'), testInfo);
  await expect(page.getByTestId('cards-screen')).toBeVisible();

  await activate(page.getByTestId('cards-back'), testInfo);
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
});

test('difficulty back button returns to menu', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();

  await activate(page.getByTestId('new-game-button'), testInfo);
  await expect(page.getByRole('heading', { name: 'First Run Brief' })).toBeVisible();
  await activate(page.getByTestId('close-tutorial-button'), testInfo);
  await expect(page.getByTestId('difficulty-screen')).toBeVisible();

  await activate(page.getByTestId('diff-back'), testInfo);
  await expect(page.getByTestId('main-menu-screen')).toBeVisible();
  await expect(page.getByTestId('difficulty-screen')).toHaveCount(0);
});
