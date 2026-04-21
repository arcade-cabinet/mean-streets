import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import App from './App';
import { renderInBrowser, settleBrowser } from './test/render-browser';
import {
  loadActiveRun,
  resetPersistenceForTests,
  saveProfile,
  saveSettings,
} from './ui/deckbuilder/storage';

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

async function waitForActiveRun(timeoutMs = 5000): Promise<{
  playerDeck: Array<{ id: string }>;
} | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const activeRun = await loadActiveRun<{
      playerDeck: Array<{ id: string }>;
    }>();
    if (activeRun) return activeRun;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return loadActiveRun<{
    playerDeck: Array<{ id: string }>;
  }>();
}

describe('App flow', () => {
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    await resetPersistenceForTests();
    cleanup?.();
  });

  it('renders the main menu with 5 entry points', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    expect(document.querySelector('[data-testid="main-menu-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="new-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="load-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="collection-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="cards-button"]')).not.toBeNull();
  });

  it('opens rules onboarding on first New Game, then routes to difficulty', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="close-rules-button"]')).not.toBeNull();
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="close-rules-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="difficulty-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-easy"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-medium"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-hard"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-nightmare"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-tile-ultra-nightmare"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="diff-sudden-death"]')).toBeNull();
    expect(document.querySelector('[data-testid="diff-start"]')).not.toBeNull();
  });

  it('routes Collection entry point to the collection screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="collection-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="collection-screen"]')).not.toBeNull();
  });

  it('routes Garage entry point to the card garage screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="garage-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="card-garage-screen"]')).not.toBeNull();
  });

  it('routes Cards entry point to the cards screen', async () => {
    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="cards-button"]')!);
    await settleBrowser();

    expect(await waitForSelector('[data-testid="cards-screen"]')).not.toBeNull();
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
  });

  it('starts wars from full owned inventory instead of the deduped summary collection', async () => {
    await saveSettings({
      audioEnabled: true,
      motionReduced: false,
      rulesSeen: true,
    });
    await saveProfile({
      unlockedCardIds: ['card-001', 'card-002'],
      cardInstances: {
        'card-001': {
          rolledRarity: 'common',
          unlockDifficulty: 'easy',
        },
        'card-002': {
          rolledRarity: 'common',
          unlockDifficulty: 'easy',
        },
      },
      cardInventory: [
        {
          cardId: 'card-001',
          rolledRarity: 'common',
          unlockDifficulty: 'easy',
        },
        {
          cardId: 'card-001',
          rolledRarity: 'common',
          unlockDifficulty: 'hard',
        },
        {
          cardId: 'card-002',
          rolledRarity: 'common',
          unlockDifficulty: 'easy',
        },
      ],
      wins: 0,
      lastPlayedAt: null,
    });

    cleanup = (await renderInBrowser(<App />)).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="new-game-button"]')!);
    await settleBrowser();
    expect(await waitForSelector('[data-testid="difficulty-screen"]')).not.toBeNull();

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="diff-tile-easy"]')!);
    await settleBrowser();
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="diff-start"]')!);
    await settleBrowser();

    const activeRun = await waitForActiveRun();
    expect(activeRun).not.toBeNull();
    expect(
      activeRun!.playerDeck.filter((card) => card.id === 'card-001'),
    ).toHaveLength(2);
  });
});
