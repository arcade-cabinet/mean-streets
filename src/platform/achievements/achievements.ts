/**
 * Achievement tracker.
 *
 * Listens for game-end events and returns newly-unlocked card IDs.
 * Unlock conditions are authored alongside each card in
 * config/raw/cards via the unlockCondition field. This module
 * parses a minimal DSL over those strings so the runtime can decide
 * which conditions fire without hand-coding each one.
 *
 * Supported condition patterns (case-insensitive):
 *
 *   "Win N games"                — cumulative win counter >= N
 *   "Win a game in under N rounds" — latest game <= N rounds
 *   "Kill N enemies in a single game" — latest game kills >= N
 *   "Seize N positions total"    — cumulative seizures >= N
 *   "Win without losing a position" — latest game: zero own positions seized
 *
 * Unrecognized conditions never unlock; they stay locked until a
 * writer hand-wires them in the next pass (Epic J3).
 */

import type { CompiledTough } from '../../sim/cards/schemas';
import type { TurfMetrics } from '../../sim/turf/types';
import type { PlayerProfile } from '../persistence/storage';

export interface GameEndEvent {
  winner: 'A' | 'B';
  playerSide: 'A' | 'B';
  metrics: TurfMetrics;
  turnCount: number;
  ownPositionsLost: number;
}

export interface UnlockResult {
  newlyUnlocked: string[];
  updatedProfile: PlayerProfile;
}

interface ConditionContext {
  profile: PlayerProfile;
  event: GameEndEvent;
  playerWon: boolean;
}

type ConditionMatcher = (ctx: ConditionContext) => boolean;

function matchWinNGames(condition: string): ConditionMatcher | null {
  const match = /^win (\d+) games?$/i.exec(condition);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  return (ctx) => ctx.profile.wins >= n;
}

function matchWinUnderNRounds(condition: string): ConditionMatcher | null {
  const match = /^win a game in under (\d+) rounds?$/i.exec(condition);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  return (ctx) => ctx.playerWon && ctx.event.turnCount < n;
}

function matchKillsInSingleGame(condition: string): ConditionMatcher | null {
  const match = /^kill (\d+) enemies in a single game$/i.exec(condition);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  return (ctx) => ctx.event.metrics.kills >= n;
}

function matchSeizeNTotal(condition: string): ConditionMatcher | null {
  const match = /^seize (\d+) positions total$/i.exec(condition);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  // ctx.profile has already been updated with this game's seizures
  // (cumulativeSeizures read AFTER the increment). Compare directly.
  return (ctx) => cumulativeSeizures(ctx.profile) >= n;
}

function matchWinWithoutLoss(condition: string): ConditionMatcher | null {
  if (!/^win without losing a position$/i.test(condition)) return null;
  return (ctx) => ctx.playerWon && ctx.event.ownPositionsLost === 0;
}

function cumulativeSeizures(profile: PlayerProfile): number {
  const meta = (profile as { _meta?: { cumulativeSeizures?: number } })._meta;
  return meta?.cumulativeSeizures ?? 0;
}

function writeCumulativeSeizures(
  profile: PlayerProfile,
  value: number,
): PlayerProfile {
  const meta =
    (profile as PlayerProfile & { _meta?: Record<string, number> })._meta ?? {};
  return {
    ...profile,
    _meta: { ...meta, cumulativeSeizures: value },
  } as PlayerProfile;
}

const MATCHERS: Array<(condition: string) => ConditionMatcher | null> = [
  matchWinNGames,
  matchWinUnderNRounds,
  matchKillsInSingleGame,
  matchSeizeNTotal,
  matchWinWithoutLoss,
];

function parseCondition(condition: string): ConditionMatcher | null {
  for (const matcher of MATCHERS) {
    const m = matcher(condition);
    if (m) return m;
  }
  return null;
}

/**
 * Process a game-end event against the full card catalog and return
 * newly-unlocked card IDs plus an updated profile.
 */
export function processGameEnd(
  event: GameEndEvent,
  catalog: CompiledTough[],
  profile: PlayerProfile,
): UnlockResult {
  const playerWon = event.winner === event.playerSide;

  let nextProfile: PlayerProfile = {
    ...profile,
    wins: playerWon ? profile.wins + 1 : profile.wins,
    lastPlayedAt: new Date().toISOString(),
  };
  nextProfile = writeCumulativeSeizures(
    nextProfile,
    cumulativeSeizures(profile) + event.metrics.seizures,
  );

  const alreadyUnlocked = new Set(nextProfile.unlockedCardIds);
  const newlyUnlocked: string[] = [];

  for (const card of catalog) {
    if (card.unlocked) continue;
    if (alreadyUnlocked.has(card.id)) continue;
    if (!card.unlockCondition) continue;
    const matcher = parseCondition(card.unlockCondition);
    if (!matcher) continue;
    const ctx: ConditionContext = { profile: nextProfile, event, playerWon };
    if (matcher(ctx)) {
      newlyUnlocked.push(card.id);
      alreadyUnlocked.add(card.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    nextProfile = {
      ...nextProfile,
      unlockedCardIds: [...alreadyUnlocked],
    };
  }

  return { newlyUnlocked, updatedProfile: nextProfile };
}
