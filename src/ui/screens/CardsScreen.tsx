import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppShell } from '../../platform';
import { loadCollection } from '../../platform/persistence/collection';
import { loadProfile } from '../../platform/persistence/storage';
import { loadCollectibleCards } from '../../sim/cards/catalog';
import type { Card as CardType, DifficultyTier } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';
import { AmbientSilhouetteLayer } from './VisualStage';

interface CardsScreenProps {
  onBack: () => void;
  onStartGame: () => void;
  availableDraws?: number;
  onDraw?: () => void;
}

function loadAllCards(): CardType[] {
  return loadCollectibleCards();
}

export function CardsScreen({
  onBack,
  onStartGame,
  availableDraws = 0,
  onDraw,
}: CardsScreenProps) {
  const { layout } = useAppShell();
  const isPhone = layout.deviceClass === 'phone';
  const catalog = useMemo(() => loadAllCards(), []);
  const [ownedCards, setOwnedCards] = useState<Record<string, CardType>>({});
  const [unlockMap, setUnlockMap] = useState<Record<string, DifficultyTier>>(
    {},
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const allCards = useMemo(
    () => catalog.map((card) => ownedCards[card.id] ?? card),
    [catalog, ownedCards],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCollection(), loadProfile()]).then(([cards, profile]) => {
      if (cancelled) return;
      const nextOwned: Record<string, CardType> = {};
      for (const card of cards) nextOwned[card.id] = card;
      const instances = profile.cardInstances ?? {};
      const nextUnlocks: Record<string, DifficultyTier> = {};
      for (const card of cards) {
        nextUnlocks[card.id] = (instances[card.id]?.unlockDifficulty ??
          'easy') as DifficultyTier;
      }
      setOwnedCards(nextOwned);
      setUnlockMap(nextUnlocks);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = selectedIdx !== null ? allCards[selectedIdx] : null;

  return (
    <div
      className="cards-screen world-screen world-screen-cards"
      data-testid="cards-screen"
    >
      <AmbientSilhouetteLayer variant="street" />
      <div className="cards-hud">
        <button
          type="button"
          className="cards-hud-btn"
          onClick={onBack}
          data-testid="cards-back"
        >
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
        <button
          type="button"
          className="cards-hud-btn cards-hud-play"
          onClick={onStartGame}
        >
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
            <CardComponent
              card={card}
              compact={isPhone}
              unlockDifficulty={unlockMap[card.id]}
            />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="cards-detail-backdrop"
          onClick={() => setSelectedIdx(null)}
        >
          <div className="cards-detail" onClick={(e) => e.stopPropagation()}>
            <CardComponent
              card={selected}
              compact={false}
              unlockDifficulty={unlockMap[selected.id]}
            />
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
