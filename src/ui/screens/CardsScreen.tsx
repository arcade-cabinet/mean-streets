import { useMemo, useRef, useState } from 'react';
import { useAppShell } from '../../platform';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';
import { createRng } from '../../sim/cards/rng';
import type { Card as CardType } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';

interface CardsScreenProps {
  onBack: () => void;
  onStartGame: () => void;
  availableDraws?: number;
  onDraw?: () => void;
}

function loadAllCards(): CardType[] {
  const rng = createRng(42);
  return [
    ...loadToughCards(),
    ...generateWeapons(rng),
    ...generateDrugs(rng),
    ...generateCurrency(),
  ];
}

export function CardsScreen({
  onBack, onStartGame, availableDraws = 0, onDraw,
}: CardsScreenProps) {
  const { layout } = useAppShell();
  const isPhone = layout.deviceClass === 'phone';
  const allCards = useMemo(() => loadAllCards(), []);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const selected = selectedIdx !== null ? allCards[selectedIdx] : null;

  return (
    <div className="cards-screen" data-testid="cards-screen">
      <div className="cards-hud">
        <button type="button" className="cards-hud-btn" onClick={onBack}>
          Back
        </button>
        <span className="cards-hud-title">Collection</span>
        {availableDraws > 0 && (
          <button
            type="button"
            className="cards-hud-btn cards-hud-draw"
            onClick={onDraw}
            data-testid="draw-button"
          >
            Draw ({availableDraws})
          </button>
        )}
        <button type="button" className="cards-hud-btn cards-hud-play" onClick={onStartGame}>
          Play
        </button>
      </div>

      <div
        className={`cards-gallery ${isPhone ? 'cards-gallery-phone' : ''}`}
        ref={galleryRef}
      >
        {allCards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className={`cards-gallery-item ${selectedIdx === i ? 'cards-gallery-item-selected' : ''}`}
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            data-testid={`card-${card.id}`}
          >
            <CardComponent card={card} compact={isPhone} />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="cards-detail-backdrop"
          onClick={() => setSelectedIdx(null)}
        >
          <div className="cards-detail" onClick={e => e.stopPropagation()}>
            <CardComponent card={selected} compact={false} />
            <button
              type="button"
              className="cards-detail-close"
              onClick={() => setSelectedIdx(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
