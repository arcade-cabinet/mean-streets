import { useQueryFirst, useTrait } from 'koota/react';
import type {
  Card,
  GamePhase,
  QueuedAction,
  ToughCard,
  ModifierCard,
  Turf,
} from '../sim/turf/types';
import {
  turfToughs,
  turfModifiers,
  positionPower,
  positionResistance,
} from '../sim/turf/board';
import { ActionBudget, GameState, PlayerA, PlayerB, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

export function useGamePhase(): GamePhase | undefined {
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  return gs?.phase;
}

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
 * consumers receive plain card objects.
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
