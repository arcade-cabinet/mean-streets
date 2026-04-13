/**
 * AI state machine using Yuka's StateMachine.
 * Four behavior states: BUILDING, AGGRESSIVE, DEFENSIVE, DESPERATE.
 * Transitions driven by fuzzy logic evaluation.
 */

// @ts-expect-error — Yuka has no TypeScript declarations
import { State, StateMachine } from 'yuka';
import type { FuzzyEval } from './ai-fuzzy';

export type AiState = 'BUILDING' | 'AGGRESSIVE' | 'DEFENSIVE' | 'DESPERATE';

/** Context passed to state enter/execute/exit. */
export interface AiContext {
  currentState: AiState;
  fuzzy: FuzzyEval;
  turnsInState: number;
}

/** Determine which state to be in based on fuzzy outputs. */
export function resolveState(fuzzy: FuzzyEval, currentState: AiState, turnsInState: number): AiState {
  // Desperation overrides everything
  if (fuzzy.desperation > 0.6) return 'DESPERATE';

  // High aggression + low patience = aggressive
  if (fuzzy.aggression > 0.6 && fuzzy.patience < 0.4) return 'AGGRESSIVE';

  // Low aggression + high patience = building
  if (fuzzy.aggression < 0.4 && fuzzy.patience > 0.5) return 'BUILDING';

  // High patience + moderate aggression = defensive
  if (fuzzy.patience > 0.6 && fuzzy.aggression < 0.6) return 'DEFENSIVE';

  // Moderate everything = stay in current state (hysteresis)
  // But if we've been in BUILDING too long, switch to aggressive
  if (currentState === 'BUILDING' && turnsInState > 8) return 'AGGRESSIVE';

  return currentState;
}

/**
 * Get action priorities based on current AI state.
 * Returns ordered list of action types to try.
 */
export function getStatePriorities(aiState: AiState): string[] {
  switch (aiState) {
    case 'BUILDING':
      return ['place_crew', 'arm_weapon', 'stack_product', 'stack_cash', 'reclaim', 'direct_attack'];

    case 'AGGRESSIVE':
      return ['pushed_attack', 'funded_attack', 'direct_attack', 'reclaim', 'arm_weapon', 'place_crew', 'stack_product', 'stack_cash'];

    case 'DEFENSIVE':
      return ['reclaim', 'arm_weapon', 'place_crew', 'stack_cash', 'stack_product', 'direct_attack', 'funded_attack'];

    case 'DESPERATE':
      return ['reclaim', 'direct_attack', 'pushed_attack', 'funded_attack', 'place_crew', 'arm_weapon', 'stack_product', 'stack_cash'];

    default:
      return ['direct_attack', 'place_crew', 'arm_weapon'];
  }
}
