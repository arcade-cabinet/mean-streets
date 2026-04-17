import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardsScreen } from '../CardsScreen';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

describe('CardsScreen (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders the cards screen with gallery', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    expect(document.querySelector('[data-testid="cards-screen"]')).not.toBeNull();
    expect(document.querySelector('.cards-gallery')).not.toBeNull();
  });

  it('populates gallery with cards', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    const items = document.querySelectorAll('.cards-gallery-item');
    expect(items.length).toBeGreaterThan(10);
  });

  it('shows draw button when availableDraws > 0', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} availableDraws={5} onDraw={vi.fn()} />,
    )).unmount;
    const drawBtn = document.querySelector('[data-testid="draw-button"]');
    expect(drawBtn).not.toBeNull();
    expect(drawBtn!.textContent).toContain('5');
  });

  it('hides draw button when availableDraws is 0', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} availableDraws={0} />,
    )).unmount;
    expect(document.querySelector('[data-testid="draw-button"]')).toBeNull();
  });

  it('opens detail overlay on card click', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    const firstCard = document.querySelector<HTMLElement>('.cards-gallery-item')!;
    firstCard.click();
    await settleBrowser();
    expect(document.querySelector('.cards-detail-backdrop')).not.toBeNull();
  });

  it('closes detail overlay on Close click', async () => {
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    document.querySelector<HTMLElement>('.cards-gallery-item')!.click();
    await settleBrowser();
    document.querySelector<HTMLElement>('.cards-detail-close')!.click();
    await settleBrowser();
    expect(document.querySelector('.cards-detail-backdrop')).toBeNull();
  });

  it('calls onBack when Back clicked', async () => {
    const onBack = vi.fn();
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={onBack} onStartGame={vi.fn()} />,
    )).unmount;
    document.querySelector<HTMLElement>('.cards-hud-btn')!.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onStartGame when Play clicked', async () => {
    const onStartGame = vi.fn();
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={onStartGame} />,
    )).unmount;
    document.querySelector<HTMLElement>('.cards-hud-play')!.click();
    expect(onStartGame).toHaveBeenCalledOnce();
  });

  it('uses compact cards on phone viewport', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    expect(document.querySelector('.cards-gallery-phone')).not.toBeNull();
  });

  it('gallery fills viewport height', async () => {
    setTestViewport({ width: 1280, height: 800, orientation: 'landscape' });
    cleanup = (await renderInBrowser(
      <CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />,
    )).unmount;
    await settleBrowser();
    const gallery = document.querySelector<HTMLElement>('.cards-gallery')!;
    expect(gallery.offsetHeight).toBeGreaterThan(600);
  });
});
