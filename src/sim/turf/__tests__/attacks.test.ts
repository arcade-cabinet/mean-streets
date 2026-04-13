import { describe, expect, it } from 'vitest';
import type { CashCard, CrewCard, Position, ProductCard, WeaponCard } from '../types';
import { emptyPosition } from '../board';
import { resolveDirectAttack, resolveFundedAttack } from '../attacks';
import { DEFAULT_TURF_CONFIG } from '../types';

function makeCrew(overrides: Partial<CrewCard> = {}): CrewCard {
  return {
    type: 'crew',
    id: overrides.id ?? 'crew-1',
    displayName: overrides.displayName ?? 'Brick',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'kings-row',
    power: overrides.power ?? 6,
    resistance: overrides.resistance ?? 6,
    abilityText: overrides.abilityText ?? 'None',
    unlocked: true,
    locked: false,
    ...overrides,
  };
}

function makeWeapon(category: string, bonus: number, slot: 'top' | 'bottom'): WeaponCard {
  return {
    type: 'weapon',
    id: `weapon-${category}-${slot}`,
    name: `${category}-${slot}`,
    category,
    bonus,
    offenseAbility: category.toUpperCase(),
    offenseAbilityText: category,
    defenseAbility: category.toUpperCase(),
    defenseAbilityText: category,
    unlocked: true,
    locked: false,
  };
}

function makeDrug(category: string, potency: number): ProductCard {
  return {
    type: 'product',
    id: `drug-${category}-${potency}`,
    name: `${category}-${potency}`,
    category,
    potency,
    offenseAbility: category.toUpperCase(),
    offenseAbilityText: category,
    defenseAbility: category.toUpperCase(),
    defenseAbilityText: category,
    unlocked: true,
    locked: false,
  };
}

function makeCash(denomination: 100 | 1000): CashCard {
  return { type: 'cash', id: `cash-${denomination}`, denomination };
}

function position(owner: 'A' | 'B', crew: CrewCard): Position {
  const pos = emptyPosition(owner);
  pos.crew = crew;
  pos.turnsActive = 1;
  return pos;
}

describe('attack category abilities', () => {
  it('enforces modifier deck hallucinogen logic on funded attacks', () => {
    const attacker = position('A', makeCrew({ displayName: 'Caller' }));
    const defender = position('B', makeCrew({ displayName: 'Mark', resistance: 7 }));
    attacker.cashLeft = makeCash(100);
    attacker.drugTop = makeDrug('hallucinogen', 2);
    defender.drugBottom = makeDrug('hallucinogen', 3);

    const outcome = resolveFundedAttack(attacker, defender, DEFAULT_TURF_CONFIG);

    expect(outcome.type).toBe('flip');
    expect(outcome.description).toContain('CONFUSE 2');
    expect(outcome.description).toContain('PARANOIA 3');
    expect(outcome.description).toContain('$100 vs ');
  });

  it('consumes stealth defense to evade the first direct attack', () => {
    const attacker = position('A', makeCrew({ displayName: 'Rook', power: 7 }));
    const defender = position('B', makeCrew({ displayName: 'Ghost', resistance: 3 }));
    defender.weaponBottom = makeWeapon('stealth', 1, 'bottom');

    const outcome = resolveDirectAttack(attacker, defender);

    expect(outcome.type).toBe('miss');
    expect(outcome.description).toContain('evades');
    expect(defender.crew?.resistance).toBe(3);
    expect(defender.weaponBottom).toBeNull();
  });

  it('lets painkillers survive a killing blow once', () => {
    const attacker = position('A', makeCrew({ displayName: 'Hammer', power: 8 }));
    attacker.weaponTop = makeWeapon('blunt', 2, 'top');
    const defender = position('B', makeCrew({ displayName: 'Tank', resistance: 2 }));
    defender.drugBottom = makeDrug('narcotic', 2);

    const outcome = resolveDirectAttack(attacker, defender);

    expect(outcome.type).toBe('sick');
    expect(outcome.description).toContain('survives');
    expect(defender.crew?.resistance).toBe(1);
    expect(defender.drugBottom).toBeNull();
  });

  it('applies parry and reflexes chip damage back to the attacker', () => {
    const attacker = position('A', makeCrew({ displayName: 'Blade', resistance: 7 }));
    const defender = position('B', makeCrew({ displayName: 'Guard', resistance: 8 }));
    defender.weaponBottom = makeWeapon('bladed', 2, 'bottom');
    defender.drugBottom = makeDrug('stimulant', 1);

    const outcome = resolveDirectAttack(attacker, defender);

    expect(outcome.description).toContain('PARRY 2');
    expect(outcome.description).toContain('REFLEXES 1');
    expect(attacker.crew?.resistance).toBe(4);
  });
});
