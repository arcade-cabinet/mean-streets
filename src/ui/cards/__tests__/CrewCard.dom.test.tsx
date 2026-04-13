import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { CrewCard } from '../CrewCard';
import type { CashCard, CrewCard as CrewCardType, Position, ProductCard, WeaponCard } from '../../../sim/turf/types';

function crew(overrides: Partial<CrewCardType> = {}): CrewCardType {
  return {
    type: 'crew',
    id: overrides.id ?? 'crew-brick',
    displayName: overrides.displayName ?? 'Brick',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'kings-row',
    power: overrides.power ?? 6,
    resistance: overrides.resistance ?? 5,
    abilityText: overrides.abilityText ?? 'None',
    unlocked: true,
    locked: false,
    ...overrides,
  };
}

function weapon(category: string, bonus: number): WeaponCard {
  return {
    type: 'weapon',
    id: `weapon-${category}-${bonus}`,
    name: 'Switchblade',
    category,
    bonus,
    offenseAbility: 'LACERATE',
    offenseAbilityText: 'Bleed the target.',
    defenseAbility: 'PARRY',
    defenseAbilityText: 'Counter-damage.',
    unlocked: true,
    locked: false,
  };
}

function drug(category: string, potency: number): ProductCard {
  return {
    type: 'product',
    id: `drug-${category}-${potency}`,
    name: 'Velvet Static',
    category,
    potency,
    offenseAbility: 'SUPPRESS',
    offenseAbilityText: 'Lower enemy power.',
    defenseAbility: 'NUMB',
    defenseAbilityText: 'Reduce incoming damage.',
    unlocked: true,
    locked: false,
  };
}

function cash(denomination: 100 | 1000): CashCard {
  return { type: 'cash', id: `cash-${denomination}`, denomination };
}

function makePosition(): Position {
  return {
    crew: crew(),
    drugTop: drug('stimulant', 2),
    drugBottom: drug('sedative', 3),
    weaponTop: weapon('bladed', 4),
    weaponBottom: weapon('stealth', 1),
    cashLeft: cash(100),
    cashRight: cash(1000),
    owner: 'A',
    seized: false,
    turnsActive: 1,
  };
}

describe('CrewCard', () => {
  it('renders six anchored modifier slots as a single assembled crew card', () => {
    render(
      <AppShellProvider>
        <CrewCard position={makePosition()} isPlayer />
      </AppShellProvider>,
    );

    expect(screen.getByTestId('crew-card-crew-brick')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="drug-top"]')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="weapon-top"]')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="cash-left"]')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="cash-right"]')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="drug-bottom"]')).not.toBeNull();
    expect(document.querySelector('[data-slot-id="weapon-bottom"]')).not.toBeNull();
    expect(screen.getByText('Brick')).not.toBeNull();
    expect(screen.getAllByText(/\$1000|\$100|\+4|\+3|\+2|\+1/).length).toBeGreaterThan(0);
  });
});
