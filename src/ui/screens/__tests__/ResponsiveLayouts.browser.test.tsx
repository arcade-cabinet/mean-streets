import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainMenuScreen } from '../MainMenuScreen';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

describe('responsive layout variants', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders menu with 3 buttons on phone portrait', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="main-menu-screen"]')).not.toBeNull();
    expect(document.querySelectorAll('.menu-btn').length).toBe(3);
  });

  it('renders menu with 3 buttons on tablet landscape', async () => {
    setTestViewport({ width: 1180, height: 820, orientation: 'landscape' });
    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={vi.fn()} onLoadGame={vi.fn()} onCards={vi.fn()} canLoadGame={false} />,
    )).unmount;
    await settleBrowser();
    expect(document.querySelector('[data-testid="main-menu-screen"]')).not.toBeNull();
    expect(document.querySelectorAll('.menu-btn').length).toBe(3);
  });
});
