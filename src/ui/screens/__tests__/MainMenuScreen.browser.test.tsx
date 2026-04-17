import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainMenuScreen } from '../MainMenuScreen';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

describe('MainMenuScreen (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders 3 menu buttons', async () => {
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    expect(document.querySelector('[data-testid="new-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="load-game-button"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="cards-button"]')).not.toBeNull();
  });

  it('disables Load Game when canLoadGame is false', async () => {
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="load-game-button"]')!;
    expect(btn.disabled).toBe(true);
  });

  it('enables Load Game when canLoadGame is true', async () => {
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={true} />,
    )).unmount;
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="load-game-button"]')!;
    expect(btn.disabled).toBe(false);
  });

  it('calls onNewGame when New Game clicked', async () => {
    const onNewGame = vi.fn();
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={onNewGame} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    document.querySelector<HTMLElement>('[data-testid="new-game-button"]')!.click();
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onCards when Cards clicked', async () => {
    const onCards = vi.fn();
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={onCards} canLoadGame={false} />,
    )).unmount;
    document.querySelector<HTMLElement>('[data-testid="cards-button"]')!.click();
    expect(onCards).toHaveBeenCalledOnce();
  });

  it('shows pack badge when availablePacks > 0', async () => {
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} availablePacks={3} />,
    )).unmount;
    const badge = document.querySelector('.menu-btn-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('3');
  });

  it('hides pack badge when availablePacks is 0', async () => {
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} availablePacks={0} />,
    )).unmount;
    expect(document.querySelector('.menu-btn-badge')).toBeNull();
  });

  it('buttons are horizontally aligned on desktop', async () => {
    setTestViewport({ width: 1280, height: 800, orientation: 'landscape' });
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    await settleBrowser();
    const nav = document.querySelector('.menu-nav')!;
    const style = getComputedStyle(nav);
    expect(style.flexDirection).toBe('row');
  });

  it('renders all 3 buttons on small phone portrait', async () => {
    setTestViewport({ width: 375, height: 667, orientation: 'portrait' });
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    await settleBrowser();
    expect(document.querySelectorAll('.menu-btn').length).toBe(3);
  });
});
