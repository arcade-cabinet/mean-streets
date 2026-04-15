import { useQueryFirst, useTrait } from 'koota/react';
import type { Card, GamePhase, Turf } from '../sim/turf/types';
import { turfToughs, turfModifiers, positionPower, positionResistance } from '../sim/turf/board';
import { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';
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

export function useHand(side: 'A' | 'B'): Card[] {
  const Trait = side === 'A' ? PlayerA : PlayerB;
  const entity = useQueryFirst(Trait);
  const state = useTrait(entity, Trait);
  return state?.hand ?? [];
}

export function useActionBudget(): { remaining: number; total: number; turnNumber: number } {
  const entity = useQueryFirst(ActionBudget);
  const budget = useTrait(entity, ActionBudget);
  return budget ?? { remaining: 0, total: 0, turnNumber: 0 };
}

export interface TurfStackComposite {
  turf: Turf;
  toughs: Card[];
  modifiers: Card[];
  power: number;
  resistance: number;
  sickIdx: number | null;
}

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
