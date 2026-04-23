import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppShell } from '../../platform';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import { loadCollectibleCards } from '../../sim/cards/catalog';
import type { Card as CardType, Rarity } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';
import { AmbientSilhouetteLayer, ContrabandProp } from './VisualStage';

const DEFAULT_PACK_CARD_IDS = [
  'card-001',
  'weap-01',
  'drug-10',
  'currency-1000',
  'mythic-01',
] as const;

const DEFAULT_OWNED_CARD_IDS = ['card-001', 'currency-1000'] as const;

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

interface PackOpeningScreenProps {
  onBack: () => void;
  cards?: CardType[];
  ownedCardIds?: Iterable<string>;
  initialPhase?: Phase;
}

type Phase = 'sealed' | 'revealing' | 'summary';

function revealedForPhase(length: number, phase: Phase): boolean[] {
  return Array.from(
    { length },
    (_, index) => phase === 'summary' || (phase === 'revealing' && index === 0),
  );
}

export function loadPackOpeningFixtureCards(): CardType[] {
  const cardsById = new Map(
    loadCollectibleCards().map((card) => [card.id, card] as const),
  );
  return DEFAULT_PACK_CARD_IDS.map((id) => {
    const card = cardsById.get(id);
    if (!card) {
      throw new Error(`Missing pack-opening fixture card: ${id}`);
    }
    return card;
  });
}

export const PACK_OPENING_FIXTURE_OWNED_IDS = [...DEFAULT_OWNED_CARD_IDS];

