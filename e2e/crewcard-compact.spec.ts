import { test } from '@playwright/test';

test('capture compact crew card at phone-portrait', async ({ page }, testInfo) => {
  await page.goto('/?fixture=crew-card');
  await page.waitForLoadState('networkidle');
  const el = page.getByTestId('fixture-crew-card');
  const dir = `artifacts/visual-review/${testInfo.project.name}/fullpage`;
  await import('node:fs').then((fs) => fs.mkdirSync(dir, { recursive: true }));
  await el.screenshot({ path: `${dir}/crew-card-compact.png` });
});
