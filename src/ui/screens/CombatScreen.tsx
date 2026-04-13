/**
 * CombatScreen — main gameplay screen for the combat phase.
 * Player gets 5 actions per round; after exhaustion the AI takes its turn.
 */

import { useState, useCallback } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import type { AttackOutcome } from '../../sim/turf/types';
import { seizedCount, findDirectReady, findFundedReady, findPushReady } from '../../sim/turf/board';
import { endRoundAction, placeCrewAction, placeModifierAction } from '../../ecs/actions';
import { usePlayerBoard, useActionBudget } from '../../ecs/hooks';
import { GameState } from '../../ecs/traits';
import { BoardLayout } from '../board';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';
import { DragProvider, DropTarget } from '../dnd';
import { ActionMenu, AttackSelector } from '../combat';

type ActionMode = 'direct' | 'funded' | 'pushed' | 'stack' | null;

const WIN_THRESHOLD = 5;
const AI_DELAY_MS = 2000;

interface CombatScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
}

export function CombatScreen({ world, onGameOver }: CombatScreenProps) {
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const gsEntity = useQueryFirst(GameState);
  const gs = useTrait(gsEntity, GameState);
  const budget = useActionBudget();
  const playerPositions = usePlayerBoard('A');
  const opponentPositions = usePlayerBoard('B');

  const turnNumber = gs?.turnNumber ?? 0;

  function showFlash(msg: string, durationMs = 1400) {
    setFlash(msg);
    setTimeout(() => setFlash(null), durationMs);
  }

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
  }, [world, turnNumber]);

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

  const handleModifierDrop = useCallback(
    (posIdx: number, cardIdx: number, orientation: 'offense' | 'defense') => {
      placeModifierAction(world, posIdx, cardIdx, orientation);
    },
    [world],
  );

  const playerBoard = { active: playerPositions, reserve: [] };
  const hasDirectReady = findDirectReady(playerBoard).length > 0;
  const hasFundedReady = findFundedReady(playerBoard).length > 0;
  const hasPushReady = findPushReady(playerBoard).length > 0;

  const isAttacking = actionMode === 'direct' || actionMode === 'funded' || actionMode === 'pushed';

  return (
    <DragProvider>
      <div className="flex flex-col h-screen bg-stone-950 text-stone-100 overflow-hidden">
        <GameHUD />

        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-36 gap-3 relative">
          {/* Flash notification */}
          {flash && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <span className="px-6 py-2 bg-amber-500 text-stone-900 font-bold text-lg tracking-widest rounded shadow-lg animate-pulse">
                {flash}
              </span>
            </div>
          )}

          {/* AI thinking overlay */}
          {aiThinking && (
            <div className="absolute inset-0 bg-stone-950/60 z-40 flex items-center justify-center">
              <span className="text-stone-300 text-sm font-mono tracking-widest animate-pulse">
                OPPONENT THINKING...
              </span>
            </div>
          )}

          {/* Board — attack selector wraps it when attacking */}
          {isAttacking && actionMode ? (
            <AttackSelector
              world={world}
              attackType={actionMode as 'direct' | 'funded' | 'pushed'}
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

          {/* Action menu */}
          {!isAttacking && (
            <ActionMenu
              selected={actionMode}
              onSelect={handleSelect}
              onPass={handlePass}
              actionsRemaining={budget.remaining}
              hasDirectReady={hasDirectReady}
              hasFundedReady={hasFundedReady}
              hasPushReady={hasPushReady}
            />
          )}
        </div>

        <PlayerHand />
      </div>
    </DragProvider>
  );
}
