import { useCallback, useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { useAppShell } from '../../platform';
import {
  useActionBudget, useBlackMarket, useDeckCount, useDeckPending,
  useHeat, useHolding, useLockup, useMythicPool,
  useQueuedStrikes, useTurfActive, useTurfReserves, useTurnEnded,
} from '../../ecs/hooks';
import type { QueuedAction, Turf } from '../../sim/turf/types';
import { HeatMeter, StackFanModal, TurfCompositeCard } from '../board';
import { Card as CardComponent } from '../cards';
import { QueuedChips, type ActionMode } from './GameScreenActionBar';
import { buildPrompt, type StrikePhase } from './gameScreenHelpers';
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
  | { kind: 'drawer-holding' };

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

  const { aiThinking } = useOpponentTurn({ world, turnEndedA, turnEndedB, onFinish: checkWin });

  useEffect(() => {
    if (turnEndedA && turnEndedB && !pendingResolveRef.current) {
      pendingResolveRef.current = {
        strikes: [...queuedA, ...queuedB], raid: heat >= 0.8, mythic: 0,
      };
    }
  }, [turnEndedA, turnEndedB, queuedA, queuedB, heat]);

  useEffect(() => {
    if (turnNumber !== prevTurnRef.current && prevTurnRef.current !== 0) {
      showFlash(`RESOLVED — Turn ${turnNumber}`, RESOLVE_FLASH_MS);
      if (pendingResolveRef.current) {
        setResolution(pendingResolveRef.current);
        pendingResolveRef.current = null;
      }
    }
    prevTurnRef.current = turnNumber;
  }, [turnNumber, showFlash]);

  const actions = buildGameActions({
    world, pending, playerActive, opponentActive,
    mode, strikePhase, modal, healTarget,
    setMode, setStrikePhase, setModal, setHealTarget,
    flash: showFlash, checkWin,
  });

  const exhausted = budget.remaining <= 0;
  const promptText = buildPrompt(mode, strikePhase, pending !== null, null);

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
          Actions: {budget.remaining}/{budget.total}
        </span>
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
        {onOpenMenu && (
          <button type="button" className="game-hud-bar-menu" onClick={onOpenMenu} aria-label="Open game menu">Menu</button>
        )}
      </div>

      {flash && <div className="game-flash"><span className="game-flash-pill">{flash}</span></div>}
      {(aiThinking || (turnEndedA && !turnEndedB)) && (
        <div className="game-overlay" data-testid="opponent-turn-overlay">
          <div className="game-overlay-pill">Waiting for opponent…</div>
        </div>
      )}

      <div className="board-grid">
        {/* Row 1: Opponent Draw | Opponent Turf | Opponent Reserves */}
        <div className="board-slot board-slot-draw board-slot-opponent-draw" data-testid="slot-opp-draw">
          <span className="board-slot-label">Opp</span>
          <span className="board-slot-count">{opponentReserves.length} res</span>
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
            <span className="board-slot-count">{opponentReserves.length}</span>
          )}
        </div>

        {/* Row 2: Player Draw | Player Turf | Player Reserves */}
        <div
          className={`board-slot board-slot-draw board-slot-player-draw ${canDraw ? 'board-slot-tappable' : ''}`}
          onClick={() => canDraw && actions.onModeSelect('draw')}
          data-testid="slot-player-draw"
        >
          {deckCount > 0
            ? <span className="board-slot-count">{deckCount}</span>
            : <span className="board-slot-label">Empty</span>}
        </div>

        <div
          className="board-slot board-slot-turf board-slot-player"
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
            <span className="board-slot-count">{playerReserves.length}</span>
          )}
        </div>
      </div>

      {promptText && (
        <div className="game-prompt">
          <span className="game-prompt-text">{promptText}</span>
          <button type="button" className="game-prompt-cancel" onClick={actions.reset}>Cancel</button>
        </div>
      )}

      <QueuedChips strikes={queuedA} />

      <div className="board-end-turn">
        {pending && (
          <button
            type="button"
            className="game-action-btn game-action-btn-danger"
            onClick={actions.onDiscardPending}
            data-testid="action-discard-pending"
          >
            Discard
          </button>
        )}
        <button
          type="button"
          className={`game-action-btn game-action-btn-end-turn ${turnEndedA ? 'game-action-btn-disabled' : ''}`}
          disabled={turnEndedA}
          onClick={actions.onEndTurn}
          data-testid="action-end_turn"
        >
          End Turn
        </button>
      </div>

      {(modal.kind === 'stack' || modal.kind === 'swap') && (
        <StackFanModal
          turf={modal.turf} open isOwn
          onCardPick={actions.onStackPick}
          onClose={() => setModal({ kind: 'none' })}
          showHp showOwnerLines={mode === 'modifier_swap'}
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
