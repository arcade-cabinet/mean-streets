/**
 * BuildupScreen — crew/modifier placement phase with responsive board and hand layouts.
 */

import { useCallback, useState } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import { useAppShell } from '../../platform';
import { endRoundAction, placeCrewAction, placeModifierAction, strikeAction } from '../../ecs/actions';
import { usePlayerBoard } from '../../ecs/hooks';
import { GameState, PlayerA } from '../../ecs/traits';
import { BoardLayout } from '../board';
import { DragProvider, DropTarget } from '../dnd';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';

interface BuildupScreenProps {
  world: World;
  onStrike: () => void;
}

const MAX_BUILDUP_TURNS = 10;

export function BuildupScreen({ world, onStrike }: BuildupScreenProps) {
  const { layout } = useAppShell();
  const [flash, setFlash] = useState<string | null>(null);

  const gsEntity = useQueryFirst(GameState);
  const gs = useTrait(gsEntity, GameState);
  const pAEntity = useQueryFirst(PlayerA);
  const pA = useTrait(pAEntity, PlayerA);

  const playerPositions = usePlayerBoard('A');
  const opponentPositions = usePlayerBoard('B');

  const turnNumber = gs?.turnNumber ?? 0;
  const buildupTurnsA = gs?.buildupTurns.A ?? 0;
  const sideHand = layout.handPlacement === 'side';

  const showFlash = useCallback((msg: string, durationMs = 1200) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), durationMs);
  }, []);

  const handleEndRound = useCallback(() => {
    if (buildupTurnsA >= MAX_BUILDUP_TURNS) return;
    endRoundAction(world);
    showFlash(`Round ${turnNumber + 1}`);
  }, [world, buildupTurnsA, turnNumber, showFlash]);

  const handleStrike = useCallback(() => {
    showFlash('COMBAT BEGINS!', 1500);
    strikeAction(world);
    setTimeout(onStrike, 1500);
  }, [world, onStrike, showFlash]);

  const handleCrewDrop = useCallback((posIdx: number) => {
    placeCrewAction(world, posIdx);
  }, [world]);

  const handleModifierDrop = useCallback((posIdx: number, cardIdx: number, orientation: 'offense' | 'defense') => {
    placeModifierAction(world, posIdx, cardIdx, orientation);
  }, [world]);

  const isMaxRounds = buildupTurnsA >= MAX_BUILDUP_TURNS;
  const hasCards = (pA?.hand.crew.length ?? 0) > 0 || (pA?.hand.modifiers.length ?? 0) > 0;

  const controls = (
    <div className={`game-toolbar ${sideHand ? 'game-toolbar-vertical' : ''}`}>
      <button
        onClick={handleEndRound}
        disabled={isMaxRounds || !hasCards}
        className={`px-6 py-2 rounded font-bold text-sm tracking-widest uppercase transition-all
          ${isMaxRounds || !hasCards
            ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
            : 'bg-stone-600 text-stone-100 hover:bg-stone-500 shadow'
          }`}
      >
        End Round
      </button>

      <button
        onClick={handleStrike}
        data-testid="strike-button"
        className="px-8 py-2 rounded font-bold text-sm tracking-widest uppercase transition-all bg-red-700 text-white hover:bg-red-600 shadow-lg shadow-red-900/50"
      >
        Strike
      </button>
    </div>
  );

  return (
    <DragProvider>
      <div className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`} data-testid="buildup-screen">
        <GameHUD />

        <div className="game-shell">
          <div className="game-board-area">
            {flash && (
              <div className="game-flash">
                <span className="game-flash-pill">{flash}</span>
              </div>
            )}

            <div className="game-board-stack">
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

              <div className="text-stone-500 text-xs font-mono tracking-widest uppercase text-center">
                — The Street — Round {turnNumber}/{MAX_BUILDUP_TURNS}
              </div>

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
            </div>

            {!sideHand && controls}
          </div>

          {sideHand && (
            <aside className="game-side-rail">
              {controls}
              <PlayerHand placement="side" presentation={layout.handPresentation} />
            </aside>
          )}
        </div>

        {!sideHand && <PlayerHand placement="bottom" presentation={layout.handPresentation} />}
      </div>
    </DragProvider>
  );
}
