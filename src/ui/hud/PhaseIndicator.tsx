import type { GamePhase } from '../../sim/turf/types';

interface PhaseIndicatorProps {
  phase: GamePhase | undefined;
  turnNumber: number;
}

export function PhaseIndicator({ phase, turnNumber }: PhaseIndicatorProps) {
  const label = phase === 'combat' ? 'COMBAT' : 'BUILDUP';
  const toneClass = phase === 'combat' ? 'game-phase-combat' : 'game-phase-buildup';

  return (
    <div className="game-phase">
      <span className={`game-phase-label ${toneClass}`}>
        {label}
      </span>
      <span className="game-phase-round">
        R{turnNumber}
      </span>
    </div>
  );
}
