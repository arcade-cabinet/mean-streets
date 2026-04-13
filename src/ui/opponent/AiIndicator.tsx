import type { AiState } from '../../sim/turf/ai-states';

const STATE_CLASSES: Record<AiState, string> = {
  BUILDING:   'bg-blue-800 text-blue-200',
  AGGRESSIVE: 'bg-red-800 text-red-200',
  DEFENSIVE:  'bg-green-800 text-green-200',
  DESPERATE:  'bg-orange-800 text-orange-200',
};

interface AiIndicatorProps {
  state: AiState;
  isThinking: boolean;
}

export function AiIndicator({ state, isThinking }: AiIndicatorProps) {
  const colorClass = STATE_CLASSES[state] ?? 'bg-stone-700 text-stone-300';
  const label = isThinking ? `${state}...` : state;

  return (
    <div className="absolute top-2 right-2 z-10">
      <span
        className={`
          inline-block px-2 py-0.5 rounded text-xs font-mono font-bold tracking-widest
          ${colorClass}
          ${isThinking ? 'animate-pulse' : ''}
        `}
      >
        {label}
      </span>
    </div>
  );
}
