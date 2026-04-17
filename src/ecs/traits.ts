import { trait } from 'koota';
import type {
  ModifierCard,
  PlayerState,
  ToughInCustody,
  TurfGameState,
} from '../sim/turf/types';

export type ScreenName = 'menu' | 'deckbuilder' | 'combat' | 'gameover';

/**
 * v0.3 single-lane model. ECS traits are a thin read-layer over sim
 * state — the authoritative game state lives in `TurfGameState`. We
 * re-assign the `PlayerA` / `PlayerB` traits (and `changed(GameState)`)
 * whenever we want Koota subscribers to re-render. Do not duplicate
 * sim fields into extra traits; derive them in hooks instead.
 */
export const GameState = trait(() => ({}) as TurfGameState);

export const PlayerA = trait(() => ({}) as PlayerState);

export const PlayerB = trait(() => ({}) as PlayerState);

export const ActionBudget = trait({
  remaining: 0,
  total: 0,
  turnNumber: 0,
});

export const ScreenTrait = trait(() => ({ current: 'menu' as ScreenName }));

export const TurfOwner = trait(() => ({
  side: 'A' as 'A' | 'B',
  turfIdx: 0,
}));

export const SickFlag = trait(() => ({
  turfIdx: 0,
  stackIdx: -1,
}));

export const AffiliationSymbol = trait(() => ({
  affiliation: '',
  turfIdx: 0,
}));

// ── v0.3 shared-resource read traits ────────────────────────────────
//
// These traits are pure projections of sim state. Hooks like `useHeat`,
// `useBlackMarket`, `useHolding`, `useLockup`, `useMythicPool` read
// directly from `GameState` (no trait population needed). The traits
// below exist so UI can declaratively subscribe to a named slice when
// it only needs one resource, without depending on the entire
// `TurfGameState` changing. They are optional — safe to omit.

export const Heat = trait({ value: 0 });

export const BlackMarket = trait(() => ({
  pool: [] as ModifierCard[],
}));

export const Holding = trait(() => ({
  A: [] as ToughInCustody[],
  B: [] as ToughInCustody[],
}));

export const Lockup = trait(() => ({
  A: [] as ToughInCustody[],
  B: [] as ToughInCustody[],
}));

export const MythicPool = trait(() => ({
  unassigned: [] as string[],
  assignments: {} as Record<string, 'A' | 'B'>,
}));
