import type { Position } from '../../sim/turf/types';
import { positionPower, positionDefense } from '../../sim/turf/board';
import { ModifierSlot } from './ModifierSlot';

interface CrewCardProps {
  position: Position;
  isPlayer: boolean;
  onSlotDrop?: (slot: string, card: unknown) => void;
}

const AFFILIATION_COLORS: Record<string, string> = {
  'kings-row': 'text-rose-300 border-rose-500/40 bg-rose-950/30',
  'iron-devils': 'text-slate-200 border-slate-400/40 bg-slate-900/40',
  'jade-dragon': 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30',
  'los-diablos': 'text-orange-300 border-orange-500/40 bg-orange-950/30',
  'southside-saints': 'text-amber-300 border-amber-500/40 bg-amber-950/30',
  'the-reapers': 'text-zinc-200 border-zinc-400/40 bg-zinc-900/40',
  'dead-rabbits': 'text-red-200 border-red-400/40 bg-red-950/30',
  'neon-snakes': 'text-lime-300 border-lime-500/40 bg-lime-950/30',
  'black-market': 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-950/30',
  'cobalt-syndicate': 'text-sky-300 border-sky-500/40 bg-sky-950/30',
  freelance: 'text-stone-200 border-stone-400/40 bg-stone-900/40',
};

export function CrewCard({ position, isPlayer: _isPlayer, onSlotDrop: _onSlotDrop }: CrewCardProps) {
  if (!position.crew) {
    return (
      <div className="w-36 h-44 border-2 border-dashed border-stone-600 rounded-lg flex items-center justify-center bg-stone-900/40">
        <span className="text-stone-600 text-xs font-mono tracking-widest">EMPTY</span>
      </div>
    );
  }

  const { crew } = position;
  const power = positionPower(position);
  const defense = positionDefense(position);
  const affiliationTone = AFFILIATION_COLORS[crew.affiliation] ?? 'text-stone-300 border-stone-500/40 bg-stone-900/40';
  const isSeized = position.seized;

  return (
    <div
      className={`w-[188px] h-[252px] rounded-[22px] border flex flex-col select-none overflow-hidden relative
        ${isSeized
          ? 'border-red-700 bg-stone-900/80 opacity-60'
          : 'border-stone-600 bg-stone-800 text-amber-100'
        }`}
      style={{ filter: 'url(#metallic)' }}
      data-testid={`crew-card-${crew.id}`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ filter: 'url(#ragged-edge)' }} />
      <div className="absolute inset-x-0 top-0 h-10 bg-linear-to-r from-stone-950/80 via-stone-700/20 to-stone-950/70" />

      <div className="relative flex-1 flex flex-col px-2.5 py-2">
        <div className="flex items-start justify-between mb-2">
          <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${affiliationTone}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {crew.affiliation.replace(/-/g, ' ')}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-stone-400">
            {crew.archetype}
          </div>
        </div>

        <div className="grid grid-cols-[56px_1fr_56px] gap-1.5">
          <ModifierSlot type="drug" card={position.drugTop} orientation="offense" slotId="drug-top" />
          <div className="flex flex-col items-center justify-center rounded-xl border border-stone-600/80 bg-stone-900/70 min-h-[58px]">
            <span className="text-[10px] font-black tracking-[0.18em] text-stone-400 uppercase">Power</span>
            <span className="text-2xl font-black leading-none text-amber-300">{power}</span>
          </div>
          <ModifierSlot type="weapon" card={position.weaponTop} orientation="offense" slotId="weapon-top" />
        </div>

        <div className="grid grid-cols-[56px_1fr_56px] gap-1.5 mt-1.5">
          <ModifierSlot type="cash" card={position.cashLeft} orientation="offense" slotId="cash-left" />
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-stone-500 bg-stone-700 shadow-[inset_0_0_14px_rgba(0,0,0,0.45)]">
              <span className="text-[10px] font-black tracking-[0.16em] text-stone-100">
                {crew.affiliation.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <ModifierSlot type="cash" card={position.cashRight} orientation="defense" slotId="cash-right" />
        </div>

        <div className="grid grid-cols-[56px_1fr_56px] gap-1.5 mt-1.5">
          <ModifierSlot type="drug" card={position.drugBottom} orientation="defense" slotId="drug-bottom" />
          <div className="flex flex-col items-center justify-center rounded-xl border border-stone-600/80 bg-stone-900/70 min-h-[58px]">
            <span className="text-[10px] font-black tracking-[0.18em] text-stone-400 uppercase">Res</span>
            <span className="text-2xl font-black leading-none text-sky-300">{defense}</span>
          </div>
          <ModifierSlot type="weapon" card={position.weaponBottom} orientation="defense" slotId="weapon-bottom" />
        </div>

        <div className="mt-2 border-t border-stone-600/80 pt-2">
          <div className="text-[15px] font-black leading-tight tracking-[0.06em] text-amber-50 truncate">
            {crew.displayName}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-stone-400">
            <span>{crew.archetype}</span>
            <span>{_isPlayer ? 'Player' : 'Rival'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
