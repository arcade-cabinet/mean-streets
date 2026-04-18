import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { CollectionScreen } from '../CollectionScreen';

// Mock the persistence layer so jsdom doesn't hit SQLite
vi.mock('../../../platform/persistence/collection', () => ({
  loadCollection: () => Promise.resolve([]),
  addCardsToCollection: () => Promise.resolve([]),
}));

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('CollectionScreen', () => {
  it('renders the collection screen with title', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('collection-screen')).not.toBeNull();
    expect(screen.getByText('Collection')).not.toBeNull();
  });

  it('shows progress indicator', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    const progress = screen.getByTestId('collection-progress');
    expect(progress.textContent).toContain('unlocked');
  });

  it('shows per-category summary counts', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    const summary = screen.getByTestId('collection-summary');
    expect(summary.textContent).toContain('toughs');
    expect(summary.textContent).toContain('weapons');
    expect(summary.textContent).toContain('drugs');
    expect(summary.textContent).toContain('cash');
  });

  it('renders category filter buttons', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('coll-cat-all')).not.toBeNull();
    expect(screen.getByTestId('coll-cat-tough')).not.toBeNull();
    expect(screen.getByTestId('coll-cat-weapon')).not.toBeNull();
    expect(screen.getByTestId('coll-cat-drug')).not.toBeNull();
    expect(screen.getByTestId('coll-cat-currency')).not.toBeNull();
  });

  it('renders rarity filter buttons with counts', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('coll-rarity-all')).not.toBeNull();
    expect(screen.getByTestId('coll-rarity-common')).not.toBeNull();
    expect(screen.getByTestId('coll-rarity-rare')).not.toBeNull();
    expect(screen.getByTestId('coll-rarity-legendary')).not.toBeNull();
  });

  it('defaults to all filters showing all cards', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('coll-cat-all').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('coll-rarity-all').getAttribute('aria-pressed')).toBe('true');
  });

  it('filters by category when category button is clicked', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    const allCount = screen.getByTestId('collection-filtered-count').textContent!;
    fireEvent.click(screen.getByTestId('coll-cat-tough'));
    const toughCount = screen.getByTestId('collection-filtered-count').textContent!;
    expect(toughCount).not.toBe(allCount);
    expect(screen.getByTestId('coll-cat-tough').getAttribute('aria-pressed')).toBe('true');
  });

  it('filters by rarity when rarity button is clicked', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    const allCount = screen.getByTestId('collection-filtered-count').textContent!;
    fireEvent.click(screen.getByTestId('coll-rarity-rare'));
    const rareCount = screen.getByTestId('collection-filtered-count').textContent!;
    expect(rareCount).not.toBe(allCount);
  });

  it('shows empty state when no cards match filters', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('coll-cat-currency'));
    fireEvent.click(screen.getByTestId('coll-rarity-legendary'));
    expect(screen.getByTestId('collection-empty')).not.toBeNull();
    expect(screen.getByText('No cards match the current filters.')).not.toBeNull();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(wrap(<CollectionScreen onBack={onBack} />));
    fireEvent.click(screen.getByTestId('collection-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('has accessible filter navigation', () => {
    const { container } = render(wrap(<CollectionScreen onBack={vi.fn()} />));
    expect(container.querySelector('nav[aria-label="Collection filters"]')).not.toBeNull();
  });

  it('shows filtered count text', () => {
    render(wrap(<CollectionScreen onBack={vi.fn()} />));
    const countText = screen.getByTestId('collection-filtered-count').textContent!;
    expect(countText).toMatch(/\d+ cards?/);
  });
});
