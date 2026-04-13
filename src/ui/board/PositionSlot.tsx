import type { Position } from '../../sim/turf/types';
import { CrewCard } from '../cards';

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
        className="w-36 h-44 rounded-lg border border-stone-700 bg-stone-800 flex items-center justify-center cursor-default shrink-0"
        aria-label="Hidden opponent card"
      >
        <span className="text-stone-600 text-xs font-mono tracking-widest rotate-180">MEAN STREETS</span>
      </div>
    );
  }

  if (position.seized) {
    return (
      <div
        className="relative w-36 h-44 shrink-0 cursor-pointer"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label="Seized position"
      >
        <CrewCard position={position} isPlayer={isPlayer} />
        <div className="absolute inset-0 rounded-lg bg-red-900/50 flex items-center justify-center pointer-events-none">
          <span className="text-red-400 text-sm font-black tracking-widest rotate-[-12deg] border-2 border-red-400 px-2 py-0.5">
            SEIZED
          </span>
        </div>
      </div>
    );
  }

  if (!position.crew) {
    return (
      <div
        className={`w-36 h-44 rounded-lg border-2 border-dashed border-stone-700 flex items-center justify-center bg-stone-900/40 shrink-0 ${onClick ? 'cursor-pointer hover:border-amber-700 hover:bg-stone-800/40 transition-colors' : 'cursor-default'}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label="Empty position"
      >
        <span className="text-stone-600 text-xs font-mono tracking-widest">EMPTY</span>
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <CrewCard position={position} isPlayer={isPlayer} />
    </div>
  );
}
