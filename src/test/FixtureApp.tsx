import '../App.css';
import { WorldProvider } from 'koota/react';
import type { BackpackCard, CashCard, CrewCard as CrewCardType, Position, ProductCard, WeaponCard } from '../sim/turf/types';
import { createGameWorld } from '../ecs/world';
import { GameState, PlayerA, PlayerB } from '../ecs/traits';
import { strikeAction } from '../ecs/actions';
import { CrewCard, ModifierBadge } from '../ui/cards';
import { GrittyFilters } from '../ui/filters';
import { MainMenuScreen, DeckBuilderScreen, DeckGarageScreen, BuildupScreen, CombatScreen } from '../ui/screens';
import type { DeckLoadout } from '../ui/deckbuilder/storage';

type FixtureName = 'menu' | 'deck-garage' | 'deckbuilder' | 'buildup' | 'combat' | 'crew-card' | 'modifier-badges';

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

function backpack(id: string, payload: Array<WeaponCard | ProductCard | CashCard>): BackpackCard {
  return {
    type: 'backpack',
    id,
    name: `Kit ${id}`,
    icon: 'crate',
    size: Math.min(4, payload.length) as 1 | 2 | 3 | 4,
    payload,
    unlocked: true,
    locked: false,
  };
}

function samplePosition(overrides: Partial<Position> = {}): Position {
  return {
    crew: crew(),
    drugTop: drug('stimulant', 2),
    drugBottom: drug('sedative', 3),
    weaponTop: weapon('bladed', 4),
    weaponBottom: weapon('stealth', 1),
    cashLeft: cash(100),
    cashRight: cash(1000),
    backpack: null,
    runner: false,
    payloadRemaining: 0,
    owner: 'A',
    seized: false,
    turnsActive: 1,
    ...overrides,
  };
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

function populateFixtureWorld(world: ReturnType<typeof createGameWorld>) {
  const entity = world.queryFirst(GameState, PlayerA, PlayerB);
  const gs = entity?.get(GameState);
  const player = entity?.get(PlayerA);
  const opponent = entity?.get(PlayerB);
  if (!entity || !gs || !player || !opponent) return;

  player.board.active[0] = samplePosition({
    owner: 'A',
    crew: crew({
      id: 'player-bruiser',
      displayName: 'Danny "Riot" Russo',
      archetype: 'medic',
      affiliation: 'kings-row',
      power: 6,
      resistance: 8,
    }),
    backpack: backpack('runner-active', [weapon('ranged', 2), cash(100)]),
    runner: true,
    payloadRemaining: 2,
  });
  player.board.active[1] = samplePosition({
    owner: 'A',
    crew: crew({
      id: 'player-fence',
      displayName: 'Sung "Dagger" Park',
      archetype: 'fence',
      affiliation: 'jade-dragon',
      power: 5,
      resistance: 4,
    }),
    weaponTop: weapon('ranged', 2),
    weaponBottom: weapon('stealth', 1),
    cashLeft: cash(1000),
    cashRight: null,
  });
  player.board.active[2] = samplePosition({
    owner: 'A',
    crew: crew({
      id: 'player-ghost',
      displayName: 'Marco "Switch" Vega',
      archetype: 'ghost',
      affiliation: 'los-diablos',
      power: 4,
      resistance: 3,
    }),
    drugTop: null,
    drugBottom: drug('hallucinogen', 1),
    weaponTop: weapon('bladed', 3),
    weaponBottom: null,
    cashLeft: null,
    cashRight: cash(100),
  });

  opponent.board.active[0] = samplePosition({
    owner: 'B',
    crew: crew({
      id: 'opp-bruiser',
      displayName: 'Rico Slate',
      archetype: 'bruiser',
      affiliation: 'iron-devils',
      power: 7,
      resistance: 6,
    }),
    weaponTop: weapon('blunt', 3),
    weaponBottom: weapon('blunt', 1),
  });
  opponent.board.active[1] = samplePosition({
    owner: 'B',
    crew: crew({
      id: 'opp-medic',
      displayName: 'Vera Choir',
      archetype: 'medic',
      affiliation: 'southside-saints',
      power: 4,
      resistance: 7,
    }),
    drugTop: drug('steroid', 2),
    drugBottom: drug('narcotic', 1),
    cashLeft: cash(100),
    cashRight: cash(100),
  });

  player.board.reserve[0] = samplePosition({
    owner: 'A',
    crew: crew({
      id: 'reserve-runner',
      displayName: 'Lena "Courier" Vale',
      archetype: 'runner',
      affiliation: 'black-market',
      power: 3,
      resistance: 4,
    }),
    drugTop: null,
    drugBottom: null,
    weaponTop: null,
    weaponBottom: null,
    cashLeft: null,
    cashRight: null,
    backpack: backpack('reserve-pack', [drug('stimulant', 1), cash(1000)]),
    runner: true,
    payloadRemaining: 2,
  });

  player.hand.crew = player.hand.crew.slice(0, 3);
  player.hand.modifiers = [
    cash(1000),
    weapon('stealth', 1),
    drug('stimulant', 1),
  ];
  player.hand.backpacks = [backpack('hand-pack', [weapon('stealth', 1), drug('stimulant', 1)])];

  gs.turnNumber = 0;

  entity.changed(GameState);
  entity.changed(PlayerA);
  entity.changed(PlayerB);
}

function renderWorldFixture(fixture: 'buildup' | 'combat') {
  const world = createGameWorld(undefined, 42);
  populateFixtureWorld(world);
  if (fixture === 'combat') {
    strikeAction(world);
  }

  return (
    <WorldProvider world={world}>
      {fixture === 'buildup' ? (
        <BuildupScreen world={world} onStrike={() => {}} />
      ) : (
        <CombatScreen world={world} onGameOver={() => {}} />
      )}
    </WorldProvider>
  );
}

function renderFixture(fixture: FixtureName) {
  switch (fixture) {
    case 'menu':
      return <MainMenuScreen onNewGame={() => {}} onLoadGame={() => {}} canLoadGame={false} />;
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
    case 'deckbuilder':
      return <DeckBuilderScreen onBack={() => {}} onStartGame={() => {}} />;
    case 'buildup':
      return renderWorldFixture('buildup');
    case 'combat':
      return renderWorldFixture('combat');
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
      <div
        data-testid="fixture-root"
        style={{ minHeight: '100vh', width: '100%', position: 'relative' }}
      >
        {renderFixture(fixture as FixtureName)}
      </div>
    </>
  );
}
