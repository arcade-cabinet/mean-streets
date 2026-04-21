import { expect, test } from '@playwright/test';
import { activate } from './helpers/activate';
import { runPlayerGovernor } from './helpers/player-governor';

test.describe('@governor Player Governor vs AI', () => {
  test('plays a full game to completion on Corner Boy (easy)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Long-form governor runs are desktop-only.');
    test.setTimeout(600_000);

    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
    });
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

    await page.goto('/');
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();

    await activate(page.getByTestId('new-game-button'), testInfo);

    const rulesBtn = page.getByTestId('close-rules-button');
    if (await rulesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activate(rulesBtn, testInfo);
    }

    await expect(page.getByTestId('difficulty-screen')).toBeVisible();
    await activate(page.getByTestId('diff-tile-easy'), testInfo);
    await activate(page.getByTestId('diff-start'), testInfo);

    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });

    const result = await runPlayerGovernor(page, testInfo, {
      maxActions: 5000,
      actionDelayMs: 40,
      verbose: true,
    });

    console.log(`[PlayerGovernor] Result: ${result.reason}`);
    console.log(`[PlayerGovernor] Turns: ${result.turns}, Winner: ${result.winner}`);
    console.log(`[PlayerGovernor] Total actions logged: ${result.log.length}`);

    const actionCounts: Record<string, number> = {};
    for (const entry of result.log) {
      actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1;
    }
    console.log(`[PlayerGovernor] Action breakdown:`, JSON.stringify(actionCounts));

    expect(result.reason).toBe('game-over');
    expect(['A', 'B']).toContain(result.winner);
    expect(result.turns).toBeGreaterThan(0);
  });

  test('plays a full game on Soldier (medium)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Long-form governor runs are desktop-only.');
    test.setTimeout(600_000);

    await page.goto('/');
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();

    await activate(page.getByTestId('new-game-button'), testInfo);

    const rulesBtn = page.getByTestId('close-rules-button');
    if (await rulesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activate(rulesBtn, testInfo);
    }

    await expect(page.getByTestId('difficulty-screen')).toBeVisible();
    await activate(page.getByTestId('diff-tile-medium'), testInfo);
    await activate(page.getByTestId('diff-start'), testInfo);

    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 10_000 });

    const result = await runPlayerGovernor(page, testInfo, {
      maxActions: 3000,
      actionDelayMs: 50,
      verbose: true,
    });

    console.log(`[PlayerGovernor] Medium result: ${result.reason}, turns: ${result.turns}, winner: ${result.winner}`);

    expect(result.reason).toBe('game-over');
    expect(['A', 'B']).toContain(result.winner);
  });
});
