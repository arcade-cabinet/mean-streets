import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurfCompositeCard } from '../TurfCompositeCard';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';
import type { Turf, ToughCard, WeaponCard, DrugCard, CurrencyCard } from '../../../sim/turf/types';

function tough(id: string, name: string, aff = 'kings_row'): ToughCard {
  return {
    kind: 'tough',
    id,
    name,
    tagline: '',
    archetype: 'bruiser',
    affiliation: aff,
    power: 6,
    resistance: 4,
    rarity: 'common',
    abilities: [],
  };
}

function weapon(): WeaponCard {
  return { kind: 'weapon', id: 'weapon-bat', name: 'Bat', category: 'blunt', power: 3, resistance: 1, rarity: 'common', abilities: [] };
}

function drug(): DrugCard {
  return { kind: 'drug', id: 'drug-stim', name: 'Stim', category: 'stimulant', power: 2, resistance: 2, rarity: 'common', abilities: [] };
}

function currency(): CurrencyCard {
  return { kind: 'currency', id: 'currency-100', name: 'Pocket Cash', denomination: 100, rarity: 'common' };
}

describe('TurfCompositeCard (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders empty turf in browser', async () => {
    const turf: Turf = { id: '0', stack: [] };
    cleanup = (await renderInBrowser(<TurfCompositeCard turf={turf} />)).unmount;
    expect(document.querySelector('.turf-composite-empty')).not.toBeNull();
    expect(document.body.textContent).toContain('Empty Turf');
  });

  it('renders populated turf with stats in browser', async () => {
    const turf: Turf = { id: '1', stack: [tough('t1', 'Alpha'), weapon(), drug(), currency()] };
    cleanup = (await renderInBrowser(<TurfCompositeCard turf={turf} />)).unmount;
    expect(document.querySelector('[data-testid="turf-composite-1"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Alpha');
    expect(document.querySelector('.turf-composite-mod-weapon')).not.toBeNull();
    expect(document.querySelector('.turf-composite-mod-drug')).not.toBeNull();
  });

  it('shows affiliation symbols for multi-affiliation turfs', async () => {
    const turf: Turf = {
      id: '2',
      stack: [tough('t1', 'Alpha', 'kings_row'), tough('t2', 'Bravo', 'iron_devils')],
    };
    cleanup = (await renderInBrowser(<TurfCompositeCard turf={turf} />)).unmount;
    const symbols = document.querySelectorAll('.turf-composite-affiliations .affiliation-symbol');
    expect(symbols.length).toBe(2);
  });

  it('fires click handler', async () => {
    const handler = vi.fn();
    const turf: Turf = { id: '3', stack: [tough('t1', 'Alpha')] };
    cleanup = (await renderInBrowser(<TurfCompositeCard turf={turf} onClick={handler} />)).unmount;
    const el = document.querySelector<HTMLElement>('[data-testid="turf-composite-3"]')!;
    el.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('renders compact layout on phone viewport', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });
    const turf: Turf = { id: '4', stack: [tough('t1', 'Alpha')] };
    cleanup = (await renderInBrowser(<TurfCompositeCard turf={turf} compact />)).unmount;
    await settleBrowser();
    expect(document.querySelector('.turf-composite-compact')).not.toBeNull();
  });
});
