import { describe } from 'vitest';

// TODO(vera): rewrite for handless v0.2 model.
//
// The old tests pinned on `stepAction` + `advanceTurn` being called in
// tandem on every endTurnAction, and on `turnSide` being a single-field
// flag. In v0.2 both players act in parallel; there is no `turnSide`,
// no separate `advanceTurn`, and end_turn merely flips a per-player
// `turnEnded` flag. Resolve fires implicitly inside `stepAction` when
// both flags are true.
//
// New coverage this file should provide (rewrite as Epic G in the plan):
//   1. endTurnAction('A') flips only A.turnEnded; B unaffected.
//   2. endTurnAction('A') then endTurnAction('B') advances turnNumber
//      exactly once and clears both flags.
//   3. After resolve, both sides' actionsRemaining = actionsForTurn(...).
//   4. Initial budgets: both A and B start with turn-1 actionsForTurn.
//
// The new-shape smoke assertions already live in ecs-bridge.test.ts
// (endTurnAction + resolvePhase block).

describe.skip('ecs turn regression — awaiting v0.2 rewrite', () => {
  // Intentionally empty. See comment above.
});
