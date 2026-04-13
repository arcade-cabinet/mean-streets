import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import App from './App';
import { buildValidDeck } from './test/browser-helpers';
import { renderInBrowser, settleBrowser } from './test/render-browser';
import { resetPersistenceForTests } from './ui/deckbuilder/storage';

async function waitForEnabled(button: HTMLButtonElement | null, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (button?.disabled) {
    if (Date.now() - started > timeoutMs) break;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

describe('App flow', () => {
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    await resetPersistenceForTests();
    cleanup?.();
  });

  it('routes through the documented menu to deckbuilder flow before reaching buildup', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    expect(document.querySelector('[data-testid="main-menu-screen"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Continue');
    expect(document.body.textContent).not.toContain('Difficulty');

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);

    expect(document.querySelector('[data-testid="deckbuilder-screen"]')).not.toBeNull();

    await buildValidDeck();
    const startGameButton = document.querySelector<HTMLButtonElement>('[data-testid="start-game-button"]');
    await waitForEnabled(startGameButton);
    await userEvent.click(startGameButton!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="buildup-screen"]')).not.toBeNull();
    expect(document.body.textContent).toContain('The Street');
  });

  it('keeps settings as the only menu modal path', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="settings-button"]')!);
    await settleBrowser();

    expect(document.body.textContent).toContain('Settings');
    expect(document.body.textContent).toContain('Audio Enabled');
    expect(document.body.textContent).toContain('Reduced Motion');
    expect(document.body.textContent).not.toContain('Continue');
    expect(document.body.textContent).not.toContain('Difficulty');
  });
});
