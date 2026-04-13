/**
 * Character card generator.
 *
 * Combines name pools, archetypes, and affiliations to produce
 * 100 unique named character cards with stats derived from their
 * archetype + affiliation + tier.
 */

import namesPool from '../../data/pools/names.json';
import archetypesPool from '../../data/pools/archetypes.json';
import affiliationsPool from '../../data/pools/affiliations.json';
import { CharacterCardSchema, type CharacterCard } from './schemas';

/** Seeded random for reproducible card generation. */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Pick a random element from an array using the rng. */
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Generate a display name from components. */
function formatName(
  first: string,
  nickname: string | undefined,
  last: string | undefined,
): string {
  if (nickname && last) return `${first} "${nickname}" ${last}`;
  if (nickname) return `${first} "${nickname}"`;
  if (last) return `${first} ${last}`;
  return first;
}

/**
 * Base stat calculations from tier (1-5).
 * ATK scales faster than DEF so fights resolve before stalling.
 */
function baseAtk(tier: number): number {
  // Tier 1: 3, Tier 2: 4, Tier 3: 6, Tier 4: 7, Tier 5: 9
  return Math.floor(2 + tier * 1.5);
}
function baseDef(tier: number): number {
  // Tier 1: 2, Tier 2: 2, Tier 3: 3, Tier 4: 4, Tier 5: 5
  return Math.floor(1 + tier * 0.8);
}

/**
 * Calculate day/night ATK/DEF from tier + archetype + affiliation.
 */
function calcStats(
  tier: number,
  archetype: typeof archetypesPool.archetypes[0],
  affiliation: typeof affiliationsPool.affiliations[0] | typeof affiliationsPool.freelance,
) {
  const atkBase = Math.max(1, baseAtk(tier) + archetype.statBias.atkMod + affiliation.modifier.atkBonus);
  const defBase = Math.max(1, baseDef(tier) + archetype.statBias.defMod + affiliation.modifier.defBonus);

  // Day/night shift based on archetype
  let dayAtk = atkBase;
  let dayDef = defBase;
  let nightAtk = atkBase;
  let nightDef = defBase;

  switch (archetype.dayNightShift) {
    case 'day_strong':
      dayAtk += 1;
      dayDef += 1;
      nightAtk = Math.max(0, nightAtk - 1);
      break;
    case 'night_strong':
      nightAtk += 1;
      nightDef += 1;
      dayAtk = Math.max(0, dayAtk - 1);
      break;
  }

  // Affiliation special modifiers
  if (affiliation.modifier.special === 'night_atk_2') {
    nightAtk += 2;
    dayAtk = Math.max(0, dayAtk - 1);
  }

  return {
    dayAtk: Math.max(0, dayAtk),
    dayDef: Math.max(1, dayDef),
    nightAtk: Math.max(0, nightAtk),
    nightDef: Math.max(1, nightDef),
  };
}

/**
 * Generate 100 unique character cards.
 *
 * @param seed Random seed for reproducibility
 * @param starterCount How many cards are unlocked at start
 */
export function generateAllCards(
  seed = 42,
  starterCount = 20,
): CharacterCard[] {
  const rng = createRng(seed);
  const cards: CharacterCard[] = [];
  const usedNames = new Set<string>();

  const allFirstNames = [
    ...namesPool.western.first,
    ...namesPool.eastern.first,
    ...namesPool.hispanic.first,
  ];
  const allLastNames = [
    ...namesPool.western.last,
    ...namesPool.eastern.last,
    ...namesPool.hispanic.last,
  ];
  const { nicknames } = namesPool;
  const { archetypes } = archetypesPool;
  const allAffiliations = [
    ...affiliationsPool.affiliations,
    affiliationsPool.freelance,
  ];

  // Distribute: ~9 cards per affiliation (10 affs) + ~10 freelance = 100
  const affiliationQueue: Array<typeof allAffiliations[0]> = [];
  for (const aff of affiliationsPool.affiliations) {
    for (let i = 0; i < 9; i++) affiliationQueue.push(aff);
  }
  // Fill remaining with freelance
  while (affiliationQueue.length < 100) {
    affiliationQueue.push(affiliationsPool.freelance);
  }

  // Shuffle the affiliation queue
  for (let i = affiliationQueue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [affiliationQueue[i], affiliationQueue[j]] = [affiliationQueue[j], affiliationQueue[i]];
  }

  for (let i = 0; i < 100; i++) {
    // Pick unique name
    let firstName: string;
    let nickname: string | undefined;
    let lastName: string | undefined;
    let displayName: string;

    let attempts = 0;
    do {
      firstName = pick(allFirstNames, rng);
      // 60% chance of "FirstName 'Nickname' LastName" pattern
      // 40% chance of "FirstName 'The Archetype'" (archetype title used later)
      if (rng() < 0.6) {
        nickname = pick(nicknames, rng);
        lastName = pick(allLastNames, rng);
      } else {
        nickname = undefined;
        lastName = pick(allLastNames, rng);
      }
      displayName = formatName(firstName, nickname, lastName);
      attempts++;
    } while (usedNames.has(displayName) && attempts < 50);

    usedNames.add(displayName);

    // Pick archetype (roughly even distribution)
    const archetype = archetypes[i % archetypes.length];
    const affiliation = affiliationQueue[i];

    // Tier: distribute across 1-5 (20 cards per tier)
    const tier = Math.floor(i / 20) + 1;

    // Calculate stats
    const stats = calcStats(tier, archetype, affiliation);

    // If no nickname was generated, use archetype title as nickname
    const finalNickname = nickname ?? undefined;
    const finalDisplayName = nickname
      ? displayName
      : `${firstName} "${archetype.title.replace('The ', '')}" ${lastName ?? ''}`.trim();

    const card: CharacterCard = {
      id: `card-${String(i + 1).padStart(3, '0')}`,
      firstName,
      nickname: finalNickname,
      lastName,
      displayName: finalDisplayName,
      archetype: archetype.id,
      affiliation: affiliation.id,
      tier,
      ...stats,
      ability: archetype.ability,
      abilityDesc: archetype.abilityDesc,
      unlocked: i < starterCount,
      unlockCondition: i >= starterCount
        ? generateUnlockCondition(i, rng)
        : undefined,
    };

    // Validate
    const result = CharacterCardSchema.safeParse(card);
    if (!result.success) {
      const issues = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      console.error(`Card ${i} validation failed:\n${issues.join('\n')}`);
      continue;
    }

    cards.push(result.data);
  }

  return cards;
}

