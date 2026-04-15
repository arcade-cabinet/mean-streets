import { afterEach, describe, expect, it, vi } from 'vitest';
import { StackFanModal } from '../StackFanModal';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import type { Turf, ToughCard, WeaponCard } from '../../../sim/turf/types';

function tough(id: string, name: string): ToughCard {
  return {
    kind: 'tough',
    id,
    name,
    tagline: '',
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 5,
    resistance: 4,
    rarity: 'common',
    abilities: [],
  };
}

function weapon(): WeaponCard {
  return { kind: 'weapon', id: 'weapon-bat', name: 'Bat', category: 'blunt', power: 3, resistance: 1, rarity: 'common', abilities: [] };
}

function makeTurf(): Turf {
  return {
    id: 'fan',
    stack: [tough('t1', 'Alpha'), weapon(), tough('t2', 'Bravo')],
  };
}

describe('StackFanModal (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders modal dialog when open', async () => {
    cleanup = (await renderInBrowser(
      <StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />,
    )).unmount;

    expect(document.querySelector('[data-testid="stack-fan-fan"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Stack (3 cards)');
  });

  it('shows card count and navigation', async () => {
    cleanup = (await renderInBrowser(
      <StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />,
    )).unmount;

    expect(document.body.textContent).toContain('3 / 3');
    const pips = document.querySelectorAll('.stack-fan-pip');
    expect(pips.length).toBe(3);
  });

  it('navigates via keyboard arrows', async () => {
    cleanup = (await renderInBrowser(
      <StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />,
    )).unmount;
    await settleBrowser();

    expect(document.body.textContent).toContain('3 / 3');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settleBrowser();
    expect(document.body.textContent).toContain('2 / 3');
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    cleanup = (await renderInBrowser(
      <StackFanModal turf={makeTurf()} open={true} onClose={onClose} />,
    )).unmount;
    await settleBrowser();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    cleanup = (await renderInBrowser(
      <StackFanModal turf={makeTurf()} open={true} onClose={onClose} />,
    )).unmount;

    const backdrop = document.querySelector<HTMLElement>('.stack-fan-backdrop')!;
    backdrop.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
