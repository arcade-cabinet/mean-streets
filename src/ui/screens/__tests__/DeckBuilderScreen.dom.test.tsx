import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { DeckBuilderScreen } from '../DeckBuilderScreen';

async function buildLegalDeck() {
  const crewCards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-card-type="crew"]:not([disabled])'));
  const weaponCards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-card-type="weapon"]:not([disabled])'));
  const drugCards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-card-type="product"]:not([disabled])'));
  const cashCards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-card-type="cash"]:not([disabled])'));

  for (const card of crewCards.slice(0, 25)) {
    await userEvent.click(card);
  }

  for (const card of [
    ...weaponCards.slice(0, 19),
    ...drugCards.slice(0, 3),
    ...cashCards.slice(0, 3),
  ]) {
    await userEvent.click(card);
  }
}

describe('DeckBuilderScreen', () => {
  it('shows the documented modifier minimums and enables start only for legal decks', async () => {
    render(
      <AppShellProvider>
        <DeckBuilderScreen onBack={vi.fn()} onStartGame={vi.fn()} />
      </AppShellProvider>,
    );

    const startButton = screen.getByTestId('start-game-button') as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
    expect(screen.getByTestId('modifier-rule-weapons').textContent).toContain('Weapons 0/3');
    expect(screen.getByTestId('modifier-rule-drugs').textContent).toContain('Drugs 0/3');
    expect(screen.getByTestId('modifier-rule-cash').textContent).toContain('Cash 0/3');

    await buildLegalDeck();

    expect(screen.getByTestId('modifier-rule-weapons').textContent).toContain('Weapons 19/3');
    expect(screen.getByTestId('modifier-rule-drugs').textContent).toContain('Drugs 3/3');
    expect(screen.getByTestId('modifier-rule-cash').textContent).toContain('Cash 3/3');
    expect(startButton.disabled).toBe(false);
  });
});
