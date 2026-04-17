import { TURF_SIM_CONFIG } from './ai/config';
import { addToStack } from './board';
import { lockupDuration } from './heat';
import { hasImmunity } from './ability-hooks';
import { RARITY_RANK } from './market';
import { killToughAtIdx } from './stack-ops';
import type {
  ModifierCard,
  PlayerState,
  ToughCard,
  ToughInCustody,
  TurfGameState,
} from './types';

const BRIBE_CONFIG = TURF_SIM_CONFIG.bribe;

export type HoldingOutcome =
  | { outcome: 'none' }
  | { outcome: 'bribed'; consumedMods: string[] }
  | { outcome: 'lockup'; turnsRemaining: number }
  | { outcome: 'raid' };

function findTough(
  player: PlayerState, toughId: string,
): { turfIdx: number; stackIdx: number } | null {
  for (let ti = 0; ti < player.turfs.length; ti++) {
    const turf = player.turfs[ti];
    for (let si = 0; si < turf.stack.length; si++) {
      const e = turf.stack[si];
      if (e.card.kind === 'tough' && e.card.id === toughId)
        return { turfIdx: ti, stackIdx: si };
    }
  }
  return null;
}

/** Move a tough (+ attached modifiers) from the active turf to Holding. */
export function sendToHolding(
  state: TurfGameState, side: 'A' | 'B', toughId: string,
): void {
  const player = state.players[side];
  const located = findTough(player, toughId);
  if (!located) return;
  // IMMUNITY (mythic-08): this tough cannot be sent to Holding.
  const turfEntry = player.turfs[located.turfIdx];
  const toughEntry = turfEntry?.stack[located.stackIdx];
  if (toughEntry?.card.kind === 'tough' && hasImmunity(toughEntry.card)) return;
  const turf = player.turfs[located.turfIdx];
  const { tough, mods } = killToughAtIdx(turf, located.stackIdx);
  const custodyMods: ModifierCard[] = [];
  for (const m of mods) if (m.kind !== 'tough') custodyMods.push(m as ModifierCard);
  state.holding[side].push({
    tough: tough as ToughCard,
    attachedModifiers: custodyMods,
  });
  if (player.toughsInPlay > 0) player.toughsInPlay--;
}

/**
 * Bribe success probability for a holding check:
 *   base 0.5 + rarity_rank × 0.1 + min(0.3, amount/10000).
 */
export function bribeSuccess(tough: ToughCard, amount: number): number {
  const base = BRIBE_CONFIG.holdingBase;
  const rBonus = (RARITY_RANK[tough.rarity] ?? 1) * BRIBE_CONFIG.holdingRarityWeight;
  const aBonus = Math.min(
    BRIBE_CONFIG.holdingAmountCap,
    amount / BRIBE_CONFIG.holdingAmountScale,
  );
  return Math.max(0, Math.min(1, base + rBonus + aBonus));
}

/** Stepped probability for combat bribes per RULES §10.3. */
export function combatBribeProbability(amount: number): number {
  let best = 0;
  for (const tier of BRIBE_CONFIG.thresholds) {
    if (amount >= tier.amount) best = Math.max(best, tier.probability);
  }
  return best;
}

/**
 * Advance one holding check for the given side. Outcome weight bends with
 * heat — high heat leans toward lockup, low toward bribe.
 */
export function holdingCheck(
  state: TurfGameState, side: 'A' | 'B',
): HoldingOutcome {
  const queue = state.holding[side];
  if (queue.length === 0) return { outcome: 'none' };
  const triggerP = Math.min(1, state.heat * 0.5);
  if (state.rng.next() >= triggerP) return { outcome: 'none' };

  const entry = queue.shift();
  if (!entry) return { outcome: 'none' };

  const leanBribe = 1 - state.heat;
  const bribeThreshold =
    bribeSuccess(entry.tough, 0) * leanBribe + 0.1 * leanBribe;

  if (state.rng.next() < bribeThreshold) {
    const takenIds: string[] = [];
    if (entry.attachedModifiers.length > 0) {
      entry.attachedModifiers.sort(
        (a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0),
      );
      const taken = entry.attachedModifiers.shift();
      if (taken) takenIds.push(taken.id);
    }
    state.holding[side].push(entry);
    state.metrics.bribesAccepted++;
    return { outcome: 'bribed', consumedMods: takenIds };
  }

  const turns = lockupDuration(state.config.difficulty);
  state.lockup[side].push({
    tough: entry.tough,
    attachedModifiers: entry.attachedModifiers,
    turnsRemaining: turns,
  });
  state.metrics.bribesFailed++;
  return { outcome: 'lockup', turnsRemaining: turns };
}

/** End-of-turn sweep: voluntary holdings with no counter return free. */
export function returnFromHolding(state: TurfGameState, side: 'A' | 'B'): void {
  const queue = state.holding[side];
  if (queue.length === 0) return;
  const remain: ToughInCustody[] = [];
  const player = state.players[side];
  const active = player.turfs[0];
  for (const entry of queue) {
    if (entry.turnsRemaining !== undefined || !active) {
      remain.push(entry);
      continue;
    }
    addToStack(active, entry.tough, { faceUp: false });
    for (const mod of entry.attachedModifiers) {
      addToStack(active, mod, { faceUp: false, owner: entry.tough.id });
    }
    player.toughsInPlay++;
  }
  state.holding[side] = remain;
}

/**
 * Advance lockup counters. Toughs whose counter hits 0 return to their
 * active turf. turnsRemaining=999 = perma-lockup (Ultra-Nightmare).
 */
export function lockupProcess(state: TurfGameState): void {
  for (const side of ['A', 'B'] as const) {
    const queue = state.lockup[side];
    const remain: ToughInCustody[] = [];
    const player = state.players[side];
    const active = player.turfs[0];
    for (const entry of queue) {
      if (entry.turnsRemaining === undefined) continue;
      const next = entry.turnsRemaining - 1;
      if (next <= 0 && entry.turnsRemaining < 999) {
        if (active) {
          addToStack(active, entry.tough, { faceUp: false });
          for (const mod of entry.attachedModifiers) {
            addToStack(active, mod, { faceUp: false, owner: entry.tough.id });
          }
          player.toughsInPlay++;
        }
        continue;
      }
      remain.push({ ...entry, turnsRemaining: next });
    }
    state.lockup[side] = remain;
  }
}

/** Is this tough currently held or locked up? */
export function isToughInCustody(
  state: TurfGameState, side: 'A' | 'B', toughId: string,
): boolean {
  if (state.holding[side].some((e) => e.tough.id === toughId)) return true;
  if (state.lockup[side].some((e) => e.tough.id === toughId)) return true;
  return false;
}
