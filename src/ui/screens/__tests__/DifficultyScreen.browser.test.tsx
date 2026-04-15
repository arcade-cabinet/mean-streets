import { afterEach, describe, expect, it, vi } from 'vitest';
import { DifficultyScreen } from '../DifficultyScreen';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

describe('DifficultyScreen (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders the difficulty grid in the browser', async () => {
    cleanup = (await renderInBrowser(
      <DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />,
    )).unmount;

    expect(document.querySelector('[data-testid="difficulty-screen"]')).not.toBeNull();
    expect(document.querySelectorAll('[role="radio"]').length).toBe(6);
  });

  it('selects a tier on click', async () => {
    cleanup = (await renderInBrowser(
      <DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />,
    )).unmount;

    const hardTile = document.querySelector<HTMLElement>('[data-testid="diff-tile-hard"]')!;
    hardTile.click();
    await settleBrowser();
    expect(hardTile.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onSelect with config when Start is clicked', async () => {
    const onSelect = vi.fn();
    cleanup = (await renderInBrowser(
      <DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />,
    )).unmount;

    const startBtn = document.querySelector<HTMLElement>('[data-testid="diff-start"]')!;
    startBtn.click();
    expect(onSelect).toHaveBeenCalledOnce();
    const config = onSelect.mock.calls[0][0];
    expect(config.difficulty).toBe('medium');
    expect(config.turfCount).toBeGreaterThan(0);
  });

  it('renders compact grid on phone viewport', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });
    cleanup = (await renderInBrowser(
      <DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    expect(document.querySelector('.diff-grid-compact')).not.toBeNull();
  });
});
