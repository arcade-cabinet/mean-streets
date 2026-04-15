import type { Rng } from '../cards/rng';
import type { Card, ToughCard, WeaponCard, DrugCard, CurrencyCard } from './types';
import type { TurfCardPools } from './catalog';
import { TURF_SIM_CONFIG } from './ai/config';

const DECK_BUILDER_CONFIG = TURF_SIM_CONFIG.deckBuilder;
const MIN_WEAPONS = DECK_BUILDER_CONFIG.minWeapons;
const MIN_DRUGS = DECK_BUILDER_CONFIG.minDrugs;
const TOTAL_MODIFIERS = DECK_BUILDER_CONFIG.totalModifiers;
const TOTAL_CREW = DECK_BUILDER_CONFIG.totalCrew;

export interface AutoDeckPolicy {
  aggressionBias?: number;
  controlBias?: number;
  economyBias?: number;
  synergyBias?: number;
  explorationBias?: number;
  forceIncludeIds?: string[];
}

function normalizeBias(value: number | undefined, fallback: number): number {
  return Math.max(0, Math.min(1, value ?? fallback));
}

export function buildAutoDeck(
  pools: TurfCardPools,
  rng: Rng,
  policy: AutoDeckPolicy = {},
): Card[] {
  const crewPool = [...pools.crew] as ToughCard[];
  const weaponPool = [...pools.weapons] as WeaponCard[];
  const drugPool = [...pools.drugs] as DrugCard[];
  const cashPool = [...pools.cash] as CurrencyCard[];

  const aggressionBias = normalizeBias(policy.aggressionBias, 0.5);
  const controlBias = normalizeBias(policy.controlBias, 0.5);
  const economyBias = normalizeBias(policy.economyBias, 0.5);
  const synergyBias = normalizeBias(policy.synergyBias, 0.5);
  const explorationBias = normalizeBias(policy.explorationBias, 0.35);
  const forcedIds = new Set(policy.forceIncludeIds ?? []);

  const forcedCrew = crewPool.filter(card => forcedIds.has(card.id));
  const crew = [
    ...forcedCrew,
    ...rng.shuffle(crewPool.filter(card => !forcedIds.has(card.id))).slice(0, Math.max(0, TOTAL_CREW - forcedCrew.length)),
  ].slice(0, TOTAL_CREW);

  const weaponBudget = 3 + Math.round((aggressionBias + controlBias) * 2) + Math.round(synergyBias);
  const maxExtraWeapons = Math.max(0, Math.min(8, weaponBudget + rng.int(0, Math.max(1, Math.round(explorationBias * 4)))));
  const extraWeapons = rng.int(0, maxExtraWeapons);
  const maxDrugExtra = Math.max(0, 8 - extraWeapons);
  const drugBudget = 2 + Math.round((controlBias + synergyBias) * 2);
  const extraDrugs = rng.int(0, Math.max(0, Math.min(maxDrugExtra, drugBudget + Math.round(explorationBias * 3))));
  const weaponCount = MIN_WEAPONS + extraWeapons;
  let drugCount = MIN_DRUGS + extraDrugs;
  let cashCount = TOTAL_MODIFIERS - weaponCount - drugCount;
  const preferredCash = 3 + Math.round(economyBias * 4);
  if (cashCount < preferredCash) {
    const deficit = preferredCash - cashCount;
    const reducibleDrugs = Math.max(0, drugCount - MIN_DRUGS);
    const shift = Math.min(deficit, reducibleDrugs);
    drugCount -= shift;
    cashCount += shift;
  }

  const forcedWeapons = weaponPool.filter(card => forcedIds.has(card.id));
  const forcedDrugs = drugPool.filter(card => forcedIds.has(card.id));
  const weapons = [
    ...forcedWeapons,
    ...rng.shuffle(weaponPool.filter(card => !forcedIds.has(card.id))).slice(0, Math.max(0, weaponCount - forcedWeapons.length)),
  ].slice(0, weaponCount);
  const drugs = [
    ...forcedDrugs,
    ...rng.shuffle(drugPool.filter(card => !forcedIds.has(card.id))).slice(0, Math.max(0, drugCount - forcedDrugs.length)),
  ].slice(0, drugCount);
  const cash = rng.shuffle([...cashPool]).slice(0, cashCount);

  return rng.shuffle([...crew, ...weapons, ...drugs, ...cash] as Card[]);
}
