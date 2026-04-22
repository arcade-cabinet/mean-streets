import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { DifficultyScreen } from '../DifficultyScreen';

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('DifficultyScreen', () => {
  it('renders five difficulty tiles plus permadeath switch', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getByTestId('diff-tile-easy')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-medium')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-hard')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-nightmare')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-ultra-nightmare')).not.toBeNull();
    expect(screen.getByTestId('diff-permadeath')).not.toBeNull();
    expect(screen.queryByTestId('diff-tile-sudden-death')).toBeNull();
  });

  it('defaults to medium selected', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getByTestId('diff-tile-medium').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('diff-tile-easy').getAttribute('aria-checked')).toBe('false');
  });

  it('selects a tier on click', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-tile-hard'));
    expect(screen.getByTestId('diff-tile-hard').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('diff-tile-medium').getAttribute('aria-checked')).toBe('false');
  });

  it('shows tagline for selected tier', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getAllByText('Clean rules. Dirty hands.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('diff-tile-easy'));
    expect(screen.getAllByText('The street lets you make one more mistake.').length).toBeGreaterThan(0);
  });

  it('calls onSelect with correct config on Start', () => {
    const onSelect = vi.fn();
    render(wrap(<DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-start'));
    expect(onSelect).toHaveBeenCalledOnce();
    const config = onSelect.mock.calls[0][0];
    expect(config.difficulty).toBe('medium');
    expect(config.suddenDeath).toBe(false);
    expect(config.turfCount).toBeGreaterThan(0);
    expect(config.actionsPerTurn).toBeGreaterThan(0);
  });

  it('permits permadeath on non-ultra tiers', () => {
    const onSelect = vi.fn();
    render(wrap(<DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-permadeath'));
    expect(screen.getByTestId('diff-permadeath').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('diff-permadeath-warning')).not.toBeNull();

    fireEvent.click(screen.getByTestId('diff-start'));

    expect(onSelect.mock.calls[0][0].difficulty).toBe('medium');
    expect(onSelect.mock.calls[0][0].suddenDeath).toBe(true);
  });

  it('forces permadeath on ultra nightmare', () => {
    const onSelect = vi.fn();
    render(wrap(<DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-tile-ultra-nightmare'));

    expect(screen.getByTestId('diff-permadeath').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('diff-permadeath').getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByTestId('diff-start'));

    expect(onSelect.mock.calls[0][0].difficulty).toBe('ultra-nightmare');
    expect(onSelect.mock.calls[0][0].suddenDeath).toBe(true);
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={onBack} />));
    fireEvent.click(screen.getByTestId('diff-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('has radiogroup role on the grid', () => {
    const { container } = render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it('tiles have radio role', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getByTestId('diff-tile-easy').getAttribute('role')).toBe('radio');
  });

  it('displays authored branded copy on tiles', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const tile = screen.getByTestId('diff-tile-ultra-nightmare');
    expect(tile.textContent).toContain('No Dawn');
    expect(tile.textContent).toContain('funeral song');
  });

  it('uses generated silhouette-factory iconography', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const image = screen.getByTestId('diff-tile-medium').querySelector('img');
    expect(image?.getAttribute('src')).toContain('assets/ui/silhouette-icons/difficulty-street-code.png');
  });
});
