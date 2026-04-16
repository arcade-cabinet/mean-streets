// Thin orchestrator so the UI layer can run an opponent turn without
// pulling yuka's untyped modules into tsc --project tsconfig.app.json.
// All yuka-typed imports stay under src/sim (excluded from that config)
// and the UI talks to this function by stepping through a pure TurfGameState.
import { stepAction } from '../environment';
import type { TurfAction, TurfGameState } from '../types';
import { decideAction } from './planner';

/**
 * Play the opponent's (`side`) whole turn. Keeps stepping legal actions
 * via the planner until it produces `end_turn`, caps iterations with a
 * guard to protect against planner bugs, and applies actions straight
 * to the shared sim state — UI should `changed(...)` its ECS traits
 * after this returns so Koota subscribers re-render.
 *
 * Returns the list of applied actions in order for UI replay/logging.
 */
export function runOpponentTurn(
  state: TurfGameState,
  side: 'A' | 'B',
  maxSteps = 64,
): TurfAction[] {
  const applied: TurfAction[] = [];
  for (let i = 0; i < maxSteps; i++) {
    if (state.players[side].turnEnded) break;
    const { action } = decideAction(state, side);
    stepAction(state, action);
    applied.push(action);
    if (action.kind === 'end_turn') break;
  }
  return applied;
}
