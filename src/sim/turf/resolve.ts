import { applyTangibles, runIntangiblesPhase } from './abilities';
import { applyHealTicks } from './ability-handlers';
import { TURF_SIM_CONFIG } from './ai/config';
import { resolveStrikeNow, type StrikeOutcome } from './attacks';
import {
  hasToughOnTurf,
  modifiersByOwner,
  positionPower,
  positionResistance,
  promoteReserveTurf,
  turfCurrency,
  turfModifiers,
} from './board';
import { computeHeat, lockupDuration, raidProbability } from './heat';
import { combatBribeProbability, lockupProcess, returnFromHolding } from './holding';
import { wipeMarket } from './market';
import type {
  GameConfig,
  ModifierCard,
  QueuedAction,
  TurfGameState,
} from './types';

function actionsForTurn(
  config: GameConfig,
  turnNumber: number,
  side: 'A' | 'B',
): number {
  const base = turnNumber <= 1 ? config.firstTurnActions : config.actionsPerTurn;
  const profiles = TURF_SIM_CONFIG.difficultyProfiles as Record<
    string,
    { actionBonus: number; playerActionPenalty: number } | undefined
  >;
  const profile = profiles[config.difficulty];
  if (!profile) return base;
  if (side === 'B' && profile.actionBonus) return base + profile.actionBonus;
  if (side === 'A' && profile.playerActionPenalty)
    return Math.max(1, base - profile.playerActionPenalty);
  return base;
}

interface RankedAction {
  queued: QueuedAction;
  dominance: number;
  defenderR: number;
}

function opponent(side: 'A' | 'B'): 'A' | 'B' {
  return side === 'A' ? 'B' : 'A';
}

function dominanceForQueued(state: TurfGameState, q: QueuedAction): RankedAction {
  const atk = state.players[q.side].turfs[q.turfIdx];
  const def = state.players[opponent(q.side)].turfs[q.targetTurfIdx];
  if (!atk || !def) {
    return {
      queued: q,
      dominance: Number.NEGATIVE_INFINITY,
      defenderR: 0,
    };
  }
  const bonus = applyTangibles(atk, def);
  const aPower = positionPower(atk) + bonus.atkPowerDelta;
  const dResist = bonus.ignoreResistance
    ? 0
    : positionResistance(def, state.config.difficulty) + bonus.defResistDelta;
  return { queued: q, dominance: aPower - dResist, defenderR: dResist };
}

/**
 * Try a currency bribe to cancel a strike. Sums all currency on the
 * defender's active turf (turf-wide pool per RULES §10.3 + playtest-2
 * line 188-194); probability from turf-sim.json thresholds. On success,
 * consumes cheapest bills to cover the reached threshold; consumed cards
 * route to the Black Market. Returns true if strike canceled.
 */
function maybeCombatBribe(state: TurfGameState, q: QueuedAction): boolean {
  const def = state.players[opponent(q.side)].turfs[q.targetTurfIdx];
  if (!def) return false;
  const currencyEntries: Array<{ idx: number; denom: number }> = [];
  for (let i = 0; i < def.stack.length; i++) {
    const sc = def.stack[i];
    if (sc.card.kind === 'currency') currencyEntries.push({ idx: i, denom: sc.card.denomination });
  }
  if (currencyEntries.length === 0) return false;
  const totalCash = currencyEntries.reduce((s, e) => s + e.denom, 0);
  const p = combatBribeProbability(totalCash);
  if (p <= 0) return false;
  if (state.rng.next() >= p) return false;

  // Success: consume cheapest bills until the reached threshold is covered.
  currencyEntries.sort((a, b) => a.denom - b.denom);
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
  toRemove.sort((a, b) => b - a);
  for (const idx of toRemove) {
    const card = def.stack[idx].card;
    def.stack.splice(idx, 1);
    if (card.kind !== 'tough') state.blackMarket.push(card);
  }
  state.metrics.bribesAccepted++;
  return true;
}

/**
 * Raid phase. If triggered: wipe market, sweep face-up tops on both
 * active turfs into lockup, cancel queued strikes whose source tough
 * was locked up. Returns true if a raid fired.
 */
