import type { GamePhase } from '../../sim/turf/types';

interface PhaseIndicatorProps {
  phase: GamePhase | undefined;
  turnNumber: number;
}

export function PhaseIndicator({ phase, turnNumber }: PhaseIndicatorProps) {
  const label = phase === 'combat' ? 'COMBAT' : 'BUILDUP';
  const color = phase === 'combat' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono font-bold text-sm tracking-widest ${color}`}>
        {label}
      </span>
      <span className="text-stone-500 text-xs font-mono">
        R{turnNumber}
      </span>
    </div>
  );
}
