import type { CrewCard, ModifierCard } from '../../sim/turf/types';

interface DeckSummaryProps {
  selectedCrew: CrewCard[];
  selectedModifiers: ModifierCard[];
}

function modName(m: ModifierCard): string {
  if (m.type === 'weapon') return m.name;
  if (m.type === 'product') return m.name;
  return `$${m.denomination}`;
}

export function DeckSummary({ selectedCrew, selectedModifiers }: DeckSummaryProps) {
  const weapons = selectedModifiers.filter(m => m.type === 'weapon');
  const drugs = selectedModifiers.filter(m => m.type === 'product');
  const cash = selectedModifiers.filter(m => m.type === 'cash');
  const crewFull = selectedCrew.length >= 25;
  const modFull = selectedModifiers.length >= 25;

  return (
    <div className="h-full flex flex-col gap-3 p-4 bg-stone-900 border-l border-stone-700 overflow-y-auto">
      <h2 className="text-amber-400 font-bold text-sm tracking-widest uppercase">Deck</h2>
      <div className="flex gap-3">
        <div className={`flex-1 rounded px-3 py-2 text-center border ${crewFull ? 'bg-green-900/40 border-green-700' : 'bg-stone-800 border-stone-600'}`}>
          <div className={`text-lg font-bold ${crewFull ? 'text-green-400' : 'text-amber-300'}`}>{selectedCrew.length}/25</div>
          <div className="text-stone-400 text-xs">Crew</div>
        </div>
        <div className={`flex-1 rounded px-3 py-2 text-center border ${modFull ? 'bg-green-900/40 border-green-700' : 'bg-stone-800 border-stone-600'}`}>
          <div className={`text-lg font-bold ${modFull ? 'text-green-400' : 'text-amber-300'}`}>{selectedModifiers.length}/25</div>
          <div className="text-stone-400 text-xs">Mods</div>
        </div>
      </div>
      {selectedCrew.length > 0 && (
        <div>
          <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Crew</p>
          <ul className="space-y-0.5">{selectedCrew.map(c => <li key={c.id} className="text-amber-100 text-xs truncate">{c.displayName}</li>)}</ul>
        </div>
      )}
      {weapons.length > 0 && (
        <div>
          <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Weapons ({weapons.length})</p>
          <ul className="space-y-0.5">{weapons.map(m => <li key={m.id} className="text-red-300 text-xs truncate">{modName(m)}</li>)}</ul>
        </div>
      )}
      {drugs.length > 0 && (
        <div>
          <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Drugs ({drugs.length})</p>
          <ul className="space-y-0.5">{drugs.map(m => <li key={m.id} className="text-purple-300 text-xs truncate">{modName(m)}</li>)}</ul>
        </div>
      )}
      {cash.length > 0 && (
        <div>
          <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Cash ({cash.length})</p>
          <ul className="space-y-0.5">{cash.map(m => <li key={m.id} className="text-green-300 text-xs truncate">{modName(m)}</li>)}</ul>
        </div>
      )}
      {selectedCrew.length === 0 && selectedModifiers.length === 0 && (
        <p className="text-stone-600 text-xs text-center mt-4">No cards selected</p>
      )}
    </div>
  );
}
