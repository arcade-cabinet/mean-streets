import type { ProductCard, WeaponCard, CashCard } from '../../sim/turf/types';
import { CardFrame } from './CardFrame';
import { ModifierBadge } from './ModifierBadge';

interface ModifierSlotProps {
  type: 'drug' | 'weapon' | 'cash';
  card: ProductCard | WeaponCard | CashCard | null;
  orientation: 'offense' | 'defense';
  slotId: 'drug-top' | 'weapon-top' | 'cash-left' | 'cash-right' | 'drug-bottom' | 'weapon-bottom';
}

const LABEL: Record<string, string> = { drug: 'DRUG', weapon: 'WEAP', cash: 'CASH' };
const ORIENTATION_LABEL: Record<'offense' | 'defense', string> = {
  offense: 'OFF',
  defense: 'DEF',
};

const TONE: Record<string, string> = {
  drug: 'modifier-slot-drug',
  weapon: 'modifier-slot-weapon',
  cash: 'modifier-slot-cash',
};

function cardValue(card: ProductCard | WeaponCard | CashCard): string {
  if (card.type === 'cash') return `$${card.denomination}`;
  if (card.type === 'product') return `+${card.potency}`;
  return `+${card.bonus}`;
}

export function ModifierSlot({ type, card, orientation, slotId }: ModifierSlotProps) {
  const tone = TONE[type];

  if (!card) {
    return (
      <div
        className={`modifier-slot modifier-slot-empty ${tone}`}
        data-slot-id={slotId}
      >
        <CardFrame variant="slot" className="card-frame-svg card-frame-svg-slot" />
        <span className="modifier-slot-label">
          {LABEL[type]}
        </span>
        <span className="modifier-slot-orientation">
          {ORIENTATION_LABEL[orientation]}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`modifier-slot modifier-slot-filled ${tone}`}
      data-slot-id={slotId}
    >
      <CardFrame variant="slot" className="card-frame-svg card-frame-svg-slot" />
      <div className="modifier-slot-badge-wrap">
        <ModifierBadge card={card} orientation={orientation} />
      </div>
      <div className="modifier-slot-value">
        {cardValue(card)}
      </div>
    </div>
  );
}
