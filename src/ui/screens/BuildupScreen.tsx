/**
 * BuildupScreen — drag-and-drop crew/modifier placement phase.
 * Both players place cards simultaneously for up to 10 rounds.
 * Opponent positions are shown face-down.
 */

import { useState, useCallback } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import { GameState, PlayerA } from '../../ecs/traits';
import {
  placeCrewAction,
  placeModifierAction,
  endRoundAction,
  strikeAction,
} from '../../ecs/actions';
import { usePlayerBoard } from '../../ecs/hooks';
import { BoardLayout } from '../board';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';
import { DragProvider, DropTarget } from '../dnd';

interface BuildupScreenProps {
  world: World;
  onStrike: () => void;
}

const MAX_BUILDUP_TURNS = 10;

export function BuildupScreen({ world, onStrike }: BuildupScreenProps) {
  const [flash, setFlash] = useState<string | null>(null);

  const gsEntity = useQueryFirst(GameState);
  const gs = useTrait(gsEntity, GameState);
  const pAEntity = useQueryFirst(PlayerA);
  const pA = useTrait(pAEntity, PlayerA);

  const playerPositions = usePlayerBoard('A');
  const opponentPositions = usePlayerBoard('B');

  const turnNumber = gs?.turnNumber ?? 0;
  const buildupTurnsA = gs?.buildupTurns.A ?? 0;

  function showFlash(msg: string, durationMs = 1200) {
    setFlash(msg);
    setTimeout(() => setFlash(null), durationMs);
  }

  const handleEndRound = useCallback(() => {
    if (buildupTurnsA >= MAX_BUILDUP_TURNS) return;
    endRoundAction(world);
    showFlash(`Round ${turnNumber + 1}`);
  }, [world, buildupTurnsA, turnNumber]);

  const handleStrike = useCallback(() => {
    showFlash('COMBAT BEGINS!', 1500);
    strikeAction(world);
    setTimeout(onStrike, 1500);
  }, [world, onStrike]);

  const handleCrewDrop = useCallback((posIdx: number) => {
    placeCrewAction(world, posIdx);
  }, [world]);

  const handleModifierDrop = useCallback(
    (posIdx: number, cardIdx: number, orientation: 'offense' | 'defense') => {
      placeModifierAction(world, posIdx, cardIdx, orientation);
    },
    [world],
  );

  const isMaxRounds = buildupTurnsA >= MAX_BUILDUP_TURNS;
  const hasCards = (pA?.hand.crew.length ?? 0) > 0 || (pA?.hand.modifiers.length ?? 0) > 0;

  return (
    <DragProvider>
      <div className="flex flex-col h-screen bg-stone-950 text-stone-100 overflow-hidden">
        <GameHUD />

        {/* Board area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32 gap-4 relative">

          {/* Flash notification */}
          {flash && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <span className="px-6 py-2 bg-amber-500 text-stone-900 font-bold text-lg tracking-widest rounded shadow-lg animate-pulse">
                {flash}
              </span>
            </div>
          )}

          {/* Opponent positions (face-down) */}
          <div className="flex gap-2 justify-center flex-wrap">
            {opponentPositions.map((pos, i) => (
              <div key={i} className="opacity-60">
                <BoardLayout
                  playerPositions={[]}
                  opponentPositions={[pos]}
                  phase="buildup"
                  roundNumber={turnNumber}
                  faceDown
                />
              </div>
            ))}
          </div>

          {/* Street divider label */}
          <div className="text-stone-500 text-xs font-mono tracking-widest uppercase">
            — The Street —&nbsp;Round {turnNumber}/{MAX_BUILDUP_TURNS}
          </div>

          {/* Player positions with drop targets */}
          <div className="flex gap-2 justify-center flex-wrap">
            {playerPositions.map((pos, i) => (
              <DropTarget
                key={i}
                positionIdx={i}
                position={pos}
                onCrewDrop={handleCrewDrop}
                onModifierDrop={handleModifierDrop}
              >
                <BoardLayout
                  playerPositions={[pos]}
                  opponentPositions={[]}
                  phase="buildup"
                  roundNumber={turnNumber}
                />
              </DropTarget>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-2">
            <button
              onClick={handleEndRound}
              disabled={isMaxRounds || !hasCards}
              className={`px-6 py-2 rounded font-bold text-sm tracking-widest uppercase transition-all
                ${isMaxRounds || !hasCards
                  ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
                  : 'bg-stone-600 text-stone-100 hover:bg-stone-500 shadow'
                }`}
            >
              END ROUND
            </button>

            <button
              onClick={handleStrike}
              className="px-8 py-2 rounded font-bold text-sm tracking-widest uppercase transition-all bg-red-700 text-white hover:bg-red-600 shadow-lg shadow-red-900/50"
            >
              STRIKE
            </button>
          </div>
        </div>

        <PlayerHand />
      </div>
    </DragProvider>
  );
}
