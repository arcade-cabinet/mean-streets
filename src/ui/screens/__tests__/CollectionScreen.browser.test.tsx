import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { CollectionScreen } from '../CollectionScreen';

describe('CollectionScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders screen with progress count and summary', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    expect(document.querySelector('[data-testid="collection-screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="collection-progress"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="collection-summary"]')).not.toBeNull();

    const count = document.querySelector('.coll-progress-count')?.textContent;
    expect(Number(count)).toBeGreaterThan(0);
  });

  it('shows all 5 category filter tabs', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    expect(document.querySelector('[data-testid="coll-cat-all"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="coll-cat-tough"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="coll-cat-weapon"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="coll-cat-drug"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="coll-cat-currency"]')).not.toBeNull();
  });

  it('shows all 6 rarity filter tabs', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    for (const rarity of ['all', 'common', 'uncommon', 'rare', 'legendary', 'mythic']) {
      expect(document.querySelector(`[data-testid="coll-rarity-${rarity}"]`)).not.toBeNull();
    }
  });

  it('filters by category when tab is clicked', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    const allCount = document.querySelector('[data-testid="collection-filtered-count"]')?.textContent ?? '';
    const allNum = parseInt(allCount);
    expect(allNum).toBeGreaterThan(0);

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="coll-cat-tough"]')!);
    await settleBrowser();

    const toughCount = document.querySelector('[data-testid="collection-filtered-count"]')?.textContent ?? '';
    const toughNum = parseInt(toughCount);
    expect(toughNum).toBeGreaterThan(0);
    expect(toughNum).toBeLessThan(allNum);
  });

  it('filters by rarity when tab is clicked', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="coll-rarity-legendary"]')!);
    await settleBrowser();

    const filteredCount = document.querySelector('[data-testid="collection-filtered-count"]')?.textContent ?? '';
    const num = parseInt(filteredCount);
    expect(num).toBeGreaterThan(0);
  });

  it('shows empty message for impossible filter combo', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="coll-cat-currency"]')!);
    await settleBrowser();
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="coll-rarity-mythic"]')!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="collection-empty"]')).not.toBeNull();
  });

  it('renders card grid with card components', async () => {
    cleanup = (await renderInBrowser(
      <CollectionScreen onBack={() => {}} />,
    )).unmount;

    const cells = document.querySelectorAll('.coll-grid-cell');
    expect(cells.length).toBeGreaterThan(0);
  });
});
