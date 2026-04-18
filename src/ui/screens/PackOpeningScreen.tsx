import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../../platform';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';
import { addCardsToCollection, loadCollection } from '../../platform/persistence/collection';
import type { Card as CardType, Rarity } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';

const PACK_SIZE = 5;

interface PackOpeningScreenProps {
  onBack: () => void;
}

type Phase = 'sealed' | 'revealing' | 'summary';

const RARITY_ORDER: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4,
};

function buildPackCards(allCards: CardType[]): CardType[] {
  const shuffled = [...allCards].sort(() => Math.random() - 0.5);
  const guaranteed = shuffled.find(c => c.rarity !== 'common');
  const rest = shuffled.filter(c => c !== guaranteed).slice(0, PACK_SIZE - 1);
  const pack = guaranteed ? [guaranteed, ...rest] : shuffled.slice(0, PACK_SIZE);
  return pack.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}

function loadAllCards(): CardType[] {
  return [
    ...loadToughCards(),
    ...generateWeapons(),
    ...generateDrugs(),
    ...generateCurrency(),
  ];
}

export function PackOpeningScreen({ onBack }: PackOpeningScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';

  const allCards = useMemo(loadAllCards, []);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const packCards = useMemo(() => buildPackCards(allCards), [allCards]);

  useEffect(() => {
    loadCollection().then(cards => setOwnedIds(new Set(cards.map(c => c.id))));
  }, []);

  const [phase, setPhase] = useState<Phase>('sealed');
  const [revealIdx, setRevealIdx] = useState(-1);
  const [revealed, setRevealed] = useState<boolean[]>(() => new Array(PACK_SIZE).fill(false));

  const currentCard = revealIdx >= 0 && revealIdx < packCards.length ? packCards[revealIdx] : null;
  const allRevealed = revealed.every(Boolean);

  const revealNext = useCallback(() => {
    const nextIdx = revealIdx + 1;
    if (nextIdx >= packCards.length) {
      setPhase('summary');
      return;
    }
    setRevealIdx(nextIdx);
    setRevealed(prev => {
      const next = [...prev];
      next[nextIdx] = true;
      return next;
    });
  }, [revealIdx, packCards.length]);

  const handleOpenPack = useCallback(() => {
    setPhase('revealing');
    setRevealIdx(0);
    setRevealed(prev => {
      const next = [...prev];
      next[0] = true;
      return next;
    });
  }, []);

  const handleAdvance = useCallback(() => {
    if (phase === 'revealing' && !allRevealed) {
      revealNext();
    } else if (phase === 'revealing' && allRevealed) {
      setPhase('summary');
    }
  }, [phase, allRevealed, revealNext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'sealed') handleOpenPack();
        else if (phase === 'revealing') handleAdvance();
      }
      if (e.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleOpenPack, handleAdvance, onBack]);

  // Save pack cards to collection when fully revealed
  useEffect(() => {
    if (phase === 'summary') {
      addCardsToCollection(packCards).catch(() => {});
    }
  }, [phase, packCards]);

  const isNew = useCallback((card: CardType) => !ownedIds.has(card.id), [ownedIds]);

  const rarityStats = useMemo(() => {
    const counts: Record<Rarity, number> = {
      common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
    };
    for (const c of packCards) counts[c.rarity]++;
    return counts;
  }, [packCards]);

  const newCount = useMemo(
    () => packCards.filter(c => isNew(c)).length,
    [packCards, isNew],
  );

  if (phase === 'sealed') {
    return (
      <main className="pack-screen" data-testid="pack-opening-screen" aria-label="Pack Opening">
        <header className="pack-header">
          <button className="pack-back-btn" onClick={onBack} aria-label="Back" data-testid="pack-back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="pack-title">Open Pack</h1>
        </header>
        <div className="pack-sealed-stage">
          <button
            className="pack-sealed-box"
            onClick={handleOpenPack}
            data-testid="pack-open-btn"
            aria-label="Open pack"
          >
            <div className="pack-sealed-glow" aria-hidden="true" />
            <Sparkles size={48} className="pack-sealed-icon" />
            <span className="pack-sealed-label">Tap to Open</span>
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'revealing' && currentCard) {
    return (
      <main className="pack-screen" data-testid="pack-opening-screen" aria-label="Pack Opening">
        <header className="pack-header">
          <button className="pack-back-btn" onClick={onBack} aria-label="Back" data-testid="pack-back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="pack-title">Card {revealIdx + 1} / {packCards.length}</h1>
        </header>
        <div className="pack-reveal-stage" onClick={handleAdvance} data-testid="pack-reveal-stage">
          <div
            className={`pack-reveal-card pack-reveal-enter pack-rarity-frame-${currentCard.rarity}`}
            key={currentCard.id + revealIdx}
            data-testid={`pack-reveal-card-${revealIdx}`}
          >
            <CardComponent card={currentCard} compact={compact} />
            {isNew(currentCard) && (
              <span className="pack-new-badge" data-testid="pack-new-badge">NEW</span>
            )}
          </div>
          <div className="pack-reveal-hint">
            {allRevealed ? (
              <span>Tap to view summary</span>
            ) : (
              <span>Tap for next card <ChevronRight size={16} /></span>
            )}
          </div>
        </div>
        <div className="pack-pips" aria-label="Reveal progress">
          {packCards.map((c, i) => (
            <span
              key={c.id + i}
              className={`pack-pip ${revealed[i] ? `pack-pip-revealed pack-pip-${c.rarity}` : ''} ${i === revealIdx ? 'pack-pip-current' : ''}`}
              aria-label={revealed[i] ? `Card ${i + 1}: ${c.rarity}` : `Card ${i + 1}: hidden`}
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="pack-screen" data-testid="pack-opening-screen" aria-label="Pack Opening">
      <header className="pack-header">
        <button className="pack-back-btn" onClick={onBack} aria-label="Back" data-testid="pack-back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="pack-title">Pack Contents</h1>
      </header>
      <div className="pack-summary-stats" data-testid="pack-summary-stats">
        {newCount > 0 && <span className="pack-stat pack-stat-new">{newCount} New</span>}
        {rarityStats.mythic > 0 && <span className="pack-stat pack-stat-mythic">{rarityStats.mythic} Mythic</span>}
        {rarityStats.legendary > 0 && <span className="pack-stat pack-stat-legendary">{rarityStats.legendary} Legendary</span>}
        {rarityStats.rare > 0 && <span className="pack-stat pack-stat-rare">{rarityStats.rare} Rare</span>}
        {rarityStats.uncommon > 0 && <span className="pack-stat pack-stat-uncommon">{rarityStats.uncommon} Uncommon</span>}
        {rarityStats.common > 0 && <span className="pack-stat pack-stat-common">{rarityStats.common} Common</span>}
      </div>
      <section className="pack-summary-grid" aria-label="Pack cards" data-testid="pack-summary-grid">
        {packCards.map((card, i) => (
          <div key={card.id + i} className={`pack-summary-cell pack-summary-enter-${i}`}>
            <CardComponent card={card} compact={compact} />
            {isNew(card) && (
              <span className="pack-new-badge" data-testid={`pack-summary-new-${i}`}>NEW</span>
            )}
          </div>
        ))}
      </section>
      <div className="pack-summary-actions">
        <button className="pack-done-btn" onClick={onBack} data-testid="pack-done-btn">
          Done
        </button>
      </div>
    </main>
  );
}
