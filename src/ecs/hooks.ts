import { useQueryFirst, useTrait } from 'koota/react';
import type {
  Card,
  GamePhase,
  ModifierCard,
  QueuedAction,
  ToughCard,
  ToughInCustody,
  Turf,
} from '../sim/turf/types';
import {
  positionPower,
  positionResistance,
  turfModifiers,
  turfToughs,
} from '../sim/turf/board';
import { ActionBudget, GameState, PlayerA, PlayerB, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

export function useGamePhase(): GamePhase | undefined {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.phase;
}

// ── Single-lane turf hooks (v0.3) ───────────────────────────────────
//
// In v0.3 combat happens on one active turf at a time; the remaining
// turfs sit in a reserve queue. Noa (Epic G) is expected to migrate
// every UI consumer to the explicit `useTurfActive` / `useTurfReserves`
// split. `usePlayerTurfs` is kept as a backward-compat alias — it
// returns the whole array (active + reserves) — so existing tests and
// partially-migrated screens keep rendering until Epic G retires it.

/** The active engagement turf for `side` (turfs[0]). */
export function useTurfActive(side: 'A' | 'B'): Turf | null {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.turfs[0] ?? null;
}

/** Reserve queue for `side` (turfs[1..]). Ordered by reserveIndex. */
export function useTurfReserves(side: 'A' | 'B'): Turf[] {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.turfs.slice(1) ?? [];
}

/**
 * Backward-compat alias. Returns the full turf array (active first,
 * reserves after). Retire once Noa finishes the Epic G migration.
 */
export function usePlayerTurfs(side: 'A' | 'B'): Turf[] {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.turfs ?? [];
}

/** The single drawn-but-unplaced card for `side`, or null. Replaces `useHand`. */
export function useDeckPending(side: 'A' | 'B'): Card | null {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.pending ?? null;
}

/** Has `side` committed end_turn this round? Clears on resolvePhase. */
export function useTurnEnded(side: 'A' | 'B'): boolean {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.turnEnded ?? false;
}

/** Pending queued actions for `side` this turn. Visualized as chips. */
export function useQueuedStrikes(side: 'A' | 'B'): QueuedAction[] {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.queued ?? [];
}

/** Deck size for `side` (after whatever's been drawn). */
export function useDeckCount(side: 'A' | 'B'): number {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.deck.length ?? 0;
}

export function useActionBudget(): { remaining: number; total: number; turnNumber: number } {
  const entity = useQueryFirst(ActionBudget);
  const budget = useTrait(entity, ActionBudget);
  return budget ?? { remaining: 0, total: 0, turnNumber: 0 };
}

// ── v0.3 shared-resource hooks ───────────────────────────────────────

/** Global heat level in [0, 1]. Raids trigger when it crosses the threshold. */
export function useHeat(): number {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.heat ?? 0;
}

/** Modifier cards displaced into the black market, available for trade/heal. */
export function useBlackMarket(): ModifierCard[] {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.blackMarket ?? [];
}

/** Voluntary cop holding for `side` (toughs safe from seizure). */
export function useHolding(side: 'A' | 'B'): ToughInCustody[] {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.holding[side] ?? [];
}

/** Lockup for `side` — seized toughs counting down to release or loss. */
export function useLockup(side: 'A' | 'B'): ToughInCustody[] {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.lockup[side] ?? [];
}

/**
 * Mythic pool state. `unassigned` lists cardIds still free to grab;
 * `assignments` maps cardId → owning side once claimed.
 */
export function useMythicPool(): {
  unassigned: string[];
  assignments: Record<string, 'A' | 'B'>;
} {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return {
    unassigned: gs?.mythicPool ?? [],
    assignments: gs?.mythicAssignments ?? {},
  };
}

export interface TurfStackComposite {
  turf: Turf;
  toughs: ToughCard[];
  modifiers: ModifierCard[];
  power: number;
  resistance: number;
  sickIdx: number | null;
}

/**
 * Derived read for each turf — toughs, modifiers, power, resistance.
 * `turfToughs` / `turfModifiers` already unwrap `StackedCard.card`, so
 * consumers receive plain card objects. Returns all turfs (active +
 * reserves) for backward compatibility; migrate to split hooks in G.
 */
export function useTurfStackComposite(side: 'A' | 'B'): TurfStackComposite[] {
  const turfs = usePlayerTurfs(side);
  return turfs.map((turf) => ({
    turf,
    toughs: turfToughs(turf),
    modifiers: turfModifiers(turf),
    power: positionPower(turf),
    resistance: positionResistance(turf),
    sickIdx: turf.sickTopIdx ?? null,
  }));
}

export function useScreen(): ScreenName {
  const entity = useQueryFirst(ScreenTrait);
  const s = useTrait(entity, ScreenTrait);
  return s?.current ?? 'menu';
}
