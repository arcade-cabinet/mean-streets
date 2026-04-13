import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DeckBuilderScreen } from '../DeckBuilderScreen';
import { buildValidDeck } from '../../../test/browser-helpers';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { loadDeckLoadouts, resetPersistenceForTests } from '../../deckbuilder/storage';

async function waitForEnabled(button: HTMLButtonElement | null, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (button?.disabled) {
    if (Date.now() - started > timeoutMs) break;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

describe('DeckBuilderScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    await resetPersistenceForTests();
    cleanup?.();
  });

  it('saves a completed deck loadout after full crew and modifier selection', async () => {
    const onStartGame = vi.fn();
    const onBack = vi.fn();

    cleanup = (await renderInBrowser(
      <DeckBuilderScreen
        onBack={onBack}
        onStartGame={onStartGame}
      />,
    )).unmount;

    const screenRoot = document.querySelector<HTMLElement>('[data-testid="deckbuilder-screen"]');
    const saveButton = document.querySelector<HTMLButtonElement>('[data-testid="save-deck-button"]');
    const nameInput = document.querySelector<HTMLInputElement>('[data-testid="deck-name-input"]');

    expect(screenRoot).not.toBeNull();
    expect(saveButton?.disabled).toBe(true);

    await buildValidDeck();
    await userEvent.fill(nameInput!, 'Night Shift');
    await waitForEnabled(saveButton);

    expect(saveButton?.disabled).toBe(false);

    await userEvent.click(saveButton!);
    await settleBrowser();

    const saved = await loadDeckLoadouts();
    expect(saved.some((deck) => deck.name === 'Night Shift')).toBe(true);
  });
});
