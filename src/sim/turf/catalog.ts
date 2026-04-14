import { loadStarterCrewCards } from '../cards/catalog';
import { createRng } from '../cards/rng';
import {
  generateBackpacks,
  generateCash,
  generateDrugs,
  generateWeapons,
} from './generators';
import type {
  BackpackCard,
  CashCard,
  CrewCard,
  ProductCard,
  WeaponCard,
} from './types';

export interface TurfCardPools {
  crew: CrewCard[];
  weapons: WeaponCard[];
  drugs: ProductCard[];
  cash: CashCard[];
  backpacks: BackpackCard[];
}

interface GenerateTurfCardPoolsOptions {
  allUnlocked?: boolean;
}

function unlockAll<T extends { unlocked: boolean; locked: boolean }>(
  cards: T[],
): T[] {
  return cards.map((card) => ({
    ...card,
    unlocked: true,
    locked: false,
  }));
}

export function generateTurfCardPools(
  seed = 42,
  options: GenerateTurfCardPoolsOptions = {},
): TurfCardPools {
  const rng = createRng(seed);
  const crew = loadStarterCrewCards(25).map((card) => ({
    type: 'crew' as const,
    ...card,
  }));
  const weapons = generateWeapons(rng);
  const drugs = generateDrugs(rng);
  const cash = generateCash();
  const backpacks = generateBackpacks(rng, weapons, drugs, cash);

  if (options.allUnlocked) {
    return {
      crew: unlockAll(crew),
      weapons: unlockAll(weapons),
      drugs: unlockAll(drugs),
      cash,
      backpacks: unlockAll(backpacks),
    };
  }

  return { crew, weapons, drugs, cash, backpacks };
}
