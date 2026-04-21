import type { Locator, TestInfo } from '@playwright/test';

/**
 * Tap the target on touch-enabled projects, click it otherwise.
 *
 * Waits for visibility and best-effort scrolls into view before acting
 * so the action survives narrow phone viewports where the tap target
 * starts off-screen. `force: true` bypasses Playwright's actionability
 * checks, which otherwise false-positive on element-obscured-by-ancestor
 * CSS transitions that are present but not animating.
 *
 * Shared across every e2e spec that needs unified tap/click routing.
 */
export async function activate(target: Locator, testInfo: TestInfo): Promise<void> {
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  if (testInfo.project.use.hasTouch) {
    try {
      await target.tap({ force: true });
      return;
    } catch {
      // Chromium mobile emulation can reject tap() on transformed / composited
      // game elements even when the DOM click target is valid.
      await target.click({ force: true });
    }
    return;
  }
  await target.click({ force: true });
}
