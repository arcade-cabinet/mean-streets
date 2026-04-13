/**
 * React hooks for reading ECS game state reactively.
 * All hooks subscribe to Koota traits and re-render on change.
 */

import { useWorld, useTrait, useQueryFirst } from 'koota/react';
import type { Position, GamePhase } from '../sim/turf/types';
import { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';
import type { ScreenName } from './traits';

/** Returns the current game phase ('buildup' | 'combat'). */
export function useGamePhase(): GamePhase | undefined {
  const world = useWorld();
  const entity = useQueryFirst(GameState);
  const gs = useTrait(entity, GameState);
  void world; // world provides context via WorldProvider
  return gs?.phase;
}

/** Returns the active board positions for the given side. */
export function usePlayerBoard(side: 'A' | 'B'): Position[] {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.board.active ?? [];
}

/** Returns the hand (crew + modifiers) for the given side. */
export function useHand(side: 'A' | 'B') {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.hand ?? { crew: [], modifiers: [] };
}

/** Returns the current UI screen name. */
export function useScreen(): ScreenName {
  const entity = useQueryFirst(ScreenTrait);
  const s = useTrait(entity, ScreenTrait);
  return s?.current ?? 'menu';
}

/** Returns the combat action budget for the current round. */
export function useActionBudget(): { remaining: number; total: number } {
  const entity = useQueryFirst(ActionBudget);
  const budget = useTrait(entity, ActionBudget);
  return budget ?? { remaining: 0, total: 0 };
}
