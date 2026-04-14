import { Banknote, FlaskConical, Sword } from 'lucide-react';
import type { CashCard, ProductCard, WeaponCard } from '../../sim/turf/types';
import { CardFrame } from './CardFrame';

type AttachedCard = ProductCard | WeaponCard | CashCard;

interface ModifierBadgeProps {
  card: AttachedCard;
  orientation: 'offense' | 'defense';
}

const BADGE_STYLES = {
  product: {
    shell: 'modifier-badge-product',
    Icon: FlaskConical,
  },
  weapon: {
    shell: 'modifier-badge-weapon',
    Icon: Sword,
  },
  cash: {
    shell: 'modifier-badge-cash',
    Icon: Banknote,
  },
} as const;

function valueText(card: AttachedCard): string {
  if (card.type === 'cash') return `$${card.denomination}`;
  if (card.type === 'product') return `+${card.potency}`;
  return `+${card.bonus}`;
}

function titleText(card: AttachedCard, orientation: 'offense' | 'defense'): string {
  if (card.type === 'cash') return valueText(card);
  const ability = orientation === 'offense' ? card.offenseAbility : card.defenseAbility;
  const text = orientation === 'offense' ? card.offenseAbilityText : card.defenseAbilityText;
  return `${card.name} • ${valueText(card)} • ${ability}: ${text}`;
}

function effectTag(card: AttachedCard, orientation: 'offense' | 'defense'): string | null {
  if (card.type === 'cash') return null;
  return orientation === 'offense' ? card.offenseAbility : card.defenseAbility;
}

export function ModifierBadge({ card, orientation }: ModifierBadgeProps) {
  const style = BADGE_STYLES[card.type];
  const Icon = style.Icon;
  const effect = effectTag(card, orientation);

  return (
    <div
      className={`modifier-badge ${style.shell}`}
      title={titleText(card, orientation)}
    >
      <CardFrame variant="slot" className="card-frame-svg card-frame-svg-badge" />
      <div className="modifier-badge-top">
        <Icon size={11} className="modifier-badge-icon" strokeWidth={2.3} />
        <span className="modifier-badge-orientation">
          {orientation === 'offense' ? 'OFF' : 'DEF'}
        </span>
      </div>

      <div className="modifier-badge-bottom">
        <span className="modifier-badge-value">
          {valueText(card)}
        </span>
        {effect && (
          <span className="modifier-badge-effect">
            {effect}
          </span>
        )}
      </div>
    </div>
  );
}
