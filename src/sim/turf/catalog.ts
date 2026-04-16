import { loadStarterToughCards } from '../cards/catalog';
import { createRng } from '../cards/rng';
import {
  generateCurrency,
  generateDrugs,
  generateWeapons,
} from './generators';
import type {
  CurrencyCard,
  ToughCard,
  DrugCard,
  WeaponCard,
} from './types';

export interface TurfCardPools {
  crew: ToughCard[];
  weapons: WeaponCard[];
  drugs: DrugCard[];
  cash: CurrencyCard[];
}

interface GenerateTurfCardPoolsOptions {
  allUnlocked?: boolean;
}

export function generateTurfCardPools(
  seed = 42,
  _options: GenerateTurfCardPoolsOptions = {},
): TurfCardPools {
  const rng = createRng(seed);
  const crew = loadStarterToughCards(25);
  const weapons = generateWeapons(rng);
  const drugs = generateDrugs(rng);
  const cash = generateCurrency();

  return { crew, weapons, drugs, cash };
}
