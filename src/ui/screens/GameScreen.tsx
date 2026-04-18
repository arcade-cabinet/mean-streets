import { useCallback, useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { useAppShell } from '../../platform';
import {
  useActionBudget, useBlackMarket, useDeckCount, useDeckPending, useMetrics,
  useHeat, useHolding, useLockup, useMythicPool,
  useQueuedStrikes, useTurfActive, useTurfReserves, useTurnEnded,
} from '../../ecs/hooks';
import type { QueuedAction, Turf } from '../../sim/turf/types';
import { HeatMeter, StackFanModal, TurfCompositeCard } from '../board';
import { Card as CardComponent } from '../cards';
import { QueuedChips, type ActionMode } from './GameScreenActionBar';
import type { StrikePhase } from './gameScreenHelpers';
import {
  GameMobileCustodyModal, GameMobileMarketModal,
} from './GameScreenSidebars';
import { useOpponentTurn } from './useOpponentTurn';
import { ResolutionOverlay } from './ResolutionOverlay';
import { buildGameActions } from './useGameActions';

const RESOLVE_FLASH_MS = 1200;

interface GameScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
  onOpenMenu?: () => void;
}

export type ModalView =
  | { kind: 'none' }
  | { kind: 'stack'; turf: Turf; isOwn: boolean }
  | { kind: 'swap'; turf: Turf; sourceToughId: string; modId: string }
  | { kind: 'market' }
  | { kind: 'holding' }
  | { kind: 'drawer-market' }
  | { kind: 'drawer-holding' }
  | { kind: 'drawn-card' };

