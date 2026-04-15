import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BackpackRail, type PackedBackpackDraft } from './BackpackRail';
import type { ModifierCard } from '../../sim/turf/types';

function makePack(id: string, slots: Array<string | null>): PackedBackpackDraft {
  return {
    id,
    slots: slots.map((cardId) => ({ cardId })),
  };
}

function cardIndex(): Map<string, ModifierCard> {
  const m = new Map<string, ModifierCard>();
  m.set('weap-1', {
    type: 'weapon',
    id: 'weap-1',
    name: 'Bowie Knife',
    category: 'bladed',
    bonus: 2,
    offenseAbility: 'LACERATE',
    offenseAbilityText: '',
    defenseAbility: 'PARRY',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  });
  m.set('drug-1', {
    type: 'product',
    id: 'drug-1',
    name: 'Hyper',
    category: 'stimulant',
    potency: 2,
    offenseAbility: 'RUSH',
    offenseAbilityText: '',
    defenseAbility: 'REFLEXES',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  });
  m.set('cash-100', { type: 'cash', id: 'cash-100', denomination: 100 });
  return m;
}

beforeEach(() => {
  cleanup();
  delete window.__MEAN_STREETS_ARMED_CARD__;
});

describe('<BackpackRail />', () => {
  it('renders N empty packs with 4 slots each', () => {
    render(
      <BackpackRail
        packs={[makePack('pack-1', [null, null, null, null]), makePack('pack-2', [null, null, null, null])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={25}
      />,
    );

    expect(screen.getByTestId('backpack-rail')).toBeTruthy();
    expect(screen.getByTestId('backpack-rail-pack-0')).toBeTruthy();
    expect(screen.getByTestId('backpack-rail-pack-1')).toBeTruthy();
    for (let p = 0; p < 2; p++) {
      for (let s = 0; s < 4; s++) {
        expect(screen.getByTestId(`backpack-slot-${p}-${s}`)).toBeTruthy();
      }
    }
  });

  it('displays card text + fill level data attribute on a partial pack', () => {
    render(
      <BackpackRail
        packs={[makePack('pack-1', ['weap-1', 'drug-1', null, null])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={23}
      />,
    );

    const pack = screen.getByTestId('backpack-rail-pack-0');
    expect(pack.getAttribute('data-fill')).toBe('partial');
    expect(screen.getByTestId('backpack-slot-0-0').textContent).toContain('Bowie Knife');
    expect(screen.getByTestId('backpack-slot-0-1').textContent).toContain('Hyper');
  });

  it('data-fill is "full" when every slot is occupied', () => {
    render(
      <BackpackRail
        packs={[makePack('pack-1', ['weap-1', 'drug-1', 'cash-100', 'weap-1'])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={21}
      />,
    );
    expect(screen.getByTestId('backpack-rail-pack-0').getAttribute('data-fill')).toBe('full');
  });

  it('clicking a filled slot fires onClearSlot with the correct indices', () => {
    const onClearSlot = vi.fn();
    render(
      <BackpackRail
        packs={[makePack('pack-1', ['weap-1', null, null, null])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={24}
        onClearSlot={onClearSlot}
      />,
    );

    fireEvent.click(screen.getByTestId('backpack-slot-0-0'));
    expect(onClearSlot).toHaveBeenCalledWith(0, 0);
  });

  it('clicking an empty slot with an armed card fires onAssignCard', () => {
    const onAssignCard = vi.fn();
    window.__MEAN_STREETS_ARMED_CARD__ = 'drug-1';
    render(
      <BackpackRail
        packs={[makePack('pack-1', [null, null, null, null])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={25}
        onAssignCard={onAssignCard}
      />,
    );

    fireEvent.click(screen.getByTestId('backpack-slot-0-2'));
    expect(onAssignCard).toHaveBeenCalledWith(0, 2, 'drug-1');
  });

  it('clicking an empty slot without an armed card does nothing', () => {
    const onAssignCard = vi.fn();
    render(
      <BackpackRail
        packs={[makePack('pack-1', [null, null, null, null])]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={25}
        onAssignCard={onAssignCard}
      />,
    );

    fireEvent.click(screen.getByTestId('backpack-slot-0-0'));
    expect(onAssignCard).not.toHaveBeenCalled();
  });

  it('shows the quarter-card budget prominently', () => {
    render(
      <BackpackRail
        packs={[]}
        cardIndex={cardIndex()}
        quarterCardBudgetRemaining={17}
      />,
    );
    const budget = screen.getByTestId('backpack-rail-budget');
    expect(budget.textContent).toContain('17 / 25 quarter-cards remaining');
  });
});
