/**
 * Deck generator and auto-balancer.
 *
 * Generates hypothetical 20-card decks based on gang identity constraints,
 * runs balance simulations, identifies weak points, adjusts stats,
 * and iterates until the matrix converges to 45-55% across all matchups.
 *
 * Each gang has identity constraints that define its stat distribution:
 * - Which phase (day/night) favors ATK vs DEF
 * - The overall offensive vs defensive lean
 * - How asymmetric day/night should be
 */

import type { CardData, GangData, PassiveConfig } from '../schemas';
import { GangSchema } from '../schemas';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Constraints that define a gang's stat identity. */
export interface GangConstraints {
  id: string;
  name: string;
  tagline: string;
  passive: PassiveConfig;
  deckSize: number;
  /** 0-1: how much ATK vs DEF the gang favors. 0=pure DEF, 1=pure ATK, 0.5=balanced */
  offensiveLean: number;
  /** 0-1: how asymmetric day vs night stats are. 0=identical, 1=completely inverted */
  dayNightAsymmetry: number;
  /** Which phase favors offense. 'day'=ATK higher during day, 'night'=ATK higher at night */
  offensivePhase: 'day' | 'night';
  /** Min and max stat values across all cards */
  statFloor: number;
  statCeiling: number;
}

/** Generate a deck of cards from constraints. */
export function generateDeck(constraints: GangConstraints): CardData[] {
  const { deckSize, offensiveLean, dayNightAsymmetry, offensivePhase,
    statFloor, statCeiling } = constraints;

  const cards: CardData[] = [];
  const statRange = statCeiling - statFloor;

  for (let i = 0; i < deckSize; i++) {
    const tier = i + 1;
    const t = i / (deckSize - 1); // 0.0 (weakest) to 1.0 (strongest)

    // Base power level scales with tier
    const basePower = statFloor + t * statRange;

    // Split power between ATK and DEF based on offensive lean
    const atkShare = offensiveLean;
    const defShare = 1 - offensiveLean;

    // Primary phase stats (the phase where this gang is "at home")
    const primaryAtk = Math.round(basePower * (0.5 + atkShare * 0.5));
    const primaryDef = Math.round(basePower * (0.5 + defShare * 0.5));

    // Secondary phase stats (shifted by asymmetry)
    const shift = dayNightAsymmetry;
    const secondaryAtk = Math.max(1, Math.round(primaryAtk * (1 - shift) + primaryDef * shift));
    const secondaryDef = Math.max(1, Math.round(primaryDef * (1 - shift) + primaryAtk * shift));

    // Assign to day/night based on offensive phase
    let dayAtk: number, dayDef: number, nightAtk: number, nightDef: number;
    if (offensivePhase === 'day') {
      dayAtk = primaryAtk;
      dayDef = primaryDef;
      nightAtk = secondaryAtk;
      nightDef = secondaryDef;
    } else {
      dayAtk = secondaryAtk;
      dayDef = secondaryDef;
      nightAtk = primaryAtk;
      nightDef = primaryDef;
    }

    // Ensure minimums
    dayAtk = Math.max(0, dayAtk);
    dayDef = Math.max(1, dayDef);
    nightAtk = Math.max(0, nightAtk);
    nightDef = Math.max(1, nightDef);

    cards.push({
      id: `${constraints.id.toLowerCase().slice(0, 3)}-${String(tier).padStart(2, '0')}`,
      name: `${constraints.id}-${tier}`, // placeholder names
      tier,
      dayAtk, dayDef, nightAtk, nightDef,
    });
  }

  return cards;
}

