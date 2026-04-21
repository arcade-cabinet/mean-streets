import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { Card } from '../Card';
import type {
  ToughCard,
  WeaponCard,
  DrugCard,
  CurrencyCard,
} from '../../../sim/turf/types';

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

function weapon(overrides: Partial<WeaponCard> = {}): WeaponCard {
  return {
    kind: 'weapon',
    id: 'weapon-switchblade',
    name: 'Switchblade',
    category: 'bladed',
    power: 4,
    resistance: 1,
    rarity: 'rare',
    abilities: ['LACERATE: Bleed the target'],
    ...overrides,
  };
}

function drug(overrides: Partial<DrugCard> = {}): DrugCard {
  return {
    kind: 'drug',
    id: 'drug-velvet',
    name: 'Velvet Static',
    category: 'stimulant',
    power: 2,
    resistance: 3,
    rarity: 'common',
    abilities: ['SUPPRESS: Lower enemy power'],
    ...overrides,
  };
}

function currency(denomination: 100 | 1000): CurrencyCard {
  return {
    kind: 'currency',
    id: `currency-${denomination}`,
    name: denomination === 1000 ? 'Grand Stack' : 'Pocket Cash',
    denomination,
    rarity: denomination === 1000 ? 'rare' : 'common',
  };
}

describe('Card', () => {
  it('renders a tough card with name, power, and resistance', () => {
    render(
      <AppShellProvider>
        <Card card={tough()} />
      </AppShellProvider>,
    );
    expect(screen.getByTestId('card-tough-brick')).not.toBeNull();
    expect(screen.getByText('Brick Malone')).not.toBeNull();
    expect(screen.getByText('7')).not.toBeNull();
    expect(screen.getByText('5')).not.toBeNull();
  });

  it('renders a weapon card with category and power/resistance', () => {
    render(
      <AppShellProvider>
        <Card card={weapon()} />
      </AppShellProvider>,
    );
    expect(screen.getByTestId('card-weapon-switchblade')).not.toBeNull();
    expect(screen.getByText('Switchblade')).not.toBeNull();
    expect(screen.getByText('bladed')).not.toBeNull();
  });

  it('renders a drug card with category', () => {
    render(
      <AppShellProvider>
        <Card card={drug()} />
      </AppShellProvider>,
    );
    expect(screen.getByTestId('card-drug-velvet')).not.toBeNull();
    expect(screen.getByText('Velvet Static')).not.toBeNull();
    expect(screen.getByText('stimulant')).not.toBeNull();
  });

  it('renders a currency card with denomination', () => {
    const { container } = render(
      <AppShellProvider>
        <Card card={currency(1000)} />
      </AppShellProvider>,
    );
    expect(screen.getByTestId('card-currency-1000')).not.toBeNull();
    expect(screen.getByText('$1,000')).not.toBeNull();
    expect(
      container.querySelector('.card-portrait-currency .card-portrait-img'),
    ).not.toBeNull();
  });

  it('applies rarity CSS classes', () => {
    const { container: c1 } = render(
      <AppShellProvider>
        <Card card={tough({ rarity: 'common' })} />
      </AppShellProvider>,
    );
    expect(c1.querySelector('.card-rarity-common')).not.toBeNull();

    const { container: c2 } = render(
      <AppShellProvider>
        <Card card={tough({ id: 'tough-rare', rarity: 'rare' })} />
      </AppShellProvider>,
    );
    expect(c2.querySelector('.card-rarity-rare')).not.toBeNull();

    const { container: c3 } = render(
      <AppShellProvider>
        <Card card={tough({ id: 'tough-legend', rarity: 'legendary' })} />
      </AppShellProvider>,
    );
    expect(c3.querySelector('.card-rarity-legendary')).not.toBeNull();
  });

  it('renders rarity badge with correct initial', () => {
    render(
      <AppShellProvider>
        <Card card={tough({ rarity: 'legendary' })} />
      </AppShellProvider>,
    );
    expect(screen.getByText('L')).not.toBeNull();
  });

  it('renders in compact mode when forced', () => {
    const { container } = render(
      <AppShellProvider>
        <Card card={tough()} compact />
      </AppShellProvider>,
    );
    expect(container.querySelector('.card-shell-compact')).not.toBeNull();
  });

  it('renders $100 currency correctly', () => {
    render(
      <AppShellProvider>
        <Card card={currency(100)} />
      </AppShellProvider>,
    );
    expect(screen.getByText('$100')).not.toBeNull();
  });

  it('exposes rarity metadata and MythicBadge for mythic cards', () => {
    render(
      <AppShellProvider>
        <Card
          card={tough({
            id: 'mythic-01',
            name: 'The Silhouette',
            rarity: 'mythic',
            affiliation: 'freelance',
          })}
        />
      </AppShellProvider>,
    );
    expect(screen.getByTestId('card-mythic-01').getAttribute('data-rarity')).toBe(
      'mythic',
    );
    expect(screen.getByTestId('mythic-badge')).not.toBeNull();
  });
});
