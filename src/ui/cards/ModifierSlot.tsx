import type { ProductCard, WeaponCard, CashCard } from '../../sim/turf/types';
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

const COLOR: Record<string, string> = {
  drug: 'border-purple-500 text-purple-300',
  weapon: 'border-slate-400 text-slate-300',
  cash: 'border-amber-400 text-amber-300',
};

const BG: Record<string, string> = {
  drug: 'bg-purple-950/60',
  weapon: 'bg-slate-800/60',
  cash: 'bg-amber-950/60',
};

function cardValue(card: ProductCard | WeaponCard | CashCard): string {
  if (card.type === 'cash') return `$${card.denomination}`;
  if (card.type === 'product') return `+${card.potency}`;
  return `+${card.bonus}`;
}

export function ModifierSlot({ type, card, orientation, slotId }: ModifierSlotProps) {
  const color = COLOR[type];
  const bg = BG[type];

  if (!card) {
    return (
      <div
        className={`relative w-full h-full min-h-[48px] border border-dashed ${color} rounded-md flex items-center justify-center ${bg}`}
        data-slot-id={slotId}
      >
        <span className={`text-[8px] font-mono tracking-[0.22em] opacity-55 ${color.split(' ')[1]}`}>
          {LABEL[type]}
        </span>
        <span className="absolute right-1 top-1 text-[7px] font-black tracking-[0.18em] text-stone-500">
          {ORIENTATION_LABEL[orientation]}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group relative w-full h-full min-h-[48px] border ${color} rounded-md ${bg} overflow-hidden`}
      data-slot-id={slotId}
    >
      <div className="h-full p-0.5">
        <ModifierBadge card={card} orientation={orientation} />
      </div>
      <div className={`absolute bottom-0 left-0 right-0 px-1 py-[2px] text-[7px] font-mono leading-none ${color.split(' ')[1]} bg-stone-950/55 opacity-0 transition-opacity group-hover:opacity-100`}>
        {cardValue(card)}
      </div>
    </div>
  );
}