export function GameScreen({ world, onGameOver, onOpenMenu }: GameScreenProps) {
  const { layout } = useAppShell();
  const [mode, setMode] = useState<ActionMode>(null);
  const [strikePhase, setStrikePhase] = useState<StrikePhase>('pick-source');
  const [modal, setModal] = useState<ModalView>({ kind: 'none' });
  const [flash, setFlash] = useState<string | null>(null);
  const [healTarget, setHealTarget] = useState<{ id: string; name: string } | null>(null);
  const [resolution, setResolution] = useState<
    { strikes: QueuedAction[]; raid: boolean; mythic: number } | null
  >(null);

  const budget = useActionBudget();
  const playerActive = useTurfActive('A');
  const opponentActive = useTurfActive('B');
  const playerReserves = useTurfReserves('A');
  const opponentReserves = useTurfReserves('B');
  const pending = useDeckPending('A');
  const deckCount = useDeckCount('A');
  const queuedA = useQueuedStrikes('A');
  const queuedB = useQueuedStrikes('B');
  const turnEndedA = useTurnEnded('A');
  const turnEndedB = useTurnEnded('B');
  const heat = useHeat();
  const market = useBlackMarket();
  const holdingA = useHolding('A');
  const holdingB = useHolding('B');
  const lockupA = useLockup('A');
  const lockupB = useLockup('B');
  const mythic = useMythicPool();
  const metrics = useMetrics();
  const turnNumber = budget.turnNumber;

  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const prevTurnRef = useRef(turnNumber);
  const pendingResolveRef = useRef<typeof resolution>(null);

  const showFlash = useCallback((msg: string, durationMs = 1400) => {
    setFlash(msg);
    const id = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(id);
  }, []);

  const totalPlayerTurfs = (playerActive ? 1 : 0) + playerReserves.length;
  const totalOpponentTurfs = (opponentActive ? 1 : 0) + opponentReserves.length;

  const checkWin = useCallback((): boolean => {
    if (totalOpponentTurfs === 0) { onGameOver('A'); return true; }
    if (totalPlayerTurfs === 0) { onGameOver('B'); return true; }
    return false;
  }, [totalPlayerTurfs, totalOpponentTurfs, onGameOver]);

  const { aiThinking, aiAction } = useOpponentTurn({ world, turnEndedA, turnEndedB, onFinish: checkWin });

  const metricsSnapshotRef = useRef({ raids: 0, mythicsFlipped: 0 });

  useEffect(() => {
    if (turnEndedA && turnEndedB && !pendingResolveRef.current) {
      metricsSnapshotRef.current = { raids: metrics.raids, mythicsFlipped: metrics.mythicsFlipped };
      pendingResolveRef.current = {
        strikes: [...queuedA, ...queuedB], raid: false, mythic: 0,
      };
    }
  }, [turnEndedA, turnEndedB, queuedA, queuedB, metrics.raids, metrics.mythicsFlipped]);

  useEffect(() => {
    if (turnNumber !== prevTurnRef.current && prevTurnRef.current !== 0) {
      showFlash(`RESOLVED — Turn ${turnNumber}`, RESOLVE_FLASH_MS);
      if (pendingResolveRef.current) {
        const raidFired = metrics.raids > metricsSnapshotRef.current.raids;
        const mythicDelta = metrics.mythicsFlipped - metricsSnapshotRef.current.mythicsFlipped;
        pendingResolveRef.current.raid = raidFired;
        pendingResolveRef.current.mythic = mythicDelta;
        setResolution(pendingResolveRef.current);
        pendingResolveRef.current = null;
      }
    }
    prevTurnRef.current = turnNumber;
  }, [turnNumber, showFlash, metrics.raids, metrics.mythicsFlipped]);

  const actions = buildGameActions({
    world, pending, playerActive, opponentActive,
    mode, strikePhase, modal, healTarget,
    setMode, setStrikePhase, setModal, setHealTarget,
    flash: showFlash, checkWin,
  });

  const exhausted = budget.remaining <= 0;

  useEffect(() => {
    if (exhausted && !turnEndedA && !pending) {
      actions.onEndTurn();
    }
  }, [exhausted, turnEndedA, pending, actions]);

  // On phone: auto-show drawn card modal once when a new card enters pending
  const shownDrawnRef = useRef<string | null>(null);
  useEffect(() => {
    if (compact && pending && shownDrawnRef.current !== pending.id) {
      shownDrawnRef.current = pending.id;
      setModal({ kind: 'drawn-card' });
    }
    if (!pending) shownDrawnRef.current = null;
  }, [compact, pending]);

  const canDraw = !exhausted && !turnEndedA && !pending && deckCount > 0;
  const holdingAll = [...holdingA, ...holdingB, ...lockupA, ...lockupB];
  const drawerOpen = modal.kind === 'drawer-market' || modal.kind === 'drawer-holding';

  return (
    <div className="game-screen game-screen-v3" data-testid="game-screen">
      {/* Drawer overlays — render above board */}
      {drawerOpen && (
        <button
          type="button"
          className="game-drawer-backdrop"
          onClick={() => setModal({ kind: 'none' })}
          aria-label="Close panel"
        />
      )}
      {modal.kind === 'drawer-market' && (
        <div className="game-drawer game-drawer-left">
          <GameMobileMarketModal
            market={market}
            healTargetName={healTarget?.name}
            onTrade={actions.onMarketTrade}
            onHeal={actions.onMarketHeal}
            onClose={() => setModal({ kind: 'none' })}
          />
        </div>
      )}
      {modal.kind === 'drawer-holding' && (
        <div className="game-drawer game-drawer-right">
          <GameMobileCustodyModal
            holdingA={holdingA} holdingB={holdingB} lockupA={lockupA} lockupB={lockupB}
            onClose={() => setModal({ kind: 'none' })}
          />
        </div>
      )}

      <div className="game-hud-bar">
        <span className="game-hud-bar-turn">Turn {turnNumber}</span>
        <span className="game-hud-bar-budget" data-testid="action-budget">
          {budget.remaining}/{budget.total}
          {!turnEndedA && budget.remaining > 0 && (
            <button
              type="button"
              className="game-hud-end-btn"
              onClick={actions.onEndTurn}
              data-testid="action-end_turn"
            >
              END
            </button>
          )}
        </span>
        {compact && canDraw && (
          <button
            type="button"
            className="game-hud-panel-btn game-hud-panel-btn-active"
            onClick={() => actions.onModeSelect('draw')}
            data-testid="hud-draw"
          >
            Draw ({deckCount})
          </button>
        )}
        <span className="game-hud-bar-turfs">Turfs {totalPlayerTurfs} vs {totalOpponentTurfs}</span>
        <HeatMeter value={heat} compact={compact} />
        <span className="game-hud-bar-mythic" data-testid="mythic-pool-indicator">
          Mythic {mythic.unassigned.length}/10
        </span>
        <button
          type="button"
          className={`game-hud-panel-btn ${market.length > 0 ? 'game-hud-panel-btn-active' : ''}`}
          onClick={() => setModal(modal.kind === 'drawer-market' ? { kind: 'none' } : { kind: 'drawer-market' })}
          data-testid="slot-market"
        >
          Market {market.length > 0 ? `(${market.length})` : ''}
        </button>
        <button
          type="button"
          className={`game-hud-panel-btn ${holdingAll.length > 0 ? 'game-hud-panel-btn-active' : ''}`}
          onClick={() => setModal(modal.kind === 'drawer-holding' ? { kind: 'none' } : { kind: 'drawer-holding' })}
          data-testid="slot-holding"
        >
          Custody {holdingAll.length > 0 ? `(${holdingAll.length})` : ''}
        </button>
        {pending && (
          <button
            type="button"
            className="game-hud-panel-btn game-hud-panel-btn-active"
            onClick={() => setModal({ kind: 'drawn-card' })}
            data-testid="btn-peek"
          >
            Peek
          </button>
        )}
        {onOpenMenu && (
          <button type="button" className="game-hud-bar-menu" onClick={onOpenMenu} aria-label="Open game menu">Menu</button>
        )}
      </div>

      {flash && <div className="game-flash"><span className="game-flash-pill">{flash}</span></div>}
      {(aiThinking || (turnEndedA && !turnEndedB)) && (
        <div className="game-overlay" data-testid="opponent-turn-overlay">
          <div className="game-overlay-pill">{aiAction ?? 'Waiting for opponent…'}</div>
        </div>
      )}

      <div className="board-grid">
        {/* Row 1: Opponent Draw | Opponent Turf | Opponent Reserves */}
        <div className="board-slot board-slot-draw board-slot-opponent-draw" data-testid="slot-opp-draw">
          <div className="draw-pile">
            <div className="draw-pile-card draw-pile-card-3" />
            <div className="draw-pile-card draw-pile-card-2" />
            <div className="draw-pile-card draw-pile-card-1">
              <span className="draw-pile-mark">MS</span>
            </div>
            <span className="draw-pile-count">{opponentReserves.length} res</span>
          </div>
        </div>

        <div
          className="board-slot board-slot-turf board-slot-opponent"
          onClick={() => opponentActive && actions.onLaneClick('B')}
          data-testid="turf-lane-B"
        >
          {opponentActive ? (
            <TurfCompositeCard turf={opponentActive} compact={compact} isOwn={false} />
          ) : (
            <span className="board-slot-label">Empty Turf</span>
          )}
        </div>

        <div className="board-slot board-slot-reserves board-slot-opponent-reserves">
          {opponentReserves.length > 0 && (
            <div className="draw-pile">
              <div className="draw-pile-card draw-pile-card-1" />
              <span className="draw-pile-count">{opponentReserves.length}</span>
            </div>
          )}
        </div>

        {/* Row 2: Player Draw | Player Turf | Player Reserves */}
        <div
          className={`board-slot board-slot-draw board-slot-player-draw ${canDraw ? 'board-slot-tappable' : ''}`}
          onClick={() => canDraw && actions.onModeSelect('draw')}
          data-testid="slot-player-draw"
        >
          {deckCount > 0 ? (
            <div className="draw-pile">
              {deckCount > 2 && <div className="draw-pile-card draw-pile-card-3" />}
              {deckCount > 1 && <div className="draw-pile-card draw-pile-card-2" />}
              <div className="draw-pile-card draw-pile-card-1">
                <span className="draw-pile-mark">MS</span>
              </div>
              <span className="draw-pile-count">{deckCount}</span>
            </div>
          ) : (
            <span className="board-slot-label">Empty</span>
          )}
        </div>

        <div
          className={`board-slot board-slot-turf board-slot-player ${pending ? 'board-slot-pending' : ''}`}
          onClick={() => actions.onLaneClick('A')}
          data-testid="turf-lane-A"
        >
          {playerActive ? (
            <TurfCompositeCard turf={playerActive} compact={compact} isOwn />
          ) : (
            <span className="board-slot-label">Empty Turf</span>
          )}
          {pending && (
            <div className="board-pending-badge" data-testid="pending-card">
              <CardComponent card={pending} compact />
            </div>
          )}
        </div>

        <div className="board-slot board-slot-reserves board-slot-player-reserves">
          {playerReserves.length > 0 && (
            <div className="draw-pile">
              <div className="draw-pile-card draw-pile-card-1" />
              <span className="draw-pile-count">{playerReserves.length}</span>
            </div>
          )}
        </div>
      </div>


      <QueuedChips strikes={queuedA} />


      {(modal.kind === 'stack' || modal.kind === 'swap') && (
        <StackFanModal
          turf={modal.turf} open isOwn
          onCardPick={mode !== 'play_card' ? actions.onStackPick : undefined}
          onClose={() => { setModal({ kind: 'none' }); if (mode === 'play_card') setMode(null); }}
          showHp showOwnerLines={mode === 'modifier_swap'}
          onPlaceAt={mode === 'play_card' && pending ? actions.placePendingAt : undefined}
          placingIsModifier={mode === 'play_card' && !!pending && pending.kind !== 'tough'}
        />
      )}

      {modal.kind === 'market' && (
        <GameMobileMarketModal
          market={market}
          healTargetName={healTarget?.name}
          onTrade={actions.onMarketTrade}
          onHeal={actions.onMarketHeal}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'holding' && (
        <GameMobileCustodyModal
          holdingA={holdingA} holdingB={holdingB} lockupA={lockupA} lockupB={lockupB}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'drawn-card' && pending && (
        <div
          className="game-drawn-card-overlay"
          onClick={() => setModal({ kind: 'none' })}
          data-testid="drawn-card-modal"
        >
          <div className="game-drawn-card-content" onClick={(e) => e.stopPropagation()}>
            <CardComponent card={pending} />
          </div>
          <span className="game-drawn-card-hint">Tap your turf to place</span>
        </div>
      )}

      {resolution && (
        <ResolutionOverlay
          strikes={resolution.strikes}
          raidFired={resolution.raid}
          mythicsFlipped={resolution.mythic}
          onDone={() => setResolution(null)}
        />
      )}
    </div>
  );
}
