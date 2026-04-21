import compiledWeapons from '../../../config/compiled/weapons.json';
import compiledDrugs from '../../../config/compiled/drugs.json';
import compiledCurrency from '../../../config/compiled/currency.json';
import {
  CompiledWeaponSchema,
  CompiledDrugSchema,
  CompiledCurrencySchema,
  type CompiledWeapon,
  type CompiledDrug,
  type CompiledCurrency,
} from '../cards/schemas';
import type { WeaponCard, DrugCard, CurrencyCard } from './types';
import type { Rng } from '../cards/rng';
import { TURF_SIM_CONFIG } from './ai/config';

const parsedWeapons = (compiledWeapons as unknown[]).map((e) =>
  CompiledWeaponSchema.parse(e),
);
const parsedDrugs = (compiledDrugs as unknown[]).map((e) =>
  CompiledDrugSchema.parse(e),
);
const parsedCurrency = (compiledCurrency as unknown[]).map((e) =>
  CompiledCurrencySchema.parse(e),
);

function clonePortrait<T>(value: T): T {
  return structuredClone(value);
}

function toWeaponCard(card: CompiledWeapon): WeaponCard {
  return {
    kind: 'weapon',
    id: card.id,
    name: card.name,
    category: card.category,
    power: card.power,
    resistance: card.resistance,
    rarity: card.rarity,
    abilities: [...card.abilities],
  };
}

function toDrugCard(card: CompiledDrug): DrugCard {
  return {
    kind: 'drug',
    id: card.id,
    name: card.name,
    category: card.category,
    power: card.power,
    resistance: card.resistance,
    rarity: card.rarity,
    abilities: [...card.abilities],
  };
}

function toCurrencyCard(card: CompiledCurrency): CurrencyCard {
  return {
    kind: 'currency',
    id: card.id,
    name: card.name,
    denomination: card.denomination,
    rarity: card.rarity,
    ...(card.abilities ? { abilities: [...card.abilities] } : {}),
  };
}

export function generateWeapons(_rng?: Rng): WeaponCard[] {
  return parsedWeapons.map(toWeaponCard);
}

export function generateDrugs(_rng?: Rng): DrugCard[] {
  return parsedDrugs.map(toDrugCard);
}

/** Unique authored currency cards for collection, rewards, and galleries. */
export function loadCurrencyCatalog(): CurrencyCard[] {
  return parsedCurrency.map(toCurrencyCard);
}

/**
 * Fresh-copy variants that return compiled records (including
 * `unlocked` / `unlockCondition`) for the achievement system. These
 * mirror `loadCompiledToughs` in catalog.ts — callers get their own
 * array and their own `abilities` arrays so downstream mutation can't
 * corrupt the cached module-level parse.
 */
export function loadCompiledWeapons(): CompiledWeapon[] {
  return parsedWeapons.map((w) => ({
    ...w,
    abilities: [...w.abilities],
    portrait: clonePortrait(w.portrait),
  }));
}

export function loadCompiledDrugs(): CompiledDrug[] {
  return parsedDrugs.map((d) => ({
    ...d,
    abilities: [...d.abilities],
    portrait: clonePortrait(d.portrait),
  }));
}

export function generateCurrency(): CurrencyCard[] {
  const packCfg = TURF_SIM_CONFIG.packs.currency;
  const hundred = parsedCurrency.find((card) => card.id === 'currency-100');
  const thousand = parsedCurrency.find((card) => card.id === 'currency-1000');
  if (!hundred || !thousand) {
    throw new Error(
      'compiled currency catalog is missing currency-100 or currency-1000',
    );
  }
  const cards: CurrencyCard[] = [];
  for (let i = 0; i < packCfg.billCount; i++) {
    cards.push({
      kind: 'currency',
      id: `cash-${String(i + 1).padStart(3, '0')}`,
      name: hundred.name,
      denomination: hundred.denomination,
      rarity: hundred.rarity,
      ...(hundred.abilities ? { abilities: [...hundred.abilities] } : {}),
    });
  }
  for (let i = 0; i < packCfg.stackCount; i++) {
    cards.push({
      kind: 'currency',
      id: `cash-${String(packCfg.billCount + 1 + i).padStart(3, '0')}`,
      name: thousand.name,
      denomination: thousand.denomination,
      rarity: thousand.rarity,
      ...(thousand.abilities ? { abilities: [...thousand.abilities] } : {}),
    });
  }
  return cards;
}
