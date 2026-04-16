import { useCallback, useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { useAppShell } from '../../platform';
import {
  drawAction,
  playCardAction,
  retreatAction,
  queueStrikeAction,
  discardPendingAction,
  endTurnAction,
} from '../../ecs/actions';
import {
  useActionBudget,
  useDeckCount,
  useDeckPending,
  usePlayerTurfs,
  useQueuedStrikes,
  useTurnEnded,
} from '../../ecs/hooks';
import { hasToughOnTurf, turfCurrency } from '../../sim/turf/board';
import type { Turf } from '../../sim/turf/types';
import { TurfView } from '../board';
import { StackFanModal } from '../board/StackFanModal';
import { Card as CardComponent } from '../cards';
import {
  GameActionBar,
  QueuedChips,
  type ActionMode,
} from './GameScreenActionBar';
import {
  buildPrompt,
  isStrikeMode,
  retreatViable,
  type StrikeKind,
  type StrikePhase,
} from './gameScreenHelpers';
import { useOpponentTurn } from './useOpponentTurn';

const RESOLVE_FLASH_MS = 1200;

interface GameScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
  onOpenMenu?: () => void;
}

export function GameScreen({ world, onGameOver, onOpenMenu }: GameScreenProps) {
  const { layout } = useAppShell();
  const [mode, setMode] = useState<ActionMode>(null);
  const [strikePhase, setStrikePhase] = useState<StrikePhase>('pick-source');
  const [sourceTurfIdx, setSourceTurfIdx] = useState<number | null>(null);
  const [retreatTurfIdx, setRetreatTurfIdx] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const budget = useActionBudget();
  const playerTurfs = usePlayerTurfs('A');
  const opponentTurfs = usePlayerTurfs('B');
  const pending = useDeckPending('A');
  const deckCount = useDeckCount('A');
  const queuedStrikes = useQueuedStrikes('A');
  const turnEndedA = useTurnEnded('A');
  const turnEndedB = useTurnEnded('B');
  const turnNumber = budget.turnNumber;

  const sideHand = layout.handPlacement === 'side';
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const prevTurnRef = useRef(turnNumber);

  const showFlash = useCallback((msg: string, durationMs = 1400) => {
    setFlash(msg);
    const id = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(id);
  }, []);

  const checkWin = useCallback((): boolean => {
    if (opponentTurfs.length === 0) { onGameOver('A'); return true; }
    if (playerTurfs.length === 0) { onGameOver('B'); return true; }
    return false;
  }, [playerTurfs.length, opponentTurfs.length, onGameOver]);

  const { aiThinking } = useOpponentTurn({
    world,
    turnEndedA,
    turnEndedB,
    onFinish: checkWin,
  });

  // Turn-advance detector: after both sides end_turn, sim resolves
  // synchronously and turnNumber bumps. Surface a brief "Resolved" flash.
  useEffect(() => {
    if (turnNumber !== prevTurnRef.current && prevTurnRef.current !== 0) {
      showFlash(`RESOLVED — Turn ${turnNumber}`, RESOLVE_FLASH_MS);
    }
    prevTurnRef.current = turnNumber;
  }, [turnNumber, showFlash]);

  const resetMode = useCallback(() => {
    setMode(null);
    setStrikePhase('pick-source');
    setSourceTurfIdx(null);
    setRetreatTurfIdx(null);
  }, []);

  // ── Action selection ────────────────────────────────────────
  function handleModeSelect(kind: NonNullable<ActionMode> | 'draw') {
    if (kind === 'draw') {
      drawAction(world, 'A');
      showFlash('Drew a card', 900);
      return;
    }
    if (kind === mode) { resetMode(); return; }
    resetMode();
    setMode(kind);
  }

  function handlePlaceTurf(index: number) {
    if (!pending) return;
    const result = playCardAction(world, 'A', index, pending.id);
    resetMode();
    if (result?.reason === 'play_card_discarded_rival') {
      showFlash('RIVAL DISCARDED — no buffer on that turf', 2000);
    }
    if (checkWin()) return;
  }

  function handleStrikeSource(index: number) {
    const t = playerTurfs[index];
    if (!hasToughOnTurf(t)) return;
    if (mode === 'pushed_strike' && turfCurrency(t).length === 0) return;
    if (mode === 'pushed_strike' && t.closedRanks) return;
    setSourceTurfIdx(index);
    setStrikePhase('pick-target');
  }

  function handleStrikeTarget(index: number) {
    if (sourceTurfIdx === null || !mode) return;
    const t = opponentTurfs[index];
    if (!hasToughOnTurf(t)) return;
    const kind = mode as StrikeKind;
    const result = queueStrikeAction(world, 'A', kind, sourceTurfIdx, index);
    resetMode();
    if (result) showFlash(kind.replace('_', ' ').toUpperCase() + ' QUEUED', 1200);
  }

  function handleTurfClick(side: 'A' | 'B', index: number) {
    // Pending placement takes priority: any tap on your own turf with a
    // pending card routes to place, unless the user is mid-retreat/strike.
    if (pending && side === 'A' && mode !== 'retreat' && !isStrikeMode(mode)) {
      handlePlaceTurf(index);
      return;
    }
    if (!mode) return;
    if (mode === 'play_card' && side === 'A') { handlePlaceTurf(index); return; }
    if (mode === 'retreat' && side === 'A') { setRetreatTurfIdx(index); return; }
    if (isStrikeMode(mode)) {
      if (strikePhase === 'pick-source' && side === 'A') handleStrikeSource(index);
      else if (strikePhase === 'pick-target' && side === 'B') handleStrikeTarget(index);
    }
  }

  function handleRetreatPick(stackIdx: number) {
    if (retreatTurfIdx === null) return;
    const result = retreatAction(world, 'A', retreatTurfIdx, stackIdx);
    resetMode();
    if (result) showFlash('RETREAT', 900);
  }

  function handleEndTurn() { endTurnAction(world, 'A'); resetMode(); }
  function handleDiscardPending() {
    discardPendingAction(world, 'A');
    resetMode();
    showFlash('PENDING DISCARDED', 800);
  }

  // ── Derived flags ───────────────────────────────────────────
  const exhausted = budget.remaining <= 0;
  const hasStrikableSource = playerTurfs.some(hasToughOnTurf);
  const hasStrikableTarget = opponentTurfs.some(hasToughOnTurf);
  const canStrike = !exhausted && !turnEndedA && hasStrikableSource && hasStrikableTarget;
  const hasCurrencyOnAnyTurf = playerTurfs.some(
    (t) => !t.closedRanks && turfCurrency(t).length > 0,
  );
  const canRetreat = !exhausted && !turnEndedA && playerTurfs.some(retreatViable);

  const promptText = buildPrompt(mode, strikePhase, pending !== null, retreatTurfIdx);
  const retreatTurf: Turf | null =
    retreatTurfIdx !== null ? playerTurfs[retreatTurfIdx] : null;

  return (
    <div
      className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`}
      data-testid="game-screen"
    >
      <div className="game-hud-bar">
        <span className="game-hud-bar-turn">Turn {turnNumber}</span>
        <span className="game-hud-bar-budget" data-testid="action-budget">
          Actions: {budget.remaining}/{budget.total}
        </span>
        <span className="game-hud-bar-turfs">
          Turfs {playerTurfs.length} vs {opponentTurfs.length}
        </span>
        <span className="game-hud-bar-deck">Deck {deckCount}</span>
        {onOpenMenu && (
          <button className="game-hud-bar-menu" onClick={onOpenMenu} aria-label="Open game menu">
            Menu
          </button>
        )}
      </div>

      <div className="game-shell">
        <div className="game-board-area">
          {flash && (
            <div className="game-flash">
              <span className="game-flash-pill">{flash}</span>
            </div>
          )}
          {(aiThinking || (turnEndedA && !turnEndedB)) && (
            <div className="game-overlay" data-testid="opponent-turn-overlay">
              <div className="game-overlay-pill">Waiting for opponent…</div>
            </div>
          )}

          <TurfView
            playerTurfs={playerTurfs}
            opponentTurfs={opponentTurfs}
            turnNumber={turnNumber}
            onTurfClick={handleTurfClick}
          />
        </div>

        <QueuedChips strikes={queuedStrikes} />

        {promptText && (
          <div className="game-prompt">
            <span className="game-prompt-text">{promptText}</span>
            <button className="game-prompt-cancel" onClick={resetMode}>Cancel</button>
          </div>
        )}

        {pending && (
          <div className="game-pending" data-testid="pending-card">
            <div className="game-pending-label">Pending — tap a turf to place</div>
            <CardComponent card={pending} compact={compact} />
          </div>
        )}

        <GameActionBar
          mode={mode}
          deckCount={deckCount}
          hasPending={pending !== null}
          canDraw={!exhausted && !turnEndedA && !pending && deckCount > 0}
          canPlay={!exhausted && !turnEndedA && pending !== null}
          canRetreat={canRetreat}
          canStrike={canStrike}
          canPushed={canStrike && hasCurrencyOnAnyTurf}
          canRecruit={canStrike && hasCurrencyOnAnyTurf}
          turnEnded={turnEndedA}
          onSelect={handleModeSelect}
          onDiscardPending={handleDiscardPending}
          onEndTurn={handleEndTurn}
          sideHand={sideHand}
        />
      </div>

      {retreatTurf && (
        <StackFanModal
          turf={retreatTurf}
          open={retreatTurfIdx !== null}
          isOwn
          onCardPick={handleRetreatPick}
          onClose={() => setRetreatTurfIdx(null)}
        />
      )}
    </div>
  );
}
