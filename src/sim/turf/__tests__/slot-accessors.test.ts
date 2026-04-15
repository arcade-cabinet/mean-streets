import { describe, expect, it } from 'vitest';
import type { BackpackCard, CashCard, CrewCard, Position, ProductCard, WeaponCard } from '../types';
import { emptyPosition } from '../board';
import {
  backpackGatedCount,
  getSlot,
  isBackpackEquipped,
  isSlotEmpty,
  liveSlots,
  pocketCount,
  quarterCardCount,
} from '../slot-accessors';

function makeCrew(): CrewCard {
  return {
    type: 'crew',
    id: 'c1',
    displayName: 'Crew',
    archetype: 'bruiser',
    affiliation: 'kings-row',
    power: 5,
    resistance: 5,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

function makeWeapon(): WeaponCard {
  return {
    type: 'weapon',
    id: 'w1',
    name: 'Knife',
    category: 'bladed',
    bonus: 2,
    offenseAbility: 'LACERATE',
    offenseAbilityText: '',
    defenseAbility: 'PARRY',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  };
}

function makeDrug(): ProductCard {
  return {
    type: 'product',
    id: 'd1',
    name: 'Hyper',
    category: 'stimulant',
    potency: 2,
    offenseAbility: 'RUSH',
    offenseAbilityText: '',
    defenseAbility: 'REFLEXES',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  };
}

function makeCash(): CashCard {
  return { type: 'cash', id: '$1', denomination: 100 };
}

function makeBackpack(): BackpackCard {
  return {
    type: 'backpack',
    id: 'pk-1',
    name: 'Runner Pack',
    icon: 'knife',
    size: 2,
    payload: [],
    unlocked: true,
    locked: false,
  };
}

function seed(overrides: Partial<Position> = {}): Position {
  const pos = emptyPosition('A');
  pos.crew = makeCrew();
  return Object.assign(pos, overrides);
}

describe('slot-accessors (RULES.md §2 semantic names)', () => {
  it('maps pocket slots to cashLeft/cashRight', () => {
    const pos = seed({ cashLeft: makeCash(), cashRight: null });
    expect(getSlot(pos, 'pocketLeft')).toBe(pos.cashLeft);
    expect(getSlot(pos, 'pocketRight')).toBeNull();
    expect(isSlotEmpty(pos, 'pocketLeft')).toBe(false);
    expect(isSlotEmpty(pos, 'pocketRight')).toBe(true);
  });

  it('maps backpack-gated corners to drugTop/weaponTop/drugBottom/weaponBottom', () => {
    const drug = makeDrug();
    const weapon = makeWeapon();
    const pos = seed({
      drugTop: drug,
      weaponTop: weapon,
      drugBottom: null,
      weaponBottom: null,
    });
    expect(getSlot(pos, 'backpackTopLeft')).toBe(drug);
    expect(getSlot(pos, 'backpackTopRight')).toBe(weapon);
    expect(getSlot(pos, 'backpackBottomLeft')).toBeNull();
    expect(getSlot(pos, 'backpackBottomRight')).toBeNull();
  });

  it('isBackpackEquipped reflects the position.backpack field', () => {
    const pos = seed();
    expect(isBackpackEquipped(pos)).toBe(false);
    pos.backpack = makeBackpack();
    expect(isBackpackEquipped(pos)).toBe(true);
  });

  it('liveSlots is 2 without backpack, 6 with backpack', () => {
    const pos = seed();
    expect(liveSlots(pos)).toEqual(['pocketLeft', 'pocketRight']);
    pos.backpack = makeBackpack();
    expect(liveSlots(pos)).toHaveLength(6);
  });

  it('pocketCount counts 0..2 regardless of backpack state', () => {
    const pos = seed();
    expect(pocketCount(pos)).toBe(0);
    pos.cashLeft = makeCash();
    expect(pocketCount(pos)).toBe(1);
    pos.cashRight = makeCash();
    expect(pocketCount(pos)).toBe(2);
  });

  it('backpackGatedCount is 0 without backpack even if legacy fields set', () => {
    const pos = seed({ drugTop: makeDrug(), weaponTop: makeWeapon() });
    expect(backpackGatedCount(pos)).toBe(0);
    pos.backpack = makeBackpack();
    expect(backpackGatedCount(pos)).toBe(2);
  });

  it('quarterCardCount sums pocket + backpack-gated', () => {
    const pos = seed({ cashLeft: makeCash(), drugTop: makeDrug() });
    expect(quarterCardCount(pos)).toBe(1); // no backpack → only pocket counts
    pos.backpack = makeBackpack();
    expect(quarterCardCount(pos)).toBe(2);
  });
});
