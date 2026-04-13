import { describe, expect, it } from 'vitest';
import { analyzeBalanceResults } from '../balance';
import { generateTurfCardPools } from '../catalog';
import type { TurfGameResult } from '../types';

function makeResult(
  winner: 'A' | 'B',
  aCrew: string[],
  aMods: string[],
  bCrew: string[],
  bMods: string[],
): TurfGameResult {
  return {
    winner,
    endReason: 'total_seizure',
    firstPlayer: 'A',
    turnCount: 10,
    metrics: {
      turns: 10,
      directAttacks: 2,
      fundedAttacks: 1,
      pushedAttacks: 1,
      kills: 1,
      flips: 0,
      seizures: 1,
      busts: 0,
      weaponsDrawn: 1,
      productPlayed: 1,
      cashPlayed: 1,
      crewPlaced: 5,
      positionsReclaimed: 0,
      passes: 0,
      buildupRoundsA: 2,
      buildupRoundsB: 2,
      combatRounds: 3,
      totalActions: 10,
      firstStrike: 'A',
    },
    seed: 1,
    finalState: {
      seizedA: 0,
      seizedB: 5,
    },
    decks: {
      A: { crewIds: aCrew, modifierIds: aMods },
      B: { crewIds: bCrew, modifierIds: bMods },
    },
  };
}

describe('analyzeBalanceResults', () => {
  it('produces recommendations and matchup insights from independent decks', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const aCrew = ['card-001', 'card-002', 'card-003'];
    const aMods = ['weap-01', 'drug-01', 'weap-02'];
    const bCrew = ['card-004', 'card-005', 'card-006'];
    const bMods = ['weap-03', 'drug-03', 'weap-04'];
    const results = Array.from({ length: 40 }, (_, index) =>
      makeResult(index % 5 === 0 ? 'B' : 'A', aCrew, aMods, bCrew, bMods),
    );

    const analysis = analyzeBalanceResults(results, pools, { version: 1, cards: {} });

    expect(analysis.recommendations.some(rec => rec.cardId === 'card-001')).toBe(true);
    expect(analysis.strongestSynergies.length).toBeGreaterThan(0);
    expect(analysis.worstMatchups.length).toBeGreaterThan(0);
    expect(analysis.history.cards['card-001']).toBeDefined();
  });
});
