import { userEvent } from 'vitest/browser';

/**
 * Click the next N enabled, unselected cards matching `selector`, re-querying
 * the DOM between clicks. The collection re-renders between clicks (selected
 * cards pick up the `deck-card-selected` class) so the initial NodeList goes
 * stale quickly; re-querying each iteration avoids clicking detached nodes
 * and skips ones that are already selected.
 */
async function clickN(selector: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const next = Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
      .find((button) => !button.disabled && !button.classList.contains('deck-card-selected'));
    if (!next) return;
    await userEvent.click(next);
  }
}

export async function buildValidDeck(): Promise<void> {
  await clickN('button[data-card-type="crew"]', 25);
  await clickN('button[data-card-type="weapon"]', 19);
  await clickN('button[data-card-type="product"]', 3);
  await clickN('button[data-card-type="cash"]', 3);
}
