import type { Position } from '../../sim/turf/types';
import { CrewCard } from '../cards';
import { CardFrame } from '../cards/CardFrame';

interface PositionSlotProps {
  position: Position;
  index: number;
  isPlayer: boolean;
  faceDown?: boolean;
  onClick?: () => void;
}

export function PositionSlot({ position, index: _index, isPlayer, faceDown, onClick }: PositionSlotProps) {
  if (faceDown) {
    return (
      <div
        className="position-slot-back"
        aria-label="Hidden opponent card"
      >
        <CardFrame variant="slot" className="card-frame-svg card-frame-svg-position-back" />
        <span className="position-slot-back-copy">Mean Streets</span>
      </div>
    );
  }

  if (position.seized) {
    return (
      <div
        className="position-slot position-slot-seized"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label="Seized position"
      >
        <CrewCard position={position} isPlayer={isPlayer} />
        <div className="position-slot-seized-overlay">
          <span className="position-slot-seized-stamp">
            SEIZED
          </span>
        </div>
      </div>
    );
  }

  if (!position.crew) {
    return (
      <div
        className={`position-slot-empty ${onClick ? 'position-slot-empty-clickable' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label="Empty position"
      >
        <CardFrame variant="slot" className="card-frame-svg card-frame-svg-position-empty" />
        <span className="position-slot-empty-label">Empty</span>
      </div>
    );
  }

  return (
    <div
      className={`position-slot ${onClick ? 'position-slot-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <CrewCard position={position} isPlayer={isPlayer} />
    </div>
  );
}
