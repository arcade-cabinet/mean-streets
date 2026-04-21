import { describe, expect, it } from 'vitest';
import {
  AuthoredCurrencySchema,
  AuthoredDrugSchema,
  AuthoredToughSchema,
  AuthoredWeaponSchema,
} from './schemas';
import {
  compileCurrency,
  compileDrug,
  compileTough,
  compileWeapon,
} from './compile';

describe('card compile helpers', () => {
  it('preserves stack portraits on toughs, weapons, and drugs', () => {
    const tough = AuthoredToughSchema.parse({
      id: 'card-test',
      kind: 'tough',
      name: 'Test Tough',
      archetype: 'bruiser',
      affiliation: 'kings_row',
      power: [2, 4],
      resistance: [3, 5],
      maxHp: 5,
      hp: 5,
      rarity: ['common', 'rare'],
      abilities: ['BRAWL'],
      unlocked: true,
      locked: true,
      portrait: {
        mode: 'stack',
        template: 'street-left',
        palette: 'ash',
        layers: {
          body: 'average',
          torso: 'hoodie',
          arms: 'fists',
          legs: 'runner',
        },
      },
    });
    const weapon = AuthoredWeaponSchema.parse({
      id: 'weap-test',
      kind: 'weapon',
      name: 'Test Weapon',
      category: 'bladed',
      power: [1, 3],
      resistance: [1, 2],
      rarity: ['common', 'uncommon'],
      abilities: ['CUT'],
      unlocked: true,
      locked: true,
      portrait: {
        mode: 'stack',
        template: 'totem',
        palette: 'steel',
        layers: {
          primary: 'knife',
          support: 'chain',
        },
      },
    });
    const drug = AuthoredDrugSchema.parse({
      id: 'drug-test',
      kind: 'drug',
      name: 'Test Drug',
      category: 'stimulant',
      power: [1, 2],
      resistance: [1, 1],
      rarity: ['common', 'rare'],
      abilities: ['RUSH'],
      unlocked: true,
      locked: true,
      portrait: {
        mode: 'stack',
        template: 'fan',
        palette: 'toxic',
        layers: {
          primary: 'pill-bottle',
          support: 'burner-phone',
        },
      },
    });

    expect(compileTough(tough)).toMatchObject({
      power: 4,
      resistance: 5,
      maxHp: 5,
      hp: 5,
      rarity: 'rare',
      portrait: tough.portrait,
    });
    expect(compileWeapon(weapon)).toMatchObject({
      power: 3,
      resistance: 2,
      rarity: 'uncommon',
      portrait: weapon.portrait,
    });
    expect(compileDrug(drug)).toMatchObject({
      power: 2,
      resistance: 1,
      rarity: 'rare',
      portrait: drug.portrait,
    });
  });

  it('preserves currency abilities and stack portrait', () => {
    const currency = AuthoredCurrencySchema.parse({
      id: 'currency-test',
      kind: 'currency',
      name: 'Clean Money',
      denomination: 1000,
      rarity: ['rare', 'legendary'],
      abilities: ['LAUNDER'],
      unlocked: true,
      locked: true,
      portrait: {
        mode: 'stack',
        template: 'triptych-left',
        palette: 'laundered',
        layers: {
          primary: 'cash-stack',
          support: 'burner-phone',
        },
      },
    });

    expect(compileCurrency(currency)).toEqual({
      kind: 'currency',
      id: 'currency-test',
      name: 'Clean Money',
      denomination: 1000,
      rarity: 'legendary',
      abilities: ['LAUNDER'],
      unlocked: true,
      locked: true,
      portrait: currency.portrait,
    });
  });
});