function raidPhase(state: TurfGameState): boolean {
  const heat = computeHeat(state).total;
  state.heat = heat;
  const p = raidProbability(heat, state.config.difficulty);
  if (state.rng.next() >= p) return false;

  state.metrics.raids++;
  wipeMarket(state);

  for (const side of ['A', 'B'] as const) {
    const player = state.players[side];
    const active = player.turfs[0];
    if (!active || active.closedRanks) continue;
    const topIdx = active.stack.length - 1;
    if (topIdx < 0) continue;
    const top = active.stack[topIdx];
    if (!top.faceUp) continue;
    if (top.card.kind !== 'tough') continue;

    // Bail? If total turf cash ≥ bailAmount, consume cheapest bills to cover.
    const bailAmount = TURF_SIM_CONFIG.bribe.bailAmount;
    const currencyIndices: Array<{ idx: number; denom: number }> = [];
    for (let ci = 0; ci < active.stack.length; ci++) {
      const sc = active.stack[ci];
      if (sc.card.kind === 'currency') currencyIndices.push({ idx: ci, denom: sc.card.denomination });
    }
    const totalBailCash = currencyIndices.reduce((s, e) => s + e.denom, 0);
    if (totalBailCash >= bailAmount) {
      // Consume cheapest bills first until bailAmount is covered.
      currencyIndices.sort((a, b) => a.denom - b.denom);
      let bailed = 0;
      const bailRemove: number[] = [];
      for (const e of currencyIndices) {
        if (bailed >= bailAmount) break;
        bailed += e.denom;
        bailRemove.push(e.idx);
      }
      bailRemove.sort((a, b) => b - a);
      for (const idx of bailRemove) {
        const card = active.stack[idx].card;
        active.stack.splice(idx, 1);
        if (card.kind !== 'tough') state.blackMarket.push(card);
      }
      continue;
    }

    // Lockup the top tough + its modifiers.
    const lockedTough = top.card;
    const lockedMods: ModifierCard[] = modifiersByOwner(active, lockedTough.id);
    // Remove the tough from the stack.
    active.stack.splice(topIdx, 1);
    // Remove every mod bound to that tough.
    for (let i = active.stack.length - 1; i >= 0; i--) {
      const sc = active.stack[i];
      if (sc.card.kind !== 'tough' && sc.owner === lockedTough.id) {
        active.stack.splice(i, 1);
      }
    }
    state.lockup[side].push({
      tough: lockedTough,
      attachedModifiers: lockedMods,
      turnsRemaining: lockupDuration(state.config.difficulty),
    });
    if (player.toughsInPlay > 0) player.toughsInPlay--;

    // Cancel queued strikes from this side targeting via this tough.
    player.queued = player.queued.filter((q) => {
      const src = player.turfs[q.turfIdx];
      if (!src) return false;
      return src.stack.some(
        (sc) => sc.card.kind === 'tough' && sc.card.hp > 0,
      );
    });
  }
  return true;
}

/**
 * Apply the full resolve phase: raid → combat → seize reconciliation →
 * heal ticks → holding sweep → lockup process → cleanup → action budgets.
 */
