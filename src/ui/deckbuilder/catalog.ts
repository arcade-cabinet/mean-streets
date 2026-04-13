import { generateAllCards } from '../../sim/cards/generator';
import { createRng } from '../../sim/cards/rng';
import { generateWeapons, generateDrugs, generateCash } from '../../sim/turf/generators';
import type { CrewCard, ModifierCard } from '../../sim/turf/types';
import type { CharacterCard } from '../../sim/cards/schemas';

const CREW_CATALOG_SEED = 24680;
const MODIFIER_CATALOG_SEED = 13579;

function toCrewCard(card: CharacterCard): CrewCard {
  return { ...card, type: 'crew' as const };
}

export function createDeckCatalog(): { crew: CrewCard[]; modifiers: ModifierCard[] } {
  const rng = createRng(MODIFIER_CATALOG_SEED);

  return {
    crew: generateAllCards(CREW_CATALOG_SEED, 100).map(toCrewCard),
    modifiers: [
      ...generateWeapons(rng),
      ...generateDrugs(rng),
      ...generateCash(),
    ] as ModifierCard[],
  };
}
