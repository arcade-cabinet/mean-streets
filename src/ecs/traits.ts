/**
 * Koota ECS trait definitions for Mean Streets game state.
 * All complex state uses AoS (Array of Structs) via factory functions.
 */

import { trait } from 'koota';
import type { TurfGameState, PlayerState } from '../sim/turf/types';

export type ScreenName = 'menu' | 'deckbuilder' | 'buildup' | 'combat' | 'gameover';

/**
 * Holds the complete TurfGameState (phase, turnNumber, config, rng, etc.).
 * Stored as AoS so the full object is accessible and mutable.
 */
export const GameState = trait(() => ({} as TurfGameState));

/**
 * Holds PlayerState for the A-side player.
 */
export const PlayerA = trait(() => ({} as PlayerState));

/**
 * Holds PlayerState for the B-side player.
 */
export const PlayerB = trait(() => ({} as PlayerState));

/**
 * Tracks how many combat actions remain this round.
 */
export const ActionBudget = trait({
  remaining: 0,
  total: 0,
});

/**
 * Tracks the current UI screen.
 * Uses AoS so we can store the union string type.
 */
export const ScreenTrait = trait(() => ({ current: 'menu' as ScreenName }));
