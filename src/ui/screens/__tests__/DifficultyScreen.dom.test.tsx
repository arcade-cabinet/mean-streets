import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { DifficultyScreen } from '../DifficultyScreen';

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('DifficultyScreen', () => {
  it('renders five difficulty tiles', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getByTestId('diff-tile-easy')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-medium')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-hard')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-nightmare')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-ultra-nightmare')).not.toBeNull();
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
    expect(screen.getByText('Even ground, fair fight')).not.toBeNull();
    fireEvent.click(screen.getByTestId('diff-tile-easy'));
    expect(screen.getByText('Loose crew, forgiving block')).not.toBeNull();
  });

  it('calls onSelect with correct config on Start', () => {
    const onSelect = vi.fn();
    render(wrap(<DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-start'));
    expect(onSelect).toHaveBeenCalledOnce();
    const config = onSelect.mock.calls[0][0];
    expect(config.difficulty).toBe('medium');
    expect(config.turfCount).toBeGreaterThan(0);
    expect(config.actionsPerTurn).toBeGreaterThan(0);
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

  it('displays turf count and actions per turn on tiles', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const tile = screen.getByTestId('diff-tile-ultra-nightmare');
    expect(tile.textContent).toMatch(/\d+ turfs? · \d+ act\/turn/);
  });
});
