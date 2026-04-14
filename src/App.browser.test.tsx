import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import App from './App';
import { buildValidDeck } from './test/browser-helpers';
import { renderInBrowser, settleBrowser } from './test/render-browser';
import { resetPersistenceForTests, saveDeckLoadout } from './ui/deckbuilder/storage';

async function waitForEnabled(selector: string, timeoutMs = 5000): Promise<HTMLButtonElement | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled) return button;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return document.querySelector<HTMLButtonElement>(selector);
}

async function waitForSelector(selector: string, timeoutMs = 5000): Promise<Element | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const match = document.querySelector(selector);
    if (match) return match;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return document.querySelector(selector);
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
    await settleBrowser();

    expect(document.body.textContent).toContain('Rules');
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="close-rules-button"]')!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="deckbuilder-screen"]')).not.toBeNull();

    const errors: string[] = [];
    const origOnError = window.onerror;
    const origUnhandled = window.onunhandledrejection;
    window.onerror = (msg, src, line, col, err) => {
      errors.push(`${msg} @ ${src}:${line}:${col} :: ${err?.stack ?? ''}`);
      return false;
    };
    window.onunhandledrejection = (event) => {
      errors.push(`unhandled: ${event.reason?.stack ?? event.reason}`);
    };

    try {
      await buildValidDeck();
      const startGameButton = await waitForEnabled('[data-testid="start-game-button"]', 5000);
      if (startGameButton?.disabled !== false) {
        const selectedCrewCount = document.querySelectorAll('button[data-card-type="crew"].deck-card-selected').length;
        const selectedWeaponCount = document.querySelectorAll('button[data-card-type="weapon"].deck-card-selected').length;
        const selectedDrugCount = document.querySelectorAll('button[data-card-type="product"].deck-card-selected').length;
        const selectedCashCount = document.querySelectorAll('button[data-card-type="cash"].deck-card-selected').length;
        throw new Error(
          `start-game-button still disabled after buildValidDeck. ` +
          `crew=${selectedCrewCount}/25 weapon=${selectedWeaponCount}/19 ` +
          `drug=${selectedDrugCount}/3 cash=${selectedCashCount}/3`,
        );
      }
      startGameButton.scrollIntoView({ block: 'center', inline: 'center' });
      await settleBrowser();
      // Use a native dispatch so the DOM event fires even if the button is
      // partially outside the playwright click hit-target box on CI viewports.
      startGameButton.click();
      await settleBrowser();

      const buildup = await waitForSelector('[data-testid="buildup-screen"]', 10000);
      if (!buildup) {
        const visibleScreens: string[] = [];
        document.querySelectorAll('[data-testid$="-screen"]').forEach((el) => {
          visibleScreens.push(el.getAttribute('data-testid') ?? '?');
        });
        throw new Error(
          `buildup-screen did not mount after start click. visible screens=[${visibleScreens.join(',')}] errors=[${errors.join(' | ')}] body length=${document.body.textContent?.length ?? 0}`,
        );
      }
      expect(document.body.textContent).toContain('The Street');
    } finally {
      window.onerror = origOnError;
      window.onunhandledrejection = origUnhandled;
    }
  });

  it('opens rules onboarding before the first new game', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();

    expect(document.body.textContent).toContain('Rules');
    expect(document.body.textContent).toContain('Deck');
    expect(document.body.textContent).toContain('Combat');
    expect(document.body.textContent).not.toContain('Continue');
    expect(document.body.textContent).not.toContain('Difficulty');
  });

  it('routes to the deck garage when saved decks exist', async () => {
    window.__MEAN_STREETS_TEST__ = true;
    await saveDeckLoadout({
      id: 'deck-night-shift',
      name: 'Night Shift',
      crewIds: [],
      modifierIds: [],
      updatedAt: new Date().toISOString(),
    });

    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();

    expect(document.body.textContent).toContain('Rules');
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="close-rules-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="deck-garage-screen"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Night Shift');
    expect(document.querySelector('[data-testid="new-deck-button"]')).not.toBeNull();
  });
});
