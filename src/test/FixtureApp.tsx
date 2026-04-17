import '../App.css';
import { WorldProvider } from 'koota/react';
import { createGameWorld } from '../ecs/world';
import type {
  Card as CardType,
  CurrencyCard,
  DrugCard,
  ToughCard,
  WeaponCard,
} from '../sim/turf/types';
import { Card } from '../ui/cards';
import type { DeckLoadout } from '../ui/deckbuilder/storage';
import { GrittyFilters } from '../ui/filters';
import {
  DeckGarageScreen,
  DifficultyScreen,
  GameScreen,
  MainMenuScreen,
} from '../ui/screens';

type FixtureName = 'menu' | 'difficulty' | 'deck-garage' | 'combat' | 'card';

interface FixtureAppProps {
  fixture: string;
}

function tough(overrides: Partial<ToughCard> = {}): ToughCard {
  const resistance = overrides.resistance ?? 6;
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-fixture',
    name: overrides.name ?? 'Brick Malone',
    tagline: overrides.tagline ?? 'Built different.',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'kings_row',
    power: overrides.power ?? 7,
    resistance,
    rarity: overrides.rarity ?? 'common',
    abilities: overrides.abilities ?? [],
    // v0.3: toughs carry hp/maxHp. Fixture default mirrors `resistance`,
    // matching the authored convention in `sim/turf/types.ts`.
    maxHp: overrides.maxHp ?? resistance,
    hp: overrides.hp ?? resistance,
    ...overrides,
  };
}

function weaponCard(category: string, power: number): WeaponCard {
  return {
    kind: 'weapon',
    id: `weapon-${category}-${power}`,
    name: 'Switchblade',
    category,
    power,
    resistance: 1,
    rarity: 'common',
    abilities: ['LACERATE: Bleed the target'],
  };
}

function drugCard(category: string, power: number): DrugCard {
  return {
    kind: 'drug',
    id: `drug-${category}-${power}`,
    name: 'Velvet Static',
    category,
    power,
    resistance: 1,
    rarity: 'common',
    abilities: ['SUPPRESS: Lower enemy power'],
  };
}

function currencyCard(denomination: 100 | 1000): CurrencyCard {
  return {
    kind: 'currency',
    id: `currency-${denomination}`,
    name: denomination === 1000 ? 'Grand Stack' : 'Pocket Cash',
    denomination,
    rarity: denomination === 1000 ? 'rare' : 'common',
  };
}

function sampleCards(): CardType[] {
  return [
    tough(),
    tough({
      id: 'tough-rare',
      name: 'Sung "Dagger" Park',
      affiliation: 'jade_dragon',
      rarity: 'rare',
      power: 5,
      resistance: 4,
    }),
    tough({
      id: 'tough-legend',
      name: 'Marco "Switch" Vega',
      affiliation: 'los_diablos',
      rarity: 'legendary',
      power: 9,
      resistance: 3,
    }),
    weaponCard('bladed', 4),
    drugCard('stimulant', 2),
    currencyCard(100),
    currencyCard(1000),
  ];
}

function sampleLoadouts(): DeckLoadout[] {
  return [
    {
      id: 'deck-night-shift',
      name: 'Night Shift',
      crewIds: new Array(25).fill('crew-1'),
      modifierIds: new Array(25).fill('mod-1'),
      updatedAt: new Date('2026-04-13T12:00:00.000Z').toISOString(),
    },
    {
      id: 'deck-river-kings',
      name: 'River Kings',
      crewIds: new Array(25).fill('crew-2'),
      modifierIds: new Array(25).fill('mod-2'),
      updatedAt: new Date('2026-04-13T11:00:00.000Z').toISOString(),
    },
  ];
}

function renderWorldFixture() {
  const world = createGameWorld(undefined, 42);
  return (
    <WorldProvider world={world}>
      <GameScreen world={world} onGameOver={() => {}} />
    </WorldProvider>
  );
}

function renderFixture(fixture: FixtureName) {
  switch (fixture) {
    case 'menu':
      return (
        <MainMenuScreen
          onNewGame={() => {}}
          onLoadGame={() => {}}
          onCards={() => {}}
          canLoadGame={false}
        />
      );
    case 'difficulty':
      return <DifficultyScreen onSelect={() => {}} onBack={() => {}} />;
    case 'deck-garage':
      return (
        <DeckGarageScreen
          loadouts={sampleLoadouts()}
          onCreateDeck={() => {}}
          onEditDeck={() => {}}
          onPlayDeck={() => {}}
          onBack={() => {}}
        />
      );
    case 'combat':
      return renderWorldFixture();
    case 'card':
      return (
        <div className="min-h-screen bg-stone-950 p-8 flex flex-wrap gap-4 items-start justify-center">
          {sampleCards().map((c) => (
            <div key={c.id} data-testid={`fixture-card-${c.id}`}>
              <Card card={c} />
            </div>
          ))}
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
      <div
        data-testid="fixture-root"
        style={{ minHeight: '100vh', width: '100%', position: 'relative' }}
      >
        {renderFixture(fixture as FixtureName)}
      </div>
    </>
  );
}
