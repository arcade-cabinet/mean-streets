import { useCallback, useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { useAppShell } from '../../platform';
import {
  useActionBudget, useBlackMarket, useDeckCount, useDeckPending,
  useHeat, useHolding, useLockup, useMythicPool,
  useQueuedStrikes, useTurfActive, useTurfReserves, useTurnEnded,
} from '../../ecs/hooks';
import { hasToughOnTurf, turfCurrency, turfToughs } from '../../sim/turf/board';
import type { QueuedAction, Turf } from '../../sim/turf/types';
import { HeatMeter, StackFanModal, TurfView } from '../board';
import { Card as CardComponent } from '../cards';
import { GameActionBar, QueuedChips, type ActionMode } from './GameScreenActionBar';
import {
  buildPrompt, modifierSwapViable, retreatViable, type StrikePhase,
} from './gameScreenHelpers';
import {
  GameDesktopLeftSidebar, GameDesktopRightSidebar,
  GameMobileCustodyModal, GameMobileMarketModal, GameMobileTriggers,
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
  | { kind: 'holding' };

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

  const sideHand = layout.handPlacement === 'side';
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const isPhone = layout.deviceClass === 'phone';
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
  const canStrike = !exhausted && !turnEndedA && !!playerActive && !!opponentActive
    && hasToughOnTurf(playerActive) && hasToughOnTurf(opponentActive);
  const hasCurrency = !!playerActive && !playerActive.closedRanks && turfCurrency(playerActive).length > 0;
  const canRetreat = !exhausted && !turnEndedA && playerActive ? retreatViable(playerActive) : false;
  const canModifierSwap = !exhausted && !turnEndedA && playerActive ? modifierSwapViable(playerActive) : false;
  const canSendAction = !exhausted && !turnEndedA && playerActive ? turfToughs(playerActive).length > 0 : false;

  const sidebarProps = {
    market, holdingA, holdingB, lockupA, lockupB,
    healTargetName: healTarget?.name,
    onMarketTrade: actions.onMarketTrade,
    onMarketHeal: actions.onMarketHeal,
  };
  const promptText = buildPrompt(mode, strikePhase, pending !== null, null);

  return (
    <div
      className={`game-screen game-screen-v3 ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`}
      data-testid="game-screen"
    >
      <div className="game-hud-bar">
        <span className="game-hud-bar-turn">Turn {turnNumber}</span>
        <span className="game-hud-bar-budget" data-testid="action-budget">
          Actions: {budget.remaining}/{budget.total}
        </span>
        <span className="game-hud-bar-turfs">Turfs {totalPlayerTurfs} vs {totalOpponentTurfs}</span>
        <span className="game-hud-bar-deck">Deck {deckCount}</span>
        <HeatMeter value={heat} compact={isPhone} />
        <span className="game-hud-bar-mythic" data-testid="mythic-pool-indicator">
          Mythic {mythic.unassigned.length}/10
        </span>
        {onOpenMenu && (
          <button className="game-hud-bar-menu" onClick={onOpenMenu} aria-label="Open game menu">Menu</button>
        )}
      </div>

      <div className="game-shell">
        {!isPhone && <GameDesktopLeftSidebar {...sidebarProps} />}

        <div className="game-board-area">
          {flash && <div className="game-flash"><span className="game-flash-pill">{flash}</span></div>}
          {(aiThinking || (turnEndedA && !turnEndedB)) && (
            <div className="game-overlay" data-testid="opponent-turn-overlay">
              <div className="game-overlay-pill">Waiting for opponent…</div>
            </div>
          )}

          <TurfView
            playerActive={playerActive} opponentActive={opponentActive}
            playerReserves={playerReserves} opponentReserves={opponentReserves}
            turnNumber={turnNumber} onLaneClick={actions.onLaneClick}
          />

          <QueuedChips strikes={queuedA} />

          {promptText && (
            <div className="game-prompt">
              <span className="game-prompt-text">{promptText}</span>
              <button className="game-prompt-cancel" onClick={actions.reset}>Cancel</button>
            </div>
          )}

          {pending && (
            <div className="game-pending" data-testid="pending-card">
              <div className="game-pending-label">Pending — tap your turf to place</div>
              <CardComponent card={pending} compact={compact} />
            </div>
          )}

          <GameActionBar
            mode={mode} deckCount={deckCount} hasPending={pending !== null}
            canDraw={!exhausted && !turnEndedA && !pending && deckCount > 0}
            canPlay={!exhausted && !turnEndedA && pending !== null}
            canRetreat={canRetreat}
            canModifierSwap={canModifierSwap}
            canSendToMarket={canSendAction}
            canSendToHolding={canSendAction}
            canStrike={canStrike}
            canPushed={canStrike && hasCurrency}
            canRecruit={canStrike && hasCurrency}
            turnEnded={turnEndedA}
            onSelect={actions.onModeSelect}
            onDiscardPending={actions.onDiscardPending}
            onEndTurn={actions.onEndTurn}
            sideHand={sideHand}
          />
        </div>

        {!isPhone && <GameDesktopRightSidebar {...sidebarProps} />}
        {isPhone && (
          <GameMobileTriggers
            marketCount={market.length}
            custodyCount={holdingA.length + lockupA.length}
            onOpenMarket={() => setModal({ kind: 'market' })}
            onOpenCustody={() => setModal({ kind: 'holding' })}
          />
        )}
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
