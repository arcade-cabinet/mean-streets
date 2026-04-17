import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import type { ModifierCard } from '../../../sim/turf/types';
import { BlackMarketPanel } from '../BlackMarketPanel';

const WEAPON: ModifierCard = {
  id: 'weapon-test-1', name: 'Test Knife', kind: 'weapon',
  category: 'melee', rarity: 'common', power: 2, resistance: 0, abilities: [],
};

const DRUG: ModifierCard = {
  id: 'drug-test-1', name: 'Test Stim', kind: 'drug',
  category: 'stimulant', rarity: 'uncommon', power: 0, resistance: 3, abilities: [],
};

function makePool(): ModifierCard[] {
  return [WEAPON, DRUG];
}

describe('BlackMarketPanel', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders panel with pool cards', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    expect(document.querySelector('[data-testid="black-market-panel-A"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="black-market-pool"]')).not.toBeNull();
    expect(document.querySelector(`[data-testid="black-market-cell-${WEAPON.id}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-testid="black-market-cell-${DRUG.id}"]`)).not.toBeNull();
  });

  it('shows empty message when pool is empty', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={[]} side="A" />,
    )).unmount;

    expect(document.querySelector('.black-market-empty')).not.toBeNull();
  });

  it('toggles selection on card click', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    const cell = document.querySelector<HTMLButtonElement>(`[data-testid="black-market-cell-${WEAPON.id}"]`)!;
    expect(cell.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(cell);
    await settleBrowser();

    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(cell.classList.contains('black-market-cell-selected')).toBe(true);
  });

  it('rarity radio buttons switch target', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    const legendaryBtn = document.querySelector<HTMLButtonElement>('[data-testid="black-market-rarity-legendary"]')!;
    await userEvent.click(legendaryBtn);
    await settleBrowser();

    expect(legendaryBtn.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[data-testid="black-market-rarity-uncommon"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('trade button disabled when nothing selected', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    const tradeBtn = document.querySelector<HTMLButtonElement>('[data-testid="black-market-trade-btn"]')!;
    expect(tradeBtn.disabled).toBe(true);
  });

  it('trade callback fires with selected ids and target rarity', async () => {
    const onTrade = vi.fn();
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" onTrade={onTrade} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>(`[data-testid="black-market-cell-${WEAPON.id}"]`)!);
    await settleBrowser();

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="black-market-trade-btn"]')!);
    expect(onTrade).toHaveBeenCalledWith([WEAPON.id], 'rare');
  });

  it('heal button disabled without healTargetName', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    const healBtn = document.querySelector<HTMLButtonElement>('[data-testid="black-market-heal-btn"]')!;
    expect(healBtn.disabled).toBe(true);
  });

  it('heal button enabled when healTargetName provided and card selected', async () => {
    const onHeal = vi.fn();
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" onHeal={onHeal} healTargetName="Test Tough" />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>(`[data-testid="black-market-cell-${DRUG.id}"]`)!);
    await settleBrowser();

    const healBtn = document.querySelector<HTMLButtonElement>('[data-testid="black-market-heal-btn"]')!;
    expect(healBtn.disabled).toBe(false);
    expect(healBtn.textContent).toContain('Test Tough');

    await userEvent.click(healBtn);
    expect(onHeal).toHaveBeenCalledWith([DRUG.id]);
  });

  it('clear button resets selection', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>(`[data-testid="black-market-cell-${WEAPON.id}"]`)!);
    await settleBrowser();

    expect(document.querySelector('[data-testid="black-market-clear-btn"]')).not.toBeNull();
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="black-market-clear-btn"]')!);
    await settleBrowser();

    const cell = document.querySelector<HTMLButtonElement>(`[data-testid="black-market-cell-${WEAPON.id}"]`)!;
    expect(cell.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders as modal when modal=true', async () => {
    cleanup = (await renderInBrowser(
      <BlackMarketPanel pool={makePool()} side="A" modal />,
    )).unmount;

    expect(document.querySelector('[data-testid="black-market-modal-A"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="black-market-panel-A"]')).toBeNull();
  });
});
