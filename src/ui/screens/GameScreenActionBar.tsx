import type { QueuedAction, TurfActionKind } from '../../sim/turf/types';

export type ActionMode =
  | 'play_card'
  | 'retreat'
  | 'direct_strike'
  | 'pushed_strike'
  | 'funded_recruit'
  | null;

export interface ActionButton {
  kind: Exclude<TurfActionKind, 'end_turn' | 'pass' | 'discard'> | 'draw';
  label: string;
  disabled: boolean;
  variant?: 'primary' | 'danger';
}

interface QueuedChipsProps {
  strikes: QueuedAction[];
  onCancel?: (idx: number) => void;
}

/** Row of chips showing already-declared strike / recruit actions for
 * this turn. Placed above the action bar so the player can see what will
 * resolve after End Turn. Cancellation is not wired (sim does not expose
 * dequeue yet); placeholder callback kept for future. */
export function QueuedChips({ strikes, onCancel }: QueuedChipsProps) {
  if (strikes.length === 0) return null;
  return (
    <div className="game-queued-chips" data-testid="queued-chips">
      {strikes.map((q, i) => {
        const label =
          q.kind === 'direct_strike'
            ? 'DIRECT'
            : q.kind === 'pushed_strike'
              ? 'PUSHED'
              : 'RECRUIT';
        return (
          <button
            key={`${q.kind}-${q.turfIdx}-${q.targetTurfIdx}-${i}`}
            type="button"
            className="game-queued-chip"
            onClick={() => onCancel?.(i)}
            aria-label={`Queued ${label} from turf ${q.turfIdx + 1} to turf ${q.targetTurfIdx + 1}`}
            data-testid={`queued-chip-${i}`}
          >
            <span className="game-queued-chip-kind">{label}</span>
            <span className="game-queued-chip-arrow">T{q.turfIdx + 1}→T{q.targetTurfIdx + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ActionBarProps {
  mode: ActionMode;
  deckCount: number;
  hasPending: boolean;
  canDraw: boolean;
  canPlay: boolean;
  canRetreat: boolean;
  canStrike: boolean;
  canPushed: boolean;
  canRecruit: boolean;
  turnEnded: boolean;
  onSelect: (
    kind: 'draw' | 'play_card' | 'retreat' | 'direct_strike' | 'pushed_strike' | 'funded_recruit',
  ) => void;
  onDiscardPending: () => void;
  onEndTurn: () => void;
  sideHand: boolean;
}

export function GameActionBar(props: ActionBarProps) {
  const {
    mode,
    deckCount,
    hasPending,
    canDraw,
    canPlay,
    canRetreat,
    canStrike,
    canPushed,
    canRecruit,
    turnEnded,
    onSelect,
    onDiscardPending,
    onEndTurn,
    sideHand,
  } = props;

  return (
    <div
      className={`game-action-bar ${sideHand ? 'game-action-bar-side' : 'game-action-bar-bottom'}`}
    >
      <button
        type="button"
        className={`game-action-btn ${!canDraw ? 'game-action-btn-disabled' : ''}`}
        disabled={!canDraw}
        onClick={() => canDraw && onSelect('draw')}
        data-testid="action-draw"
      >
        Draw <span className="game-action-btn-badge">{deckCount}</span>
      </button>
      <button
        type="button"
        className={`game-action-btn ${mode === 'play_card' ? 'game-action-btn-active' : ''} ${!canPlay ? 'game-action-btn-disabled' : ''}`}
        disabled={!canPlay}
        onClick={() => canPlay && onSelect('play_card')}
        data-testid="action-play_card"
      >
        Play
      </button>
      {hasPending && (
        <button
          type="button"
          className="game-action-btn game-action-btn-danger"
          onClick={onDiscardPending}
          data-testid="action-discard-pending"
        >
          Discard
        </button>
      )}
      <button
        type="button"
        className={`game-action-btn ${mode === 'retreat' ? 'game-action-btn-active' : ''} ${!canRetreat ? 'game-action-btn-disabled' : ''}`}
        disabled={!canRetreat}
        onClick={() => canRetreat && onSelect('retreat')}
        data-testid="action-retreat"
      >
        Retreat
      </button>
      <button
        type="button"
        className={`game-action-btn ${mode === 'direct_strike' ? 'game-action-btn-active' : ''} ${!canStrike ? 'game-action-btn-disabled' : ''}`}
        disabled={!canStrike}
        onClick={() => canStrike && onSelect('direct_strike')}
        data-testid="action-direct_strike"
      >
        Direct
      </button>
      <button
        type="button"
        className={`game-action-btn ${mode === 'pushed_strike' ? 'game-action-btn-active' : ''} ${!canPushed ? 'game-action-btn-disabled' : ''}`}
        disabled={!canPushed}
        onClick={() => canPushed && onSelect('pushed_strike')}
        data-testid="action-pushed_strike"
      >
        Pushed
      </button>
      <button
        type="button"
        className={`game-action-btn ${mode === 'funded_recruit' ? 'game-action-btn-active' : ''} ${!canRecruit ? 'game-action-btn-disabled' : ''}`}
        disabled={!canRecruit}
        onClick={() => canRecruit && onSelect('funded_recruit')}
        data-testid="action-funded_recruit"
      >
        Recruit
      </button>
      <div className="game-action-separator" />
      <button
        type="button"
        className={`game-action-btn ${turnEnded ? 'game-action-btn-disabled' : ''}`}
        disabled={turnEnded}
        onClick={onEndTurn}
        data-testid="action-end_turn"
      >
        End Turn
      </button>
    </div>
  );
}
