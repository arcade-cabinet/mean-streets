import type { ModifierCard } from '../../sim/turf/types';

interface QuarterCardProps {
  card: ModifierCard;
  orientation?: 'offense' | 'defense';
  compact?: boolean;
}

const WEAPON_CLASSES = 'bg-slate-700 border border-slate-500 text-slate-100';
const DRUG_CLASSES   = 'bg-purple-900/80 border border-purple-700 text-purple-100';
const CASH_CLASSES   = 'bg-amber-900/80 border border-amber-600 text-amber-100';

export function QuarterCard({ card, orientation, compact = false }: QuarterCardProps) {
  if (card.type === 'cash') {
    const label = card.denomination === 1000 ? '$1,000' : '$100';
    return (
      <div
        className={`${CASH_CLASSES} rounded ${compact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} font-bold`}
        style={{ filter: 'url(#grime)' }}
      >
        {label}
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
          className={`${WEAPON_CLASSES} rounded px-1 py-0.5 text-[10px] font-semibold truncate`}
          style={{ filter: 'url(#grime)' }}
          title={card.name}
        >
          {card.name} <span className="font-bold">+{card.bonus}</span>
        </div>
      );
    }

    return (
      <div
        className={`${WEAPON_CLASSES} rounded px-2 py-1 text-xs space-y-0.5`}
        style={{ filter: 'url(#grime)' }}
      >
        <div className="flex justify-between items-center">
          <span className="font-bold truncate">{card.name}</span>
          <span className="font-mono font-bold ml-1">+{card.bonus}</span>
        </div>
        <div className="text-slate-400 uppercase tracking-wide text-[9px]">{card.category}</div>
        {abilityText && (
          <div className="text-slate-300 text-[9px] leading-tight">{abilityText}</div>
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
        className={`${DRUG_CLASSES} rounded px-1 py-0.5 text-[10px] font-semibold truncate`}
        style={{ filter: 'url(#grime)' }}
        title={card.name}
      >
        {card.name} <span className="font-bold">{card.potency}</span>
      </div>
    );
  }

  return (
    <div
      className={`${DRUG_CLASSES} rounded px-2 py-1 text-xs space-y-0.5`}
      style={{ filter: 'url(#grime)' }}
    >
      <div className="flex justify-between items-center">
        <span className="font-bold truncate">{card.name}</span>
        <span className="font-mono font-bold ml-1">{card.potency}</span>
      </div>
      <div className="text-purple-400 uppercase tracking-wide text-[9px]">{card.category}</div>
      {abilityText && (
        <div className="text-purple-300 text-[9px] leading-tight">{abilityText}</div>
      )}
    </div>
  );
}
