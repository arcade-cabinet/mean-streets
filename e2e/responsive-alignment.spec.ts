/**
 * responsive-alignment.spec.ts
 *
 * Verifies every fixture stays inside the viewport horizontally on
 * every device profile. Catches the class of bug where a flex/grid
 * child pushes the scrollWidth past viewport width and breaks the
 * mobile layout.
 *
 * Also verifies that compact / compressed card layouts render the
 * expected structural landmarks (stat row + modifier grid) so a
 * refactor can't silently drop slots off the compact card.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const FIXTURES = ['menu', 'deck-garage', 'deckbuilder', 'buildup', 'combat'] as const;

async function assertNoHorizontalOverflow(page: Page, fixture: string) {
  await page.goto(`/?fixture=${fixture}`);
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => {
    const innerW = window.innerWidth;
    const body = document.body;
    const html = document.documentElement;
    return {
      innerW,
      bodySW: body.scrollWidth,
      htmlSW: html.scrollWidth,
    };
  });
  // Allow 2px tolerance for sub-pixel rounding.
  expect(
    overflow.bodySW,
    `fixture=${fixture}: body.scrollWidth ${overflow.bodySW} > innerWidth ${overflow.innerW}`,
  ).toBeLessThanOrEqual(overflow.innerW + 2);
}

test.describe('responsive horizontal alignment', () => {
  for (const fixture of FIXTURES) {
    test(`${fixture} fits within viewport`, async ({ page }) => {
      await assertNoHorizontalOverflow(page, fixture);
    });
  }
});

test.describe('compact crew card structure', () => {
  test('renders stat row + 6-slot modifier grid on phone-portrait/folded', async ({ page }, testInfo) => {
    // Only run where the compact layout actually applies.
    const layoutId = testInfo.project.name;
    test.skip(
      layoutId !== 'iphone-14' && layoutId !== 'pixel-7',
      'compact layout is phone-portrait only',
    );

    await page.goto('/?fixture=crew-card');
    await page.waitForLoadState('networkidle');

    // Compact card shell.
    const shell = page.locator('.crew-card-shell-compact');
    await expect(shell).toBeVisible();

    // Compact stat row: P/R/W/D/$ columns.
    const compactTop = page.locator('.crew-card-compact-top');
    await expect(compactTop).toBeVisible();
    const stats = compactTop.locator('.crew-card-compact-stat');
    await expect(stats).toHaveCount(5);

    // Modifier grid: six quarter-card slot wrappers.
    const modifiers = page.locator('.crew-card-compact-modifiers [data-testid^="modifier-slot-"]');
    // Slot testids are added by ModifierSlot; verify count == 6 (3 offense + 3 defense).
    const slotCount = await modifiers.count();
    // ModifierSlot may not carry that testid; fall back to wrapper-class check.
    if (slotCount === 0) {
      const wrappers = page.locator('.crew-card-compact-modifiers > *');
      await expect(wrappers).toHaveCount(6);
    } else {
      expect(slotCount).toBe(6);
    }
  });

  test('compact name + layout sit above modifier grid vertically', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'iphone-14' && testInfo.project.name !== 'pixel-7',
      'compact layout is phone-portrait only',
    );

    await page.goto('/?fixture=crew-card');
    await page.waitForLoadState('networkidle');

    const bounds = await page.evaluate(() => {
      const name = document.querySelector('.crew-card-compact-name')?.getBoundingClientRect();
      const mods = document.querySelector('.crew-card-compact-modifiers')?.getBoundingClientRect();
      const aff = document.querySelector('.crew-card-affiliation-compact')?.getBoundingClientRect();
      return {
        nameY: name?.top ?? null,
        modsY: mods?.top ?? null,
        affY: aff?.top ?? null,
      };
    });

    // Name must sit above modifiers, and modifiers above the
    // affiliation footer.
    expect(bounds.nameY).not.toBeNull();
    expect(bounds.modsY).not.toBeNull();
    expect(bounds.nameY!).toBeLessThan(bounds.modsY!);
    if (bounds.affY !== null) {
      expect(bounds.modsY!).toBeLessThan(bounds.affY!);
    }
  });
});

test.describe('menu logo does not overlap menu actions', () => {
  test('logo bottom is above first menu button top on phone-portrait', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'iphone-14' && testInfo.project.name !== 'pixel-7',
      'only assert against stacked menu variant',
    );

    await page.goto('/?fixture=menu');
    await page.waitForLoadState('networkidle');

    const rects = await page.evaluate(() => {
      const logo = document.querySelector('[data-testid="menu-logo"]') as HTMLElement | null;
      const btn = document.querySelector('[data-testid="new-game-button"]') as HTMLElement | null;
      return {
        logoBottom: logo?.getBoundingClientRect().bottom ?? null,
        btnTop: btn?.getBoundingClientRect().top ?? null,
      };
    });
    expect(rects.logoBottom).not.toBeNull();
    expect(rects.btnTop).not.toBeNull();
    expect(
      rects.logoBottom!,
      `logo.bottom (${rects.logoBottom}) must be <= button.top (${rects.btnTop})`,
    ).toBeLessThanOrEqual(rects.btnTop!);
  });
});
