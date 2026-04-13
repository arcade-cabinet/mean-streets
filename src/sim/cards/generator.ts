/**
 * Character card generator.
 * 100 unique named characters with single Power stat + ability text.
 */

import namesPool from '../../data/pools/names.json';
import archetypesPool from '../../data/pools/archetypes.json';
import affiliationsPool from '../../data/pools/affiliations.json';
import { CharacterCardSchema, type CharacterCard } from './schemas';

function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function formatName(first: string, nick?: string, last?: string): string {
  if (nick && last) return `${first} "${nick}" ${last}`;
  if (nick) return `${first} "${nick}"`;
  if (last) return `${first} ${last}`;
  return first;
}

/**
 * Power scales 1-10 across 100 cards.
 * Archetype powerMod adjusts (-1 to +1).
 */
function calcPower(index: number, powerMod: number): number {
  // Cards 0-19: power 1-3, 20-39: 2-4, 40-59: 3-6, 60-79: 5-8, 80-99: 7-10
  const base = Math.floor(1 + (index / 99) * 8);
  return Math.max(1, Math.min(12, base + powerMod));
}

export function generateAllCards(seed = 42, starterCount = 20): CharacterCard[] {
  const rng = createRng(seed);
  const cards: CharacterCard[] = [];
  const usedNames = new Set<string>();

  const allFirst = [
    ...namesPool.western.first,
    ...namesPool.eastern.first,
    ...namesPool.hispanic.first,
  ];
  const allLast = [
    ...namesPool.western.last,
    ...namesPool.eastern.last,
    ...namesPool.hispanic.last,
  ];
  const { nicknames } = namesPool;
  const { archetypes } = archetypesPool;

  // Build affiliation queue: ~9 per affiliation + ~10 freelance
  const affQueue: string[] = [];
  for (const aff of affiliationsPool.affiliations) {
    for (let i = 0; i < 9; i++) affQueue.push(aff.id);
  }
  while (affQueue.length < 100) affQueue.push('freelance');

  // Shuffle affiliation queue
  for (let i = affQueue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [affQueue[i], affQueue[j]] = [affQueue[j], affQueue[i]];
  }

  for (let i = 0; i < 100; i++) {
    let firstName: string, nickname: string | undefined, lastName: string | undefined;
    let displayName: string;

    let attempts = 0;
    do {
      firstName = pick(allFirst, rng);
      if (rng() < 0.6) {
        nickname = pick(nicknames, rng);
        lastName = pick(allLast, rng);
      } else {
        nickname = undefined;
        lastName = pick(allLast, rng);
      }
      displayName = formatName(firstName, nickname, lastName);
      attempts++;
    } while (usedNames.has(displayName) && attempts < 50);
    usedNames.add(displayName);

    const archetype = archetypes[i % archetypes.length];
    const affiliation = affQueue[i];
    const power = calcPower(i, archetype.powerMod);

    // If no nickname, use archetype title
    if (!nickname) {
      displayName = `${firstName} "${archetype.title}" ${lastName ?? ''}`.trim();
    }

    const card: CharacterCard = {
      id: `card-${String(i + 1).padStart(3, '0')}`,
      displayName,
      archetype: archetype.id,
      affiliation,
      power,
      abilityText: archetype.abilityText,
      unlocked: i < starterCount,
      unlockCondition: i >= starterCount
        ? unlockCondition(i, rng)
        : undefined,
    };

    const result = CharacterCardSchema.safeParse(card);
    if (result.success) {
      cards.push(result.data);
    } else {
      console.error(`Card ${i} failed:`, result.error.issues);
    }
  }
  return cards;
}

function unlockCondition(idx: number, rng: () => number): string {
  const conds = [
    `Win ${Math.floor(rng() * 5 + 3)} games`,
    `Kill ${Math.floor(rng() * 10 + 5)} vanguards total`,
    `Win a game in under ${Math.floor(rng() * 5 + 12)} turns`,
    `Win using only 2 affiliations`,
    `Trigger ${Math.floor(rng() * 5 + 3)} overdraw penalties`,
    `Win without using reserves`,
    `Win with a deck containing 3+ affiliations`,
    `Win without sacrificing any cards`,
    `Use a Ghost to attack from reserves 3 times`,
    `Steal 5 cards with Hustlers across all games`,
  ];
  return conds[idx % conds.length];
}

export function printCardPoolSummary(cards: CharacterCard[]): void {
  console.log(`\nTotal: ${cards.length} | Unlocked: ${cards.filter(c => c.unlocked).length}`);

  const byAff: Record<string, number> = {};
  const byArch: Record<string, number> = {};
  const byPower: Record<number, number> = {};
  for (const c of cards) {
    byAff[c.affiliation] = (byAff[c.affiliation] ?? 0) + 1;
    byArch[c.archetype] = (byArch[c.archetype] ?? 0) + 1;
    byPower[c.power] = (byPower[c.power] ?? 0) + 1;
  }

  console.log('\nAffiliation:', Object.entries(byAff).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log('Archetype:', Object.entries(byArch).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log('Power:', Object.entries(byPower).sort(([a], [b]) => +a - +b).map(([k, v]) => `${k}:${v}`).join(' '));

  console.log('\nSample:');
  for (let i = 0; i < 10; i++) {
    const c = cards[i];
    console.log(`  ${c.displayName.padEnd(30)} P:${c.power} [${c.archetype}] ${c.affiliation} ${c.unlocked ? '✓' : '🔒'}`);
  }
}
