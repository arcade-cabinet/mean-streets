import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { PackOpeningScreen } from '../PackOpeningScreen';

describe('PackOpeningScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders sealed phase with open button', async () => {
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={() => {}} />,
    )).unmount;

    expect(document.querySelector('[data-testid="pack-opening-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pack-open-btn"]')).not.toBeNull();
  });

  it('transitions to revealing phase when pack is opened', async () => {
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-open-btn"]')!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="pack-reveal-stage"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pack-reveal-card-0"]')).not.toBeNull();
  });

  it('advances through all 5 cards and reaches summary', async () => {
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-open-btn"]')!);
    await settleBrowser();

    for (let i = 0; i < 4; i++) {
      await userEvent.click(document.querySelector<HTMLElement>('[data-testid="pack-reveal-stage"]')!);
      await settleBrowser();
    }

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="pack-reveal-stage"]')!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="pack-summary-grid"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pack-summary-stats"]')).not.toBeNull();
  });

  it('summary shows done button that calls onBack', async () => {
    const onBack = vi.fn();
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={onBack} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-open-btn"]')!);
    await settleBrowser();

    for (let i = 0; i < 5; i++) {
      await userEvent.click(document.querySelector<HTMLElement>('[data-testid="pack-reveal-stage"]')!);
      await settleBrowser();
    }

    const doneBtn = document.querySelector<HTMLButtonElement>('[data-testid="pack-done-btn"]');
    expect(doneBtn).not.toBeNull();
    await userEvent.click(doneBtn!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('back button calls onBack from sealed phase', async () => {
    const onBack = vi.fn();
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={onBack} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-back"]')!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('reveals progress pips during card reveal', async () => {
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-open-btn"]')!);
    await settleBrowser();

    const pips = document.querySelectorAll('.pack-pip');
    expect(pips.length).toBe(5);

    const revealedPips = document.querySelectorAll('.pack-pip-revealed');
    expect(revealedPips.length).toBe(1);
  });

  it('summary grid shows 5 card cells', async () => {
    cleanup = (await renderInBrowser(
      <PackOpeningScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="pack-open-btn"]')!);
    await settleBrowser();

    for (let i = 0; i < 5; i++) {
      await userEvent.click(document.querySelector<HTMLElement>('[data-testid="pack-reveal-stage"]')!);
      await settleBrowser();
    }

    const cells = document.querySelectorAll('.pack-summary-cell');
    expect(cells.length).toBe(5);
  });
});
