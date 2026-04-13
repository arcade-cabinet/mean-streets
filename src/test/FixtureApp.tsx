import '../App.css';
import type { CashCard, CrewCard as CrewCardType, Position, ProductCard, WeaponCard } from '../sim/turf/types';
import { CrewCard, ModifierBadge } from '../ui/cards';
import { GrittyFilters } from '../ui/filters';
import { MainMenuScreen, DeckBuilderScreen } from '../ui/screens';

type FixtureName = 'menu' | 'deckbuilder' | 'crew-card' | 'modifier-badges';

interface FixtureAppProps {
  fixture: string;
}

function crew(overrides: Partial<CrewCardType> = {}): CrewCardType {
  return {
    type: 'crew',
    id: overrides.id ?? 'crew-fixture',
    displayName: overrides.displayName ?? 'Brick Malone',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'kings-row',
    power: overrides.power ?? 7,
    resistance: overrides.resistance ?? 6,
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

function samplePosition(): Position {
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

function renderFixture(fixture: FixtureName) {
  switch (fixture) {
    case 'menu':
      return <MainMenuScreen onNewGame={() => {}} onSettings={() => {}} />;
    case 'deckbuilder':
      return <DeckBuilderScreen onBack={() => {}} onStartGame={() => {}} />;
    case 'crew-card':
      return (
        <div className="min-h-screen bg-stone-950 p-8 flex items-center justify-center">
          <div data-testid="fixture-crew-card">
            <CrewCard position={samplePosition()} isPlayer />
          </div>
        </div>
      );
    case 'modifier-badges':
      return (
        <div className="min-h-screen bg-stone-950 p-8 flex items-center justify-center">
          <div data-testid="fixture-modifier-badges" className="grid grid-cols-3 gap-4 max-w-md">
            <ModifierBadge card={weapon('bladed', 4)} orientation="offense" />
            <ModifierBadge card={drug('sedative', 3)} orientation="defense" />
            <ModifierBadge card={cash(1000)} orientation="offense" />
          </div>
        </div>
      );
    default:
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
          Unknown fixture
        </div>
      );
  }
}

export function FixtureApp({ fixture }: FixtureAppProps) {
  return (
    <>
      <GrittyFilters />
      <div data-testid="fixture-root">
        {renderFixture(fixture as FixtureName)}
      </div>
    </>
  );
}
