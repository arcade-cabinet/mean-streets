import type { Position } from '../../sim/turf/types';
import { positionPower, positionDefense } from '../../sim/turf/board';
import { ModifierSlot } from './ModifierSlot';

interface CrewCardProps {
  position: Position;
  isPlayer: boolean;
  onSlotDrop?: (slot: string, card: unknown) => void;
}

const AFFILIATION_COLORS: Record<string, string> = {
  'Eastside': 'text-red-400',
  'Westside': 'text-blue-400',
  'Southside': 'text-green-400',
  'Northside': 'text-yellow-400',
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
  const affiliationColor = AFFILIATION_COLORS[crew.affiliation] ?? 'text-stone-400';
  const isSeized = position.seized;

  return (
    <div
      className={`w-36 h-44 rounded-lg border flex flex-col select-none
        ${isSeized
          ? 'border-red-700 bg-stone-900/80 opacity-60'
          : 'border-stone-600 bg-stone-800 text-amber-100'
        }`}
      style={{ filter: 'url(#metallic)' }}
    >
      {/* Top row: drugTop | Power | weaponTop */}
      <div className="grid grid-cols-3 gap-0.5 p-1 h-[30%]">
        <ModifierSlot type="drug" card={position.drugTop} orientation="offense" />
        <div className="flex items-center justify-center">
          <span className="text-amber-400 font-bold text-base leading-none">{power}</span>
        </div>
        <ModifierSlot type="weapon" card={position.weaponTop} orientation="offense" />
      </div>

      {/* Middle row: cashLeft | Badge | cashRight */}
      <div className="grid grid-cols-3 gap-0.5 px-1 h-[30%]">
        <ModifierSlot type="cash" card={position.cashLeft} orientation="offense" />
        <div className="flex items-center justify-center">
          <div className={`w-8 h-8 rounded-full border-2 border-stone-500 bg-stone-700 flex items-center justify-center`}>
            <span className={`text-[8px] font-bold text-center leading-tight ${affiliationColor}`}>
              {crew.affiliation.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <ModifierSlot type="cash" card={position.cashRight} orientation="defense" />
      </div>

      {/* Bottom row: drugBottom | Resistance | weaponBottom */}
      <div className="grid grid-cols-3 gap-0.5 p-1 h-[30%]">
        <ModifierSlot type="drug" card={position.drugBottom} orientation="defense" />
        <div className="flex items-center justify-center">
          <span className="text-blue-400 font-bold text-base leading-none">{defense}</span>
        </div>
        <ModifierSlot type="weapon" card={position.weaponBottom} orientation="defense" />
      </div>

      {/* Footer: crew name + archetype */}
      <div className="px-1 pb-1 h-[10%] flex flex-col justify-end">
        <div className="border-t border-stone-600 pt-0.5">
          <p className="text-[10px] font-bold text-amber-100 leading-none truncate">
            {crew.displayName}
            <span className="text-stone-400 font-normal"> — {crew.archetype}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
