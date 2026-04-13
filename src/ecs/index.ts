/**
 * ECS layer — Koota world + reactive game state bridge.
 */

export { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';
export type { ScreenName } from './traits';

export { createGameWorld } from './world';

export {
  placeCrewAction,
  placeModifierAction,
  directAttackAction,
  fundedAttackAction,
  pushedAttackAction,
  endRoundAction,
  strikeAction,
  setScreen,
} from './actions';

export {
  useGamePhase,
  usePlayerBoard,
  useHand,
  useScreen,
  useActionBudget,
} from './hooks';
