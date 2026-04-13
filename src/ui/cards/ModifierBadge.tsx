import { Banknote, FlaskConical, Sword } from 'lucide-react';
import type { CashCard, ProductCard, WeaponCard } from '../../sim/turf/types';

type AttachedCard = ProductCard | WeaponCard | CashCard;

interface ModifierBadgeProps {
  card: AttachedCard;
  orientation: 'offense' | 'defense';
}

const BADGE_STYLES = {
  product: {
    shell: 'border-purple-500/60 bg-purple-950/75 text-purple-100',
    value: 'text-purple-200',
    meta: 'text-purple-300/85',
    Icon: FlaskConical,
  },
  weapon: {
    shell: 'border-slate-400/60 bg-slate-900/80 text-slate-100',
    value: 'text-slate-100',
    meta: 'text-slate-300/85',
    Icon: Sword,
  },
  cash: {
    shell: 'border-amber-400/60 bg-amber-950/75 text-amber-100',
    value: 'text-amber-100',
    meta: 'text-amber-300/90',
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
      className={`group relative flex h-full min-h-[48px] flex-col justify-between rounded-md border px-1.5 py-1 ${style.shell}`}
      title={titleText(card, orientation)}
    >
      <div className="flex items-start justify-between gap-1">
        <Icon size={11} className={style.meta} strokeWidth={2.3} />
        <span className="text-[7px] font-black tracking-[0.18em] text-stone-200/85">
          {orientation === 'offense' ? 'OFF' : 'DEF'}
        </span>
      </div>

      <div className="mt-1 flex items-end justify-between gap-1">
        <span className={`text-[11px] font-black leading-none ${style.value}`}>
          {valueText(card)}
        </span>
        {effect && (
          <span className={`max-w-[38px] truncate text-[7px] font-black leading-none tracking-[0.12em] ${style.meta}`}>
            {effect}
          </span>
        )}
      </div>
    </div>
  );
}
