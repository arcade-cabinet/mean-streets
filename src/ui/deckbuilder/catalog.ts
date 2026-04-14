import { loadStarterCrewCards } from '../../sim/cards/catalog';
import type { CharacterCard } from '../../sim/cards/schemas';
import { createRng } from '../../sim/cards/rng';
import { buildAutoDeck } from '../../sim/turf/deck-builder';
import {
  generateBackpacks,
  generateCash,
  generateDrugs,
  generateWeapons,
} from '../../sim/turf/generators';
import type {
  BackpackCard,
  CrewCard,
  ModifierCard,
} from '../../sim/turf/types';
import type { DeckLoadout } from './storage';

const MODIFIER_CATALOG_SEED = 13579;

function toCrewCard(card: CharacterCard): CrewCard {
  return { ...card, type: 'crew' as const };
}

export function createDeckCatalog(): {
  crew: CrewCard[];
  modifiers: ModifierCard[];
  backpacks: BackpackCard[];
} {
  const rng = createRng(MODIFIER_CATALOG_SEED);
  const weapons = generateWeapons(rng);
  const drugs = generateDrugs(rng);
  const cash = generateCash();
  const backpacks = generateBackpacks(rng, weapons, drugs, cash);

  return {
    crew: loadStarterCrewCards(25).map(toCrewCard),
    modifiers: [...weapons, ...drugs, ...cash] as ModifierCard[],
    backpacks,
  };
}

export function resolveDeckLoadout(loadout: DeckLoadout): {
  crew: CrewCard[];
  modifiers: ModifierCard[];
  backpacks: BackpackCard[];
} {
  const catalog = createDeckCatalog();
  const crew = loadout.crewIds
    .map((id) => catalog.crew.find((card) => card.id === id))
    .filter((card): card is CrewCard => !!card);
  const modifiers = loadout.modifierIds
    .map((id) => catalog.modifiers.find((card) => card.id === id))
    .filter((card): card is ModifierCard => !!card);
  const backpacks = (loadout.backpackIds ?? [])
    .map((id) => catalog.backpacks.find((card) => card.id === id))
    .filter((card): card is BackpackCard => !!card);

  return { crew, modifiers, backpacks };
}

export function createAutoDeckSelection(seed = 424242): {
  crewIds: string[];
  modifierIds: string[];
  backpackIds: string[];
} {
  const catalog = createDeckCatalog();
  const rng = createRng(seed);
  const deck = buildAutoDeck(
    {
      crew: catalog.crew,
      weapons: catalog.modifiers.filter((card) => card.type === 'weapon'),
      drugs: catalog.modifiers.filter((card) => card.type === 'product'),
      cash: catalog.modifiers.filter((card) => card.type === 'cash'),
      backpacks: catalog.backpacks,
    },
    rng,
  );

  return {
    crewIds: deck.crew.map((card) => card.id),
    modifierIds: deck.modifiers.map((card) => card.id),
    backpackIds: deck.backpacks.map((card) => card.id),
  };
}
