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
    <div className="deck-summary">
      <h2 className="deck-summary-title">Deck</h2>
      <div className="deck-summary-meters">
        <div className={`deck-summary-meter ${crewFull ? 'deck-summary-meter-complete' : ''}`}>
          <div className={`deck-summary-meter-value ${crewFull ? 'deck-summary-meter-value-complete' : ''}`}>{selectedCrew.length}/25</div>
          <div className="deck-summary-meter-label">Crew</div>
        </div>
        <div className={`deck-summary-meter ${modFull ? 'deck-summary-meter-complete' : ''}`}>
          <div className={`deck-summary-meter-value ${modFull ? 'deck-summary-meter-value-complete' : ''}`}>{selectedModifiers.length}/25</div>
          <div className="deck-summary-meter-label">Mods</div>
        </div>
      </div>
      {selectedCrew.length > 0 && (
        <div className="deck-summary-section">
          <p className="deck-summary-section-title">Crew</p>
          <ul className="deck-summary-list">{selectedCrew.map(c => <li key={c.id} className="deck-summary-item deck-summary-item-crew">{c.displayName}</li>)}</ul>
        </div>
      )}
      {weapons.length > 0 && (
        <div className="deck-summary-section">
          <p className="deck-summary-section-title">Weapons ({weapons.length})</p>
          <ul className="deck-summary-list">{weapons.map(m => <li key={m.id} className="deck-summary-item deck-summary-item-weapon">{modName(m)}</li>)}</ul>
        </div>
      )}
      {drugs.length > 0 && (
        <div className="deck-summary-section">
          <p className="deck-summary-section-title">Drugs ({drugs.length})</p>
          <ul className="deck-summary-list">{drugs.map(m => <li key={m.id} className="deck-summary-item deck-summary-item-drug">{modName(m)}</li>)}</ul>
        </div>
      )}
      {cash.length > 0 && (
        <div className="deck-summary-section">
          <p className="deck-summary-section-title">Cash ({cash.length})</p>
          <ul className="deck-summary-list">{cash.map(m => <li key={m.id} className="deck-summary-item deck-summary-item-cash">{modName(m)}</li>)}</ul>
        </div>
      )}
      {selectedCrew.length === 0 && selectedModifiers.length === 0 && (
        <p className="deck-summary-empty">No cards selected</p>
      )}
    </div>
  );
}
