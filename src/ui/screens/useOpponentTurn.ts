import { useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { syncAll } from '../../ecs/actions';
import { GameState } from '../../ecs/traits';
import { runOpponentTurn } from '../../sim/turf/ai/runner';
import type { TurfAction, TurfGameState } from '../../sim/turf/types';

const AI_INITIAL_DELAY_MS = 400;
const AI_ACTION_STEP_MS = 350;

interface Options {
  world: World;
  turnEndedA: boolean;
  turnEndedB: boolean;
  onFinish?: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  draw: 'Opp draws',
  play_card: 'Opp plays a card',
  direct_strike: 'Opp strikes!',
  pushed_strike: 'Opp pushes!',
  funded_recruit: 'Opp recruits!',
  retreat: 'Opp retreats',
  discard: 'Opp discards',
  end_turn: 'Opp ends turn',
  pass: 'Opp passes',
  send_to_market: 'Opp sends to market',
  send_to_holding: 'Opp goes to holding',
  modifier_swap: 'Opp swaps modifier',
  black_market_trade: 'Opp trades at market',
  black_market_heal: 'Opp heals at market',
};

function actionLabel(action: TurfAction): string {
  return ACTION_LABELS[action.kind] ?? `Opp: ${action.kind}`;
}

function isAutomationEnv(): boolean {
  return (
    typeof window !== 'undefined'
    && (window.__MEAN_STREETS_TEST__ === true || navigator.webdriver === true)
  );
}

export function useOpponentTurn({ world, turnEndedA, turnEndedB, onFinish }: Options): {
  aiThinking: boolean;
  aiAction: string | null;
} {
  const [aiThinking, setAiThinking] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const automation = isAutomationEnv();

  useEffect(() => {
    if (!turnEndedA || turnEndedB || aiThinking || timerRef.current) return;

    setAiThinking(true);
    setAiAction('Opp thinking...');

    const runTurn = () => {
      timerRef.current = null;
      let applied: TurfAction[] = [];
      try {
        const e = world.queryFirst(GameState);
        const gs = e?.get(GameState) as TurfGameState | undefined;
        if (e && gs && !gs.players.B.turnEnded) {
          applied = runOpponentTurn(gs, 'B');
          syncAll(e, gs);
        }
      } catch (err) {
        console.error('[useOpponentTurn] AI crashed:', err);
      }

      // Replay action labels with delays
      const significant = applied.filter(a => a.kind !== 'end_turn' && a.kind !== 'pass');
      if (significant.length === 0) {
        setAiAction(null);
        setAiThinking(false);
        onFinishRef.current?.();
        return;
      }

      if (automation) {
        setAiAction(null);
        setAiThinking(false);
        onFinishRef.current?.();
        return;
      }

      let step = 0;
      function showNext() {
        if (step >= significant.length) {
          setAiAction(null);
          setAiThinking(false);
          onFinishRef.current?.();
          return;
        }
        setAiAction(actionLabel(significant[step]));
        step++;
        timerRef.current = setTimeout(showNext, AI_ACTION_STEP_MS);
      }
      showNext();
    };

    if (automation) {
      runTurn();
      return;
    }

    timerRef.current = setTimeout(runTurn, AI_INITIAL_DELAY_MS);
  }, [turnEndedA, turnEndedB, aiThinking, automation, world]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { aiThinking, aiAction };
}
