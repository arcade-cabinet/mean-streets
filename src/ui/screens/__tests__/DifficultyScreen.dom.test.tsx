import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { DifficultyScreen } from '../DifficultyScreen';

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('DifficultyScreen', () => {
  it('renders all six difficulty tiles', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    expect(screen.getByTestId('diff-tile-easy')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-medium')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-hard')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-nightmare')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-sudden-death')).not.toBeNull();
    expect(screen.getByTestId('diff-tile-ultra-nightmare')).not.toBeNull();
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
    expect(screen.getByText('Balanced fight')).not.toBeNull();
    fireEvent.click(screen.getByTestId('diff-tile-easy'));
    expect(screen.getByText('Loose AI, forgiving board')).not.toBeNull();
  });

  it('forces sudden death checkbox when sudden-death tier is selected', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const sd = screen.getByTestId('diff-sudden-death') as HTMLInputElement;
    expect(sd.checked).toBe(false);
    expect(sd.disabled).toBe(false);

    fireEvent.click(screen.getByTestId('diff-tile-sudden-death'));
    expect(sd.checked).toBe(true);
    expect(sd.disabled).toBe(true);
  });

  it('forces sudden death for ultra-nightmare tier', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-tile-ultra-nightmare'));
    const sd = screen.getByTestId('diff-sudden-death') as HTMLInputElement;
    expect(sd.checked).toBe(true);
    expect(sd.disabled).toBe(true);
  });

  it('allows toggling sudden death on non-forced tiers', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const sd = screen.getByTestId('diff-sudden-death') as HTMLInputElement;
    expect(sd.checked).toBe(false);
    fireEvent.click(sd);
    expect(sd.checked).toBe(true);
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

  it('calls onSelect with sudden death enabled when toggled', () => {
    const onSelect = vi.fn();
    render(wrap(<DifficultyScreen onSelect={onSelect} onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('diff-sudden-death'));
    fireEvent.click(screen.getByTestId('diff-start'));
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

  it('displays turf count and actions per turn on tiles', () => {
    render(wrap(<DifficultyScreen onSelect={vi.fn()} onBack={vi.fn()} />));
    const sdTile = screen.getByTestId('diff-tile-sudden-death');
    expect(sdTile.textContent).toContain('1 turf');
  });
});
