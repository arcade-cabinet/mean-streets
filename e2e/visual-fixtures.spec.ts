import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const RUN = process.env.MEAN_STREETS_VISUAL_SPECS === '1';

async function assertFixture(
  page: Page,
  fixture: string,
  targetTestId: string,
) {
  await page.goto(`?fixture=${fixture}`);
  await page.waitForLoadState('networkidle');
  const target = page.getByTestId(targetTestId);
  await expect(target).toBeVisible();
}

test.skip(
  !RUN,
  'Use `pnpm run test:visual` for screenshot capture; set MEAN_STREETS_VISUAL_SPECS=1 to smoke-test fixture routes directly.',
);

test.describe('@visual visual fixtures', () => {
  test('renders main menu fixture', async ({ page }) => {
    await assertFixture(page, 'menu', 'main-menu-screen');
  });

  test('renders tutorial fixture', async ({ page }) => {
    await assertFixture(page, 'tutorial', 'tutorial-modal');
  });

  test('renders difficulty fixture', async ({ page }) => {
    await assertFixture(page, 'difficulty', 'difficulty-screen');
  });

  test('renders deck garage fixture', async ({ page }) => {
    await assertFixture(page, 'deck-garage', 'deck-garage-screen');
  });

  test('renders combat fixture', async ({ page }) => {
    await assertFixture(page, 'combat', 'game-screen');
  });

  test('renders first-war coach fixture', async ({ page }) => {
    await assertFixture(page, 'combat-tutorial', 'game-screen');
    await expect(page.getByTestId('first-war-coach')).toBeVisible();
  });

  test('renders card fixture', async ({ page }) => {
    await assertFixture(page, 'card', 'fixture-root');
  });

  test('renders pack opening fixture', async ({ page }) => {
    await assertFixture(page, 'pack-opening', 'pack-opening-screen');
  });

  test('renders pack reveal fixture', async ({ page }) => {
    await assertFixture(page, 'pack-opening-reveal', 'pack-opening-screen');
  });

  test('renders pack summary fixture', async ({ page }) => {
    await assertFixture(page, 'pack-opening-summary', 'pack-opening-screen');
  });

  test('renders game over fixture', async ({ page }) => {
    await assertFixture(page, 'game-over', 'gameover-screen');
  });
});
