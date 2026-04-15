import namesPool from '../../data/pools/names.json';
import archetypesPool from '../../data/pools/archetypes.json';
import affiliationsPool from '../../data/pools/affiliations.json';
import type { ToughCard } from '../turf/types';
import { createRng } from './rng';

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

function formatName(first: string, nick?: string, last?: string): string {
  if (nick && last) return `${first} "${nick}" ${last}`;
  if (nick) return `${first} "${nick}"`;
  if (last) return `${first} ${last}`;
  return first;
}

function calcPower(index: number, powerMod: number): number {
  const base = Math.floor(1 + (index / 99) * 8);
  return Math.max(1, Math.min(12, base + powerMod));
}

function calcResistance(index: number, resistanceMod: number): number {
  const base = Math.floor(1 + (index / 99) * 7);
  return Math.max(1, Math.min(12, base + resistanceMod));
}

export function generateAllCards(seed = 42): ToughCard[] {
  const rng = createRng(seed);
  const cards: ToughCard[] = [];
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

  const affQueue: string[] = [];
  for (const aff of affiliationsPool.affiliations) {
    for (let i = 0; i < 9; i++) affQueue.push(aff.id);
  }
  while (affQueue.length < 100) affQueue.push('freelance');

  for (let i = affQueue.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [affQueue[i], affQueue[j]] = [affQueue[j], affQueue[i]];
  }

  for (let i = 0; i < 100; i++) {
    let firstName: string,
      nickname: string | undefined,
      lastName: string | undefined;
    let displayName: string;

    let attempts = 0;
    do {
      firstName = pick(allFirst, rng);
      if (rng.next() < 0.6) {
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
    const resistance = calcResistance(i, archetype.resistanceMod ?? 0);

    if (!nickname) {
      displayName =
        `${firstName} "${archetype.title}" ${lastName ?? ''}`.trim();
    }

    const card: ToughCard = {
      kind: 'tough',
      id: `card-${String(i + 1).padStart(3, '0')}`,
      name: displayName,
      tagline: '',
      archetype: archetype.id,
      affiliation,
      power,
      resistance,
      rarity: 'common',
      abilities: [archetype.abilityText],
    };

    cards.push(card);
  }
  return cards;
}

export function printCardPoolSummary(cards: ToughCard[]): void {
  console.log(
    `\nTotal: ${cards.length} | First 25: ${cards.slice(0, 25).length}`,
  );

  const byAff: Record<string, number> = {};
  const byArch: Record<string, number> = {};
  const byPower: Record<number, number> = {};
  for (const c of cards) {
    byAff[c.affiliation] = (byAff[c.affiliation] ?? 0) + 1;
    byArch[c.archetype] = (byArch[c.archetype] ?? 0) + 1;
    byPower[c.power] = (byPower[c.power] ?? 0) + 1;
  }

  console.log(
    '\nAffiliation:',
    Object.entries(byAff)
      .map(([k, v]) => `${k}:${v}`)
      .join(' '),
  );
  console.log(
    'Archetype:',
    Object.entries(byArch)
      .map(([k, v]) => `${k}:${v}`)
      .join(' '),
  );
  console.log(
    'Power:',
    Object.entries(byPower)
      .sort(([a], [b]) => +a - +b)
      .map(([k, v]) => `${k}:${v}`)
      .join(' '),
  );

  console.log('\nSample:');
  for (let i = 0; i < 10; i++) {
    const c = cards[i];
    console.log(
      `  ${c.name.padEnd(30)} P:${c.power} [${c.archetype}] ${c.affiliation}`,
    );
  }
}
