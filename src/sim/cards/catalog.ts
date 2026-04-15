import compiledToughs from '../../../config/compiled/toughs.json';
import { type CompiledTough, CompiledToughSchema } from './schemas';
import type { ToughCard } from '../turf/types';
import simConfig from '../../data/ai/turf-sim.json';

const parsed = (compiledToughs as unknown[]).map((entry) =>
  CompiledToughSchema.parse(entry),
);

function toToughCard(card: CompiledTough): ToughCard {
  return {
    kind: 'tough',
    id: card.id,
    name: card.name,
    tagline: card.tagline ?? '',
    archetype: card.archetype,
    affiliation: card.affiliation,
    power: card.power,
    resistance: card.resistance,
    rarity: card.rarity,
    abilities: card.abilities,
  };
}

export function loadToughCards(): ToughCard[] {
  return parsed.map(toToughCard);
}

export function loadStarterToughCards(starterCount = simConfig.starterCollection.toughPoolSize): ToughCard[] {
  return loadToughCards().slice(0, starterCount);
}

export function loadCompiledToughs(): CompiledTough[] {
  return parsed;
}
