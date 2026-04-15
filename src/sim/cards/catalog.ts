/**
 * Runtime loader for compiled crew (tough) cards.
 *
 * Reads `config/compiled/toughs.json`, which the build step produced from
 * the tuning-history files under `config/raw/cards/toughs/`. The file is
 * imported as static JSON so Vite bundles it into the web build and
 * Node's import.meta.url resolver handles it for tsx/vitest tests.
 */

import compiledToughs from '../../../config/compiled/toughs.json';
import { type CharacterCard, CompiledCrewSchema } from './schemas';

const parsed = (compiledToughs as unknown[]).map((entry) => CompiledCrewSchema.parse(entry));

function toCharacterCard(card: (typeof parsed)[number]): CharacterCard {
  return {
    id: card.id,
    displayName: card.displayName,
    archetype: card.archetype,
    affiliation: card.affiliation,
    power: card.power,
    resistance: card.resistance,
    abilityText: card.abilityText,
    unlocked: card.unlocked,
    ...(card.unlockCondition ? { unlockCondition: card.unlockCondition } : {}),
    locked: card.locked,
  };
}

export function loadAuthoredCrewCards(): CharacterCard[] {
  return parsed.map(toCharacterCard);
}

export function loadStarterCrewCards(starterCount = 25): CharacterCard[] {
  return loadAuthoredCrewCards().map((card, index) => ({
    ...card,
    unlocked: index < starterCount || card.unlocked,
  }));
}
