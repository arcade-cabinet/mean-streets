import { describe, expect, it } from 'vitest';
import { analyzeBalanceResults } from '../balance';
import { generateTurfCardPools } from '../catalog';
import type { TurfGameResult, TurfMetrics } from '../types';

function emptyMetrics(): TurfMetrics {
  return {
    turns: 10,
    directStrikes: 2,
    pushedStrikes: 1,
    fundedRecruits: 1,
    kills: 1,
    spiked: 0,
    seizures: 1,
    busts: 0,
    cardsPlayed: 8,
    cardsDiscarded: 1,
    toughsPlayed: 5,
    modifiersPlayed: 3,
    passes: 0,
    goalSwitches: 0,
    failedPlans: 0,
    stallTurns: 0,
    deadHandTurns: 0,
    policyGuidedActions: 0,
    totalActions: 10,
    firstStrike: 'A',
  };
}

function makeResult(
  winner: 'A' | 'B',
  aCards: string[],
  bCards: string[],
): TurfGameResult {
  return {
    winner,
    endReason: 'total_seizure',
    firstPlayer: 'A',
    turnCount: 10,
    metrics: emptyMetrics(),
    seed: 1,
    plannerTrace: [],
    finalState: { turfsA: winner === 'A' ? 4 : 0, turfsB: winner === 'B' ? 4 : 0 },
    decks: {
      A: { cardIds: aCards },
      B: { cardIds: bCards },
    },
  };
}

describe('analyzeBalanceResults', () => {
  it('produces recommendations and matchup insights from independent decks', () => {
    const pools = generateTurfCardPools(42, { allUnlocked: true });
    const aCards = ['card-001', 'card-002', 'card-003', 'weap-01', 'drug-01', 'weap-02'];
    const bCards = ['card-004', 'card-005', 'card-006', 'weap-03', 'drug-03', 'weap-04'];
    const results = Array.from({ length: 40 }, (_, i) =>
      makeResult(i % 5 === 0 ? 'B' : 'A', aCards, bCards),
    );

    const analysis = analyzeBalanceResults(results, pools, { version: 2, cards: {} });

    expect(analysis.recommendations.some(r => r.cardId === 'card-001')).toBe(true);
    expect(analysis.strongestSynergies.length).toBeGreaterThan(0);
    expect(analysis.worstMatchups.length).toBeGreaterThan(0);
    expect(analysis.history.cards['card-001']).toBeDefined();
  });
});
