import type { QueuedAction, TurfActionKind } from '../../sim/turf/types';

export type ActionMode =
  | 'play_card'
  | 'retreat'
  | 'modifier_swap'
  | 'send_to_market'
  | 'send_to_holding'
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
 * resolve after End Turn. */
export function QueuedChips({ strikes, onCancel }: QueuedChipsProps) {
  if (strikes.length === 0) return null;
  return (
    <div className="game-queued-chips" data-testid="queued-chips">
      {strikes.map((q, i) => {
        const label =
          q.kind === 'direct_strike' ? 'DIRECT'
          : q.kind === 'pushed_strike' ? 'PUSHED'
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
  canModifierSwap: boolean;
  canSendToMarket: boolean;
  canSendToHolding: boolean;
  canStrike: boolean;
  canPushed: boolean;
  canRecruit: boolean;
  turnEnded: boolean;
  onSelect: (kind: 'draw' | NonNullable<ActionMode>) => void;
  onDiscardPending: () => void;
  onEndTurn: () => void;
  sideHand: boolean;
}

interface BtnSpec {
  mode: NonNullable<ActionMode> | 'draw';
  label: string;
  enabled: boolean;
  badge?: number | string;
  testid: string;
}

export function GameActionBar(props: ActionBarProps) {
  const {
    mode, deckCount, hasPending,
    canDraw, canPlay, canRetreat,
    canModifierSwap, canSendToMarket, canSendToHolding,
    canStrike, canPushed, canRecruit,
    turnEnded, onSelect, onDiscardPending, onEndTurn, sideHand,
  } = props;

  const buttons: BtnSpec[] = [
    { mode: 'draw', label: 'Draw', enabled: canDraw, badge: deckCount, testid: 'action-draw' },
    { mode: 'play_card', label: 'Play', enabled: canPlay, testid: 'action-play_card' },
    { mode: 'retreat', label: 'Retreat', enabled: canRetreat, testid: 'action-retreat' },
    { mode: 'modifier_swap', label: 'Swap', enabled: canModifierSwap, testid: 'action-modifier_swap' },
    { mode: 'send_to_market', label: 'Market', enabled: canSendToMarket, testid: 'action-send_to_market' },
    { mode: 'send_to_holding', label: 'Holding', enabled: canSendToHolding, testid: 'action-send_to_holding' },
    { mode: 'direct_strike', label: 'Direct', enabled: canStrike, testid: 'action-direct_strike' },
    { mode: 'pushed_strike', label: 'Pushed', enabled: canPushed, testid: 'action-pushed_strike' },
    { mode: 'funded_recruit', label: 'Recruit', enabled: canRecruit, testid: 'action-funded_recruit' },
  ];

  return (
    <div
      className={`game-action-bar ${sideHand ? 'game-action-bar-side' : 'game-action-bar-bottom'}`}
    >
      {buttons.map((b) => {
        const active = b.mode !== 'draw' && mode === b.mode;
        const cls =
          `game-action-btn`
          + (active ? ' game-action-btn-active' : '')
          + (!b.enabled ? ' game-action-btn-disabled' : '');
        return (
          <button
            key={b.mode}
            type="button"
            className={cls}
            disabled={!b.enabled}
            onClick={() => b.enabled && onSelect(b.mode)}
            data-testid={b.testid}
          >
            {b.label}
            {b.badge !== undefined && (
              <span className="game-action-btn-badge">{b.badge}</span>
            )}
          </button>
        );
      })}

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

      <div className="game-action-separator" />
      <button
        type="button"
        className={`game-action-btn game-action-btn-end-turn ${turnEnded ? 'game-action-btn-disabled' : ''}`}
        disabled={turnEnded}
        onClick={onEndTurn}
        data-testid="action-end_turn"
      >
        End Turn
      </button>
    </div>
  );
}
