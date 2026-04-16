import { useCallback, useEffect, useState } from 'react';
import type { World } from 'koota';
import { ActionBudget, GameState, PlayerA, PlayerB } from '../../ecs/traits';
import type { TurfGameState } from '../../sim/turf/types';

const AI_DELAY_MS = 900;

interface Options {
  world: World;
  turnEndedA: boolean;
  turnEndedB: boolean;
  onFinish?: () => void;
}

/**
 * Runs the opponent (side B) turn when A ends-turn and B has not.
 *
 * We import the sim-side `runOpponentTurn` via a variable-path dynamic
 * import so tsc --project tsconfig.app.json (which excludes `src/sim`)
 * does not try to type-check the transitive yuka module — yuka ships
 * JS only and would trigger TS7016 under our strict config. Vite
 * resolves the literal path at build time; behaviour is identical.
 */
export function useOpponentTurn({ world, turnEndedA, turnEndedB, onFinish }: Options): {
  aiThinking: boolean;
} {
  const [aiThinking, setAiThinking] = useState(false);

  const run = useCallback(() => {
    setAiThinking(true);
    const timer = setTimeout(async () => {
      const runnerPath = '../../sim/turf/ai/runner';
      const mod = (await import(/* @vite-ignore */ runnerPath)) as {
        runOpponentTurn: (s: TurfGameState, side: 'A' | 'B') => unknown;
      };
      const e = world.queryFirst(GameState);
      const gs = e?.get(GameState) as TurfGameState | undefined;
      if (e && gs && !gs.players.B.turnEnded) {
        mod.runOpponentTurn(gs, 'B');
        e.changed(GameState);
        e.set(PlayerA, gs.players.A);
        e.set(PlayerB, gs.players.B);
        e.set(ActionBudget, {
          remaining: gs.players.A.actionsRemaining,
          total: e.get(ActionBudget)?.total ?? gs.players.A.actionsRemaining,
          turnNumber: gs.turnNumber,
        });
      }
      setAiThinking(false);
      onFinish?.();
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [world, onFinish]);

  useEffect(() => {
    if (turnEndedA && !turnEndedB && !aiThinking) {
      const cleanup = run();
      return cleanup;
    }
  }, [turnEndedA, turnEndedB, aiThinking, run]);

  return { aiThinking };
}
