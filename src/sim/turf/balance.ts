import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ProductCard, TurfGameResult, WeaponCard, CrewCard } from './types';
import type { TurfCardPools } from './catalog';
import { TURF_SIM_CONFIG } from './ai/config';

type BalanceCard = CrewCard | WeaponCard | ProductCard;
type BalanceCardType = BalanceCard['type'];

export interface BalanceCatalogEntry {
  id: string;
  name: string;
  type: BalanceCardType;
  category: string;
  stat: number;
  locked: boolean;
}

export interface CardPerformance {
  id: string;
  name: string;
  type: BalanceCardType;
  category: string;
  includedCount: number;
  includedWinRate: number;
  excludedWinRate: number;
  winRateDelta: number;
  usageRate: number;
  usageMean: number;
  usageStdDev: number;
  usageZScore: number;
  locked: boolean;
  stableThisRun: boolean;
}

export interface BalanceRecommendation {
  cardId: string;
  cardName: string;
  type: BalanceCardType;
  category: string;
  field: 'power' | 'resistance' | 'bonus' | 'potency';
  currentValue: number;
  recommendedValue: number;
  direction: 'up' | 'down';
  reason: string;
  metric: number;
}

export interface PairRecommendation {
  cardAId: string;
  cardAName: string;
  cardBId: string;
  cardBName: string;
  sampleSize: number;
  winRate: number;
  score: number;
}

export interface MatchupRecommendation {
  cardId: string;
  cardName: string;
  opponentId: string;
  opponentName: string;
  sampleSize: number;
  winRate: number;
  deltaVsBaseline: number;
}

export interface BalanceHistoryCardState {
  consecutiveStableRuns: number;
  locked: boolean;
}

export interface BalanceHistory {
  version: 1;
  cards: Record<string, BalanceHistoryCardState>;
}

export interface BalanceAnalysis {
  overview: {
    sideAppearances: number;
    winningSides: number;
    locked: Record<'crew' | 'weapon' | 'product', number>;
    unlocked: Record<'crew' | 'weapon' | 'product', number>;
  };
  performances: CardPerformance[];
  recommendations: BalanceRecommendation[];
  strongestSynergies: PairRecommendation[];
  weakestSynergies: PairRecommendation[];
  bestCounters: MatchupRecommendation[];
  worstMatchups: MatchupRecommendation[];
  history: BalanceHistory;
}

interface SideDeck {
  side: 'A' | 'B';
  won: boolean;
  ids: string[];
}

interface PairStat {
  appearances: number;
  wins: number;
}

const BALANCE_CONFIG = TURF_SIM_CONFIG.balance;
const LOCK_DELTA_THRESHOLD = BALANCE_CONFIG.lockDeltaThreshold;
const RECOMMENDATION_DELTA_THRESHOLD = BALANCE_CONFIG.recommendationDeltaThreshold;
const MIN_CARD_SAMPLE = BALANCE_CONFIG.minCardSample;
const MIN_PAIR_SAMPLE = BALANCE_CONFIG.minPairSample;
const HISTORY_VERSION = 1;
const CONSECUTIVE_STABLE_RUNS_TO_LOCK = BALANCE_CONFIG.consecutiveStableRunsToLock;
const USAGE_Z_SCORE_STABILITY_MAX = BALANCE_CONFIG.usageZScoreStabilityMax;

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function matchupKey(cardId: string, opponentId: string): string {
  return `${cardId}=>${opponentId}`;
}

function primaryStatField(card: BalanceCatalogEntry): BalanceRecommendation['field'] {
  switch (card.type) {
    case 'crew':
      return card.category === 'crew-resistance' ? 'resistance' : 'power';
    case 'weapon':
      return 'bonus';
    case 'product':
      return 'potency';
  }
}

function buildCatalog(pools: TurfCardPools, history: BalanceHistory): Map<string, BalanceCatalogEntry> {
  const entries = new Map<string, BalanceCatalogEntry>();

  for (const card of pools.crew) {
    const historyState = history.cards[card.id];
    const field = card.power >= card.resistance ? 'crew-power' : 'crew-resistance';
    entries.set(card.id, {
      id: card.id,
      name: card.displayName,
      type: 'crew',
      category: field,
      stat: field === 'crew-power' ? card.power : card.resistance,
      locked: historyState?.locked ?? card.locked,
    });
  }

  for (const card of pools.weapons) {
    const historyState = history.cards[card.id];
    entries.set(card.id, {
      id: card.id,
      name: card.name,
      type: 'weapon',
      category: card.category,
      stat: card.bonus,
      locked: historyState?.locked ?? card.locked,
    });
  }

  for (const card of pools.drugs) {
    const historyState = history.cards[card.id];
    entries.set(card.id, {
      id: card.id,
      name: card.name,
      type: 'product',
      category: card.category,
      stat: card.potency,
      locked: historyState?.locked ?? card.locked,
    });
  }

  return entries;
}

