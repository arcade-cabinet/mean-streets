import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { PackOpeningScreen } from '../PackOpeningScreen';

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('PackOpeningScreen', () => {
  it('renders in sealed phase initially', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('pack-opening-screen')).not.toBeNull();
    expect(screen.getByTestId('pack-open-btn')).not.toBeNull();
    expect(screen.getByText('Tap to Open')).not.toBeNull();
  });

  it('has accessible labels on sealed phase', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    expect(screen.getByTestId('pack-open-btn').getAttribute('aria-label')).toBe('Open pack');
  });

  it('transitions to revealing phase on pack open click', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    expect(screen.getByTestId('pack-reveal-card-0')).not.toBeNull();
    expect(screen.getByText(/Card 1 \//)).not.toBeNull();
  });

  it('shows progress pips in revealing phase', () => {
    const { container } = render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    const pips = container.querySelectorAll('.pack-pip');
    expect(pips.length).toBe(5);
    expect(pips[0].classList.contains('pack-pip-current')).toBe(true);
  });

  it('advances to next card on reveal stage click', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    expect(screen.getByText(/Card 1 \//)).not.toBeNull();
    fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    expect(screen.getByText(/Card 2 \//)).not.toBeNull();
  });

  it('transitions to summary phase after all cards revealed', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    expect(screen.getByTestId('pack-summary-grid')).not.toBeNull();
    expect(screen.getByText('Pack Contents')).not.toBeNull();
  });

  it('shows summary stats in summary phase', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    expect(screen.getByTestId('pack-summary-stats')).not.toBeNull();
  });

  it('shows 5 cards in summary grid', () => {
    const { container } = render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    const cells = container.querySelectorAll('.pack-summary-cell');
    expect(cells.length).toBe(5);
  });

  it('calls onBack from sealed phase via back button', () => {
    const onBack = vi.fn();
    render(wrap(<PackOpeningScreen onBack={onBack} />));
    fireEvent.click(screen.getByTestId('pack-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onBack from summary phase via Done button', () => {
    const onBack = vi.fn();
    render(wrap(<PackOpeningScreen onBack={onBack} />));
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    fireEvent.click(screen.getByTestId('pack-done-btn'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('responds to keyboard events to open and advance', () => {
    render(wrap(<PackOpeningScreen onBack={vi.fn()} />));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('pack-reveal-card-0')).not.toBeNull();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText(/Card 2 \//)).not.toBeNull();
  });

  it('responds to Escape key to go back', () => {
    const onBack = vi.fn();
    render(wrap(<PackOpeningScreen onBack={onBack} />));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });
});
