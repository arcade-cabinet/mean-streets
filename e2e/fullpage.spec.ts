import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const DIR = 'artifacts/visual-fullpage';

async function full(page: any, url: string, name: string, project: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  mkdirSync(`${DIR}/${project}`, { recursive: true });
  await page.screenshot({ path: `${DIR}/${project}/${name}.png`, fullPage: true });
}

test('capture full-page screenshots', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await full(page, '/?fixture=menu', 'menu', project);
  await full(page, '/?fixture=deck-garage', 'deck-garage', project);
  await full(page, '/?fixture=deckbuilder', 'deckbuilder', project);
  await full(page, '/?fixture=buildup', 'buildup', project);
  await full(page, '/?fixture=combat', 'combat', project);
});
