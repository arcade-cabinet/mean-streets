import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderInBrowser } from '../../../test/render-browser';
import type { ToughCard, ToughInCustody } from '../../../sim/turf/types';
import { HoldingPanel } from '../HoldingPanel';

function makeTough(id: string, name: string): ToughCard {
  return {
    id, name, kind: 'tough', tagline: '', archetype: 'enforcer',
    affiliation: 'freelance', power: 3, resistance: 4,
    hp: 4, maxHp: 4, rarity: 'common', abilities: [],
  };
}

function makeEntry(id: string, name: string, turnsRemaining?: number): ToughInCustody {
  return {
    tough: makeTough(id, name),
    attachedModifiers: [],
    turnsRemaining,
  };
}

describe('HoldingPanel', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders empty custody message', async () => {
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[]} lockup={[]} />,
    )).unmount;

    expect(document.querySelector('[data-testid="holding-panel-A"]')).not.toBeNull();
    expect(document.querySelector('.holding-panel-empty')).not.toBeNull();
  });

  it('renders holding entries with release button', async () => {
    const onRelease = vi.fn();
    const entry = makeEntry('t1', 'Duke');
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[entry]} lockup={[]} onReleaseFromHolding={onRelease} />,
    )).unmount;

    expect(document.querySelector('[data-testid="holding-row-t1"]')).not.toBeNull();
    const releaseBtn = document.querySelector<HTMLButtonElement>('[data-testid="holding-release-t1"]')!;
    expect(releaseBtn).not.toBeNull();

    await userEvent.click(releaseBtn);
    expect(onRelease).toHaveBeenCalledWith('t1');
  });

  it('renders lockup entries with countdown', async () => {
    const entry = makeEntry('t2', 'Vince', 3);
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[]} lockup={[entry]} />,
    )).unmount;

    expect(document.querySelector('[data-testid="holding-row-t2"]')).not.toBeNull();
    const countdown = document.querySelector('[data-testid="lockup-countdown"]');
    expect(countdown).not.toBeNull();
    expect(countdown?.textContent).toBe('3T');
  });

  it('hides release button for opponent side', async () => {
    const entry = makeEntry('t3', 'Rival');
    cleanup = (await renderInBrowser(
      <HoldingPanel side="B" holding={[entry]} lockup={[]} opponent />,
    )).unmount;

    expect(document.querySelector('[data-testid="holding-panel-B"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="holding-release-t3"]')).toBeNull();
  });

  it('shows total count in header', async () => {
    const h1 = makeEntry('t4', 'Alpha');
    const l1 = makeEntry('t5', 'Beta', 2);
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[h1]} lockup={[l1]} />,
    )).unmount;

    const countEl = document.querySelector('.holding-panel-count');
    expect(countEl?.textContent).toBe('2');
  });

  it('displays HP for toughs in custody', async () => {
    const entry = makeEntry('t6', 'Gamma');
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[entry]} lockup={[]} />,
    )).unmount;

    const hpText = document.querySelector('.holding-row-hp')?.textContent ?? '';
    expect(hpText).toContain('4/4');
  });

  it('shows attached modifier count when present', async () => {
    const entry: ToughInCustody = {
      tough: makeTough('t7', 'Delta'),
      attachedModifiers: [
        { id: 'w1', name: 'Blade', kind: 'weapon', category: 'melee', rarity: 'common', power: 1, resistance: 0, abilities: [] },
      ],
    };
    cleanup = (await renderInBrowser(
      <HoldingPanel side="A" holding={[entry]} lockup={[]} />,
    )).unmount;

    const modText = document.querySelector('.holding-row-mods')?.textContent ?? '';
    expect(modText).toContain('+1 mod');
  });
});
