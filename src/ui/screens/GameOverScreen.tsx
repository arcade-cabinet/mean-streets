import { useEffect } from 'react';
import type { WarOutcome } from '../../sim/packs';
import type { Card, DifficultyTier, TurfMetrics } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';
import { playVictory, playDefeat } from '../audio/sfx';
import { AmbientSilhouetteLayer, ContrabandProp } from './VisualStage';

interface GameOverScreenProps {
  winner: 'A' | 'B';
  metrics: TurfMetrics;
  rewardCards?: Card[];
  rewardOutcome?: WarOutcome | null;
  rewardCurrencyAmount?: number | null;
  rewardUnlockDifficulty?: DifficultyTier;
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

function formatWarOutcome(outcome: WarOutcome): string {
  switch (outcome) {
    case 'perfect':
      return 'Perfect War';
    case 'flawless':
      return 'Flawless War';
    case 'dominant':
      return 'Dominant War';
    case 'won':
      return 'Won War';
  }
}

export function GameOverScreen({
  winner,
  metrics,
  rewardCards = [],
  rewardOutcome = null,
  rewardCurrencyAmount = null,
  rewardUnlockDifficulty,
  onPlayAgain,
}: GameOverScreenProps) {
  const isVictory = winner === 'A';
  const hasRewardSummary =
    rewardOutcome !== null || rewardCurrencyAmount !== null;

  useEffect(() => {
    void (isVictory ? playVictory() : playDefeat());
  }, [isVictory]);

  return (
    <div
      className="gameover-screen world-screen world-screen-gameover"
      data-testid="gameover-screen"
    >
      <AmbientSilhouetteLayer variant="spoils" />
      <div className="gameover-copy">
        <p className="gameover-kicker">Case Closed</p>
        <h1
          className={`gameover-title ${isVictory ? 'gameover-title-victory' : 'gameover-title-defeat'}`}
        >
          {isVictory ? 'Victory' : 'Defeat'}
        </h1>
        <p className="gameover-subtitle">
          {isVictory
            ? 'The block is yours. Count the damage, then step back onto the street.'
            : 'You lost the corner. Study the numbers, reload the crew, and make another run.'}
        </p>
      </div>

      <div className="gameover-panel">
        <StatRow label="Turns" value={metrics.turns} />
        <StatRow label="Kills" value={metrics.kills} />
        <StatRow label="Seizures" value={metrics.seizures} />
        <StatRow
          label="Strikes"
          value={metrics.directStrikes + metrics.pushedStrikes}
        />
        <StatRow label="Recruits" value={metrics.fundedRecruits} />
        <StatRow label="Raids" value={metrics.raids} />
        <StatRow label="Cards Played" value={metrics.cardsPlayed} />
      </div>

      {(hasRewardSummary || rewardCards.length > 0) && (
        <div className="gameover-rewards" data-testid="gameover-rewards">
          <h2 className="gameover-rewards-title">Spoils of War</h2>
          {hasRewardSummary && (
            <div
              className="gameover-reward-summary"
              data-testid="gameover-reward-summary"
            >
              {rewardOutcome && (
                <StatRow
                  label="War Outcome"
                  value={formatWarOutcome(rewardOutcome)}
                />
              )}
              {rewardCurrencyAmount !== null && (
                <StatRow
                  label="Fallback Bounty"
                  value={`$${rewardCurrencyAmount.toLocaleString()}`}
                />
              )}
            </div>
          )}
          {rewardCards.length > 0 && (
            <div className="gameover-rewards-grid">
              {rewardCards.map((card) => (
                <div key={card.id} className="gameover-reward-cell">
                  <CardComponent
                    card={card}
                    compact
                    unlockDifficulty={rewardUnlockDifficulty}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="gameover-spoils-props" aria-hidden="true">
        <ContrabandProp asset="duffel" />
        <ContrabandProp asset="cash" />
        <ContrabandProp asset="evidenceBag" />
      </div>

      <button
        onClick={onPlayAgain}
        data-testid="play-again-button"
        className="menu-button menu-button-primary gameover-button"
      >
        <span className="menu-button-label">Play Again</span>
        <span className="menu-button-detail">
          Build another deck and retake the street.
        </span>
      </button>
    </div>
  );
}
