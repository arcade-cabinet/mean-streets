import { describe, expect, it } from 'vitest';
import type { CrewCard, Position, WeaponCard } from '../types';
import { emptyPosition } from '../board';
import { resolveDirectAttack, type AttackContext } from '../attacks';

function makeCrew(overrides: Partial<CrewCard> = {}): CrewCard {
  return {
    type: 'crew',
    id: overrides.id ?? 'crew-1',
    displayName: overrides.displayName ?? 'Crew',
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

function makeWeapon(category: string, bonus: number): WeaponCard {
  return {
    type: 'weapon',
    id: `weapon-${category}`,
    name: category,
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

function position(owner: 'A' | 'B', crew: CrewCard): Position {
  const pos = emptyPosition(owner);
  pos.crew = crew;
  pos.turnsActive = 1;
  return pos;
}

describe('archetype abilities', () => {
  it('BLOOD_FRENZY: shark gets +damage per opponent-card deficit', () => {
    const attacker = position(
      'A',
      makeCrew({ displayName: 'Finn', archetype: 'shark', power: 4 }),
    );
    attacker.weaponTop = makeWeapon('blunt', 1);
    const defender = position('B', makeCrew({ displayName: 'Diver', resistance: 10 }));

    const context: AttackContext = {
      ownCardsInPlay: 5,
      opponentCardsInPlay: 2,
    };
    const outcome = resolveDirectAttack(attacker, defender, context);

    expect(outcome.description).toContain('BLOOD_FRENZY 3');
  });

  it('BLOOD_FRENZY: does not trigger when opponent has equal cards', () => {
    const attacker = position(
      'A',
      makeCrew({ displayName: 'Finn', archetype: 'shark', power: 4 }),
    );
    attacker.weaponTop = makeWeapon('blunt', 1);
    const defender = position('B', makeCrew({ displayName: 'Diver', resistance: 10 }));

    const context: AttackContext = {
      ownCardsInPlay: 5,
      opponentCardsInPlay: 5,
    };
    const outcome = resolveDirectAttack(attacker, defender, context);

    expect(outcome.description).not.toContain('BLOOD_FRENZY');
  });

  it('VENDETTA: enforcer doubles damage against at-war target', () => {
    const attacker = position(
      'A',
      makeCrew({ displayName: 'Maker', archetype: 'enforcer', power: 6 }),
    );
    attacker.weaponTop = makeWeapon('blunt', 1);
    const defender = position('B', makeCrew({ displayName: 'Rival', resistance: 10 }));
    // raw atk 7, def floor/2 = 5, raw dmg = 2 → VENDETTA x2 = 4
    const resBefore = defender.crew?.resistance ?? 0;

    const context: AttackContext = {
      ownCardsInPlay: 1,
      opponentCardsInPlay: 1,
      targetIsAtWar: true,
    };
    const outcome = resolveDirectAttack(attacker, defender, context);

    expect(outcome.description).toContain('VENDETTA x2');
    expect((defender.crew?.resistance ?? 0) <= resBefore - 3).toBe(true);
  });

  it('VENDETTA: does not trigger against peaceful target', () => {
    const attacker = position(
      'A',
      makeCrew({ displayName: 'Maker', archetype: 'enforcer', power: 6 }),
    );
    attacker.weaponTop = makeWeapon('blunt', 1);
    const defender = position('B', makeCrew({ displayName: 'Ally', resistance: 10 }));

    const context: AttackContext = {
      ownCardsInPlay: 1,
      opponentCardsInPlay: 1,
      targetIsAtWar: false,
    };
    const outcome = resolveDirectAttack(attacker, defender, context);

    expect(outcome.description).not.toContain('VENDETTA');
  });

  it('BRUISER: ignores precision rule (existing — sanity check)', () => {
    // Bruiser's precision-ignore is enforced by the environment action
    // generator, not by resolveDirectAttack. Confirm direct attacks
    // still work with no context regardless of archetype.
    const attacker = position(
      'A',
      makeCrew({ displayName: 'Brick', archetype: 'bruiser', power: 8 }),
    );
    attacker.weaponTop = makeWeapon('blunt', 1);
    const defender = position('B', makeCrew({ displayName: 'Soft', resistance: 3 }));

    const outcome = resolveDirectAttack(attacker, defender);
    expect(outcome.type).toBe('kill');
  });
});
