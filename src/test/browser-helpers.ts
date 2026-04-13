import { userEvent } from 'vitest/browser';

function queryEnabledCards(selector: string): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .filter((button) => !button.disabled);
}

export async function buildValidDeck(): Promise<void> {
  const crewCards = queryEnabledCards('button[data-card-type="crew"]');
  const weaponCards = queryEnabledCards('button[data-card-type="weapon"]');
  const drugCards = queryEnabledCards('button[data-card-type="product"]');
  const cashCards = queryEnabledCards('button[data-card-type="cash"]');

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
