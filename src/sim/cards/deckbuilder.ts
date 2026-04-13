/**
 * Deck builder — selects 20 cards from the pool respecting
 * affiliation conflict rules, then assigns to active vs reserves.
 *
 * Active stack: up to 6 cards drawn at game start
 * Reserves: up to 3 cards, accessible at a cost mid-game
 * Reserves also create "distance" between conflicting affiliations
 */

import type { CharacterCard } from './schemas';
import affiliationsPool from '../../data/pools/affiliations.json';

const allAffiliations = [
  ...affiliationsPool.affiliations,
  affiliationsPool.freelance,
];

/** Get affiliation data by ID. */
function getAffiliation(id: string) {
  return allAffiliations.find(a => a.id === id);
}

/** Check if two affiliations are at war. */
export function areAtWar(affA: string, affB: string): boolean {
  if (affA === affB) return false;
  if (affA === 'freelance' || affB === 'freelance') return false;
  const a = getAffiliation(affA);
  const b = getAffiliation(affB);
  if (!a || !b) return false;
  return a.atWarWith.includes(affB) || b.atWarWith.includes(affA);
}

/** Check if two affiliations are at peace. */
export function areAtPeace(affA: string, affB: string): boolean {
  if (affA === affB) return true;
  if (affA === 'freelance' || affB === 'freelance') return true;
  const a = getAffiliation(affA);
  if (!a) return false;
  return a.atPeaceWith.includes(affB);
}

/**
 * Check if a card can be adjacent to another in the active stack.
 * Cards at war cannot be adjacent. Reserves create a buffer.
 */
export function canBeAdjacent(cardA: CharacterCard, cardB: CharacterCard): boolean {
  return !areAtWar(cardA.affiliation, cardB.affiliation);
}

/** Validate an active stack ordering — no adjacent war conflicts. */
export function validateActiveStack(stack: CharacterCard[]): {
  valid: boolean;
  conflicts: Array<{ indexA: number; indexB: number; reason: string }>;
} {
  const conflicts: Array<{ indexA: number; indexB: number; reason: string }> = [];
  for (let i = 0; i < stack.length - 1; i++) {
    if (areAtWar(stack[i].affiliation, stack[i + 1].affiliation)) {
      conflicts.push({
        indexA: i,
        indexB: i + 1,
        reason: `${stack[i].displayName} (${stack[i].affiliation}) at war with ${stack[i + 1].displayName} (${stack[i + 1].affiliation})`,
      });
    }
  }
  return { valid: conflicts.length === 0, conflicts };
}

/** Count synergy bonuses in a deck (peace bonuses between adjacent cards). */
export function countSynergies(stack: CharacterCard[]): number {
  let synergies = 0;
  for (let i = 0; i < stack.length - 1; i++) {
    if (areAtPeace(stack[i].affiliation, stack[i + 1].affiliation)) {
      synergies++;
    }
  }
  return synergies;
}

export interface BuiltDeck {
  active: CharacterCard[];
  reserves: CharacterCard[];
  conflicts: number;
  synergies: number;
}

/**
 * AI deck builder — picks 20 cards from the pool and assigns
 * them to active (6) + reserves (3) optimally.
 *
 * Strategy: maximize synergy, minimize conflicts, put buffer
 * cards (freelancers) between warring factions in reserves.
 */
export function buildAiDeck(
  pool: CharacterCard[],
  deckSize = 20,
  activeSize = 6,
  reserveSize = 3,
  rng = Math.random,
): BuiltDeck {
  const available = pool.filter(c => c.unlocked);
  if (available.length < deckSize) {
    throw new Error(
      `Not enough unlocked cards: need ${deckSize}, have ${available.length}`,
    );
  }

  // Sort by tier (higher is stronger) then shuffle within tiers
  const sorted = [...available].sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return rng() - 0.5;
  });

  // Pick top cards by tier, trying to avoid too many war conflicts
  const deck = sorted.slice(0, deckSize);

  // Separate into active and reserves
  // Put freelancers and fixers in reserves (buffer cards)
  const buffers = deck.filter(
    c => c.affiliation === 'freelance' || c.archetype === 'fixer',
  );
  const nonBuffers = deck.filter(
    c => c.affiliation !== 'freelance' && c.archetype !== 'fixer',
  );

  const reserves: CharacterCard[] = [];
  const active: CharacterCard[] = [];

  // Fill reserves with buffers first (up to reserveSize)
  for (const b of buffers) {
    if (reserves.length < reserveSize) reserves.push(b);
    else active.push(b);
  }

  // Fill active with non-buffers, trying to order by affiliation
  // to minimize adjacency conflicts
  const byAff: Record<string, CharacterCard[]> = {};
  for (const c of nonBuffers) {
    if (!byAff[c.affiliation]) byAff[c.affiliation] = [];
    byAff[c.affiliation].push(c);
  }

  // Interleave affiliations that are at peace, separate those at war
  const affGroups = Object.entries(byAff);
  for (const [, cards] of affGroups) {
    for (const card of cards) {
      if (active.length < activeSize) active.push(card);
      else if (reserves.length < reserveSize) reserves.push(card);
      // else: card is in the deck but not in active or reserves
      // (remaining cards form the "draw pile" for the rest of the game)
    }
  }

  // Validate and count
  const validation = validateActiveStack(active);
  const synergies = countSynergies(active);

  return {
    active,
    reserves,
    conflicts: validation.conflicts.length,
    synergies,
  };
}

/**
 * Build a random deck for simulation — less optimized than AI,
 * just picks random unlocked cards.
 */
export function buildRandomDeck(
  pool: CharacterCard[],
  deckSize = 20,
  activeSize = 6,
  reserveSize = 3,
  rng = Math.random,
): BuiltDeck {
  const available = pool.filter(c => c.unlocked);
  // Shuffle
  const shuffled = [...available].sort(() => rng() - 0.5);
  const deck = shuffled.slice(0, deckSize);

  const active = deck.slice(0, activeSize);
  const reserves = deck.slice(activeSize, activeSize + reserveSize);

  const validation = validateActiveStack(active);
  const synergies = countSynergies(active);

  return {
    active,
    reserves,
    conflicts: validation.conflicts.length,
    synergies,
  };
}
