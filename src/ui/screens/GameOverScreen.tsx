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
    <div className="gameover-stat-row">
      <span className="gameover-stat-label">{label}</span>
      <span className="gameover-stat-value">{value}</span>
    </div>
  );
}

export function GameOverScreen({ winner, metrics, onPlayAgain }: GameOverScreenProps) {
  const isVictory = winner === 'A';

  return (
    <div
      className="gameover-screen"
      data-testid="gameover-screen"
    >
      <div className="gameover-copy">
        <p className="gameover-kicker">Case Closed</p>
        <h1 className={`gameover-title ${isVictory ? 'gameover-title-victory' : 'gameover-title-defeat'}`}>
          {isVictory ? 'Victory' : 'Defeat'}
        </h1>
        <p className="gameover-subtitle">
          {isVictory
            ? 'The block is yours. Count the damage, then step back onto the street.'
            : 'You lost the corner. Study the numbers, reload the crew, and make another run.'}
        </p>
      </div>

      <div className="gameover-panel">
        <StatRow label="Rounds" value={metrics.combatRounds} />
        <StatRow label="Kills" value={metrics.kills} />
        <StatRow label="Flips" value={metrics.flips} />
        <StatRow label="Seizures" value={metrics.seizures} />
      </div>

      <button
        onClick={onPlayAgain}
        data-testid="play-again-button"
        className="menu-button menu-button-primary gameover-button"
      >
        <span className="menu-button-label">Play Again</span>
        <span className="menu-button-detail">Build another deck and retake the street.</span>
      </button>
    </div>
  );
}
