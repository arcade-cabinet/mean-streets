/**
 * BuildupScreen — crew/modifier placement phase with responsive board and hand layouts.
 */

import { useCallback, useState } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import { useAppShell } from '../../platform';
import {
  deployPayloadAction,
  deployRunnerAction,
  endRoundAction,
  equipBackpackAction,
  placeCrewAction,
  placeModifierAction,
  placeReserveCrewAction,
  strikeAction,
} from '../../ecs/actions';
import { usePlayerBoard } from '../../ecs/hooks';
import { GameState, PlayerA } from '../../ecs/traits';
import { BoardLayout, PositionSlot } from '../board';
import { CardFrame } from '../cards';
import { DragProvider, DraggableCard, DropTarget, ReserveDropTarget } from '../dnd';
import { PlayerHand } from '../hand';
import { GameHUD } from '../hud';

interface BuildupScreenProps {
  world: World;
  onStrike: () => void;
  onOpenMenu?: () => void;
}

const MAX_BUILDUP_TURNS = 10;

function chunkStreet<T>(items: T[]): T[][] {
  return [items.slice(0, 3), items.slice(3, 5)].filter((row) => row.length > 0);
}

export function BuildupScreen({ world, onStrike, onOpenMenu }: BuildupScreenProps) {
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
  const compactStreet = layout.deviceClass !== 'desktop';
  const reservePositions = pA?.board.reserve ?? [];
  const [selectedRunnerLane, setSelectedRunnerLane] = useState<number | null>(null);

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

  const handleReserveCrewDrop = useCallback((reserveIdx: number) => {
    placeReserveCrewAction(world, reserveIdx);
  }, [world]);

  const handleBackpackDrop = useCallback((reserveIdx: number, backpackIdx: number) => {
    equipBackpackAction(world, reserveIdx, backpackIdx);
  }, [world]);

  const handleRunnerDrop = useCallback((reserveIdx: number, posIdx: number) => {
    deployRunnerAction(world, reserveIdx, posIdx);
  }, [world]);

  const handleDeployPayload = useCallback((laneIdx: number, payloadId: string, slot: 'offense' | 'defense') => {
    deployPayloadAction(world, laneIdx, payloadId, slot);
  }, [world]);

  const isMaxRounds = buildupTurnsA >= MAX_BUILDUP_TURNS;
  const hasCards = (pA?.hand.crew.length ?? 0) > 0 || (pA?.hand.modifiers.length ?? 0) > 0 || (pA?.hand.backpacks.length ?? 0) > 0;

  const controls = (
    <div className={`game-toolbar ${sideHand ? 'game-toolbar-vertical' : ''}`}>
      <button
        onClick={handleEndRound}
        disabled={isMaxRounds || !hasCards}
        className={`game-control-button ${isMaxRounds || !hasCards ? 'game-control-button-disabled' : ''}`}
      >
        <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
        <span className="utility-button-label">End Round</span>
      </button>

      <button
        onClick={handleStrike}
        data-testid="strike-button"
        className="game-control-button game-control-button-primary"
      >
        <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
        <span className="utility-button-label">Strike</span>
      </button>
    </div>
  );

  const compactOpponentStreet = compactStreet ? (
    <div className="street-grid street-grid-opponent street-grid-muted">
      {chunkStreet(opponentPositions).map((row, rowIndex) => (
        <div key={rowIndex} className="street-grid-row">
          {row.map((pos, columnIndex) => (
            <div key={`${rowIndex}-${columnIndex}`} className="street-grid-cell street-grid-cell-muted">
              <PositionSlot position={pos} index={columnIndex} isPlayer={false} faceDown />
            </div>
          ))}
        </div>
      ))}
    </div>
  ) : (
    <div className="board-layout-row board-layout-row-opponent board-layout-row-muted">
      {opponentPositions.map((pos, i) => (
        <div key={i} className="board-layout-cell-muted">
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
  );

  const compactPlayerStreet = compactStreet ? (
    <div className="street-grid street-grid-player">
      {chunkStreet(playerPositions).map((row, rowIndex) => (
        <div key={rowIndex} className="street-grid-row">
          {row.map((pos, columnIndex) => {
            const positionIdx = rowIndex === 0 ? columnIndex : columnIndex + 3;
            return (
              <DropTarget
                key={`${rowIndex}-${columnIndex}`}
                positionIdx={positionIdx}
                position={pos}
                onCrewDrop={handleCrewDrop}
                onModifierDrop={handleModifierDrop}
                onRunnerDrop={handleRunnerDrop}
              >
                <div className="street-grid-cell">
                  <PositionSlot
                    position={pos}
                    index={positionIdx}
                    isPlayer={true}
                    onClick={() => setSelectedRunnerLane(pos.runner ? positionIdx : null)}
                  />
                </div>
              </DropTarget>
            );
          })}
        </div>
      ))}
    </div>
  ) : (
    <div className="board-layout-row board-layout-row-player">
      {playerPositions.map((pos, i) => (
        <DropTarget
          key={i}
          positionIdx={i}
          position={pos}
          onCrewDrop={handleCrewDrop}
          onModifierDrop={handleModifierDrop}
          onRunnerDrop={handleRunnerDrop}
        >
          <PositionSlot
            position={pos}
            index={i}
            isPlayer={true}
            onClick={() => setSelectedRunnerLane(pos.runner ? i : null)}
          />
        </DropTarget>
      ))}
    </div>
  );

  return (
    <DragProvider>
      <div className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`} data-testid="buildup-screen">
        <GameHUD onOpenMenu={onOpenMenu} />

        <div className="game-shell">
          <div className="game-board-area">
            {flash && (
              <div className="game-flash">
                <span className="game-flash-pill">{flash}</span>
              </div>
            )}

            <div className="game-board-stack">
              {compactOpponentStreet}

              <div className="game-street-banner">
                <span className="game-street-tag">The Street</span>
                <span className="game-street-copy">Round {turnNumber}/{MAX_BUILDUP_TURNS}</span>
              </div>

              {compactPlayerStreet}
            </div>

            <div className="reserve-strip">
              <div className="reserve-strip-header">
                <span className="game-street-tag">Reserve</span>
                <span className="game-street-copy">Stage runners and kits</span>
              </div>
              <div className="reserve-strip-grid" data-testid="reserve-strip">
                {reservePositions.map((pos, reserveIdx) => {
                  const reserveCard = (
                    <div className="reserve-slot-card">
                      <PositionSlot
                        position={pos}
                        index={reserveIdx}
                        isPlayer={true}
                      />
                      {pos.runner && (
                        <div className="reserve-slot-runner-label">
                          Runner
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <ReserveDropTarget
                      key={reserveIdx}
                      reserveIdx={reserveIdx}
                      position={pos}
                      onCrewDrop={handleReserveCrewDrop}
                      onBackpackDrop={handleBackpackDrop}
                    >
                      {pos.runner ? (
                        <DraggableCard type="runner" cardIndex={reserveIdx}>
                          {reserveCard}
                        </DraggableCard>
                      ) : reserveCard}
                    </ReserveDropTarget>
                  );
                })}
              </div>
            </div>

            {selectedRunnerLane !== null && playerPositions[selectedRunnerLane]?.backpack && (
              <div className="runner-payload-panel" data-testid="runner-payload-panel">
                <div className="runner-payload-header">
                  <span className="game-street-tag">Runner Kit</span>
                  <span className="game-street-copy">{playerPositions[selectedRunnerLane].backpack?.name}</span>
                </div>
                <div className="runner-payload-actions">
                  {playerPositions[selectedRunnerLane].backpack?.payload.map((payload) => (
                    <div key={payload.id} className="runner-payload-action">
                      <span className="runner-payload-name">
                        {payload.type === 'cash' ? `$${payload.denomination}` : payload.name}
                      </span>
                      <div className="runner-payload-buttons">
                        <button
                          className="deck-mini-button"
                          onClick={() => handleDeployPayload(selectedRunnerLane, payload.id, 'offense')}
                        >
                          <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
                          <span className="utility-button-label">Atk</span>
                        </button>
                        <button
                          className="deck-mini-button"
                          onClick={() => handleDeployPayload(selectedRunnerLane, payload.id, 'defense')}
                        >
                          <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
                          <span className="utility-button-label">Def</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
