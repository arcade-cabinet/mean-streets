// Intangible handler implementations — invoked from `abilities.ts`.
// Each returns an IntangibleOutcome; the dispatcher in abilities.ts
// walks rarity bands and calls them per-card in priority order.
import type { IntangibleOutcome } from './abilities';
import { TURF_SIM_CONFIG } from './ai/config';
import { isBribeSpendableCurrency } from './ability-hooks';
import type { QueuedAction, ToughCard, Turf, TurfGameState } from './types';

export const proceed = (): IntangibleOutcome => ({ kind: 'proceed' });

export function getTurf(
  state: TurfGameState,
  side: 'A' | 'B',
  idx: number,
): Turf | null {
  return state.players[side].turfs[idx] ?? null;
}

export function removeFromStack(turf: Turf, idx: number): void {
  turf.stack.splice(idx, 1);
  if (turf.sickTopIdx != null) {
    if (idx === turf.sickTopIdx) turf.sickTopIdx = null;
    else if (idx < turf.sickTopIdx) turf.sickTopIdx--;
  }
}

// ── Counter ─────────────────────────────────────────────────
export function runCounter(
  state: TurfGameState,
  queued: QueuedAction,
  carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
): IntangibleOutcome {
  if (carrierSide !== 'defender') return proceed();
  const defSide: 'A' | 'B' = queued.side === 'A' ? 'B' : 'A';
  const defender = getTurf(state, defSide, queued.targetTurfIdx);
  if (!defender || carrierIdx < 0 || carrierIdx >= defender.stack.length)
    return proceed();
  removeFromStack(defender, carrierIdx);
  return { kind: 'canceled', reason: 'countered' };
}

// ── Probabilistic bribe (§10.3) ─────────────────────────────
/**
 * Look up bribe probability from turf-sim.json thresholds.
 * Reads `bribe.thresholds` as the single source of truth — highest
 * tier whose `amount` ≤ `totalCash` wins.
 */
export function bribeProbabilityForAmount(amount: number): number {
  let best = 0;
  for (const tier of TURF_SIM_CONFIG.bribe.thresholds) {
    if (amount >= tier.amount) best = Math.max(best, tier.probability);
  }
  return best;
}

/**
 * Attempt a turf-wide currency bribe before the strike resolves (§10.3).
 *
 * Sums ALL currency cards on the defender's active turf (not just the
 * largest single denomination). On success, consumes currency starting
 * with the cheapest denominations until the threshold amount is covered;
 * consumed cards are routed to the shared Black Market (no discard pile
 * in v0.3). On failure, currency stays.
 */
export function maybeBribe(
  state: TurfGameState,
  defender: Turf,
): IntangibleOutcome {
  // Collect currency entries sorted ascending by denomination (cheapest first
  // for consumption, per §4 affiliation-buffer precedent).
  const currencyEntries: Array<{ idx: number; denom: number }> = [];
  for (let i = 0; i < defender.stack.length; i++) {
    const c = defender.stack[i].card;
    if (c.kind !== 'currency') continue;
    if (!isBribeSpendableCurrency(c)) continue;
    currencyEntries.push({ idx: i, denom: c.denomination });
  }
  if (currencyEntries.length === 0) return proceed();

  const totalCash = currencyEntries.reduce((s, e) => s + e.denom, 0);
  const p = bribeProbabilityForAmount(totalCash);
  if (p <= 0) return proceed();

  if (state.rng.next() >= p) {
    // Failed — currency stays (§10.3: vanishes only on success).
    state.metrics.bribesFailed = (state.metrics.bribesFailed ?? 0) + 1;
    return proceed();
  }

  // Success: consume cheapest denominations until we've covered the best
  // reached threshold. Sort ascending so we spend the smallest bills first.
  currencyEntries.sort((a, b) => a.denom - b.denom);
  // Find which threshold amount we reached (the highest tier whose amount
  // ≤ totalCash) — consume exactly that much.
  let thresholdAmount = 0;
  for (const tier of TURF_SIM_CONFIG.bribe.thresholds) {
    if (totalCash >= tier.amount) thresholdAmount = tier.amount;
  }

  let spent = 0;
  const toRemove: number[] = [];
  for (const e of currencyEntries) {
    if (spent >= thresholdAmount) break;
    spent += e.denom;
    toRemove.push(e.idx);
  }
  // Remove in reverse-index order to preserve earlier indices.
  toRemove.sort((a, b) => b - a);
  for (const idx of toRemove) {
    const card = defender.stack[idx].card;
    removeFromStack(defender, idx);
    if (card.kind !== 'tough') state.blackMarket.push(card);
  }

  state.metrics.bribesAccepted = (state.metrics.bribesAccepted ?? 0) + 1;
  return { kind: 'canceled', reason: 'bribed' };
}

