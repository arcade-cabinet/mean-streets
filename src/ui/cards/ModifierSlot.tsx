import type { ProductCard, WeaponCard, CashCard } from '../../sim/turf/types';

interface ModifierSlotProps {
  type: 'drug' | 'weapon' | 'cash';
  card: ProductCard | WeaponCard | CashCard | null;
  orientation: 'offense' | 'defense';
}

const LABEL: Record<string, string> = { drug: 'DRUG', weapon: 'WEAP', cash: 'CASH' };

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

function cardName(card: ProductCard | WeaponCard | CashCard): string {
  if (card.type === 'cash') return 'CASH';
  return card.name.length > 8 ? card.name.slice(0, 7) + '…' : card.name;
}

export function ModifierSlot({ type, card, orientation: _orientation }: ModifierSlotProps) {
  const color = COLOR[type];
  const bg = BG[type];

  if (!card) {
    return (
      <div className={`w-full h-full border border-dashed ${color} rounded flex items-center justify-center`}>
        <span className={`text-[9px] font-mono tracking-widest opacity-50 ${color.split(' ')[1]}`}>
          {LABEL[type]}
        </span>
      </div>
    );
  }

  return (
    <div className={`w-full h-full border ${color} rounded ${bg} flex flex-col items-center justify-center gap-0.5 px-0.5`}>
      <span className={`text-[8px] font-mono leading-none truncate w-full text-center ${color.split(' ')[1]}`}>
        {cardName(card)}
      </span>
      <span className={`text-[10px] font-bold leading-none ${color.split(' ')[1]}`}>
        {cardValue(card)}
      </span>
    </div>
  );
}