/** Generate an unlock condition string for a card. */
function generateUnlockCondition(index: number, rng: () => number): string {
  const conditions = [
    `Win ${Math.floor(rng() * 5 + 3)} games`,
    `Win ${Math.floor(rng() * 3 + 1)} games with a full Freelance deck`,
    `Kill ${Math.floor(rng() * 10 + 5)} vanguards total`,
    `Win a game in under ${Math.floor(rng() * 5 + 10)} turns`,
    `Win a game using only cards from 2 affiliations`,
    `Trigger ${Math.floor(rng() * 5 + 3)} overdraw penalties on opponents`,
    `Win without using any reserves`,
    `Win with a deck containing 3+ affiliations`,
    `Deal ${Math.floor(rng() * 20 + 30)} total damage in a single game`,
    `Win a game on the first night phase`,
  ];
  return conditions[index % conditions.length];
}

/** Print a summary of the generated card pool. */
export function printCardPoolSummary(cards: CharacterCard[]): void {
  console.log(`\nTotal cards: ${cards.length}`);
  console.log(`Unlocked: ${cards.filter(c => c.unlocked).length}`);

  // By affiliation
  const byAff: Record<string, number> = {};
  for (const c of cards) {
    byAff[c.affiliation] = (byAff[c.affiliation] ?? 0) + 1;
  }
  console.log('\nBy affiliation:');
  for (const [aff, count] of Object.entries(byAff).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${aff.padEnd(20)} ${count}`);
  }

  // By archetype
  const byArch: Record<string, number> = {};
  for (const c of cards) {
    byArch[c.archetype] = (byArch[c.archetype] ?? 0) + 1;
  }
  console.log('\nBy archetype:');
  for (const [arch, count] of Object.entries(byArch).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${arch.padEnd(20)} ${count}`);
  }

  // By tier
  const byTier: Record<number, number> = {};
  for (const c of cards) {
    byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
  }
  console.log('\nBy tier:');
  for (const [tier, count] of Object.entries(byTier)) {
    console.log(`  Tier ${tier}: ${count} cards`);
  }

  // Stat ranges by tier
  console.log('\nStat ranges by tier:');
  for (let t = 1; t <= 5; t++) {
    const tierCards = cards.filter(c => c.tier === t);
    if (tierCards.length === 0) continue;
    const dAtk = tierCards.map(c => c.dayAtk);
    const dDef = tierCards.map(c => c.dayDef);
    const nAtk = tierCards.map(c => c.nightAtk);
    const nDef = tierCards.map(c => c.nightDef);
    console.log(
      `  Tier ${t}: dayATK ${Math.min(...dAtk)}-${Math.max(...dAtk)} ` +
      `dayDEF ${Math.min(...dDef)}-${Math.max(...dDef)} ` +
      `nightATK ${Math.min(...nAtk)}-${Math.max(...nAtk)} ` +
      `nightDEF ${Math.min(...nDef)}-${Math.max(...nDef)}`,
    );
  }

  // Sample cards
  console.log('\nSample cards:');
  for (let i = 0; i < Math.min(10, cards.length); i++) {
    const c = cards[i];
    console.log(
      `  ${c.displayName.padEnd(30)} ` +
      `[${c.archetype}] ` +
      `${c.affiliation.padEnd(18)} ` +
      `T${c.tier} ` +
      `day:${c.dayAtk}/${c.dayDef} night:${c.nightAtk}/${c.nightDef} ` +
      `${c.unlocked ? '✓' : '🔒'}`,
    );
  }
}