/** Build a complete GangData from constraints + generated cards. */
export function buildGangFromConstraints(constraints: GangConstraints): GangData {
  const cards = generateDeck(constraints);
  const gang = {
    id: constraints.id,
    name: constraints.name,
    tagline: constraints.tagline,
    passive: constraints.passive,
    cards,
  };

  // Validate with Zod
  const result = GangSchema.safeParse(gang);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Generated gang "${constraints.id}" failed validation:\n${issues.join('\n')}`);
  }

  return result.data;
}

/** Default constraints for the four gangs. */
export const GANG_CONSTRAINTS: Record<string, GangConstraints> = {
  KNUCKLES: {
    id: 'KNUCKLES',
    name: 'Knuckles',
    tagline: 'Hit first. Hit hard. Don\'t stop.',
    passive: { type: 'BRUTAL', value: 1, description: '+1 damage on all attacks' },
    deckSize: 20,
    offensiveLean: 0.65,      // ATK-heavy
    dayNightAsymmetry: 0.3,   // moderate shift — day is better for offense
    offensivePhase: 'day',
    statFloor: 2,
    statCeiling: 9,
  },
  CHAINS: {
    id: 'CHAINS',
    name: 'Chains',
    tagline: 'You\'re not going anywhere.',
    passive: { type: 'ANCHOR', value: 2, description: '+2 shield on promote' },
    deckSize: 20,
    offensiveLean: 0.35,      // DEF-heavy
    dayNightAsymmetry: 0.2,   // slight shift — defensive in both phases
    offensivePhase: 'day',
    statFloor: 2,
    statCeiling: 9,
  },
  SHIVS: {
    id: 'SHIVS',
    name: 'Shivs',
    tagline: 'You didn\'t even see me.',
    passive: { type: 'BLEED', value: 1, description: 'enemy discards 1 on kill' },
    deckSize: 20,
    offensiveLean: 0.6,       // slightly ATK-heavy
    dayNightAsymmetry: 0.6,   // high asymmetry — shape-shifters
    offensivePhase: 'day',    // aggressive day, defensive night
    statFloor: 2,
    statCeiling: 9,
  },
  CROWS: {
    id: 'CROWS',
    name: 'Crows',
    tagline: 'What\'s yours is mine.',
    passive: { type: 'SCAVENGE', value: 1, description: 'draw 1 on sacrifice' },
    deckSize: 20,
    offensiveLean: 0.5,       // perfectly balanced
    dayNightAsymmetry: 0.1,   // barely shifts — consistent
    offensivePhase: 'day',
    statFloor: 2,
    statCeiling: 9,
  },
};

/** Adjustment recommendations based on balance report data. */
export interface Adjustment {
  gangId: string;
  parameter: keyof GangConstraints;
  direction: 'up' | 'down';
  amount: number;
  reason: string;
}

/**
 * Analyze a balance result and suggest adjustments.
 * Returns a list of parameter tweaks to try.
 */
export function suggestAdjustments(
  gangRatings: Record<string, number>,
  matchupWinRates: Array<{ gangA: string; gangB: string; winRateA: number }>,
  passRates: Array<{ gangA: string; gangB: string; passRate: number }>,
): Adjustment[] {
  const adjustments: Adjustment[] = [];

  // Adjust gangs that are too strong or too weak overall
  for (const [id, rating] of Object.entries(gangRatings)) {
    if (rating > 55) {
      adjustments.push({
        gangId: id,
        parameter: 'offensiveLean',
        direction: 'down',
        amount: 0.05,
        reason: `${id} aggregate win rate ${rating}% — reduce offensive lean`,
      });
      adjustments.push({
        gangId: id,
        parameter: 'statCeiling',
        direction: 'down',
        amount: 1,
        reason: `${id} aggregate win rate ${rating}% — lower stat ceiling`,
      });
    }
    if (rating < 45) {
      adjustments.push({
        gangId: id,
        parameter: 'offensiveLean',
        direction: 'up',
        amount: 0.05,
        reason: `${id} aggregate win rate ${rating}% — increase offensive lean`,
      });
      adjustments.push({
        gangId: id,
        parameter: 'statCeiling',
        direction: 'up',
        amount: 1,
        reason: `${id} aggregate win rate ${rating}% — raise stat ceiling`,
      });
    }
  }

  // Check for high pass rates (indicates precision lock issues)
  for (const { gangA, gangB, passRate } of passRates) {
    if (passRate > 25 && gangA === gangB) {
      adjustments.push({
        gangId: gangA,
        parameter: 'dayNightAsymmetry',
        direction: 'up',
        amount: 0.1,
        reason: `${gangA} mirror has ${passRate}% pass rate — increase day/night asymmetry`,
      });
    }
  }

  return adjustments;
}

/**
 * Apply adjustments to constraints and return updated versions.
 */
export function applyAdjustments(
  constraints: Record<string, GangConstraints>,
  adjustments: Adjustment[],
): Record<string, GangConstraints> {
  const updated = structuredClone(constraints);

  for (const adj of adjustments) {
    const gang = updated[adj.gangId];
    if (!gang) continue;

    const current = gang[adj.parameter] as number;
    if (typeof current !== 'number') continue;

    const newVal = adj.direction === 'up'
      ? current + adj.amount
      : current - adj.amount;

    // Clamp based on parameter
    switch (adj.parameter) {
      case 'offensiveLean':
      case 'dayNightAsymmetry':
        (gang as Record<string, unknown>)[adj.parameter] = Math.max(0, Math.min(1, newVal));
        break;
      case 'statFloor':
        (gang as Record<string, unknown>)[adj.parameter] = Math.max(1, Math.min(5, newVal));
        break;
      case 'statCeiling':
        (gang as Record<string, unknown>)[adj.parameter] = Math.max(5, Math.min(15, newVal));
        break;
    }
  }

  return updated;
}

/** Save generated gang data to a JSON file. */
export function saveGangJson(gang: GangData, dir: string): string {
  const path = join(dir, `${gang.id.toLowerCase()}.json`);
  writeFileSync(path, JSON.stringify(gang, null, 2));
  return path;
}
