import type { ModifierCard } from '../../sim/turf/types';
import { CardFrame } from './CardFrame';

interface QuarterCardProps {
  card: ModifierCard;
  orientation?: 'offense' | 'defense';
  compact?: boolean;
}

export function QuarterCard({ card, orientation, compact = false }: QuarterCardProps) {
  if (card.type === 'cash') {
    const label = card.denomination === 1000 ? '$1,000' : '$100';
    return (
      <div
        className={`quarter-card quarter-card-grimed quarter-card-cash ${compact ? 'quarter-card-compact' : 'quarter-card-full'}`}
      >
        <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-quarter" />
        <span className="quarter-card-headerline">{label}</span>
      </div>
    );
  }

  if (card.type === 'weapon') {
    const abilityText = orientation === 'offense'
      ? card.offenseAbilityText
      : orientation === 'defense'
        ? card.defenseAbilityText
        : null;

    if (compact) {
      return (
        <div
          className="quarter-card quarter-card-grimed quarter-card-weapon quarter-card-compact"
          title={card.name}
        >
          <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-quarter" />
          <span className="quarter-card-headerline">{card.name} <span className="quarter-card-inline-value">+{card.bonus}</span></span>
        </div>
      );
    }

    return (
      <div
        className="quarter-card quarter-card-grimed quarter-card-weapon quarter-card-full"
      >
        <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-quarter" />
        <div className="quarter-card-top">
          <span className="quarter-card-title">{card.name}</span>
          <span className="quarter-card-value">+{card.bonus}</span>
        </div>
        <div className="quarter-card-meta">{card.category}</div>
        {abilityText && (
          <div className="quarter-card-ability">{abilityText}</div>
        )}
      </div>
    );
  }

  // product / drug
  const abilityText = orientation === 'offense'
    ? card.offenseAbilityText
    : orientation === 'defense'
      ? card.defenseAbilityText
      : null;

  if (compact) {
    return (
      <div
        className="quarter-card quarter-card-grimed quarter-card-drug quarter-card-compact"
        title={card.name}
      >
        <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-quarter" />
        <span className="quarter-card-headerline">{card.name} <span className="quarter-card-inline-value">{card.potency}</span></span>
      </div>
    );
  }

  return (
    <div
      className="quarter-card quarter-card-grimed quarter-card-drug quarter-card-full"
    >
      <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-quarter" />
      <div className="quarter-card-top">
        <span className="quarter-card-title">{card.name}</span>
        <span className="quarter-card-value">{card.potency}</span>
      </div>
      <div className="quarter-card-meta">{card.category}</div>
      {abilityText && (
        <div className="quarter-card-ability">{abilityText}</div>
      )}
    </div>
  );
}
