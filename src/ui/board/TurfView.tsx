import { useCallback, useState } from 'react';
import type { Turf } from '../../sim/turf/types';
import { useAppShell } from '../../platform';
import { TurfCompositeCard } from './TurfCompositeCard';
import { StackFanModal } from './StackFanModal';

// v0.3 single-lane UX: ONE active turf per side plus a queued "reserves"
// indicator. Reserves are not tappable — they come out of the queue when
// the active turf is seized. The indicator is a vertical stack of pips
// showing how many reserves remain per side; tapping it opens a read-only
// modal listing the next-up turfs.

interface ReservesIndicatorProps {
  reserves: Turf[];
  side: 'A' | 'B';
  onPeek?: () => void;
}

function ReservesIndicator({ reserves, side, onPeek }: ReservesIndicatorProps) {
  return (
    <button
      type="button"
      className={`turf-reserves turf-reserves-${side}`}
      onClick={onPeek}
      aria-label={`${reserves.length} reserve turf${reserves.length === 1 ? '' : 's'} for ${side === 'A' ? 'you' : 'opponent'}`}
      data-testid={`turf-reserves-${side}`}
    >
      <span className="turf-reserves-count">{reserves.length}</span>
      <span className="turf-reserves-label">RSV</span>
      <span className="turf-reserves-pips" aria-hidden="true">
        {reserves.slice(0, 5).map((t) => (
          <span key={t.id} className="turf-reserves-pip" />
        ))}
        {reserves.length > 5 && <span className="turf-reserves-pip-more">+{reserves.length - 5}</span>}
      </span>
    </button>
  );
}

interface TurfLaneProps {
  turf: Turf | null;
  reserves: Turf[];
  side: 'A' | 'B';
  dimmed?: boolean;
  onTurfClick?: (side: 'A' | 'B') => void;
}

export function TurfLane({ turf, reserves, side, dimmed, onTurfClick }: TurfLaneProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const [fanTurf, setFanTurf] = useState<Turf | null>(null);
  const [peekReserves, setPeekReserves] = useState(false);
  const isOwn = side === 'A';

  const handleClick = useCallback(() => {
    if (!turf) return;
    if (onTurfClick) onTurfClick(side);
    else setFanTurf(turf);
  }, [side, onTurfClick, turf]);

  return (
    <div
      className={`turf-lane ${dimmed ? 'turf-lane-dimmed' : ''} ${side === 'B' ? 'turf-lane-opponent' : 'turf-lane-player'}`}
      data-testid={`turf-lane-${side}`}
    >
      <div className="turf-lane-active">
        {turf ? (
          <TurfCompositeCard
            turf={turf}
            compact={compact}
            isOwn={isOwn}
            onClick={handleClick}
          />
        ) : (
          <div className="turf-lane-empty" data-testid={`turf-lane-empty-${side}`}>
            No active turf
          </div>
        )}
      </div>

      {reserves.length > 0 && (
        <ReservesIndicator
          reserves={reserves}
          side={side}
          onPeek={() => setPeekReserves(true)}
        />
      )}

      {fanTurf && (
        <StackFanModal
          turf={fanTurf}
          open
          isOwn={isOwn}
          onClose={() => setFanTurf(null)}
          showHp
        />
      )}

      {peekReserves && reserves.length > 0 && (
        <div
          className="turf-reserves-peek-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Reserves for ${side === 'A' ? 'you' : 'opponent'}`}
          onClick={() => setPeekReserves(false)}
          data-testid={`reserves-peek-${side}`}
        >
          <div
            className="turf-reserves-peek"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="turf-reserves-peek-header">
              <span>Reserves Queue</span>
              <button
                className="turf-reserves-peek-close"
                onClick={() => setPeekReserves(false)}
                aria-label="Close reserves peek"
              >
                ✕
              </button>
            </header>
            <div className="turf-reserves-peek-list">
              {reserves.map((t, i) => (
                <div key={t.id} className="turf-reserves-peek-row">
                  <span className="turf-reserves-peek-position">#{i + 2}</span>
                  <TurfCompositeCard turf={t} isOwn={isOwn} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Backward-compat: TurfRow renders every turf in a row. Retained for the
 * rare caller that still wants the whole array (e.g. collection preview
 * or historical debug views). New code should prefer <TurfLane>.
 */
interface TurfRowProps {
  turfs: Turf[];
  side: 'A' | 'B';
  dimmed?: boolean;
  onTurfClick?: (side: 'A' | 'B', index: number) => void;
}

export function TurfRow({ turfs, side, dimmed, onTurfClick }: TurfRowProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const [fanTurf, setFanTurf] = useState<Turf | null>(null);
  const isOwn = side === 'A';

  const handleTurfClick = useCallback((turf: Turf, idx: number) => {
    if (onTurfClick) onTurfClick(side, idx);
    else setFanTurf(turf);
  }, [side, onTurfClick]);

  return (
    <>
      <div
        className={`turf-row ${dimmed ? 'turf-row-dimmed' : ''} ${side === 'B' ? 'turf-row-opponent' : 'turf-row-player'}`}
        data-testid={`turf-row-${side}`}
      >
        {turfs.map((turf, i) => (
          <TurfCompositeCard
            key={turf.id}
            turf={turf}
            compact={compact}
            isOwn={isOwn}
            onClick={() => handleTurfClick(turf, i)}
          />
        ))}
      </div>

      {fanTurf && (
        <StackFanModal
          turf={fanTurf}
          open
          isOwn={isOwn}
          onClose={() => setFanTurf(null)}
          showHp
        />
      )}
    </>
  );
}

interface TurfViewProps {
  /** Active-turf/reserves form (v0.3). If provided, `playerTurfs`/`opponentTurfs` are ignored. */
  playerActive?: Turf | null;
  opponentActive?: Turf | null;
  playerReserves?: Turf[];
  opponentReserves?: Turf[];
  /** Legacy form — full arrays per side; splits first entry as active. */
  playerTurfs?: Turf[];
  opponentTurfs?: Turf[];
  turnNumber: number;
  /** Called when a lane is clicked; only fires for the active turf. */
  onLaneClick?: (side: 'A' | 'B') => void;
}

export function TurfView(props: TurfViewProps) {
  const {
    playerActive, opponentActive,
    playerReserves, opponentReserves,
    playerTurfs, opponentTurfs,
    turnNumber, onLaneClick,
  } = props;

  // Prefer the explicit v0.3 props; otherwise split the legacy arrays.
  const pActive = playerActive !== undefined ? playerActive : playerTurfs?.[0] ?? null;
  const oActive = opponentActive !== undefined ? opponentActive : opponentTurfs?.[0] ?? null;
  const pReserves = playerReserves ?? playerTurfs?.slice(1) ?? [];
  const oReserves = opponentReserves ?? opponentTurfs?.slice(1) ?? [];

  return (
    <div className="turf-view" data-testid="turf-view">
      <TurfLane turf={oActive} reserves={oReserves} side="B" dimmed onTurfClick={onLaneClick} />

      <div className="turf-view-divider">
        <div className="turf-view-divider-line" />
        <div className="turf-view-divider-copy">
          <span className="turf-view-divider-phase">combat</span>
          <span className="turf-view-divider-dot">·</span>
          <span>TURN {turnNumber}</span>
        </div>
        <div className="turf-view-divider-line" />
      </div>

      <TurfLane turf={pActive} reserves={pReserves} side="A" onTurfClick={onLaneClick} />
    </div>
  );
}
