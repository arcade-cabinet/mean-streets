import type { Position } from '../../sim/turf/types';
import { PositionSlot } from './PositionSlot';
import { StreetDivider } from './StreetDivider';

interface BoardLayoutProps {
  playerPositions: Position[];
  opponentPositions: Position[];
  phase: string;
  roundNumber: number;
  faceDown?: boolean;
  onPositionClick?: (side: 'A' | 'B', index: number) => void;
}

export function BoardLayout({
  playerPositions,
  opponentPositions,
  phase,
  roundNumber,
  faceDown,
  onPositionClick,
}: BoardLayoutProps) {
  return (
    <div className="board-layout">
      <div className="board-layout-row board-layout-row-opponent">
        {opponentPositions.map((pos, i) => (
          <PositionSlot
            key={i}
            position={pos}
            index={i}
            isPlayer={false}
            faceDown={faceDown}
            onClick={onPositionClick ? () => onPositionClick('B', i) : undefined}
          />
        ))}
      </div>

      <StreetDivider phase={phase} roundNumber={roundNumber} />

      <div className="board-layout-row board-layout-row-player">
        {playerPositions.map((pos, i) => (
          <PositionSlot
            key={i}
            position={pos}
            index={i}
            isPlayer={true}
            onClick={onPositionClick ? () => onPositionClick('A', i) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
