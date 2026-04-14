/**
 * Category-based generators for weapon, drug, and cash card pools.
 * Weapons: 5 categories x 10 = 50 unique cards.
 * Drugs: 5 categories x 10 = 50 unique cards.
 * Cash: 25x $100 + 5x $1000 = 30 cards.
 */

import weaponCategoriesPool from '../../data/pools/weapon-categories.json';
import drugCategoriesPool from '../../data/pools/drug-categories.json';
import type { BackpackCard, WeaponCard, ProductCard, CashCard, PayloadCard } from './types';
import type { Rng } from '../cards/rng';

const WEAPONS_PER_CATEGORY = 10;
const DRUGS_PER_CATEGORY = 10;
const UNLOCKED_PER_CATEGORY = 4;

function calcBonus(index: number, min: number, max: number, mod: number): number {
  const range = max - min;
  const base = min + Math.round((index / (WEAPONS_PER_CATEGORY - 1)) * range);
  return Math.max(1, Math.min(5, base + mod));
}

function weaponUnlockCondition(rng: Rng): string {
  const conds = [
    `Win ${rng.int(3, 7)} games`,
    `Kill ${rng.int(5, 15)} enemies total`,
    `Win a game using only bladed weapons`,
    `Win a game in under ${rng.int(12, 16)} rounds`,
    `Seize ${rng.int(10, 20)} positions total`,
    `Win without losing a position`,
    `Kill ${rng.int(3, 5)} enemies in a single game`,
    `Win with all 5 weapon categories in your deck`,
  ];
  return rng.pick(conds);
}

function drugUnlockCondition(rng: Rng): string {
  const conds = [
    `Win ${rng.int(3, 7)} games`,
    `Use ${rng.int(10, 20)} drugs in total across games`,
    `Win a game using only stimulants`,
    `Flip ${rng.int(5, 10)} enemies total`,
    `Win without using steroids`,
    `Win a game with all 5 drug categories in your deck`,
    `Win a game in under ${rng.int(12, 16)} rounds`,
    `Survive ${rng.int(3, 5)} killing blows using painkillers`,
  ];
  return rng.pick(conds);
}

function getBonusRange(categoryId: string): { min: number; max: number } {
  switch (categoryId) {
    case 'bladed': return { min: 1, max: 3 };
    case 'blunt': return { min: 2, max: 4 };
    case 'explosive': return { min: 2, max: 4 };
    case 'ranged': return { min: 1, max: 2 };
    case 'stealth': return { min: 1, max: 2 };
    default: return { min: 1, max: 3 };
  }
}

function getPotencyRange(categoryId: string): { min: number; max: number } {
  switch (categoryId) {
    case 'stimulant': return { min: 1, max: 3 };
    case 'sedative': return { min: 2, max: 4 };
    case 'hallucinogen': return { min: 1, max: 3 };
    case 'steroid': return { min: 2, max: 4 };
    case 'narcotic': return { min: 1, max: 2 };
    default: return { min: 1, max: 3 };
  }
}

/** Generate 50 weapon cards from 5 categories x 10. */
export function generateWeapons(rng: Rng): WeaponCard[] {
  const cards: WeaponCard[] = [];
  let globalIdx = 0;

  for (const cat of weaponCategoriesPool.categories) {
    const names = rng.shuffle([...cat.names]);
    const bonusRange = getBonusRange(cat.id);

    for (let i = 0; i < WEAPONS_PER_CATEGORY; i++) {
      const name = names[i % names.length];
      const bonus = calcBonus(i, bonusRange.min, bonusRange.max, cat.bonusMod);
      const isUnlocked = i < UNLOCKED_PER_CATEGORY;

      cards.push({
        type: 'weapon',
        id: `weap-${String(globalIdx + 1).padStart(2, '0')}`,
        name,
        category: cat.id,
        bonus,
        offenseAbility: cat.offenseAbility,
        offenseAbilityText: cat.offenseAbilityText,
        defenseAbility: cat.defenseAbility,
        defenseAbilityText: cat.defenseAbilityText,
        unlocked: isUnlocked,
        unlockCondition: isUnlocked ? undefined : weaponUnlockCondition(rng),
        locked: false,
      });
      globalIdx++;
    }
  }
  return cards;
}

/** Generate 50 drug cards from 5 categories x 10. */
export function generateDrugs(rng: Rng): ProductCard[] {
  const cards: ProductCard[] = [];
  let globalIdx = 0;
  const usedNames = new Set<string>();

  for (const cat of drugCategoriesPool.categories) {
    const adjectives = rng.shuffle([...cat.adjectives]);
    const nouns = rng.shuffle([...cat.nouns]);
    const potencyRange = getPotencyRange(cat.id);

    for (let i = 0; i < DRUGS_PER_CATEGORY; i++) {
      let name: string;
      let attempts = 0;
      do {
        const adj = adjectives[i % adjectives.length];
        const noun = nouns[(i + attempts) % nouns.length];
        name = `${adj} ${noun}`;
        attempts++;
      } while (usedNames.has(name) && attempts < 50);
      usedNames.add(name);

      const potency = calcBonus(i, potencyRange.min, potencyRange.max, cat.potencyMod);
      const isUnlocked = i < UNLOCKED_PER_CATEGORY;

      cards.push({
        type: 'product',
        id: `drug-${String(globalIdx + 1).padStart(2, '0')}`,
        name,
        category: cat.id,
        potency,
        offenseAbility: cat.offenseAbility,
        offenseAbilityText: cat.offenseAbilityText,
        defenseAbility: cat.defenseAbility,
        defenseAbilityText: cat.defenseAbilityText,
        unlocked: isUnlocked,
        unlockCondition: isUnlocked ? undefined : drugUnlockCondition(rng),
        locked: false,
      });
      globalIdx++;
    }
  }
  return cards;
}