export function resolvePhase(state: TurfGameState): void {
  state.phase = 'resolve';

  // 1. Raid phase (may clear queued strikes by locking up sources).
  raidPhase(state);

  // 2. Combat Pass 1: rank queued actions by dominance.
  const ranked: RankedAction[] = [];
  for (const side of ['A', 'B'] as const) {
    for (const q of state.players[side].queued) {
      ranked.push(dominanceForQueued(state, q));
    }
  }
  // Higher dominance first. Ties → higher defender R wins (defender inertia).
  ranked.sort((a, b) => {
    if (b.dominance !== a.dominance) return b.dominance - a.dominance;
    return b.defenderR - a.defenderR;
  });

  // 3. Combat Pass 2: priority chain per queued strike.
  const attackedBy: Map<string, 'A' | 'B'> = new Map();
  const key = (defSide: 'A' | 'B', idx: number) => `${defSide}:${idx}`;

  for (const ra of ranked) {
    const q = ra.queued;
    // 3a. Currency bribe → may cancel strike outright.
    if (maybeCombatBribe(state, q)) continue;
    // 3b. Drugs + weapons intangibles (counter / redirect / bribe ability).
    const verdict = runIntangiblesPhase(state, q);
    if (verdict.kind === 'canceled') continue;
    if (verdict.kind === 'redirected') q.targetTurfIdx = verdict.newTargetTurfIdx;
    // 3c. Resolve the strike (damage math happens here).
    const result = resolveStrikeNow(state, q);
    accrueMetrics(state, q, result.outcome);
    attackedBy.set(key(opponent(q.side), q.targetTurfIdx), q.side);
  }

  // 4. Seize reconciliation: any defender turf that was attacked AND has
  // no living tough now → seize + promote reserve.
  for (const atkSide of ['A', 'B'] as const) {
    const defSide = opponent(atkSide);
    const defender = state.players[defSide];
    for (let i = defender.turfs.length - 1; i >= 0; i--) {
      if (attackedBy.get(key(defSide, i)) !== atkSide) continue;
      if (hasToughOnTurf(defender.turfs[i])) continue;
      // Send dead turf's surviving modifiers to the Black Market.
      const mods = turfModifiers(defender.turfs[i]);
      for (const m of mods) state.blackMarket.push(m);
      const previousTurns = state.warStats.seizures
        .filter((s) => s.seizedBy === atkSide)
        .reduce((sum, s) => sum + s.turnsOnThatTurf, 0);
      state.warStats.seizures.push({
        seizedBy: atkSide,
        seizedTurfIdx: i,
        turnsOnThatTurf: state.turnNumber - previousTurns,
      });
      state.metrics.seizures++;
      if (i === 0) promoteReserveTurf(defender);
      else defender.turfs.splice(i, 1);
    }
  }

  // 5. End-of-turn heal ticks: PATCHUP / FIELD_MEDIC / RESUSCITATE.
  for (const side of ['A', 'B'] as const) applyHealTicks(state, side);

  // 6. Holding & lockup sweeps.
  for (const side of ['A', 'B'] as const) returnFromHolding(state, side);
  lockupProcess(state);

  // 7. Cleanup.
  for (const side of ['A', 'B'] as const) {
    const p = state.players[side];
    p.queued.length = 0;
    p.turnEnded = false;
    if (p.pending) {
      // Modifiers route to the shared Black Market; toughs simply leave play.
      if (p.pending.kind !== 'tough') {
        state.blackMarket.push(p.pending as ModifierCard);
      }
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

  // 8. Winner detection.
  const aEmpty = state.players.A.turfs.length === 0;
  const bEmpty = state.players.B.turfs.length === 0;
  if (aEmpty && bEmpty) {
    state.winner = null;
    state.endReason = 'draw';
  } else if (aEmpty) {
    state.winner = 'B';
    state.endReason = 'total_seizure';
  } else if (bEmpty) {
    state.winner = 'A';
    state.endReason = 'total_seizure';
  }
}

function accrueMetrics(
  state: TurfGameState,
  q: QueuedAction,
  outcome: StrikeOutcome,
): void {
  const m = state.metrics;
  if (q.kind === 'direct_strike') m.directStrikes++;
  else if (q.kind === 'pushed_strike') m.pushedStrikes++;
  else m.fundedRecruits++;
  if (!m.firstStrike) m.firstStrike = q.side;
  if (outcome === 'kill') {
    m.kills++;
    const opp = state.players[opponent(q.side)];
    opp.toughsInPlay = Math.max(0, opp.toughsInPlay - 1);
    if (q.kind === 'funded_recruit') state.players[q.side].toughsInPlay++;
  } else if (outcome === 'busted') {
    m.busts++;
  } else {
    // wound / serious_wound / crushing → stat metric; preserve legacy 'spiked'.
    m.spiked++;
  }
}

export function __debug_dominances(
  state: TurfGameState,
): Array<{ queued: QueuedAction; dominance: number }> {
  const out: Array<{ queued: QueuedAction; dominance: number }> = [];
  for (const side of ['A', 'B'] as const) {
    for (const q of state.players[side].queued) {
      const r = dominanceForQueued(state, q);
      out.push({ queued: r.queued, dominance: r.dominance });
    }
  }
  return out;
}
