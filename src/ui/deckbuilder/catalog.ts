import { loadStarterToughCards } from '../../sim/cards/catalog';
import { createRng } from '../../sim/cards/rng';
import { buildAutoDeck } from '../../sim/turf/deck-builder';
import {
  generateCurrency,
  generateDrugs,
  generateWeapons,
} from '../../sim/turf/generators';
import type {
  ToughCard,
  ModifierCard,
} from '../../sim/turf/types';
import type { DeckLoadout } from './storage';

const MODIFIER_CATALOG_SEED = 13579;

export function createDeckCatalog(): {
  crew: ToughCard[];
  modifiers: ModifierCard[];
} {
  const rng = createRng(MODIFIER_CATALOG_SEED);
  const weapons = generateWeapons(rng);
  const drugs = generateDrugs(rng);
  const cash = generateCurrency();

  return {
    crew: loadStarterToughCards(25),
    modifiers: [...weapons, ...drugs, ...cash],
  };
}

export function resolveDeckLoadout(loadout: DeckLoadout): {
  crew: ToughCard[];
  modifiers: ModifierCard[];
} {
  const catalog = createDeckCatalog();
  const crew = loadout.crewIds
    .map((id) => catalog.crew.find((card) => card.id === id))
    .filter((card): card is ToughCard => !!card);
  const modifiers = loadout.modifierIds
    .map((id) => catalog.modifiers.find((card) => card.id === id))
    .filter((card): card is ModifierCard => !!card);

  return { crew, modifiers };
}

export function createAutoDeckSelection(seed = 424242): {
  crewIds: string[];
  modifierIds: string[];
} {
  const catalog = createDeckCatalog();
  const rng = createRng(seed);
  const deck = buildAutoDeck(
    {
      crew: catalog.crew,
      weapons: catalog.modifiers.filter((card) => card.kind === 'weapon'),
      drugs: catalog.modifiers.filter((card) => card.kind === 'drug'),
      cash: catalog.modifiers.filter((card) => card.kind === 'currency'),
    },
    rng,
  );

  const crewIds = deck.filter((card) => card.kind === 'tough').map((card) => card.id);
  const modifierIds = deck.filter((card) => card.kind !== 'tough').map((card) => card.id);
  return { crewIds, modifierIds };
}