export function PackOpeningScreen({
  onBack,
  cards,
  ownedCardIds,
  initialPhase = 'sealed',
}: PackOpeningScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const packCards = useMemo(
    () => cards ?? loadPackOpeningFixtureCards(),
    [cards],
  );
  const ownedIds = useMemo(
    () => new Set(ownedCardIds ?? PACK_OPENING_FIXTURE_OWNED_IDS),
    [ownedCardIds],
  );

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [revealIdx, setRevealIdx] = useState(() =>
    initialPhase === 'sealed' ? -1 : 0,
  );
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    revealedForPhase(packCards.length, initialPhase),
  );
  const packResetKey = useMemo(
    () => `${initialPhase}:${packCards.map((card) => card.id).join('|')}`,
    [initialPhase, packCards],
  );
  const lastPackResetKey = useRef(packResetKey);

  useEffect(() => {
    if (lastPackResetKey.current === packResetKey) return;
    lastPackResetKey.current = packResetKey;
    setPhase(initialPhase);
    setRevealIdx(initialPhase === 'sealed' ? -1 : 0);
    setRevealed(revealedForPhase(packCards.length, initialPhase));
  }, [packCards.length, packResetKey, initialPhase]);

  const currentCard =
    revealIdx >= 0 && revealIdx < packCards.length
      ? packCards[revealIdx]
      : null;
  const allRevealed = revealed.length > 0 && revealed.every(Boolean);

  const revealNext = useCallback(() => {
    const nextIdx = revealIdx + 1;
    if (nextIdx >= packCards.length) {
      setPhase('summary');
      return;
    }
    setRevealIdx(nextIdx);
    setRevealed((prev) => {
      const next = [...prev];
      next[nextIdx] = true;
      return next;
    });
  }, [revealIdx, packCards.length]);

  const handleOpenPack = useCallback(() => {
    if (packCards.length === 0) {
      setPhase('summary');
      return;
    }
    setPhase('revealing');
    setRevealIdx(0);
    setRevealed(
      Array.from({ length: packCards.length }, (_, index) => index === 0),
    );
  }, [packCards.length]);

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

  const isNew = useCallback(
    (card: CardType) => !ownedIds.has(card.id),
    [ownedIds],
  );

  const rarityStats = useMemo(() => {
    const counts: Record<Rarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      legendary: 0,
      mythic: 0,
    };
    for (const c of packCards) counts[c.rarity]++;
    return counts;
  }, [packCards]);

  const newCount = useMemo(
    () => packCards.filter((c) => isNew(c)).length,
    [packCards, isNew],
  );
  const dropTag = useMemo(
    () => `MS-${packCards.length}-M${rarityStats.mythic}-N${newCount}`,
    [newCount, packCards.length, rarityStats.mythic],
  );
  const currentCardType = useMemo(
    () =>
      currentCard
        ? currentCard.kind === 'tough'
          ? currentCard.archetype
          : currentCard.kind === 'currency'
            ? `$${currentCard.denomination}`
            : currentCard.category
        : '',
    [currentCard],
  );

  if (phase === 'sealed') {
    return (
      <main
        className="pack-screen world-screen world-screen-spoils"
        data-testid="pack-opening-screen"
        aria-label="Pack Opening"
      >
        <AmbientSilhouetteLayer variant="spoils" />
        <header className="pack-header">
          <button
            className="pack-back-btn"
            onClick={onBack}
            aria-label="Back"
            data-testid="pack-back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="pack-kicker">Street Reward</p>
            <h1 className="pack-title">Crack the Drop</h1>
          </div>
        </header>
        <aside className="pack-case-file" aria-label="Sealed drop manifest">
          <p className="pack-case-file-label">Case File</p>
          <dl>
            <div>
              <dt>Drop Tag</dt>
              <dd>{dropTag}</dd>
            </div>
            <div>
              <dt>Contents</dt>
              <dd>{packCards.length} sealed pulls</dd>
            </div>
            <div>
              <dt>Chain</dt>
              <dd>Unbroken</dd>
            </div>
          </dl>
        </aside>
        <div className="pack-sealed-stage">
          <div
            className="pack-stage-props pack-stage-props-left"
            aria-hidden="true"
          >
            <ContrabandProp asset="wallet" />
            <ContrabandProp asset="pillBottle" />
          </div>
          <button
            className="pack-sealed-box"
            onClick={handleOpenPack}
            data-testid="pack-open-btn"
            aria-label="Crack open reward drop"
          >
            <div className="pack-sealed-glow" aria-hidden="true" />
            <ContrabandProp asset="duffel" className="pack-drop-duffel" />
            <ContrabandProp asset="evidenceBag" className="pack-drop-bag" />
            <ContrabandProp asset="cash" className="pack-drop-cash" />
            <Sparkles size={42} className="pack-sealed-icon" />
            <span className="pack-sealed-stamp">
              Evidence {packCards.length.toString().padStart(2, '0')}
            </span>
            <span className="pack-sealed-label">Tap to Crack</span>
          </button>
          <div
            className="pack-stage-props pack-stage-props-right"
            aria-hidden="true"
          >
            <ContrabandProp asset="drugBag" />
            <ContrabandProp asset="moneyClip" />
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'revealing' && currentCard) {
    return (
      <main
        className="pack-screen world-screen world-screen-spoils"
        data-testid="pack-opening-screen"
        aria-label="Pack Opening"
      >
        <AmbientSilhouetteLayer variant="spoils" />
        <header className="pack-header">
          <button
            className="pack-back-btn"
            onClick={onBack}
            aria-label="Back"
            data-testid="pack-back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="pack-kicker">Evidence Pull</p>
            <h1 className="pack-title">
              Pull {revealIdx + 1} / {packCards.length}
            </h1>
          </div>
        </header>
        <div
          className="pack-reveal-stage"
          onClick={handleAdvance}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleAdvance();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={allRevealed ? 'View pack summary' : 'Reveal next card'}
          data-testid="pack-reveal-stage"
        >
          <aside
            className="pack-reveal-dossier"
            aria-live="polite"
            aria-label="Evidence dossier"
          >
            <p>Evidence {revealIdx + 1}</p>
            <h2>{currentCard.name}</h2>
            <dl>
              <div>
                <dt>Grade</dt>
                <dd>{RARITY_LABELS[currentCard.rarity]}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{currentCardType}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{isNew(currentCard) ? 'Fresh lead' : 'Filed piece'}</dd>
              </div>
            </dl>
          </aside>
          <div className="pack-reveal-table" aria-hidden="true">
            <ContrabandProp asset="burner" />
            <ContrabandProp asset="knuckles" />
            <ContrabandProp asset="brickKilo" />
          </div>
          <div
            className={`pack-reveal-card pack-reveal-enter pack-rarity-frame-${currentCard.rarity}`}
            key={currentCard.id + revealIdx}
            data-testid={`pack-reveal-card-${revealIdx}`}
          >
            <CardComponent card={currentCard} compact={compact} />
            {isNew(currentCard) && (
              <span className="pack-new-badge" data-testid="pack-new-badge">
                NEW
              </span>
            )}
          </div>
          <div className="pack-reveal-hint">
            {allRevealed ? (
              <span>Tap to view summary</span>
            ) : (
              <span>
                Tap for next card <ChevronRight size={16} />
              </span>
            )}
          </div>
        </div>
        <div className="pack-pips" aria-label="Reveal progress">
          {packCards.map((c, i) => (
            <span
              key={c.id + i}
              className={`pack-pip ${revealed[i] ? `pack-pip-revealed pack-pip-${c.rarity}` : ''} ${i === revealIdx ? 'pack-pip-current' : ''}`}
              aria-label={
                revealed[i]
                  ? `Card ${i + 1}: ${c.rarity}`
                  : `Card ${i + 1}: hidden`
              }
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      className="pack-screen world-screen world-screen-spoils"
      data-testid="pack-opening-screen"
      aria-label="Pack Opening"
    >
      <AmbientSilhouetteLayer variant="spoils" />
      <header className="pack-header">
        <button
          className="pack-back-btn"
          onClick={onBack}
          aria-label="Back"
          data-testid="pack-back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="pack-kicker">After-Action Payout</p>
          <h1 className="pack-title">Street Spoils</h1>
        </div>
      </header>
      <section className="pack-summary-table" aria-label="Evidence table">
        <div className="pack-summary-table-header">
          <p>Evidence Table</p>
          <span>{dropTag}</span>
        </div>
        <div className="pack-summary-props" aria-hidden="true">
          <ContrabandProp asset="wallet" />
          <ContrabandProp asset="syringe" />
          <ContrabandProp asset="herbBag" />
        </div>
        <div className="pack-summary-stats" data-testid="pack-summary-stats">
          {newCount > 0 && (
            <span className="pack-stat pack-stat-new">{newCount} New</span>
          )}
          {rarityStats.mythic > 0 && (
            <span className="pack-stat pack-stat-mythic">
              {rarityStats.mythic} Mythic
            </span>
          )}
          {rarityStats.legendary > 0 && (
            <span className="pack-stat pack-stat-legendary">
              {rarityStats.legendary} Legendary
            </span>
          )}
          {rarityStats.rare > 0 && (
            <span className="pack-stat pack-stat-rare">
              {rarityStats.rare} Rare
            </span>
          )}
          {rarityStats.uncommon > 0 && (
            <span className="pack-stat pack-stat-uncommon">
              {rarityStats.uncommon} Uncommon
            </span>
          )}
          {rarityStats.common > 0 && (
            <span className="pack-stat pack-stat-common">
              {rarityStats.common} Common
            </span>
          )}
        </div>
        <section
          className="pack-summary-grid"
          aria-label="Pack cards"
          data-testid="pack-summary-grid"
        >
          {packCards.map((card, i) => (
            <div
              key={card.id + i}
              className={`pack-summary-cell pack-summary-enter-${i}`}
            >
              <CardComponent card={card} compact={compact} />
              {isNew(card) && (
                <span
                  className="pack-new-badge"
                  data-testid={`pack-summary-new-${i}`}
                >
                  NEW
                </span>
              )}
              <span className="pack-summary-ledger">
                Bag {i + 1} / {RARITY_LABELS[card.rarity]} /{' '}
                {isNew(card) ? 'Fresh' : 'Filed'}
              </span>
            </div>
          ))}
        </section>
      </section>
      <div className="pack-summary-actions">
        <button
          className="pack-done-btn"
          onClick={onBack}
          data-testid="pack-done-btn"
        >
          Done
        </button>
      </div>
    </main>
  );
}
