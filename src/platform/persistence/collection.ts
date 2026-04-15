import type { Card } from '../../sim/turf/types';
import type { PackReward } from '../../sim/packs/types';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generatePack, starterGrant } from '../../sim/packs/generator';
import { loadProfile, saveProfile } from './storage';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';

function allCardPool(): Card[] {
  return [
    ...loadToughCards(),
    ...generateWeapons(),
    ...generateDrugs(),
    ...generateCurrency(),
  ];
}

function resolveCardIds(ids: string[]): Card[] {
  const pool = allCardPool();
  const poolMap = new Map(pool.map(c => [c.id, c]));
  return ids.map(id => poolMap.get(id)).filter((c): c is Card => c != null);
}

export async function loadCollection(): Promise<Card[]> {
  const profile = await loadProfile();
  if (profile.unlockedCardIds.length === 0) {
    return grantStarterCollection();
  }
  return resolveCardIds(profile.unlockedCardIds);
}

export async function saveCollection(cards: Card[]): Promise<void> {
  const profile = await loadProfile();
  profile.unlockedCardIds = cards.map(c => c.id);
  await saveProfile(profile);
}

export async function addCardsToCollection(newCards: Card[]): Promise<Card[]> {
  const profile = await loadProfile();
  const existingIds = new Set(profile.unlockedCardIds);
  for (const card of newCards) {
    existingIds.add(card.id);
  }
  profile.unlockedCardIds = [...existingIds];
  await saveProfile(profile);
  return resolveCardIds(profile.unlockedCardIds);
}

export async function grantStarterCollection(): Promise<Card[]> {
  const rng = createRng(randomSeed());
  const cards = starterGrant(rng);
  await saveCollection(cards);
  return cards;
}

export async function openRewardPacks(
  rewards: PackReward[],
  suddenDeathWin: boolean,
): Promise<Card[]> {
  const baseCollection = await loadCollection();
  const rng = createRng(randomSeed());
  const newCards: Card[] = [];
  // Running view of unlocked cards so each pack in the batch reflects
  // unlocks from prior packs in the same call (avoids stale-snapshot dupes).
  const runningCollection: Card[] = [...baseCollection];
  const seenIds = new Set(runningCollection.map(c => c.id));

  for (const reward of rewards) {
    for (let i = 0; i < reward.count; i++) {
      const packCards = generatePack(reward.kind, runningCollection, rng, { suddenDeathWin });
      newCards.push(...packCards);
      for (const card of packCards) {
        if (!seenIds.has(card.id)) {
          seenIds.add(card.id);
          runningCollection.push(card);
        }
      }
    }
  }

  if (newCards.length > 0) {
    await addCardsToCollection(newCards);
  }

  return newCards;
}
