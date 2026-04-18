// Intangible handler implementations — invoked from `abilities.ts`.
// Each returns an IntangibleOutcome; the dispatcher in abilities.ts
// walks rarity bands and calls them per-card in priority order.
import type { IntangibleOutcome } from './abilities';
import type { DrugCard, QueuedAction, ToughCard, Turf, TurfGameState } from './types';

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
const BRIBE_BANDS: Array<[number, number]> = [
  [5000, 0.99],
  [2000, 0.95],
  [1000, 0.85],
  [500, 0.7],
];

function bribeChance(denom: number): number {
  for (const [d, p] of BRIBE_BANDS) if (denom >= d) return p;
  return 0;
}

export function maybeBribe(
  state: TurfGameState,
  defender: Turf,
): IntangibleOutcome {
  let bestIdx = -1;
  let bestDenom = 0;
  for (let i = 0; i < defender.stack.length; i++) {
    const c = defender.stack[i].card;
    if (c.kind !== 'currency') continue;
    if (c.denomination > bestDenom) {
      bestDenom = c.denomination;
      bestIdx = i;
    }
  }
  if (bestIdx < 0 || bestDenom < 500) return proceed();
  const p = bribeChance(bestDenom);
  if (state.rng.next() >= p) {
    // Failed bribe — currency stays (vanishes on cancel only, §10.3).
    state.metrics.bribesFailed = (state.metrics.bribesFailed ?? 0) + 1;
    return proceed();
  }
  removeFromStack(defender, bestIdx);
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

  for (const entry of active.stack) {
    const card = entry.card;

    if (card.kind === 'drug') {
      if (card.abilities.includes('PATCHUP')) {
        // Heal the tough that owns this drug.
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

      if (card.abilities.includes('RESUSCITATE')) {
        // One-shot: fire only if not yet consumed for this drug card instance.
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

    if (card.kind === 'tough' && card.abilities.includes('FIELD_MEDIC')) {
      // +1 HP to every wounded tough on this turf (including self if wounded).
      for (const t of woundedToughs()) {
        t.hp = Math.min(t.maxHp, t.hp + 1);
      }
    }
  }
}