// ── Drug-driven self-attack (CONFUSE/PARANOIA) ──────────────
export function runSelfAttack(
  state: TurfGameState,
  queued: QueuedAction,
  _carrierIdx: number,
  carrierSide: 'attacker' | 'defender',
): IntangibleOutcome {
  if (carrierSide !== 'defender') return proceed();
  const atk = state.players[queued.side];
  let weakestIdx = -1;
  let weakestPower = Number.POSITIVE_INFINITY;
  for (let i = 0; i < atk.turfs.length; i++) {
    if (i === queued.turfIdx) continue;
    const power = atk.turfs[i].stack.reduce(
      (s, sc) => (sc.card.kind === 'currency' ? s : s + sc.card.power),
      0,
    );
    if (power < weakestPower) {
      weakestPower = power;
      weakestIdx = i;
    }
  }
  if (weakestIdx < 0) return proceed();
  return {
    kind: 'redirected',
    newTargetTurfIdx: weakestIdx,
    reason: 'self-attack',
  };
}

// ── Mythic handlers ─────────────────────────────────────────
/** CLEAN_SLATE (mythic-02): one-shot resets total heat to 0. */
export function runCleanSlate(state: TurfGameState): IntangibleOutcome {
  state.heat = 0;
  return proceed();
}

/** BUILD_TURF (mythic-03): carve out +1 reserve turf. */
export function runBuildTurf(
  state: TurfGameState,
  queued: QueuedAction,
): IntangibleOutcome {
  const player = state.players[queued.side];
  player.turfs.push({
    id: `built-${queued.side}-${player.turfs.length}`,
    stack: [],
    sickTopIdx: null,
    closedRanks: false,
    isActive: false,
    reserveIndex: player.turfs.length,
  });
  return proceed();
}

/** STRIKE_RETREATED (mythic-05): retarget to a face-up-via-retreat tough. */
export function runStrikeRetreated(
  state: TurfGameState,
  queued: QueuedAction,
): IntangibleOutcome {
  const defSide: 'A' | 'B' = queued.side === 'A' ? 'B' : 'A';
  const defender = getTurf(state, defSide, queued.targetTurfIdx);
  if (!defender) return proceed();
  for (let i = defender.stack.length - 1; i > 0; i--) {
    const sc = defender.stack[i];
    if (sc.card.kind === 'tough' && sc.faceUp) {
      return {
        kind: 'redirected',
        newTargetTurfIdx: queued.targetTurfIdx,
        newTargetStackIdx: i,
        reason: 'strike-retreated',
      };
    }
  }
  return proceed();
}

// ── Healing chain (§7) ──────────────────────────────────────
/**
 * Apply end-of-turn heal ticks from PATCHUP / FIELD_MEDIC passives
 * for a single side's active turf.
 *
 * PATCHUP (drug): +1 HP/turn to the tough that owns this drug.
 * FIELD_MEDIC (tough): +1 HP to every wounded tough on the same turf.
 * RESUSCITATE (drug): one-shot full heal to the tough that owns this drug;
 *                     fires once then marks the drug's id as consumed.
 *
 * All heals are clamped to maxHp.
 */
export function applyHealTicks(state: TurfGameState, side: 'A' | 'B'): void {
  const player = state.players[side];
  const active = player.turfs[0];
  if (!active) return;

  // Collect toughs that are alive but wounded for FIELD_MEDIC targeting.
  const woundedToughs = (): ToughCard[] => {
    const out: ToughCard[] = [];
    for (const entry of active.stack) {
      const c = entry.card;
      if (c.kind === 'tough' && c.hp > 0 && c.hp < c.maxHp) out.push(c);
    }
    return out;
  };

  // Priority order per RULES §7: PATCHUP → FIELD_MEDIC → RESUSCITATE.
  // Iterate the stack three times, one tier per pass, to ensure deterministic
  // ordering regardless of where abilities appear in the stack.

  // Pass 1 — PATCHUP (drug): +1 HP/turn to the owning tough.
  for (const entry of active.stack) {
    const card = entry.card;
    if (card.kind === 'drug' && card.abilities.includes('PATCHUP')) {
      const ownerId = entry.owner;
      if (ownerId) {
        for (const e2 of active.stack) {
          if (e2.card.kind === 'tough' && e2.card.id === ownerId) {
            const t = e2.card;
            if (t.hp > 0) t.hp = Math.min(t.maxHp, t.hp + 1);
          }
        }
      }
    }
  }

  // Pass 2 — FIELD_MEDIC (tough): +1 HP to every wounded tough on this turf.
  for (const entry of active.stack) {
    const card = entry.card;
    if (card.kind === 'tough' && card.abilities.includes('FIELD_MEDIC')) {
      for (const t of woundedToughs()) {
        t.hp = Math.min(t.maxHp, t.hp + 1);
      }
    }
  }

  // Pass 3 — RESUSCITATE (drug): one-shot full heal to the owning tough.
  for (const entry of active.stack) {
    const card = entry.card;
    if (card.kind === 'drug' && card.abilities.includes('RESUSCITATE')) {
      if (!state.resuscitateConsumed.has(card.id)) {
        const ownerId = entry.owner;
        if (ownerId) {
          for (const e2 of active.stack) {
            if (e2.card.kind === 'tough' && e2.card.id === ownerId) {
              const t = e2.card;
              if (t.hp > 0 && t.hp < t.maxHp) {
                t.hp = t.maxHp;
                state.resuscitateConsumed.add(card.id);
              }
            }
          }
        }
      }
    }
  }
}
