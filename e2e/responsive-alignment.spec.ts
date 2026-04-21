import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const FIXTURES = [
  'menu',
  'difficulty',
  'deck-garage',
  'combat',
  'card',
  'pack-opening',
  'game-over',
] as const;

async function assertNoHorizontalOverflow(page: Page, fixture: string) {
  await page.goto(`?fixture=${fixture}`);
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

test.describe('menu logo does not overlap menu actions', () => {
  test('logo bottom is above first menu button top on phone-portrait', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'iphone-14' && testInfo.project.name !== 'pixel-7',
      'only assert against stacked menu variant',
    );

    await page.goto('?fixture=menu');
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
