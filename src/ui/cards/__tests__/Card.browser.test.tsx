import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '../Card';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';
import type { ToughCard, WeaponCard, DrugCard, CurrencyCard } from '../../../sim/turf/types';

function tough(overrides: Partial<ToughCard> = {}): ToughCard {
  return {
    kind: 'tough',
    id: 'tough-brick',
    name: 'Brick Malone',
    tagline: 'Built different.',
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 7,
    resistance: 5,
    rarity: 'common',
    abilities: ['Ignores precision attacks'],
    ...overrides,
  };
}

function weapon(): WeaponCard {
  return {
    kind: 'weapon',
    id: 'weapon-knife',
    name: 'Switchblade',
    category: 'bladed',
    power: 4,
    resistance: 1,
    rarity: 'rare',
    abilities: [],
  };
}

function drug(): DrugCard {
  return {
    kind: 'drug',
    id: 'drug-stim',
    name: 'Velvet Static',
    category: 'stimulant',
    power: 2,
    resistance: 3,
    rarity: 'common',
    abilities: [],
  };
}

function currency(): CurrencyCard {
  return {
    kind: 'currency',
    id: 'currency-1000',
    name: 'Grand Stack',
    denomination: 1000,
    rarity: 'rare',
  };
}

describe('Card (browser)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('renders a tough card in the real DOM', async () => {
    cleanup = (await renderInBrowser(<Card card={tough()} />)).unmount;
    const el = document.querySelector('[data-testid="card-tough-brick"]');
    expect(el).not.toBeNull();
    expect(document.body.textContent).toContain('Brick Malone');
  });

  it('renders all four card kinds', async () => {
    cleanup = (await renderInBrowser(
      <>
        <Card card={tough()} />
        <Card card={weapon()} />
        <Card card={drug()} />
        <Card card={currency()} />
      </>,
    )).unmount;

    expect(document.querySelector('[data-testid="card-tough-brick"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="card-weapon-knife"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="card-drug-stim"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="card-currency-1000"]')).not.toBeNull();
  });

  it('applies rarity CSS class in the browser', async () => {
    cleanup = (await renderInBrowser(<Card card={tough({ rarity: 'legendary' })} />)).unmount;
    expect(document.querySelector('.card-rarity-legendary')).not.toBeNull();
  });

  it('uses compact layout on phone-portrait viewport', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });
    cleanup = (await renderInBrowser(<Card card={tough()} />)).unmount;
    await settleBrowser();
    expect(document.querySelector('.card-shell-compact')).not.toBeNull();
  });

  it('renders affiliation symbol in tough card', async () => {
    cleanup = (await renderInBrowser(<Card card={tough()} />)).unmount;
    expect(document.querySelector('.affiliation-symbol')).not.toBeNull();
  });

  it('renders CardFrame SVG inside the card', async () => {
    cleanup = (await renderInBrowser(<Card card={tough()} />)).unmount;
    expect(document.querySelector('.card-frame-svg')).not.toBeNull();
  });
});
