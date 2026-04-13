/**
 * Core type definitions for Mean Streets game simulation.
 * All game concepts are defined here — cards, gangs, configs.
 */

/** A single card definition within a gang's deck. */
export interface CardDef {
  id: string;
  name: string;
  gangId: string;
  tier: number; // 1-based position in the deck's power curve
  dayAtk: number;
  dayDef: number;
  nightAtk: number;
  nightDef: number;
}

/** Gang passive ability types. */
export type GangPassive = 'BRUTAL' | 'ANCHOR' | 'BLEED' | 'SCAVENGE';

/** A gang (faction/deck identity) definition. */
export interface GangDef {
  id: string;
  name: string;
  passive: GangPassive;
  passiveDesc: string;
  tagline: string;
  cards: CardDef[];
}

/** Game configuration for a single simulation run. */
export interface GameConfig {
  gangA: string;
  gangB: string;
  dieSize: number; // 0 = no die, 4/6/8/10/12/20
  precisionMult: number; // ATK <= enemy HP * this
  handMax: number;
  runsEnabled: boolean;
  setsEnabled: boolean;
  secondPlayerBonus: boolean;
  nightShiftEvery: number; // vanguard kills between phase flips
  maxTurns: number;
}

/** Default game configuration. */
export const DEFAULT_CONFIG: Omit<GameConfig, 'gangA' | 'gangB'> = {
  dieSize: 6,
  precisionMult: 1.5,
  handMax: 5,
  runsEnabled: true,
  setsEnabled: true,
  secondPlayerBonus: true,
  nightShiftEvery: 2,
  maxTurns: 200,
};

/** Metrics collected during a single game. */
export interface GameMetrics {
  turns: number;
  passes: number;
  attacks: number;
  sacrifices: number;
  hustles: number;
  dieRolls: number;
  dieHits: number;
  dieMisses: number;
  dieVanguardHits: number;
  precisionLocks: number;
  overdrawPenalties: number;
  shieldSaves: number;
  vanguardDeaths: number;
  runsPlayed: number;
  setsPlayed: number;
  nightShifts: number;
  killsByA: number;
  killsByB: number;
  forcedDieRolls: number;
  sacrificeDraws: number;
  bleedDiscards: number;
  stallBreakers: number;
  cardsRemainingInDeck: number;
}

/** Result of a single game. */
export interface GameResult {
  winner: 'A' | 'B';
  endReason: 'starvation' | 'stall';
  firstPlayer: 'A' | 'B';
  metrics: GameMetrics;
}

/** Aggregated results from many games of the same matchup. */
export interface MatchupResult {
  gangA: string;
  gangB: string;
  games: number;
  config: GameConfig;
  winRateA: number;
  winRateB: number;
  firstMoverWinRate: number;
  stallRate: number;
  avgTurns: number;
  medianTurns: number;
  avgPassRate: number;
  avgPrecisionLockRate: number;
  metrics: Record<string, number>; // averaged metric values
}

/** Full balance report across all matchups. */
export interface BalanceReport {
  timestamp: string;
  gangs: string[];
  matrix: MatchupResult[][]; // [gangA index][gangB index]
  gangRatings: Record<string, number>; // aggregate win rate per gang
  worstMatchup: { gangA: string; gangB: string; winRate: number };
  balanced: boolean; // true if all matchups within 45-55%
  issues: string[];
}

export function createEmptyMetrics(): GameMetrics {
  return {
    turns: 0, passes: 0, attacks: 0, sacrifices: 0, hustles: 0,
    dieRolls: 0, dieHits: 0, dieMisses: 0, dieVanguardHits: 0,
    precisionLocks: 0, overdrawPenalties: 0, shieldSaves: 0,
    vanguardDeaths: 0, runsPlayed: 0, setsPlayed: 0, nightShifts: 0,
    killsByA: 0, killsByB: 0, forcedDieRolls: 0,
    sacrificeDraws: 0, bleedDiscards: 0, stallBreakers: 0,
    cardsRemainingInDeck: 0,
  };
}
