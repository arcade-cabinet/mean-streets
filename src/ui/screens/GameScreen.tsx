import { useCallback, useState } from 'react';
import type { World } from 'koota';
import { useQueryFirst, useTrait } from 'koota/react';
import { useAppShell } from '../../platform';
import {
  playCardAction,
  strikeAction,
  discardAction,
  endTurnAction,
} from '../../ecs/actions';
import { useActionBudget, usePlayerTurfs, useHand } from '../../ecs/hooks';
import { GameState } from '../../ecs/traits';
import { hasToughOnTurf, turfCurrency } from '../../sim/turf/board';
import type { Card, TurfActionKind } from '../../sim/turf/types';
import { TurfView } from '../board';
import { Card as CardComponent } from '../cards';

type ActionMode = TurfActionKind | null;
type StrikePhase = 'pick-source' | 'pick-target';

const AI_DELAY_MS = 1800;

interface GameScreenProps {
  world: World;
  onGameOver: (winner: 'A' | 'B') => void;
  onOpenMenu?: () => void;
}

export function GameScreen({ world, onGameOver, onOpenMenu }: GameScreenProps) {
  const { layout } = useAppShell();
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [strikePhase, setStrikePhase] = useState<StrikePhase>('pick-source');
  const [sourceTurfIdx, setSourceTurfIdx] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const gsEntity = useQueryFirst(GameState);
  const gs = useTrait(gsEntity, GameState);
  const budget = useActionBudget();
  const playerTurfs = usePlayerTurfs('A');
  const opponentTurfs = usePlayerTurfs('B');
  const hand = useHand('A');

  const turnNumber = gs?.turnNumber ?? 0;
  const sideHand = layout.handPlacement === 'side';
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';

  const showFlash = useCallback((msg: string, durationMs = 1400) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), durationMs);
  }, []);

  function resetAction() {
    setActionMode(null);
    setStrikePhase('pick-source');
    setSourceTurfIdx(null);
    setSelectedCardId(null);
  }

  function checkWin(): boolean {
    if (opponentTurfs.length === 0) { onGameOver('A'); return true; }
    if (playerTurfs.length === 0) { onGameOver('B'); return true; }
    return false;
  }

  const runAiTurn = useCallback(() => {
    setAiThinking(true);
    setTimeout(() => {
      endTurnAction(world);
      setAiThinking(false);
      showFlash(`Turn ${turnNumber + 1}`);
    }, AI_DELAY_MS);
  }, [world, turnNumber, showFlash]);

  function handleActionSelect(kind: TurfActionKind) {
    if (kind === actionMode) { resetAction(); return; }
    resetAction();
    setActionMode(kind);
  }

  function handleTurfClick(side: 'A' | 'B', index: number) {
    if (!actionMode) return;

    if (actionMode === 'play_card' && side === 'A' && selectedCardId) {
      playCardAction(world, index, selectedCardId);
      resetAction();
      if (checkWin()) return;
      return;
    }

    const isStrike = actionMode === 'direct_strike' || actionMode === 'pushed_strike' || actionMode === 'funded_recruit';
    if (isStrike) {
      if (strikePhase === 'pick-source' && side === 'A') {
        if (!hasToughOnTurf(playerTurfs[index])) return;
        if (actionMode === 'pushed_strike' && turfCurrency(playerTurfs[index]).length === 0) return;
        setSourceTurfIdx(index);
        setStrikePhase('pick-target');
        return;
      }
      if (strikePhase === 'pick-target' && side === 'B' && sourceTurfIdx !== null) {
        if (!hasToughOnTurf(opponentTurfs[index])) return;
        const result = strikeAction(world, actionMode, sourceTurfIdx, index);
        resetAction();
        if (result) {
          const label = actionMode.replace('_', ' ').toUpperCase();
          showFlash(label, 1800);
        }
        if (checkWin()) return;
        return;
      }
    }
  }

  function handleCardClick(card: Card) {
    if (actionMode === 'discard') {
      discardAction(world, card.id);
      resetAction();
      return;
    }
    if (actionMode === 'play_card') {
      setSelectedCardId(card.id);
      return;
    }
    setActionMode('play_card');
    setSelectedCardId(card.id);
  }

  function handleEndTurn() {
    resetAction();
    runAiTurn();
  }

  const playerState = gs?.players.A;
  const hasStrikableSource = playerTurfs.some(hasToughOnTurf);
  const hasStrikableTarget = opponentTurfs.some(hasToughOnTurf);
  const canStrike = hasStrikableSource && hasStrikableTarget;
  const hasCurrencyOnAnyTurf = playerTurfs.some(t => turfCurrency(t).length > 0);
  const exhausted = budget.remaining <= 0;

  const actionButtons: { kind: TurfActionKind; label: string; disabled: boolean }[] = [
    { kind: 'play_card', label: 'Play', disabled: exhausted || hand.length === 0 },
    { kind: 'direct_strike', label: 'Direct Strike', disabled: exhausted || !canStrike },
    { kind: 'pushed_strike', label: 'Pushed Strike', disabled: exhausted || !canStrike || !hasCurrencyOnAnyTurf },
    { kind: 'funded_recruit', label: 'Recruit', disabled: exhausted || !canStrike || !hasCurrencyOnAnyTurf },
  ];

  const promptText = (() => {
    if (actionMode === 'play_card' && !selectedCardId) return 'Select a card from your hand';
    if (actionMode === 'play_card' && selectedCardId) return 'Select a turf to place the card';
    if (actionMode === 'direct_strike' || actionMode === 'pushed_strike' || actionMode === 'funded_recruit') {
      return strikePhase === 'pick-source' ? 'Select your turf to attack from' : 'Select opponent turf to target';
    }
    if (actionMode === 'discard') return 'Select a card to discard';
    return null;
  })();

  return (
    <div className={`game-screen ${sideHand ? 'game-screen-side' : 'game-screen-bottom'}`} data-testid="game-screen">
      <div className="game-hud-bar">
        <span className="game-hud-bar-turn">Turn {turnNumber}</span>
        <span className="game-hud-bar-budget" data-testid="action-budget">
          Actions: {budget.remaining}/{budget.total}
        </span>
        <span className="game-hud-bar-turfs">
          Turfs {playerTurfs.length} vs {opponentTurfs.length}
        </span>
        <span className="game-hud-bar-deck">
          Hand {hand.length} | Deck {playerState?.deck.length ?? 0}
        </span>
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

          {aiThinking && (
            <div className="game-overlay">
              <div className="game-overlay-pill">OPPONENT THINKING...</div>
            </div>
          )}

          <TurfView
            playerTurfs={playerTurfs}
            opponentTurfs={opponentTurfs}
            turnNumber={turnNumber}
            onTurfClick={handleTurfClick}
          />
        </div>

        {promptText && (
          <div className="game-prompt">
            <span className="game-prompt-text">{promptText}</span>
            <button className="game-prompt-cancel" onClick={resetAction}>Cancel</button>
          </div>
        )}

        <div className={`game-action-bar ${sideHand ? 'game-action-bar-side' : 'game-action-bar-bottom'}`}>
          {actionButtons.map(({ kind, label, disabled }) => (
            <button
              key={kind}
              className={`game-action-btn ${actionMode === kind ? 'game-action-btn-active' : ''} ${disabled ? 'game-action-btn-disabled' : ''}`}
              onClick={() => !disabled && handleActionSelect(kind)}
              disabled={disabled}
              data-testid={`action-${kind}`}
            >
              {label}
            </button>
          ))}
          <div className="game-action-separator" />
          <button
            className="game-action-btn"
            onClick={handleEndTurn}
            data-testid="action-end_turn"
          >
            End Turn
          </button>
        </div>

        <div className={`game-hand-row ${sideHand ? 'game-hand-row-side' : 'game-hand-row-bottom'}`} data-testid="hand-row">
          {hand.map((card) => (
            <button
              key={card.id}
              className={`game-hand-card ${selectedCardId === card.id ? 'game-hand-card-selected' : ''} ${actionMode === 'discard' ? 'game-hand-card-discard' : ''}`}
              onClick={() => handleCardClick(card)}
              data-testid={`hand-card-${card.id}`}
            >
              <CardComponent card={card} compact={compact} />
            </button>
          ))}
          {hand.length === 0 && (
            <div className="game-hand-empty">No cards in hand</div>
          )}
        </div>
      </div>
    </div>
  );
}
