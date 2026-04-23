import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import {
  loadPackOpeningFixtureCards,
  PackOpeningScreen,
} from '../PackOpeningScreen';

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

/** Render the screen and wait for the async pack-generation effect to settle. */
async function renderAndWait(ui: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(wrap(ui));
  });
  // @ts-expect-error — result is assigned inside act but TS doesn't track that
  return result;
}

describe('PackOpeningScreen', () => {
  it('renders in sealed phase initially', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('pack-opening-screen')).not.toBeNull();
    expect(screen.getByTestId('pack-open-btn')).not.toBeNull();
    expect(screen.getByText('Tap to Crack')).not.toBeNull();
    expect(screen.getByText('Case File')).not.toBeNull();
    expect(screen.getByText('Unbroken')).not.toBeNull();
  });

  it('has accessible labels on sealed phase', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('pack-open-btn').getAttribute('aria-label')).toBe(
      'Crack open reward drop',
    );
  });

  it('transitions to revealing phase on pack open click', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    expect(screen.getByTestId('pack-reveal-card-0')).not.toBeNull();
    expect(screen.getByText(/Pull 1 \//)).not.toBeNull();
    expect(screen.getByText('Evidence 1')).not.toBeNull();
    expect(screen.getByText(/fresh lead|filed piece/i)).not.toBeNull();
    expect(screen.getByLabelText('Reveal next card')).not.toBeNull();
  });

  it('shows progress pips in revealing phase', async () => {
    const { container } = await renderAndWait(
      <PackOpeningScreen onBack={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    const pips = container.querySelectorAll('.pack-pip');
    expect(pips.length).toBe(5);
    expect(pips[0].classList.contains('pack-pip-current')).toBe(true);
  });

  it('advances to next card on reveal stage click', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    expect(screen.getByText(/Pull 1 \//)).not.toBeNull();
    fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    expect(screen.getByText(/Pull 2 \//)).not.toBeNull();
  });

  it('transitions to summary phase after all cards revealed', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('pack-summary-grid')).not.toBeNull(),
    );
    expect(screen.getByText('Street Spoils')).not.toBeNull();
    expect(screen.getByText('Evidence Table')).not.toBeNull();
    expect(screen.getByText(/Bag 1/)).not.toBeNull();
  });

  it('shows summary stats in summary phase', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('pack-summary-stats')).not.toBeNull(),
    );
  });

  it('shows 5 cards in summary grid', async () => {
    const { container } = await renderAndWait(
      <PackOpeningScreen onBack={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    await waitFor(() => {
      const cells = container.querySelectorAll('.pack-summary-cell');
      expect(cells.length).toBe(5);
    });
  });

  it('calls onBack from sealed phase via back button', async () => {
    const onBack = vi.fn();
    await renderAndWait(<PackOpeningScreen onBack={onBack} />);
    fireEvent.click(screen.getByTestId('pack-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onBack from summary phase via Done button', async () => {
    const onBack = vi.fn();
    await renderAndWait(<PackOpeningScreen onBack={onBack} />);
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('pack-done-btn')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('pack-done-btn'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('responds to keyboard events to open and advance', async () => {
    await renderAndWait(<PackOpeningScreen onBack={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('pack-reveal-card-0')).not.toBeNull();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText(/Pull 2 \//)).not.toBeNull();
  });

  it('responds to Escape key to go back', async () => {
    const onBack = vi.fn();
    await renderAndWait(<PackOpeningScreen onBack={onBack} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('uses supplied owned card ids instead of reading persistence', async () => {
    const cards = loadPackOpeningFixtureCards();
    await renderAndWait(
      <PackOpeningScreen
        cards={cards}
        ownedCardIds={cards.slice(0, 2).map((card) => card.id)}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('pack-open-btn'));
    for (let i = 0; i < cards.length; i++) {
      fireEvent.click(screen.getByTestId('pack-reveal-stage'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('pack-summary-grid')).not.toBeNull(),
    );
    expect(screen.getAllByText('NEW')).toHaveLength(cards.length - 2);
  });

  it('supports visual fixture entry points for reveal and summary phases', async () => {
    const cards = loadPackOpeningFixtureCards();
    const { unmount } = await renderAndWait(
      <PackOpeningScreen
        cards={cards}
        initialPhase="revealing"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('pack-reveal-stage')).not.toBeNull();
    expect(screen.getByText(/Pull 1 \//)).not.toBeNull();
    unmount();

    await renderAndWait(
      <PackOpeningScreen
        cards={cards}
        initialPhase="summary"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('pack-summary-grid')).not.toBeNull();
    expect(screen.getByText('Street Spoils')).not.toBeNull();
  });
});
