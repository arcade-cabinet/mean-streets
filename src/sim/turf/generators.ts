import compiledWeapons from '../../../config/compiled/weapons.json';
import compiledDrugs from '../../../config/compiled/drugs.json';
import {
  CompiledWeaponSchema,
  CompiledDrugSchema,
  type CompiledWeapon,
  type CompiledDrug,
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

function toWeaponCard(card: CompiledWeapon): WeaponCard {
  return {
    kind: 'weapon',
    id: card.id,
    name: card.name,
    category: card.category,
    power: card.power,
    resistance: card.resistance,
    rarity: card.rarity,
    abilities: card.abilities,
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
    abilities: card.abilities,
  };
}

export function generateWeapons(_rng?: Rng): WeaponCard[] {
  return parsedWeapons.map(toWeaponCard);
}

export function generateDrugs(_rng?: Rng): DrugCard[] {
  return parsedDrugs.map(toDrugCard);
}

export function generateCurrency(): CurrencyCard[] {
  const packCfg = TURF_SIM_CONFIG.packs.currency;
  const cards: CurrencyCard[] = [];
  for (let i = 0; i < packCfg.billCount; i++) {
    cards.push({
      kind: 'currency',
      id: `cash-${String(i + 1).padStart(3, '0')}`,
      name: `$${packCfg.billDenomination} Bill`,
      denomination: packCfg.billDenomination as 100 | 1000,
      rarity: 'common',
    });
  }
  for (let i = 0; i < packCfg.stackCount; i++) {
    cards.push({
      kind: 'currency',
      id: `cash-${String(packCfg.billCount + 1 + i).padStart(3, '0')}`,
      name: `$${packCfg.stackDenomination} Stack`,
      denomination: packCfg.stackDenomination as 100 | 1000,
      rarity: 'rare',
    });
  }
  return cards;
}
