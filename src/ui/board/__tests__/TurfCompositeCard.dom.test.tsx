import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { TurfCompositeCard } from '../TurfCompositeCard';
import type {
  Card,
  CurrencyCard,
  DrugCard,
  StackedCard,
  ToughCard,
  Turf,
  WeaponCard,
} from '../../../sim/turf/types';

function tough(overrides: Partial<ToughCard> = {}): ToughCard {
  const base: ToughCard = {
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
    maxHp: 5,
    hp: 5,
  };
  // If override bumps resistance, keep HP in lockstep so v0.3's
  // HP-clamp math doesn't zero the advertised stats.
  if (overrides.resistance !== undefined) {
    base.maxHp = overrides.resistance;
    base.hp = overrides.resistance;
  }
  return { ...base, ...overrides };
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

function stacked(card: Card, faceUp = true): StackedCard {
  return { card, faceUp };
}

function makeTurf(
  cards: Card[] = [],
  id = '0',
  opts: { closedRanks?: boolean; faceUp?: boolean } = {},
): Turf {
  return {
    id,
    closedRanks: opts.closedRanks ?? false,
    stack: cards.map((c) => stacked(c, opts.faceUp ?? true)),
    isActive: true,
    reserveIndex: 0,
  };
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
    // Loyal-stack bonus requires 3+ toughs of the same affiliation (RULES §4).
    // A single tough at power 8 reports 8 — no loyal bonus applies.
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
    const turf: Turf = {
      id: '0',
      closedRanks: false,
      stack: [stacked(t)],
      sickTopIdx: 0,
      isActive: true,
      reserveIndex: 0,
    };
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

  it('shows CLOSED RANKS label on own turf when closedRanks is true', () => {
    const turf = makeTurf([tough()], '0', { closedRanks: true });
    const { container } = render(wrap(<TurfCompositeCard turf={turf} isOwn />));
    expect(container.querySelector('.turf-composite-closed-ranks-badge')).not.toBeNull();
  });

  it('renders a face-down back on opponent turf with hidden top', () => {
    const turf = makeTurf([tough()], '0', { faceUp: false });
    const { container } = render(
      wrap(<TurfCompositeCard turf={turf} isOwn={false} />),
    );
    expect(container.querySelector('.turf-composite-facedown')).not.toBeNull();
    expect(container.querySelector('.turf-composite-back')).not.toBeNull();
  });

  it('reveals opponent turf when top is face-up', () => {
    const turf = makeTurf([tough()], '0', { faceUp: true });
    render(wrap(<TurfCompositeCard turf={turf} isOwn={false} />));
    expect(screen.getByText('Brick Malone')).not.toBeNull();
  });
});
