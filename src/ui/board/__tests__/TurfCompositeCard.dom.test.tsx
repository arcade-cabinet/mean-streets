import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { TurfCompositeCard } from '../TurfCompositeCard';
import type { Turf, ToughCard, WeaponCard, DrugCard, CurrencyCard } from '../../../sim/turf/types';

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
    abilities: [],
    ...overrides,
  };
}

function weapon(): WeaponCard {
  return {
    kind: 'weapon',
    id: 'weapon-knife',
    name: 'Knife',
    category: 'bladed',
    power: 3,
    resistance: 1,
    rarity: 'common',
    abilities: [],
  };
}

function drug(): DrugCard {
  return {
    kind: 'drug',
    id: 'drug-stim',
    name: 'Stim',
    category: 'stimulant',
    power: 2,
    resistance: 2,
    rarity: 'common',
    abilities: [],
  };
}

function currency(denomination: 100 | 1000 = 100): CurrencyCard {
  return {
    kind: 'currency',
    id: `currency-${denomination}`,
    name: denomination === 1000 ? 'Grand Stack' : 'Pocket Cash',
    denomination,
    rarity: denomination === 1000 ? 'rare' : 'common',
  };
}

function makeTurf(stack: (ToughCard | WeaponCard | DrugCard | CurrencyCard)[] = [], id = '0'): Turf {
  return { id, stack };
}

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('TurfCompositeCard', () => {
  it('renders empty state with correct label', () => {
    render(wrap(<TurfCompositeCard turf={makeTurf()} />));
    expect(screen.getByText('Empty Turf')).not.toBeNull();
    expect(screen.getByTestId('turf-composite-0')).not.toBeNull();
  });

  it('renders empty turf with slot frame', () => {
    const { container } = render(wrap(<TurfCompositeCard turf={makeTurf()} />));
    expect(container.querySelector('.turf-composite-empty')).not.toBeNull();
  });

  it('renders populated turf with tough name and stats', () => {
    const t = tough();
    render(wrap(<TurfCompositeCard turf={makeTurf([t])} />));
    expect(screen.getByText('Brick Malone')).not.toBeNull();
    expect(screen.getByTestId('turf-composite-0')).not.toBeNull();
  });

  it('displays power and resistance badges', () => {
    const turf = makeTurf([tough({ power: 8, resistance: 6 })]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    expect(container.querySelector('.turf-composite-power-badge')!.textContent).toBe('8');
    expect(container.querySelector('.turf-composite-resistance-badge')!.textContent).toBe('6');
  });

  it('shows modifier summary tags', () => {
    const turf = makeTurf([tough(), weapon(), drug(), currency()]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    expect(container.querySelector('.turf-composite-mod-weapon')!.textContent).toBe('1 wpn');
    expect(container.querySelector('.turf-composite-mod-drug')!.textContent).toBe('1 drg');
    expect(container.querySelector('.turf-composite-mod-cash')!.textContent).toBe('$100');
  });

  it('shows stack size badge', () => {
    const turf = makeTurf([tough(), weapon(), drug()]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    expect(container.querySelector('.turf-composite-stack-badge')!.textContent).toBe('3');
  });

  it('applies best rarity class from toughs', () => {
    const turf = makeTurf([
      tough({ id: 'tough-a', rarity: 'common' }),
      tough({ id: 'tough-b', rarity: 'rare', affiliation: 'iron_devils' }),
    ]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    expect(container.querySelector('.card-rarity-rare')).not.toBeNull();
  });

  it('shows SICK badge when sickTopIdx is set', () => {
    const t = tough();
    const turf: Turf = { id: '0', stack: [t], sickTopIdx: 0 };
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    expect(container.querySelector('.turf-composite-sick-badge')).not.toBeNull();
  });

  it('shows extra roster count when multiple toughs', () => {
    const turf = makeTurf([
      tough({ id: 'tough-a' }),
      tough({ id: 'tough-b', name: 'Vex', affiliation: 'iron_devils' }),
      tough({ id: 'tough-c', name: 'Nico', affiliation: 'jade_dragon' }),
    ]);
    render(wrap(<TurfCompositeCard turf={turf} compact />));
    expect(screen.getByText('+2')).not.toBeNull();
  });

  it('compact mode applies compact class', () => {
    const turf = makeTurf([tough()]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} compact />));
    expect(container.querySelector('.turf-composite-compact')).not.toBeNull();
  });

  it('calls onClick when clicked', () => {
    const handler = vi.fn();
    const turf = makeTurf([tough()]);
    render(wrap(<TurfCompositeCard turf={turf} onClick={handler} />));
    fireEvent.click(screen.getByTestId('turf-composite-0'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports keyboard activation via Enter', () => {
    const handler = vi.fn();
    const turf = makeTurf([tough()]);
    render(wrap(<TurfCompositeCard turf={turf} onClick={handler} />));
    fireEvent.keyDown(screen.getByTestId('turf-composite-0'), { key: 'Enter' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('has button role when onClick is provided', () => {
    const turf = makeTurf([tough()]);
    render(wrap(<TurfCompositeCard turf={turf} onClick={() => {}} />));
    expect(screen.getByTestId('turf-composite-0').getAttribute('role')).toBe('button');
  });

  it('has no button role when onClick is absent', () => {
    const turf = makeTurf([tough()]);
    render(wrap(<TurfCompositeCard turf={turf} />));
    expect(screen.getByTestId('turf-composite-0').getAttribute('role')).toBeNull();
  });

  it('shows affiliation symbols for all unique affiliations', () => {
    const turf = makeTurf([
      tough({ id: 'tough-a', affiliation: 'kings_row' }),
      tough({ id: 'tough-b', affiliation: 'iron_devils' }),
    ]);
    const { container } = render(wrap(<TurfCompositeCard turf={turf} />));
    const symbols = container.querySelectorAll('.turf-composite-affiliations .affiliation-symbol');
    expect(symbols.length).toBe(2);
  });
});
