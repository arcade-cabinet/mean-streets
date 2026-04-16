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
    // Defensive copy: each callsite gets its own abilities array so a
    // downstream mutation (e.g. ECS system appending a buff tag) cannot
    // bleed into the shared catalog snapshot.
    abilities: [...card.abilities],
  };
}

export function loadToughCards(): ToughCard[] {
  return parsed.map(toToughCard);
}

export function loadStarterToughCards(starterCount = simConfig.starterCollection.toughPoolSize): ToughCard[] {
  return loadToughCards().slice(0, starterCount);
}

/**
 * Return a fresh copy of every compiled tough. `parsed` is a module-level
 * Zod-parsed array; returning it directly would hand callers the shared
 * mutable reference and any push/splice would corrupt every other
 * consumer for the life of the process.
 */
export function loadCompiledToughs(): CompiledTough[] {
  return parsed.map((t) => ({ ...t, abilities: [...t.abilities] }));
}
