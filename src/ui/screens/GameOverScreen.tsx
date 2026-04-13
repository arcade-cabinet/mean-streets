import type { TurfMetrics } from '../../sim/turf/types';

interface GameOverScreenProps {
  winner: 'A' | 'B';
  metrics: TurfMetrics;
  onPlayAgain: () => void;
}

interface StatRowProps {
  label: string;
  value: number | string;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex justify-between gap-8 text-sm">
      <span className="text-stone-400 uppercase tracking-widest">{label}</span>
      <span className="text-stone-100 font-bold tabular-nums">{value}</span>
    </div>
  );
}

export function GameOverScreen({ winner, metrics, onPlayAgain }: GameOverScreenProps) {
  const isVictory = winner === 'A';

  return (
    <div
      className="h-screen bg-stone-950 flex flex-col items-center justify-center gap-8"
      data-testid="gameover-screen"
    >
      <h1
        className={`text-7xl font-bold tracking-[0.2em] uppercase select-none ${
          isVictory ? 'text-amber-400' : 'text-red-500'
        }`}
      >
        {isVictory ? 'VICTORY' : 'DEFEAT'}
      </h1>

      <div className="bg-stone-900 border border-stone-700 rounded p-6 w-72 flex flex-col gap-3">
        <StatRow label="Rounds" value={metrics.combatRounds} />
        <StatRow label="Kills" value={metrics.kills} />
        <StatRow label="Flips" value={metrics.flips} />
        <StatRow label="Seizures" value={metrics.seizures} />
      </div>

      <button
        onClick={onPlayAgain}
        data-testid="play-again-button"
        className="bg-amber-700 hover:bg-amber-600 text-stone-900 font-bold px-8 py-3 rounded tracking-widest uppercase transition-all shadow-lg shadow-amber-900/40"
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
