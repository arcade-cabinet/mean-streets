import { trait } from 'koota';
import type { TurfGameState, PlayerState, Card } from '../sim/turf/types';

export type ScreenName = 'menu' | 'deckbuilder' | 'combat' | 'gameover';

export const GameState = trait(() => ({} as TurfGameState));

export const PlayerA = trait(() => ({} as PlayerState));

export const PlayerB = trait(() => ({} as PlayerState));

export const ActionBudget = trait({
  remaining: 0,
  total: 0,
  turnNumber: 0,
});

export const ScreenTrait = trait(() => ({ current: 'menu' as ScreenName }));

export const CardInStack = trait(() => ({
  turfIdx: 0,
  stackIdx: 0,
  card: {} as Card,
}));

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
