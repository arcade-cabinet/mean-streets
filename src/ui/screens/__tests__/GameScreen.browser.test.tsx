import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldProvider } from 'koota/react';
import { createGameWorld } from '../../../ecs/world';
import { GameScreen } from '../GameScreen';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

function renderGameScreen(onGameOver = vi.fn()) {
  const world = createGameWorld({ difficulty: 'easy', suddenDeath: false, turfCount: 5, actionsPerTurn: 3, firstTurnActions: 5 }, 42);
  return renderInBrowser(
    <WorldProvider world={world}>
      <GameScreen world={world} onGameOver={onGameOver} />
    </WorldProvider>,
  );
}

describe('GameScreen board layout (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders the game screen with board grid', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="game-screen"]')).not.toBeNull();
    expect(document.querySelector('.board-grid')).not.toBeNull();
  });

  it('renders HUD bar with turn, actions, heat, mythic', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    expect(document.querySelector('.game-hud-bar')).not.toBeNull();
    expect(document.querySelector('[data-testid="action-budget"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="mythic-pool-indicator"]')).not.toBeNull();
  });

  it('renders player and opponent turf lanes', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="turf-lane-A"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="turf-lane-B"]')).not.toBeNull();
  });

  it('renders draw pile slot for player', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    const drawSlot = document.querySelector('[data-testid="slot-player-draw"]');
    expect(drawSlot).not.toBeNull();
    expect(drawSlot!.textContent).toMatch(/\d+/);
  });

  it('renders Market and Custody in HUD', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="slot-market"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="slot-holding"]')).not.toBeNull();
  });

  it('renders end turn button', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="action-end_turn"]')).not.toBeNull();
  });

  it('board grid fills viewport on desktop', async () => {
    setTestViewport({ width: 1280, height: 800, orientation: 'landscape' });
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    const grid = document.querySelector<HTMLElement>('.board-grid')!;
    expect(grid.offsetHeight).toBeGreaterThan(500);
  });

  it('board grid has 6 slots (3 columns × 2 rows)', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    const slots = document.querySelectorAll('.board-slot');
    expect(slots.length).toBe(6);
  });

  it('shows opponent turn overlay when waiting', async () => {
    cleanup = (await renderGameScreen()).unmount;
    await settleBrowser();
    const endTurn = document.querySelector<HTMLElement>('[data-testid="action-end_turn"]')!;
    endTurn.click();
    await settleBrowser();
    const overlay = document.querySelector('[data-testid="opponent-turn-overlay"]');
    expect(overlay).not.toBeNull();
  });
});
