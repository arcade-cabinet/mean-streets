import { trait } from 'koota';
import type { PlayerState, TurfGameState } from '../sim/turf/types';

export type ScreenName = 'menu' | 'deckbuilder' | 'combat' | 'gameover';

/**
 * v0.2 handless model. ECS traits are a thin read-layer over sim state —
 * the authoritative game state lives in `TurfGameState.players[side]`. We
 * re-assign the `PlayerA` / `PlayerB` traits whenever we want Koota
 * subscribers to re-render (via `entity.changed(...)`). Do not duplicate
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
