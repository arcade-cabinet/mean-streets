import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import App from './App';
import { renderInBrowser, settleBrowser } from './test/render-browser';
import { resetPersistenceForTests } from './ui/deckbuilder/storage';

async function waitForSelector(selector: string, timeoutMs = 5000): Promise<Element | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const match = document.querySelector(selector);
    if (match) return match;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return document.querySelector(selector);
}

async function dismissRulesOnboarding(): Promise<void> {
  const closeBtn = await waitForSelector('[data-testid="close-rules-button"]', 2000);
  if (closeBtn) {
    await userEvent.click(closeBtn as HTMLButtonElement);
    await settleBrowser();
  }
}

describe('App flow', () => {
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    await resetPersistenceForTests();
    cleanup?.();
  });

  it('renders the v0.2 main menu with all entry points', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    expect(document.querySelector('[data-testid="main-menu-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="new-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="load-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="collection-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="open-pack-button"]')).not.toBeNull();
  });

  it('opens rules onboarding on first New Game, then routes to difficulty', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();

    // First launch: rules onboarding modal appears.
    expect(await waitForSelector('[data-testid="close-rules-button"]')).not.toBeNull();
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="close-rules-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="difficulty-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-easy"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-medium"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-hard"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-nightmare"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-ultra-nightmare"]')).not.toBeNull();
    // v0.3 removed the Sudden Death toggle.
    expect(document.querySelector('[data-testid="diff-sudden-death"]')).toBeNull();
    expect(document.querySelector('[data-testid="diff-start"]')).not.toBeNull();
  });

  it('routes Collection entry point to the collection screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="collection-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="collection-screen"]')).not.toBeNull();
  });

  it('routes Open Pack entry point to the pack opening screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="open-pack-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="pack-opening-screen"]')).not.toBeNull();
  });

  it('difficulty -> start spawns the game screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();

    await dismissRulesOnboarding();

    expect(await waitForSelector('[data-testid="difficulty-screen"]')).not.toBeNull();

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="diff-tile-medium"]')!);
    await settleBrowser();

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="diff-start"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="game-screen"]', 10000)).not.toBeNull();
    expect(document.querySelector('[data-testid="action-budget"]')).not.toBeNull();
    // v0.2: handless — assert the draw-action button instead of hand-row.
    expect(document.querySelector('[data-testid="action-draw"]')).not.toBeNull();
  });
});
