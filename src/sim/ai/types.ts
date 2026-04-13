/**
 * AI decision types for game simulation.
 */

/** An action the AI can take on a turn. */
export interface AiDecision {
  action: 'attack' | 'sacrifice' | 'hustle' | 'roll_die' | 'pass';
  /** Card indices to play (multiple for runs/sets). */
  cardIndices: number[];
  /** Single card index for sacrifice. */
  cardIndex?: number;
  /** Reasoning string for debugging/logging. */
  reason: string;
}
