import { useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { ActionBudget, GameState, PlayerA, PlayerB } from '../../ecs/traits';
import { runOpponentTurn } from '../../sim/turf/ai/runner';
import type { TurfGameState } from '../../sim/turf/types';

const AI_DELAY_MS = 900;

interface Options {
  world: World;
  turnEndedA: boolean;
  turnEndedB: boolean;
  onFinish?: () => void;
}

export function useOpponentTurn({ world, turnEndedA, turnEndedB, onFinish }: Options): {
  aiThinking: boolean;
} {
  const [aiThinking, setAiThinking] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!turnEndedA || turnEndedB || aiThinking || timerRef.current) return;

    setAiThinking(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      try {
        const e = world.queryFirst(GameState);
        const gs = e?.get(GameState) as TurfGameState | undefined;
        if (e && gs && !gs.players.B.turnEnded) {
          runOpponentTurn(gs, 'B');
          e.changed(GameState);
          e.set(PlayerA, gs.players.A);
          e.set(PlayerB, gs.players.B);
          e.set(ActionBudget, {
            remaining: gs.players.A.actionsRemaining,
            total: e.get(ActionBudget)?.total ?? gs.players.A.actionsRemaining,
            turnNumber: gs.turnNumber,
          });
        }
      } catch (err) {
        console.error('[useOpponentTurn] AI crashed:', err);
      }
      setAiThinking(false);
      onFinishRef.current?.();
    }, AI_DELAY_MS);
  }, [turnEndedA, turnEndedB, aiThinking, world]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { aiThinking };
}
