import { useCallback, useState } from 'react';
import type { Turf } from '../../sim/turf/types';
import { useAppShell } from '../../platform';
import { TurfCompositeCard } from './TurfCompositeCard';
import { StackFanModal } from './StackFanModal';

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

  const handleTurfClick = useCallback((turf: Turf, idx: number) => {
    if (onTurfClick) {
      onTurfClick(side, idx);
    } else {
      setFanTurf(turf);
    }
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
            onClick={() => handleTurfClick(turf, i)}
          />
        ))}
      </div>

      {fanTurf && (
        <StackFanModal
          turf={fanTurf}
          open={fanTurf !== null}
          onClose={() => setFanTurf(null)}
        />
      )}
    </>
  );
}

interface TurfViewProps {
  playerTurfs: Turf[];
  opponentTurfs: Turf[];
  turnNumber: number;
  onTurfClick?: (side: 'A' | 'B', index: number) => void;
}

export function TurfView({ playerTurfs, opponentTurfs, turnNumber, onTurfClick }: TurfViewProps) {
  return (
    <div className="turf-view" data-testid="turf-view">
      <TurfRow turfs={opponentTurfs} side="B" dimmed onTurfClick={onTurfClick} />

      <div className="turf-view-divider">
        <div className="turf-view-divider-line" />
        <div className="turf-view-divider-copy">
          <span className="turf-view-divider-phase">combat</span>
          <span className="turf-view-divider-dot">·</span>
          <span>TURN {turnNumber}</span>
        </div>
        <div className="turf-view-divider-line" />
      </div>

      <TurfRow turfs={playerTurfs} side="A" onTurfClick={onTurfClick} />
    </div>
  );
}
