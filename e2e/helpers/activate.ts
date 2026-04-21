import type { Locator, TestInfo } from '@playwright/test';

/**
 * Activate the target with a DOM click across pointer profiles.
 *
 * Waits for visibility and best-effort scrolls into view before acting
 * so the action survives narrow phone viewports where the tap target
 * starts off-screen. `force: true` bypasses Playwright's actionability
 * checks, which otherwise false-positive on element-obscured-by-ancestor
 * CSS transitions that are present but not animating.
 *
 * Shared across every e2e spec that needs unified tap/click routing.
 */
export async function activate(
  target: Locator,
  testInfo: TestInfo,
): Promise<void> {
  void testInfo;
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click({ force: true });
}
