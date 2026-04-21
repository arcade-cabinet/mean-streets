import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type {
  DifficultyTier,
  Rarity,
} from '../../sim/turf/types';
import {
  loadCollectionInventory,
  loadPreferences,
  mergeCollectionBucket,
  savePreferences,
  type CardPreference,
} from '../../platform/persistence/collection';
import {
  BulkRarityBar,
  CardRowItem,
  type CardRow,
} from './CardGarageSubcomponents';
import { collectionPreferenceKey } from '../../sim/turf/deck-builder';

type CategoryGroup = 'tough' | 'weapon' | 'drug' | 'currency';

interface CardGarageScreenProps {
  onBack: () => void;
}

const CATEGORY_ORDER: CategoryGroup[] = ['tough', 'weapon', 'drug', 'currency'];
const CATEGORY_LABELS: Record<CategoryGroup, string> = {
  tough: 'Toughs',
  weapon: 'Weapons',
  drug: 'Drugs',
  currency: 'Cash',
};
const RARITIES: Rarity[] = [
  'mythic',
  'legendary',
  'rare',
  'uncommon',
  'common',
];
const RARITY_ORDER: Record<Rarity, number> = {
  mythic: 0,
  legendary: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

type DifficultyFilter = 'all' | DifficultyTier;
const DIFFICULTY_FILTERS: { id: DifficultyFilter; label: string }[] = [
  { id: 'all', label: 'All difficulty' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'nightmare', label: 'Nightmare' },
  { id: 'ultra-nightmare', label: 'Ultra' },
];

interface GarageRow extends CardRow {
  copyCount: number;
  unlockDifficulty: DifficultyTier;
}

function defaultPref(cardId: string): CardPreference {
  return {
    cardId,
    enabled: true,
    priority: 5,
  };
}

function bucketKey(cardId: string, rarity: Rarity): string {
  return `${cardId}-${rarity}`;
}

function difficultyRank(difficulty: DifficultyTier): number {
  return DIFFICULTY_FILTERS.findIndex((entry) => entry.id === difficulty);
}

function buildGarageRows(
  inventory: Awaited<ReturnType<typeof loadCollectionInventory>>,
  prefs: CardPreference[],
): Map<string, GarageRow> {
  const prefMap = new Map(prefs.map((pref) => [pref.cardId, pref]));
  const rowMap = new Map<string, GarageRow>();
  for (const entry of inventory) {
    const key = bucketKey(entry.card.id, entry.card.rarity);
    const preferenceKey = collectionPreferenceKey(entry.card);
    const existing = rowMap.get(key);
    if (existing) {
      existing.copyCount += 1;
      if (
        difficultyRank(entry.unlockDifficulty) >
        difficultyRank(existing.unlockDifficulty)
      ) {
        existing.unlockDifficulty = entry.unlockDifficulty;
      }
      continue;
    }
    rowMap.set(key, {
      id: key,
      card: entry.card,
      pref: prefMap.get(preferenceKey) ?? defaultPref(preferenceKey),
      copyCount: 1,
      unlockDifficulty: entry.unlockDifficulty,
    });
  }
  return rowMap;
}

function sortRows(a: CardRow, b: CardRow): number {
  return (
    RARITY_ORDER[a.card.rarity] - RARITY_ORDER[b.card.rarity] ||
    a.card.name.localeCompare(b.card.name)
  );
}

export function CardGarageScreen({ onBack }: CardGarageScreenProps) {
  const [rows, setRows] = useState<Map<string, GarageRow>>(new Map());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingFlush, setPendingFlush] = useState<CardPreference[]>([]);
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>('all');
  const [mergeToast, setMergeToast] = useState<string | null>(null);

  const refreshRows = useCallback(async () => {
    const inventory = await loadCollectionInventory();
    const ids = [...new Set(inventory.map(({ card }) => card.id))];
    const prefs = await loadPreferences(
      [...new Set(inventory.map(({ card }) => collectionPreferenceKey(card)))],
    );
    setUnlockedCount(ids.length);
    setRows(buildGarageRows(inventory, prefs));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const inventory = await loadCollectionInventory();
      if (cancelled) return;
      const ids = [...new Set(inventory.map(({ card }) => card.id))];
      const prefs = await loadPreferences(
        [...new Set(inventory.map(({ card }) => collectionPreferenceKey(card)))],
      );
      if (cancelled) return;
      setLoading(false);
      setUnlockedCount(ids.length);
      setRows(buildGarageRows(inventory, prefs));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce slider drags — flush after 400 ms of inactivity.
  useEffect(() => {
    if (pendingFlush.length === 0) return;
    const id = setTimeout(() => {
      savePreferences(pendingFlush);
      setPendingFlush([]);
    }, 400);
    return () => clearTimeout(id);
  }, [pendingFlush]);

  const handleChange = useCallback((pref: CardPreference) => {
    setRows((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const [id, row] of prev) {
        if (row.pref.cardId !== pref.cardId) continue;
        next.set(id, { ...row, pref });
        changed = true;
      }
      if (!changed) return prev;
      return next;
    });
    setPendingFlush((prev) => [
      ...prev.filter((p) => p.cardId !== pref.cardId),
      pref,
    ]);
  }, []);

  const handleBulk = useCallback(
    (rarity: Rarity, category: CategoryGroup, enabled: boolean) => {
      const updated = new Map<string, CardPreference>();
      setRows((prev) => {
        const next = new Map(prev);
        const targetedCardIds = new Set<string>();
        for (const row of prev.values()) {
          if (row.card.rarity === rarity && row.card.kind === category) {
            targetedCardIds.add(row.pref.cardId);
          }
        }
        for (const [id, row] of prev) {
          if (!targetedCardIds.has(row.pref.cardId)) continue;
          const newPref = { ...row.pref, enabled };
          next.set(id, { ...row, pref: newPref });
          updated.set(newPref.cardId, newPref);
        }
        return next;
      });
      if (updated.size > 0) savePreferences([...updated.values()]);
    },
    [],
  );

  // Bulk auto-toggle: enable/disable every card of a kind regardless of rarity.
  const handleAutoToggle = useCallback(
    (category: CategoryGroup, enabled: boolean) => {
      const updated = new Map<string, CardPreference>();
      setRows((prev) => {
        const next = new Map(prev);
        const targetedCardIds = new Set<string>();
        for (const row of prev.values()) {
          if (row.card.kind === category) {
            targetedCardIds.add(row.pref.cardId);
          }
        }
        for (const [id, row] of prev) {
          if (!targetedCardIds.has(row.pref.cardId)) continue;
          const newPref = { ...row.pref, enabled };
          next.set(id, { ...row, pref: newPref });
          updated.set(newPref.cardId, newPref);
        }
        return next;
      });
      if (updated.size > 0) savePreferences([...updated.values()]);
    },
    [],
  );

  const handleMerge = useCallback(
    async (row: CardRow) => {
      if (pendingFlush.length > 0) {
        await savePreferences(pendingFlush);
        setPendingFlush([]);
      }
      const merged = await mergeCollectionBucket(row.card.id, row.card.rarity);
      if (!merged) {
        setMergeToast(`Merge failed — need 2 ${row.card.name} copies at ${row.card.rarity}`);
        setTimeout(() => setMergeToast(null), 2200);
        return;
      }
      await refreshRows();
      setMergeToast(`${row.card.name} merged to ${merged.toRarity}`);
      setTimeout(() => setMergeToast(null), 2200);
    },
    [pendingFlush, refreshRows],
  );

  const grouped = useMemo(() => {
    const result = new Map<CategoryGroup, Map<Rarity, GarageRow[]>>();
    for (const cat of CATEGORY_ORDER) {
      const byRarity = new Map<Rarity, GarageRow[]>(RARITIES.map((r) => [r, []]));
      result.set(cat, byRarity);
    }
    for (const row of rows.values()) {
      if (difficultyFilter !== 'all' && row.unlockDifficulty !== difficultyFilter) {
        continue;
      }
      result
        .get(row.card.kind as CategoryGroup)
        ?.get(row.card.rarity)
        ?.push(row);
    }
    for (const byRarity of result.values()) {
      for (const [rarity, list] of byRarity) {
        byRarity.set(rarity, list.sort(sortRows));
      }
    }
    return result;
  }, [rows, difficultyFilter]);

  const enabledCount = useMemo(
    () => [...rows.values()].filter((row) => row.pref.enabled).length,
    [rows],
  );

  if (loading) {
    return (
      <main className="garage-screen" data-testid="card-garage-screen">
        <div className="garage-loading">Loading collection…</div>
      </main>
    );
  }

  return (
    <main
      className="garage-screen"
      data-testid="card-garage-screen"
      aria-label="Card Garage"
    >
      <header className="garage-header">
        <button
          className="garage-back-btn"
          onClick={onBack}
          aria-label="Back"
          data-testid="garage-back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="garage-header-copy">
          <h1 className="garage-title">Card Garage</h1>
          <p className="garage-subtitle">
            {unlockedCount} unlocked &middot; {enabledCount} active
          </p>
        </div>
      </header>

      <nav
        className="garage-filter-bar"
        aria-label="Difficulty filter"
        data-testid="garage-diff-filter"
      >
        {DIFFICULTY_FILTERS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`garage-filter-btn ${difficultyFilter === d.id ? 'garage-filter-btn-active' : ''}`}
            aria-pressed={difficultyFilter === d.id}
            onClick={() => setDifficultyFilter(d.id)}
            data-testid={`garage-diff-${d.id}`}
          >
            {d.label}
          </button>
        ))}
      </nav>

      {mergeToast && (
        <div className="garage-toast" data-testid="garage-merge-toast">
          {mergeToast}
        </div>
      )}

      <div className="garage-body">
        {CATEGORY_ORDER.map((cat) => {
          const byRarity = grouped.get(cat);
          if (!byRarity) return null;
          const total = RARITIES.reduce(
            (sum, rarity) => sum + (byRarity.get(rarity)?.length ?? 0),
            0,
          );
          if (total === 0) return null;
          return (
            <section
              key={cat}
              className="garage-section"
              aria-label={`${CATEGORY_LABELS[cat]} section`}
              data-testid={`garage-section-${cat}`}
            >
              <header className="garage-section-heading">
                <h2 className="garage-section-title">
                  {CATEGORY_LABELS[cat]}
                  <span className="garage-section-count">{total}</span>
                </h2>
                <div
                  className="garage-auto-toggles"
                  data-testid={`garage-auto-${cat}`}
                >
                  <button
                    type="button"
                    className="garage-auto-btn"
                    onClick={() => handleAutoToggle(cat, true)}
                    data-testid={`garage-auto-enable-${cat}`}
                  >
                    Auto: all on
                  </button>
                  <button
                    type="button"
                    className="garage-auto-btn"
                    onClick={() => handleAutoToggle(cat, false)}
                    data-testid={`garage-auto-disable-${cat}`}
                  >
                    Auto: all off
                  </button>
                </div>
              </header>
              {RARITIES.map((rarity) => {
                const rarityRows = byRarity.get(rarity) ?? [];
                if (rarityRows.length === 0) return null;
                return (
                  <div
                    key={rarity}
                    className="garage-rarity-group"
                    data-testid={`garage-group-${cat}-${rarity}`}
                  >
                    <BulkRarityBar
                      rarity={rarity}
                      count={rarityRows.length}
                      onEnableAll={() => handleBulk(rarity, cat, true)}
                      onDisableAll={() => handleBulk(rarity, cat, false)}
                    />
                    {rarityRows.map((row) => (
                      <CardRowItem
                        key={row.id}
                        row={row}
                        onChange={handleChange}
                        duplicateCount={row.copyCount - 1}
                        onMerge={handleMerge}
                      />
                    ))}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </main>
  );
}
