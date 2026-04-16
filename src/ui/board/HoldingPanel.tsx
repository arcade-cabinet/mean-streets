/**
 * HoldingPanel — rendering for toughs in custody (voluntary holding +
 * involuntary lockup with countdown).
 *
 * Voluntary holding: toughs are safe from seizure but can't act. No timer.
 * Lockup: seized by cops; `turnsRemaining` counts down to release.
 *
 * Inline on tablet/desktop; modal on phone — parent decides placement.
 * Panel supports both sides: pass `side` to determine which player's
 * holding/lockup to show. For opponent side (B), mark `opponent` so the
 * visual styling flips and no release actions are offered.
 */
import type { ToughInCustody } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';

interface HoldingPanelProps {
  side: 'A' | 'B';
  holding: ToughInCustody[];
  lockup: ToughInCustody[];
  opponent?: boolean;
  /** Optional release-from-holding click (only A). No-op when opponent. */
  onReleaseFromHolding?: (toughId: string) => void;
  /** Compact variant for phone modal or narrow inline slot. */
  compact?: boolean;
}

function CustodyRow({
  entry,
  compact,
  lockedUp,
  onRelease,
}: {
  entry: ToughInCustody;
  compact: boolean;
  lockedUp: boolean;
  onRelease?: () => void;
}) {
  const { tough, attachedModifiers, turnsRemaining } = entry;
  const showClock = lockedUp && typeof turnsRemaining === 'number';

  return (
    <div
      className={`holding-row ${lockedUp ? 'holding-row-lockup' : 'holding-row-holding'}`}
      data-testid={`holding-row-${tough.id}`}
    >
      <div className="holding-row-card">
        <CardComponent card={tough} compact={compact} />
      </div>
      <div className="holding-row-meta">
        <span className="holding-row-name">{tough.name}</span>
        <span className="holding-row-hp">
          HP {tough.hp}/{tough.maxHp}
        </span>
        {attachedModifiers.length > 0 && (
          <span className="holding-row-mods">
            +{attachedModifiers.length} mod{attachedModifiers.length === 1 ? '' : 's'}
          </span>
        )}
        {showClock && (
          <span className="holding-row-clock" data-testid="lockup-countdown">
            {turnsRemaining}T
          </span>
        )}
        {!lockedUp && onRelease && (
          <button
            type="button"
            className="holding-row-release"
            onClick={onRelease}
            aria-label={`Release ${tough.name} from holding`}
            data-testid={`holding-release-${tough.id}`}
          >
            Release
          </button>
        )}
      </div>
    </div>
  );
}

export function HoldingPanel({
  side,
  holding,
  lockup,
  opponent = false,
  onReleaseFromHolding,
  compact = false,
}: HoldingPanelProps) {
  const total = holding.length + lockup.length;

  return (
    <section
      className={`holding-panel ${opponent ? 'holding-panel-opponent' : 'holding-panel-own'} ${compact ? 'holding-panel-compact' : ''}`}
      data-testid={`holding-panel-${side}`}
      aria-label={opponent ? 'Opponent custody' : 'Your custody'}
    >
      <header className="holding-panel-header">
        <span className="holding-panel-title">
          {opponent ? 'Opp Custody' : 'Custody'}
        </span>
        <span className="holding-panel-count">{total}</span>
      </header>

      {total === 0 && (
        <div className="holding-panel-empty">No toughs in custody</div>
      )}

      {holding.length > 0 && (
        <div className="holding-panel-group">
          <div className="holding-panel-group-label">Holding</div>
          {holding.map((entry) => (
            <CustodyRow
              key={entry.tough.id}
              entry={entry}
              compact={compact}
              lockedUp={false}
              onRelease={
                !opponent && onReleaseFromHolding
                  ? () => onReleaseFromHolding(entry.tough.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {lockup.length > 0 && (
        <div className="holding-panel-group">
          <div className="holding-panel-group-label">Lockup</div>
          {lockup.map((entry) => (
            <CustodyRow
              key={entry.tough.id}
              entry={entry}
              compact={compact}
              lockedUp
            />
          ))}
        </div>
      )}
    </section>
  );
}
