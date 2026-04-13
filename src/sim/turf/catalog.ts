import { generateAllCards } from '../cards/generator';
import { createRng } from '../cards/rng';
import { generateCash, generateDrugs, generateWeapons } from './generators';
import type { CashCard, CrewCard, ProductCard, WeaponCard } from './types';

export interface TurfCardPools {
  crew: CrewCard[];
  weapons: WeaponCard[];
  drugs: ProductCard[];
  cash: CashCard[];
}

interface GenerateTurfCardPoolsOptions {
  allUnlocked?: boolean;
}

function unlockAll<T extends { unlocked: boolean; locked: boolean }>(cards: T[]): T[] {
  return cards.map(card => ({
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
  const crew = generateAllCards(seed, 25).map(card => ({
    type: 'crew' as const,
    ...card,
  }));
  const weapons = generateWeapons(rng);
  const drugs = generateDrugs(rng);
  const cash = generateCash();

  if (options.allUnlocked) {
    return {
      crew: unlockAll(crew),
      weapons: unlockAll(weapons),
      drugs: unlockAll(drugs),
      cash,
    };
  }

  return { crew, weapons, drugs, cash };
}
