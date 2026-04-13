/**
 * CombatScreen — responsive combat layout with side rail or bottom hand depending on posture.
 */

import { useCallback, useState } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import { useAppShell } from '../../platform';
import { endRoundAction, placeCrewAction, placeModifierAction } from '../../ecs/actions';
import { useActionBudget, usePlayerBoard } from '../../ecs/hooks';
import { GameState } from '../../ecs/traits';
import { findDirectReady, findFundedReady, findPushReady, seizedCount } from '../../sim/turf/board';
import type { AttackOutcome } from '../../sim/turf/types';
import { BoardLayout } from '../board';
import { ActionMenu, AttackSelector } from '../combat';
import { DragProvider, DropTarget } from '../dnd';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';

type ActionMode = 'direct' | 'funded' | 'pushed' | 'stack' | null;

const WIN_THRESHOLD = 5;
const AI_DELAY_MS = 2000;

interface CombatScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
}

export function CombatScreen({ world, onGameOver }: CombatScreenProps) {
  const { layout } = useAppShell();
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const gsEntity = useQueryFirst(GameState);
  const gs = useTrait(gsEntity, GameState);
  const budget = useActionBudget();
  const playerPositions = usePlayerBoard('A');
  const opponentPositions = usePlayerBoard('B');

  const turnNumber = gs?.turnNumber ?? 0;
  const sideHand = layout.handPlacement === 'side';

  const showFlash = useCallback((msg: string, durationMs = 1400) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), durationMs);
  }, []);

  function checkWinCondition() {
    const opponentBoard = { active: opponentPositions, reserve: [] };
    const playerBoard = { active: playerPositions, reserve: [] };
    if (seizedCount(opponentBoard) >= WIN_THRESHOLD) {
      onGameOver('A');
      return true;
    }
    if (seizedCount(playerBoard) >= WIN_THRESHOLD) {
      onGameOver('B');
      return true;
    }
    return false;
  }

  const runAiTurn = useCallback(() => {
    setAiThinking(true);
    setTimeout(() => {
      endRoundAction(world);
      setAiThinking(false);
      showFlash(`Round ${turnNumber + 1}`);
    }, AI_DELAY_MS);
  }, [world, turnNumber, showFlash]);

  function handleActionComplete(_outcome: AttackOutcome | null) {
    setActionMode(null);
    if (checkWinCondition()) return;
    if (budget.remaining <= 1) {
      runAiTurn();
    }
  }

  function handleActionCancel() {
    setActionMode(null);
  }

  function handleSelect(action: string) {
    setActionMode(action as ActionMode);
  }

  function handlePass() {
    setActionMode(null);
    runAiTurn();
  }

  const handleCrewDrop = useCallback((posIdx: number) => {
    placeCrewAction(world, posIdx);
  }, [world]);

  const handleModifierDrop = useCallback((posIdx: number, cardIdx: number, orientation: 'offense' | 'defense') => {
    placeModifierAction(world, posIdx, cardIdx, orientation);
  }, [world]);

  const playerBoard = { active: playerPositions, reserve: [] };
  const hasDirectReady = findDirectReady(playerBoard).length > 0;
  const hasFundedReady = findFundedReady(playerBoard).length > 0;
  const hasPushReady = findPushReady(playerBoard).length > 0;
  const isAttacking = actionMode === 'direct' || actionMode === 'funded' || actionMode === 'pushed';

  const actionMenu = (
    <ActionMenu
      selected={actionMode}
      onSelect={handleSelect}
      onPass={handlePass}
      actionsRemaining={budget.remaining}
      hasDirectReady={hasDirectReady}
      hasFundedReady={hasFundedReady}
      hasPushReady={hasPushReady}
      orientation={sideHand ? 'vertical' : 'horizontal'}
    />
  );

  return (
    <DragProvider>
      <div className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`} data-testid="combat-screen">
        <GameHUD />

        <div className="game-shell">
          <div className="game-board-area">
            {flash && (
              <div className="game-flash">
                <span className="game-flash-pill">{flash}</span>
              </div>
            )}

            {aiThinking && (
              <div className="game-overlay">
                <span className="text-stone-300 text-sm font-mono tracking-widest animate-pulse">
                  OPPONENT THINKING...
                </span>
              </div>
            )}

            {isAttacking && actionMode ? (
              <AttackSelector
                world={world}
                attackType={actionMode}
                playerPositions={playerPositions}
                opponentPositions={opponentPositions}
                onComplete={handleActionComplete}
                onCancel={handleActionCancel}
              />
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex gap-2 justify-center flex-wrap">
                  {opponentPositions.map((pos, i) => (
                    <div key={i} className="opacity-80">
                      <BoardLayout
                        playerPositions={[]}
                        opponentPositions={[pos]}
                        phase="combat"
                        roundNumber={turnNumber}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  {playerPositions.map((pos, i) => (
                    actionMode === 'stack' ? (
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
                          phase="combat"
                          roundNumber={turnNumber}
                        />
                      </DropTarget>
                    ) : (
                      <div key={i}>
                        <BoardLayout
                          playerPositions={[pos]}
                          opponentPositions={[]}
                          phase="combat"
                          roundNumber={turnNumber}
                        />
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {!sideHand && !isAttacking && <div className="game-toolbar">{actionMenu}</div>}
          </div>

          {sideHand && (
            <aside className="game-side-rail">
              {!isAttacking && actionMenu}
              <PlayerHand placement="side" presentation={layout.handPresentation} />
            </aside>
          )}
        </div>

        {!sideHand && <PlayerHand placement="bottom" presentation={layout.handPresentation} />}
      </div>
    </DragProvider>
  );
}
