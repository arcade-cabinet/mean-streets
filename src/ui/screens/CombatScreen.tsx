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
import { BoardLayout, PositionSlot } from '../board';
import { ActionMenu, AttackSelector } from '../combat';
import { DragProvider, DropTarget } from '../dnd';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';

type ActionMode = 'direct' | 'funded' | 'pushed' | 'stack' | null;

const WIN_THRESHOLD = 5;
const AI_DELAY_MS = 2000;

function chunkStreet<T>(items: T[]): T[][] {
  return [items.slice(0, 3), items.slice(3, 5)].filter((row) => row.length > 0);
}

interface CombatScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
  onOpenMenu?: () => void;
}

export function CombatScreen({ world, onGameOver, onOpenMenu }: CombatScreenProps) {
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
  const compactStreet = layout.deviceClass !== 'desktop';

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

  function handleActionComplete(outcome: AttackOutcome | null) {
    setActionMode(null);
    if (outcome) {
      // Surface the combat outcome (kill / flip / sick / busted / miss /
      // seized) as a screen flash so the player can see ability tags
      // (PARRY, BLOOD_FRENZY, PHANTOM_STRIKE, etc.) fire.
      const tagged = outcome.description.length > 80
        ? outcome.description.slice(0, 78) + '…'
        : outcome.description;
      showFlash(`${outcome.type.toUpperCase()} — ${tagged}`, 2200);
    }
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

  const compactOpponentStreet = compactStreet ? (
    <div className="street-grid street-grid-opponent street-grid-dimmed">
      {chunkStreet(opponentPositions).map((row, rowIndex) => (
        <div key={rowIndex} className="street-grid-row">
          {row.map((pos, columnIndex) => (
            <div key={`${rowIndex}-${columnIndex}`} className="street-grid-cell street-grid-cell-dimmed">
              <PositionSlot position={pos} index={columnIndex} isPlayer={false} />
            </div>
          ))}
        </div>
      ))}
    </div>
  ) : (
    <div className="board-layout-row board-layout-row-opponent board-layout-row-dimmed">
      {opponentPositions.map((pos, i) => (
        <div key={i} className="board-layout-cell-dimmed">
          <BoardLayout
            playerPositions={[]}
            opponentPositions={[pos]}
            phase="combat"
            roundNumber={turnNumber}
          />
        </div>
      ))}
    </div>
  );

  const compactPlayerStreet = compactStreet ? (
    <div className="street-grid street-grid-player">
      {chunkStreet(playerPositions).map((row, rowIndex) => (
        <div key={rowIndex} className="street-grid-row">
          {row.map((pos, columnIndex) => {
            const positionIdx = rowIndex === 0 ? columnIndex : columnIndex + 3;
            const slot = (
              <div className="street-grid-cell">
                <PositionSlot position={pos} index={positionIdx} isPlayer={true} />
              </div>
            );

            if (actionMode === 'stack') {
              return (
                <DropTarget
                  key={`${rowIndex}-${columnIndex}`}
                  positionIdx={positionIdx}
                  position={pos}
                  onCrewDrop={handleCrewDrop}
                  onModifierDrop={handleModifierDrop}
                >
                  {slot}
                </DropTarget>
              );
            }

            return <div key={`${rowIndex}-${columnIndex}`}>{slot}</div>;
          })}
        </div>
      ))}
    </div>
  ) : (
    <div className="board-layout-row board-layout-row-player">
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
          <div key={i} className="board-layout-cell">
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
  );

  return (
    <DragProvider>
      <div className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`} data-testid="combat-screen">
        <GameHUD onOpenMenu={onOpenMenu} />

        <div className="game-shell">
          <div className="game-board-area">
            {flash && (
              <div className="game-flash">
                <span className="game-flash-pill">{flash}</span>
              </div>
            )}

            {aiThinking && (
              <div className="game-overlay">
                <div className="game-overlay-pill">OPPONENT THINKING...</div>
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
              <div className="combat-board-stack">
                {compactOpponentStreet}

                <div className="game-street-banner">
                  <span className="game-street-tag">Combat Zone</span>
                  <span className="game-street-copy">Round {turnNumber} · Actions {budget.remaining}</span>
                </div>

                {compactPlayerStreet}
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
