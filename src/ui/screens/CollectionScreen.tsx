import { useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../../platform';
import { ArrowLeft } from 'lucide-react';
import { loadCollection } from '../../platform/persistence/collection';
import { loadProfile } from '../../platform/persistence/storage';
import { loadCollectibleCards } from '../../sim/cards/catalog';
import type {
  Card as CardType,
  CardCategory,
  DifficultyTier,
  Rarity,
} from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';

type CategoryFilter = 'all' | CardCategory;

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tough', label: 'Toughs' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'drug', label: 'Drugs' },
  { id: 'currency', label: 'Cash' },
];

const RARITY_FILTERS: { id: Rarity | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'common', label: 'Common' },
  { id: 'uncommon', label: 'Uncommon' },
  { id: 'rare', label: 'Rare' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'mythic', label: 'Mythic' },
];

interface CollectionScreenProps {
  onBack: () => void;
  onPlay?: () => void;
}

function loadFullCatalog(): CardType[] {
  return loadCollectibleCards();
}

function countByCategory(cards: CardType[]): Record<CardCategory, number> {
  const counts: Record<CardCategory, number> = {
    tough: 0,
    weapon: 0,
    drug: 0,
    currency: 0,
  };
  for (const c of cards) counts[c.kind]++;
  return counts;
}

function countByRarity(cards: CardType[]): Record<Rarity, number> {
  const counts: Record<Rarity, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    legendary: 0,
    mythic: 0,
  };
  for (const c of cards) counts[c.rarity]++;
  return counts;
}

export function CollectionScreen({ onBack, onPlay }: CollectionScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';

  const catalog = useMemo(loadFullCatalog, []);
  const catalogIds = useMemo(
    () => new Set(catalog.map((c) => c.id)),
    [catalog],
  );
  const [ownedCards, setOwnedCards] = useState<Record<string, CardType>>({});
  const [unlockMap, setUnlockMap] = useState<Record<string, DifficultyTier>>(
    {},
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCollection(), loadProfile()]).then(([cards, profile]) => {
      if (cancelled) return;
      if (cards.length === 0) return;
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

  const mergedCatalog = useMemo(
    () => catalog.map((card) => ownedCards[card.id] ?? card),
    [catalog, ownedCards],
  );

  const filtered = useMemo(() => {
    return mergedCatalog.filter((c) => {
      if (categoryFilter !== 'all' && c.kind !== categoryFilter) return false;
      if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false;
      return true;
    });
  }, [mergedCatalog, categoryFilter, rarityFilter]);

  const ownedCount = [...catalogIds].filter((id) => ownedCards[id] != null)
    .length;
  const categoryCounts = useMemo(
    () => countByCategory(mergedCatalog),
    [mergedCatalog],
  );
  const rarityCounts = useMemo(
    () => countByRarity(mergedCatalog),
    [mergedCatalog],
  );

  return (
    <main
      className="coll-screen"
      data-testid="collection-screen"
      aria-label="Card Collection"
    >
      <header className="coll-header">
        <button
          className="coll-back-btn"
          onClick={onBack}
          aria-label="Back to menu"
          data-testid="collection-back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="coll-title">Collection</h1>
        <div className="coll-progress" data-testid="collection-progress">
          <span className="coll-progress-count">
            {ownedCount} / {catalog.length}
          </span>
          <span className="coll-progress-label">unlocked</span>
        </div>
        {onPlay && (
          <button
            className="coll-play-btn"
            onClick={onPlay}
            data-testid="collection-play"
          >
            Play
          </button>
        )}
      </header>

      <div className="coll-summary" data-testid="collection-summary">
        <span className="coll-summary-item coll-summary-tough">
          {categoryCounts.tough} toughs
        </span>
        <span className="coll-summary-sep" aria-hidden="true">
          /
        </span>
        <span className="coll-summary-item coll-summary-weapon">
          {categoryCounts.weapon} weapons
        </span>
        <span className="coll-summary-sep" aria-hidden="true">
          /
        </span>
        <span className="coll-summary-item coll-summary-drug">
          {categoryCounts.drug} drugs
        </span>
        <span className="coll-summary-sep" aria-hidden="true">
          /
        </span>
        <span className="coll-summary-item coll-summary-currency">
          {categoryCounts.currency} cash
        </span>
      </div>

      <nav className="coll-filters" aria-label="Collection filters">
        <div className="coll-filter-row">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`coll-filter-btn ${categoryFilter === tab.id ? 'coll-filter-btn-active' : ''}`}
              data-testid={`coll-cat-${tab.id}`}
              aria-pressed={categoryFilter === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="coll-filter-row coll-filter-row-rarity">
          {RARITY_FILTERS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRarityFilter(r.id)}
              className={`coll-filter-btn coll-rarity-btn ${rarityFilter === r.id ? 'coll-filter-btn-active' : ''} ${r.id !== 'all' ? `coll-rarity-${r.id}` : ''}`}
              data-testid={`coll-rarity-${r.id}`}
              aria-pressed={rarityFilter === r.id}
            >
              {r.label}
              {r.id !== 'all' && (
                <span className="coll-rarity-count">
                  ({rarityCounts[r.id]})
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="coll-count" data-testid="collection-filtered-count">
        {filtered.length} {filtered.length === 1 ? 'card' : 'cards'}
      </div>

      <section className="coll-grid" aria-label="Card grid">
        {filtered.map((card) => {
          const owned = ownedCards[card.id] != null;
          return (
            <div
              key={card.id}
              className={`coll-grid-cell ${owned ? '' : 'coll-grid-cell-locked'}`}
            >
              <CardComponent
                card={card}
                compact={compact}
                unlockDifficulty={unlockMap[card.id]}
              />
              {!owned && <div className="coll-locked-overlay" />}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="coll-empty" data-testid="collection-empty">
            No cards match the current filters.
          </div>
        )}
      </section>
    </main>
  );
}