export function loadBalanceHistory(path: string): BalanceHistory {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as BalanceHistory;
    if (parsed.version !== HISTORY_VERSION || !parsed.cards) {
      return { version: HISTORY_VERSION, cards: {} };
    }
    return parsed;
  } catch {
    return { version: HISTORY_VERSION, cards: {} };
  }
}

export function saveBalanceHistory(path: string, history: BalanceHistory): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

function buildSideDecks(results: TurfGameResult[]): SideDeck[] {
  return results.flatMap(result => ([
    {
      side: 'A' as const,
      won: result.winner === 'A',
      ids: [...result.decks.A.crewIds, ...result.decks.A.modifierIds],
    },
    {
      side: 'B' as const,
      won: result.winner === 'B',
      ids: [...result.decks.B.crewIds, ...result.decks.B.modifierIds],
    },
  ]));
}

export function analyzeBalanceResults(
  results: TurfGameResult[],
  pools: TurfCardPools,
  previousHistory: BalanceHistory,
): BalanceAnalysis {
  const catalog = buildCatalog(pools, previousHistory);
  const sideDecks = buildSideDecks(results);
  const sideAppearances = sideDecks.length;
  const winningSides = sideDecks.filter(side => side.won).length;
  const included = new Map<string, PairStat>();
  const synergyStats = new Map<string, PairStat>();
  const matchupStats = new Map<string, PairStat>();

  for (const deck of sideDecks) {
    const balanceIds = deck.ids.filter(id => catalog.has(id));

    for (const id of balanceIds) {
      const stat = included.get(id) ?? { appearances: 0, wins: 0 };
      stat.appearances++;
      if (deck.won) stat.wins++;
      included.set(id, stat);
    }

    for (let i = 0; i < balanceIds.length; i++) {
      for (let j = i + 1; j < balanceIds.length; j++) {
        const key = pairKey(balanceIds[i], balanceIds[j]);
        const stat = synergyStats.get(key) ?? { appearances: 0, wins: 0 };
        stat.appearances++;
        if (deck.won) stat.wins++;
        synergyStats.set(key, stat);
      }
    }
  }

  for (const result of results) {
    const aIds = [...result.decks.A.crewIds, ...result.decks.A.modifierIds].filter(id => catalog.has(id));
    const bIds = [...result.decks.B.crewIds, ...result.decks.B.modifierIds].filter(id => catalog.has(id));

    for (const aId of aIds) {
      for (const bId of bIds) {
        const aKey = matchupKey(aId, bId);
        const aStat = matchupStats.get(aKey) ?? { appearances: 0, wins: 0 };
        aStat.appearances++;
        if (result.winner === 'A') aStat.wins++;
        matchupStats.set(aKey, aStat);

        const bKey = matchupKey(bId, aId);
        const bStat = matchupStats.get(bKey) ?? { appearances: 0, wins: 0 };
        bStat.appearances++;
        if (result.winner === 'B') bStat.wins++;
        matchupStats.set(bKey, bStat);
      }
    }
  }

  const rawPerformances: CardPerformance[] = [];
  const byCategory = new Map<string, CardPerformance[]>();

  for (const card of catalog.values()) {
    const stat = included.get(card.id) ?? { appearances: 0, wins: 0 };
    const includedCount = stat.appearances;
    const includedWinRate = includedCount === 0 ? 0.5 : stat.wins / includedCount;
    const excludedCount = sideAppearances - includedCount;
    const excludedWins = winningSides - stat.wins;
    const excludedWinRate = excludedCount === 0 ? 0.5 : excludedWins / excludedCount;
    const usageRate = sideAppearances === 0 ? 0 : includedCount / sideAppearances;

    const performance: CardPerformance = {
      id: card.id,
      name: card.name,
      type: card.type,
      category: card.category,
      includedCount,
      includedWinRate: round(includedWinRate),
      excludedWinRate: round(excludedWinRate),
      winRateDelta: round(includedWinRate - excludedWinRate),
      usageRate: round(usageRate),
      usageMean: 0,
      usageStdDev: 0,
      usageZScore: 0,
      locked: card.locked,
      stableThisRun: false,
    };

    rawPerformances.push(performance);
    const groupKey = `${card.type}:${card.category}`;
    const group = byCategory.get(groupKey) ?? [];
    group.push(performance);
    byCategory.set(groupKey, group);
  }

  for (const group of byCategory.values()) {
    const mean = group.reduce((sum, perf) => sum + perf.usageRate, 0) / group.length;
    const deviation = stdDev(group.map(perf => perf.usageRate), mean);
    for (const perf of group) {
      perf.usageMean = round(mean);
      perf.usageStdDev = round(deviation);
      perf.usageZScore = deviation === 0 ? 0 : round((perf.usageRate - mean) / deviation);
    }
  }

  const recommendations: BalanceRecommendation[] = [];

  for (const perf of rawPerformances) {
    const current = catalog.get(perf.id)!;
    const enoughSample = perf.includedCount >= MIN_CARD_SAMPLE;
    const hasUsageStability = Math.abs(perf.usageZScore) <= USAGE_Z_SCORE_STABILITY_MAX;
    const needsAdjustment = enoughSample && Math.abs(perf.winRateDelta) >= RECOMMENDATION_DELTA_THRESHOLD;
    const stableThisRun = enoughSample
      && !needsAdjustment
      && Math.abs(perf.winRateDelta) < LOCK_DELTA_THRESHOLD
      && hasUsageStability;
    perf.stableThisRun = stableThisRun;

    if (current.locked || !needsAdjustment) continue;

    const direction: BalanceRecommendation['direction'] = perf.winRateDelta > 0 ? 'down' : 'up';
    const field = primaryStatField(current);
    const adjustment = direction === 'down' ? -1 : 1;
    const recommendedValue = Math.max(1, current.stat + adjustment);
    if (recommendedValue === current.stat) continue;

    recommendations.push({
      cardId: perf.id,
      cardName: perf.name,
      type: perf.type,
      category: perf.category,
      field,
      currentValue: current.stat,
      recommendedValue,
      direction,
      reason: `${perf.name} shifts side win rate by ${(perf.winRateDelta * 100).toFixed(1)}% with ${perf.includedCount} samples`,
      metric: perf.winRateDelta,
    });
  }

  const nextHistory: BalanceHistory = {
    version: HISTORY_VERSION,
    cards: {},
  };

  for (const perf of rawPerformances) {
    const previous = previousHistory.cards[perf.id] ?? { consecutiveStableRuns: 0, locked: false };
    const noRecommendation = !recommendations.some(rec => rec.cardId === perf.id);
    const consecutiveStableRuns = perf.stableThisRun && noRecommendation
      ? previous.consecutiveStableRuns + 1
      : 0;
    const locked = previous.locked || consecutiveStableRuns >= CONSECUTIVE_STABLE_RUNS_TO_LOCK;

    perf.locked = locked;
    nextHistory.cards[perf.id] = {
      consecutiveStableRuns,
      locked,
    };
  }

  const synergyPairs: PairRecommendation[] = [];

  for (const [key, stat] of synergyStats.entries()) {
    if (stat.appearances < MIN_PAIR_SAMPLE) continue;
    const [cardAId, cardBId] = key.split('::');
    const perfA = rawPerformances.find(perf => perf.id === cardAId);
    const perfB = rawPerformances.find(perf => perf.id === cardBId);
    if (!perfA || !perfB) continue;
    const winRate = stat.wins / stat.appearances;
    const baseline = (perfA.includedWinRate + perfB.includedWinRate) / 2;
    synergyPairs.push({
      cardAId,
      cardAName: perfA.name,
      cardBId,
      cardBName: perfB.name,
      sampleSize: stat.appearances,
      winRate: round(winRate),
      score: round(winRate - baseline),
    });
  }

  const matchupPairs: MatchupRecommendation[] = [];

  for (const [key, stat] of matchupStats.entries()) {
    if (stat.appearances < MIN_PAIR_SAMPLE) continue;
    const [cardId, opponentId] = key.split('=>');
    const perf = rawPerformances.find(entry => entry.id === cardId);
    const opponent = rawPerformances.find(entry => entry.id === opponentId);
    if (!perf || !opponent) continue;
    const winRate = stat.wins / stat.appearances;
    matchupPairs.push({
      cardId,
      cardName: perf.name,
      opponentId,
      opponentName: opponent.name,
      sampleSize: stat.appearances,
      winRate: round(winRate),
      deltaVsBaseline: round(winRate - perf.includedWinRate),
    });
  }

  const performances = rawPerformances.sort((a, b) => {
    const lockDelta = Number(a.locked) - Number(b.locked);
    if (lockDelta !== 0) return lockDelta;
    return Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta);
  });

  const lockCounts = {
    crew: performances.filter(perf => perf.type === 'crew' && perf.locked).length,
    weapon: performances.filter(perf => perf.type === 'weapon' && perf.locked).length,
    product: performances.filter(perf => perf.type === 'product' && perf.locked).length,
  };

  return {
    overview: {
      sideAppearances,
      winningSides,
      locked: lockCounts,
      unlocked: {
        crew: performances.filter(perf => perf.type === 'crew' && !perf.locked).length,
        weapon: performances.filter(perf => perf.type === 'weapon' && !perf.locked).length,
        product: performances.filter(perf => perf.type === 'product' && !perf.locked).length,
      },
    },
    performances,
    recommendations: recommendations.sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric)),
    strongestSynergies: synergyPairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 12),
    weakestSynergies: synergyPairs
      .sort((a, b) => a.score - b.score)
      .slice(0, 12),
    bestCounters: matchupPairs
      .sort((a, b) => b.deltaVsBaseline - a.deltaVsBaseline)
      .slice(0, 12),
    worstMatchups: matchupPairs
      .sort((a, b) => a.deltaVsBaseline - b.deltaVsBaseline)
      .slice(0, 12),
    history: nextHistory,
  };
}
