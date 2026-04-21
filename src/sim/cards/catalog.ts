import compiledToughs from '../../../config/compiled/toughs.json';
import compiledMythics from '../../../config/compiled/mythics.json';
import {
  type CompiledMythic,
  CompiledMythicSchema,
  type CompiledTough,
  CompiledToughSchema,
} from './schemas';
import {
  generateDrugs,
  generateWeapons,
  loadCurrencyCatalog,
} from '../turf/generators';
import type { Card, ToughCard } from '../turf/types';
import simConfig from '../../data/ai/turf-sim.json';

const parsed = (compiledToughs as unknown[]).map((entry) =>
  CompiledToughSchema.parse(entry),
);

// Mythic pool is validated at module load so authoring mistakes (e.g. a
// rarity history that doesn't end in 'mythic') crash the app early
// rather than producing corrupted CardInstances at runtime.
const parsedMythics = (compiledMythics as unknown[]).map((entry) =>
  CompiledMythicSchema.parse(entry),
);

function clonePortrait<T>(value: T): T {
  return structuredClone(value);
}

function toToughCard(card: CompiledTough | CompiledMythic): ToughCard {
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
    maxHp: card.maxHp,
    hp: card.hp,
    // Defensive copy: each callsite gets its own abilities array so a
    // downstream mutation (e.g. ECS system appending a buff tag) cannot
    // bleed into the shared catalog snapshot.
    abilities: [...card.abilities],
  };
}

function cloneRuntimeCard<T extends Card>(card: T): T {
  if (card.kind === 'tough') {
    return {
      ...card,
      abilities: [...card.abilities],
    } as T;
  }
  if (card.kind === 'currency') {
    return {
      ...card,
      abilities: card.abilities ? [...card.abilities] : undefined,
    } as T;
  }
  return {
    ...card,
    abilities: [...card.abilities],
  } as T;
}

export function loadToughCards(): ToughCard[] {
  return parsed.map(toToughCard);
}

export function loadStarterToughCards(
  starterCount = simConfig.starterCollection.toughPoolSize,
): ToughCard[] {
  return loadToughCards().slice(0, starterCount);
}

/**
 * Return a fresh copy of every compiled tough. `parsed` is a module-level
 * Zod-parsed array; returning it directly would hand callers the shared
 * mutable reference and any push/splice would corrupt every other
 * consumer for the life of the process.
 */
export function loadCompiledToughs(): CompiledTough[] {
  return parsed.map((t) => ({
    ...t,
    abilities: [...t.abilities],
    portrait: clonePortrait(t.portrait),
  }));
}

/**
 * Load every compiled mythic as a runtime ToughCard (mythics share the
 * tough card shape — §11 says mythics are a subset of toughs with
 * `rarity: 'mythic'`). hp/maxHp are defaulted to resistance, identical
 * to `loadToughCards`.
 *
 * These are intentionally **not** included in `loadToughCards()` output
 * because mythics never enter the common pack pool (§3.3 drop rate is
 * 0%). Callers that want the mythic pool (e.g. `game.ts` seeding
 * `state.mythicPool`) call this loader explicitly.
 */
export function loadMythicCards(): ToughCard[] {
  return parsedMythics.map(toToughCard);
}

let cachedCollectibleCards: Card[] | null = null;

/**
 * Full collectible catalog used by persistence and gallery surfaces.
 * Centralizing this avoids drift between screens when new card families
 * (like mythics or authored currency) are added to the owned-card set.
 */
export function loadCollectibleCards(): Card[] {
  if (cachedCollectibleCards === null) {
    cachedCollectibleCards = [
      ...loadToughCards(),
      ...loadMythicCards(),
      ...generateWeapons(),
      ...generateDrugs(),
      ...loadCurrencyCatalog(),
    ];
  }
  return cachedCollectibleCards.map(cloneRuntimeCard);
}

/** Return the 10 mythic card ids as a fresh array for `mythicPool` seeding. */
export function loadMythicPoolIds(): string[] {
  return parsedMythics.map((m) => m.id);
}

/** Raw compiled mythic records (includes `mythic_signature` doc block). */
export function loadCompiledMythics(): CompiledMythic[] {
  return parsedMythics.map((m) => ({
    ...m,
    abilities: [...m.abilities],
    portrait: clonePortrait(m.portrait),
  }));
}
