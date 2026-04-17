import type { Rng } from '../cards/rng';
import type { WarStats } from '../turf/types';
import type {
  PackInstance,
  PackKind,
  RewardBundle,
  TurfSeizureReward,
  VictoryRating,
  WarOutcome,
  WarOutcomeReward,
} from './types';

/**
 * v0.3 progression — war-outcome + per-turf reward math (RULES §13).
 *
 * Pure functions: given a WarStats snapshot, the winner flag, and a
 * seeded RNG, produces a deterministic RewardBundle. Persistence and
 * pack contents are *not* touched here — the caller (App.tsx / AI
 * profile layer) hands these bundles to the pack opener.
 */

const PERFECT_WAR_FALLBACK_CURRENCY = 500;

function rollPackCategory(_rng: Rng): PackKind {
  return 'standard';
}

function makePack(kind: PackKind, rng: Rng): PackInstance {
  // Reward bundles are intent-only — the actual cards are rolled at
  // open-time by the pack generator. Giving the pack a stable id here
  // lets the UI/persistence correlate "this is the 5-card pack I
  // earned from my Absolute Victory on turf 2" when the reveal screen
  // renders later.
  const entropy = rng.int(100000, 999999);
  return {
    id: `pack-${kind}-${entropy}`,
    kind,
    cards: [],
    openedAt: null,
  };
}

/** Map turns-to-seize to a VictoryRating tier (RULES §13.1). */
export function classifyTurfSeizure(turnsToSeize: number): VictoryRating {
  if (turnsToSeize === 1) return 'absolute';
  if (turnsToSeize === 2) return 'overwhelming';
  if (turnsToSeize <= 3) return 'decisive';
  return 'standard';
}

/**
 * Produce a TurfSeizureReward for every seizure in `warStats`. Pack
 * types are rolled uniformly at random from the four category packs.
 *
 * Callers that want only their own seizures should pre-filter the
 * WarStats by `seizedBy` side before calling.
 */
export function computePerTurfRewards(
  warStats: WarStats,
  rng: Rng,
): TurfSeizureReward[] {
  return warStats.seizures.map((s) => {
    const rating = classifyTurfSeizure(s.turnsOnThatTurf);
    if (rating === 'standard') {
      return { pack: null, rating, turnsToSeize: s.turnsOnThatTurf };
    }
    // Pack size scales by rating (5 / 3 / 1). For 'absolute' we
    // award a standard 5-card pack; smaller ratings get triples or
    // singles. The generator fills each slot with a probabilistic
    // type roll.
    const kind: PackKind =
      rating === 'absolute' ? rollPackCategory(rng) :
      rating === 'overwhelming' ? 'triple' :
      'single';
    const pack = makePack(kind, rng);
    return { pack, rating, turnsToSeize: s.turnsOnThatTurf };
  });
}

/**
 * Rate the winner's war outcome (RULES §13.2). Returns null on loss.
 *
 * - Perfect: every own seizure is Absolute AND winner lost zero turfs.
 * - Flawless: every own seizure is Decisive or better AND zero losses.
 * - Dominant: zero losses, but some seizures were Standard.
 * - Won: won despite taking losses.
 */
export function classifyWarOutcome(
  warStats: WarStats,
  won: boolean,
  winnerSide: 'A' | 'B' = 'A',
): WarOutcome | null {
  if (!won) return null;
  const ownSeizures = warStats.seizures.filter((s) => s.seizedBy === winnerSide);
  const lostTurfs = warStats.seizures.filter((s) => s.seizedBy !== winnerSide).length;
  const ratings = ownSeizures.map((s) => classifyTurfSeizure(s.turnsOnThatTurf));
  const allAbsolute = ratings.length > 0 && ratings.every((r) => r === 'absolute');
  const allDecisiveOrBetter = ratings.length > 0 && ratings.every((r) => r !== 'standard');
  if (lostTurfs === 0 && allAbsolute) return 'perfect';
  if (lostTurfs === 0 && allDecisiveOrBetter) return 'flawless';
  if (lostTurfs === 0) return 'dominant';
  return 'won';
}

/** Compute the war-outcome reward. Mutates `mythicPool` on a Perfect draw. */
export function computeWarOutcomeReward(
  warStats: WarStats,
  won: boolean,
  mythicPool: string[],
  rng: Rng,
  winnerSide: 'A' | 'B' = 'A',
): WarOutcomeReward {
  const outcome = classifyWarOutcome(warStats, won, winnerSide);
  if (!outcome) {
    return { pack: null, outcome: null, mythicDraw: null, escalatingCurrency: null };
  }
  if (outcome === 'perfect') {
    if (mythicPool.length > 0) {
      const mythicDraw = rng.pick(mythicPool);
      // Mutate the pool in-place so caller can thread pool state
      // across multiple sequential wars without re-seeding.
      const idx = mythicPool.indexOf(mythicDraw);
      mythicPool.splice(idx, 1);
      return { pack: null, outcome, mythicDraw, escalatingCurrency: null };
    }
    // Pool exhausted — RULES §13.4 says escalating currency ($500 →
    // $1000 → $1500 → …) but that escalation state lives on the
    // profile, not in a stateless reward call. We return the floor
    // bounty; the persistence layer escalates on its own. See TODO
    // in ai-profile.ts (and the player profile) for follow-up.
    return {
      pack: null,
      outcome,
      mythicDraw: null,
      escalatingCurrency: PERFECT_WAR_FALLBACK_CURRENCY,
    };
  }
  const kind: PackKind =
    outcome === 'flawless' ? rollPackCategory(rng) :
    outcome === 'dominant' ? 'triple' :
    'single';
  return {
    pack: makePack(kind, rng),
    outcome,
    mythicDraw: null,
    escalatingCurrency: null,
  };
}

/** Aggregate per-turf + war-outcome rewards for one side. */
export function computeRewardBundle(
  warStats: WarStats,
  won: boolean,
  mythicPool: string[],
  rng: Rng,
  winnerSide: 'A' | 'B' = 'A',
): RewardBundle {
  // Per-turf rewards: filter to seizures BY the winner (the losing
  // side doesn't get rewarded for turfs taken from them).
  const ownWarStats: WarStats = {
    seizures: warStats.seizures.filter((s) => s.seizedBy === winnerSide),
  };
  const turfRewards = won ? computePerTurfRewards(ownWarStats, rng) : [];
  const warOutcomeReward = computeWarOutcomeReward(warStats, won, mythicPool, rng, winnerSide);
  return { turfRewards, warOutcomeReward };
}
