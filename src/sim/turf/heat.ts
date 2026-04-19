import { TURF_SIM_CONFIG } from './ai/config';
import type {
  Card,
  DifficultyTier,
  PlayerState,
  Rarity,
  ToughCard,
  TurfGameState,
} from './types';

export interface HeatBreakdown {
  fromRarity: number;
  fromCurrencyConcentration: number;
  fromLaunder: number;
  fromLowProfile: number;
  total: number;
}

const HEAT_CONFIG = TURF_SIM_CONFIG.heat;
const RARITY_COEF = HEAT_CONFIG.rarity as Record<Rarity, number>;
const RAID_COEF = HEAT_CONFIG.raidCoefficient as Record<DifficultyTier, number>;

function isLaunderCarrier(card: Card): boolean {
  const abilities = (card as { abilities?: string[] }).abilities;
  if (!abilities) return false;
  return abilities.includes('LAUNDER') || abilities.includes('launder');
}

function isLowProfileOwner(tough: ToughCard, allOnTurf: Card[]): boolean {
  // A tough's heat contribution is halved if the tough itself or any
  // modifier attached to the turf carries LOW_PROFILE (drug ability).
  if (tough.abilities.some(hasLowProfile)) return true;
  return allOnTurf.some(
    (c) => c.kind === 'drug' && c.abilities.some(hasLowProfile),
  );
}

function hasLowProfile(a: string): boolean {
  return a === 'LOW_PROFILE' || a === 'lowProfile' || a === 'low_profile';
}

function playerRarityHeat(
  player: PlayerState,
  lowProfileFactor: number,
): { fromRarity: number; fromLowProfile: number } {
  let raw = 0;
  let relief = 0;
  for (const turf of player.turfs) {
    const allCards = turf.stack.map((sc) => sc.card);
    for (const card of allCards) {
      const coef = RARITY_COEF[card.rarity] ?? 0;
      if (coef === 0) continue;
      let contribution = coef;
      if (card.kind === 'tough' && isLowProfileOwner(card, allCards)) {
        const reduced = contribution * lowProfileFactor;
        relief += contribution - reduced;
        contribution = reduced;
      }
      raw += contribution;
    }
  }
  return { fromRarity: raw, fromLowProfile: -relief };
}

function playerCurrencyHeat(player: PlayerState): number {
  const floor = HEAT_CONFIG.currencyConcentrationFloor;
  const scale = HEAT_CONFIG.currencyConcentrationScale;
  let total = 0;
  for (const turf of player.turfs) {
    let cash = 0;
    for (const sc of turf.stack) {
      if (sc.card.kind === 'currency') cash += sc.card.denomination;
    }
    total += Math.max(0, (cash - floor) / scale);
  }
  return total;
}

function playerLaunderRelief(player: PlayerState): number {
  const unit = HEAT_CONFIG.launderRelief;
  let relief = 0;
  for (const turf of player.turfs) {
    for (const sc of turf.stack) {
      if (isLaunderCarrier(sc.card)) relief += unit;
    }
  }
  return relief;
}

/**
 * Compute the full heat breakdown for the current state. Total is clamped
 * to [0, 1]. Components are returned unclamped so the autobalance tools
 * can see who contributed what.
 */
export function computeHeat(state: TurfGameState): HeatBreakdown {
  const lowProf = HEAT_CONFIG.lowProfileFactor;
  const sideA = playerRarityHeat(state.players.A, lowProf);
  const sideB = playerRarityHeat(state.players.B, lowProf);
  const fromRarity = sideA.fromRarity + sideB.fromRarity;
  const fromLowProfile = sideA.fromLowProfile + sideB.fromLowProfile;
  const fromCurrencyConcentration =
    playerCurrencyHeat(state.players.A) + playerCurrencyHeat(state.players.B);
  const fromLaunder = -(
    playerLaunderRelief(state.players.A) + playerLaunderRelief(state.players.B)
  );
  const raw =
    fromRarity + fromCurrencyConcentration + fromLowProfile + fromLaunder;
  const total = Math.max(0, Math.min(1, raw));
  return {
    fromRarity,
    fromCurrencyConcentration,
    fromLaunder,
    fromLowProfile,
    total,
  };
}

/** `p = heat² × difficulty_coefficient`, clamped [0, 1]. */
export function raidProbability(
  heat: number,
  difficulty: DifficultyTier,
): number {
  const coef = RAID_COEF[difficulty] ?? 1;
  const p = heat * heat * coef;
  return Math.max(0, Math.min(1, p));
}

/** Lockup duration in turns for the given difficulty. 999 = effectively perma. */
export function lockupDuration(difficulty: DifficultyTier): number {
  const table = HEAT_CONFIG.lockupDuration as Record<DifficultyTier, number>;
  return table[difficulty] ?? 1;
}