/** Generate base cash pool: 25x $100 + 5x $1000. */
export function generateCash(): CashCard[] {
  const cards: CashCard[] = [];
  for (let i = 0; i < 25; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(i + 1).padStart(3, '0')}`,
      denomination: 100,
    });
  }
  for (let i = 0; i < 5; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(26 + i).padStart(3, '0')}`,
      denomination: 1000,
    });
  }
  return cards;
}

function clonePayload(card: PayloadCard, backpackId: string, slot: number): PayloadCard {
  return {
    ...card,
    id: `${backpackId}::slot-${slot + 1}::${card.id}`,
  };
}

const BACKPACK_ICONS = ['knife', 'vial', 'cash', 'mask', 'bolt', 'crosshair', 'crate', 'flame'] as const;
const BACKPACK_PREFIXES = ['Runner', 'Drop', 'Ghost', 'Street', 'Stash', 'Courier', 'Night', 'Hotshot'] as const;
const BACKPACK_SUFFIXES = ['Pack', 'Kit', 'Loadout', 'Bag', 'Rig', 'Bundle', 'Satchel', 'Cache'] as const;

/**
 * Generate backpack kits that package quarter-card payload into a full-card draw object.
 * These are the canonical modifier draw objects for the runner migration.
 */
export function generateBackpacks(
  rng: Rng,
  weapons: WeaponCard[],
  drugs: ProductCard[],
  cash: CashCard[],
  count = 30,
): BackpackCard[] {
  const unlockedWeapons = weapons.filter(card => card.unlocked);
  const unlockedDrugs = drugs.filter(card => card.unlocked);
  const allWeapons = unlockedWeapons.length > 0 ? unlockedWeapons : weapons;
  const allDrugs = unlockedDrugs.length > 0 ? unlockedDrugs : drugs;
  const allCash = cash;
  const backpacks: BackpackCard[] = [];

  for (let i = 0; i < count; i++) {
    const id = `pack-${String(i + 1).padStart(2, '0')}`;
    const size = (2 + (i % 3)) as 2 | 3 | 4;
    const pattern = i % 5;
    const payload: PayloadCard[] = [];

    if (pattern === 0) {
      payload.push(allCash[i % allCash.length], allWeapons[i % allWeapons.length]);
      if (size >= 3) payload.push(allCash[(i + 7) % allCash.length]);
      if (size >= 4) payload.push(allDrugs[i % allDrugs.length]);
    } else if (pattern === 1) {
      payload.push(allCash[i % allCash.length], allDrugs[i % allDrugs.length]);
      if (size >= 3) payload.push(allWeapons[(i + 5) % allWeapons.length]);
      if (size >= 4) payload.push(allCash[(i + 11) % allCash.length]);
    } else if (pattern === 2) {
      payload.push(allWeapons[i % allWeapons.length], allDrugs[i % allDrugs.length]);
      if (size >= 3) payload.push(allCash[(i + 13) % allCash.length]);
      if (size >= 4) payload.push(allWeapons[(i + 3) % allWeapons.length]);
    } else if (pattern === 3) {
      payload.push(allCash[i % allCash.length], allCash[(i + 3) % allCash.length]);
      if (size >= 3) payload.push(allDrugs[(i + 9) % allDrugs.length]);
      if (size >= 4) payload.push(allWeapons[(i + 9) % allWeapons.length]);
    } else {
      payload.push(allDrugs[i % allDrugs.length], allWeapons[(i + 1) % allWeapons.length]);
      if (size >= 3) payload.push(allDrugs[(i + 7) % allDrugs.length]);
      if (size >= 4) payload.push(allCash[(i + 17) % allCash.length]);
    }

    const unlocked = i < 8;
    backpacks.push({
      type: 'backpack',
      id,
      name: `${BACKPACK_PREFIXES[i % BACKPACK_PREFIXES.length]} ${BACKPACK_SUFFIXES[(i + 2) % BACKPACK_SUFFIXES.length]}`,
      icon: BACKPACK_ICONS[i % BACKPACK_ICONS.length],
      size,
      payload: payload.slice(0, size).map((card, slot) => clonePayload(card, id, slot)),
      unlocked,
      unlockCondition: unlocked ? undefined : `Win ${3 + (i % 5)} games with a runner in your deck`,
      locked: false,
    });
  }

  return rng.shuffle(backpacks);
}
