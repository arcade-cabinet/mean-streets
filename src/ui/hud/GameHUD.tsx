import { useGamePhase, useActionBudget, usePlayerBoard, useHand } from '../../ecs/hooks';
import { seizedCount } from '../../sim/turf/board';
import { PhaseIndicator } from './PhaseIndicator';
import { ActionBudget } from './ActionBudget';

const POSITIONS_TOTAL = 5;

export function GameHUD() {
  const phase = useGamePhase();
  const budget = useActionBudget();
  const playerPositions = usePlayerBoard('A');
  const oppPositions = usePlayerBoard('B');
  const playerHand = useHand('A');

  const playerSeized = seizedCount({ active: playerPositions, reserve: [] });
  const oppSeized = seizedCount({ active: oppPositions, reserve: [] });

  const isPlayerTurn = true; // placeholder — replace with turn-side hook when available

  return (
    <div className="w-full flex items-center gap-4 px-4 py-2 bg-stone-900/90 backdrop-blur border-b border-stone-700 font-mono text-xs">
      <PhaseIndicator phase={phase} turnNumber={0} />

      {phase === 'combat' && (
        <ActionBudget remaining={budget.remaining} total={budget.total} />
      )}

      <div className="flex items-center gap-1 text-stone-400">
        <span className="text-stone-500">DECK</span>
        <span className="text-amber-200">{playerHand.crew.length}</span>
        <span className="text-stone-600">/</span>
        <span className="text-stone-300">{playerHand.modifiers.length}</span>
      </div>

      <div className="flex items-center gap-1 text-stone-400 ml-auto">
        <span className="text-amber-200">You:</span>
        <span className="text-amber-400 font-bold">{playerSeized}/{POSITIONS_TOTAL}</span>
        <span className="text-stone-600 mx-1">|</span>
        <span className="text-red-300">Opp:</span>
        <span className="text-red-400 font-bold">{oppSeized}/{POSITIONS_TOTAL}</span>
        <span className="text-stone-500 ml-1">seized</span>
      </div>

      <div className={`text-xs font-bold tracking-widest ${isPlayerTurn ? 'text-amber-300' : 'text-stone-500'}`}>
        {isPlayerTurn ? 'YOUR TURN' : 'OPPONENT THINKING...'}
      </div>
    </div>
  );
}
