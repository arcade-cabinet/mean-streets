import { applyTangibles, runIntangiblesPhase } from './abilities';
import { TURF_SIM_CONFIG } from './ai/config';
import { resolveStrikeNow } from './attacks';
import {
  hasToughOnTurf,
  positionPower,
  positionResistance,
  seizeTurf,
} from './board';
import type { GameConfig, QueuedAction, TurfGameState } from './types';

// Local copy of actionsForTurn to avoid a circular import with environment.ts.
function actionsForTurn(
  config: GameConfig,
  turnNumber: number,
  side: 'A' | 'B',
): number {
  const base =
    turnNumber <= 1 ? config.firstTurnActions : config.actionsPerTurn;
  const profiles = TURF_SIM_CONFIG.difficultyProfiles as Record<
    string,
    { actionBonus: number; playerActionPenalty: number } | undefined
  >;
  const profile = profiles[config.difficulty];
  if (!profile) return base;
  const isAI = side === 'B';
  if (isAI && profile.actionBonus) return base + profile.actionBonus;
  if (!isAI && profile.playerActionPenalty) {
    return Math.max(1, base - profile.playerActionPenalty);
  }
  return base;
}

interface RankedAction {
  queued: QueuedAction;
  dominance: number;
}

function opponent(side: 'A' | 'B'): 'A' | 'B' {
  return side === 'A' ? 'B' : 'A';
}

/**
 * Compute dominance for a queued attack: `attacker power + tangible bonus
 * + loyalty atk` minus defender tangible/resist contribution (the defender
 * number is folded in so ties break toward the defender: higher dominance
 * = stronger offensive swing). For ordering, we use attacker-minus-defender
 * so a close match lands near zero and ties push to the defender's
 * resistance bucket (defensive inertia).
 */
function dominanceForQueued(state: TurfGameState, q: QueuedAction): number {
  const atk = state.players[q.side].turfs[q.turfIdx];
  const def = state.players[opponent(q.side)].turfs[q.targetTurfIdx];
  if (!atk || !def) return -Number.POSITIVE_INFINITY;
  const bonus = applyTangibles(atk, def);
  const aPower = positionPower(atk) + bonus.atkPowerDelta;
  const dResist = bonus.ignoreResistance
    ? 0
    : positionResistance(def) + bonus.defResistDelta;
  return aPower - dResist;
}

/**
 * Resolve all queued actions for both players at end-of-turn. Assumes both
 * `state.players.A.turnEnded` and `state.players.B.turnEnded` are true.
 *
 * Order of operations:
 *   1. Compute dominance for every queued action.
 *   2. Sort by dominance descending; ties favor the defender side (offense
 *      has to overcome inertia).
 *   3. For each queued action: run intangibles → if canceled, skip; if
 *      redirected, mutate targetTurfIdx; if proceed, call `resolveStrikeNow`.
 *   4. After resolving, scan for defender turfs with zero living toughs →
 *      seize.
 *   5. Clear queued arrays, turnEnded flags, pending-placement cards.
 *   6. Increment turnNumber, reset action budgets, reset phase to 'action'.
 *   7. Check winner: if either player has 0 turfs, set `state.winner`.
 */
export function resolvePhase(state: TurfGameState): void {
  state.phase = 'resolve';

  const ranked: RankedAction[] = [];
  for (const side of ['A', 'B'] as const) {
    for (const queued of state.players[side].queued) {
      ranked.push({
        queued,
        dominance: dominanceForQueued(state, queued),
      });
    }
  }

  // Sort: highest dominance first; ties favor defender — since we're
  // ordering *attacker actions*, "tie favors defender" means in a tie
  // between two attacker actions targeting symmetric turfs, the action
  // whose attacker has weaker position (higher defender inertia) resolves
  // later. We implement as: equal dominance → stable ordering preserved.
  // Defensive inertia is already baked into the `dominance` calc.
  ranked.sort((a, b) => b.dominance - a.dominance);

  for (const ra of ranked) {
    const q = ra.queued;
    const verdict = runIntangiblesPhase(state, q);
    if (verdict.kind === 'canceled') continue;
    if (verdict.kind === 'redirected') {
      q.targetTurfIdx = verdict.newTargetTurfIdx;
    }
    const result = resolveStrikeNow(state, q);
    accrueMetrics(state, q, result.outcome);
  }

  // Seize sweep: any defender turf with zero living toughs.
  for (const atkSide of ['A', 'B'] as const) {
    const defSide = opponent(atkSide);
    const defender = state.players[defSide];
    const attacker = state.players[atkSide];
    for (let i = defender.turfs.length - 1; i >= 0; i--) {
      if (!hasToughOnTurf(defender.turfs[i])) {
        // Only attack-side seizes a defender whose turfs were attacked;
        // we don't know "who struck last", so we seize toward attacker A
        // if defender is B, else toward B — simpler: attacker is the
        // side that targeted this turf. Fallback: default destination 0.
        seizeTurf(defender, i, attacker, 0);
        state.metrics.seizures++;
      }
    }
  }

  // Clear per-turn mutable slots.
  for (const side of ['A', 'B'] as const) {
    const p = state.players[side];
    p.queued.length = 0;
    p.turnEnded = false;
    // Any leftover pending card at resolve time failed placement → discard.
    if (p.pending) {
      p.discard.push(p.pending);
      state.metrics.cardsDiscarded++;
      p.pending = null;
    }
  }

  state.turnNumber++;
  state.metrics.turns++;
  for (const side of ['A', 'B'] as const) {
    state.players[side].actionsRemaining = actionsForTurn(
      state.config,
      state.turnNumber,
      side,
    );
  }
  state.phase = 'action';

  // Winner detection: zero-turfs = match over.
  if (state.players.A.turfs.length === 0) {
    state.winner = 'B';
    state.endReason = 'total_seizure';
  } else if (state.players.B.turfs.length === 0) {
    state.winner = 'A';
    state.endReason = 'total_seizure';
  }
}

function accrueMetrics(
  state: TurfGameState,
  q: QueuedAction,
  outcome: 'kill' | 'sick' | 'busted',
): void {
  const m = state.metrics;
  if (q.kind === 'direct_strike') m.directStrikes++;
  else if (q.kind === 'pushed_strike') m.pushedStrikes++;
  else m.fundedRecruits++;
  if (!m.firstStrike) m.firstStrike = q.side;
  if (outcome === 'kill') {
    m.kills++;
    state.players[opponent(q.side)].toughsInPlay = Math.max(
      0,
      state.players[opponent(q.side)].toughsInPlay - 1,
    );
    if (q.kind === 'funded_recruit') state.players[q.side].toughsInPlay++;
  } else if (outcome === 'sick') {
    m.spiked++;
  } else {
    m.busts++;
  }
}

/** Test/debug helper — surface dominance values without running the phase. */
export function __debug_dominances(
  state: TurfGameState,
): Array<{ queued: QueuedAction; dominance: number }> {
  const out: Array<{ queued: QueuedAction; dominance: number }> = [];
  for (const side of ['A', 'B'] as const) {
    for (const q of state.players[side].queued) {
      out.push({ queued: q, dominance: dominanceForQueued(state, q) });
    }
  }
  return out;
}
