import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Card as CardType, DifficultyTier, Rarity } from '../../sim/turf/types';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';
import {
  loadCollection,
  loadPreferences,
  savePreferences,
  type CardPreference,
} from '../../platform/persistence/collection';
import { loadProfile } from '../../platform/persistence/storage';
import { BulkRarityBar, CardRowItem, type CardRow } from './CardGarageSubcomponents';

type CategoryGroup = 'tough' | 'weapon' | 'drug' | 'currency';

interface CardGarageScreenProps {
  onBack: () => void;
}

const CATEGORY_ORDER: CategoryGroup[] = ['tough', 'weapon', 'drug', 'currency'];
const CATEGORY_LABELS: Record<CategoryGroup, string> = {
  tough: 'Toughs', weapon: 'Weapons', drug: 'Drugs', currency: 'Cash',
};
const RARITIES: Rarity[] = ['mythic', 'legendary', 'rare', 'uncommon', 'common'];
const RARITY_ORDER: Record<Rarity, number> = {
  mythic: 0, legendary: 1, rare: 2, uncommon: 3, common: 4,
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

function sortRows(a: CardRow, b: CardRow): number {
  return RARITY_ORDER[a.card.rarity] - RARITY_ORDER[b.card.rarity] || a.card.name.localeCompare(b.card.name);
}

function loadAllCards(): CardType[] {
  return [...loadToughCards(), ...generateWeapons(), ...generateDrugs(), ...generateCurrency()];
}


export function CardGarageScreen({ onBack }: CardGarageScreenProps) {
  const [rows, setRows] = useState<Map<string, CardRow>>(new Map());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingFlush, setPendingFlush] = useState<CardPreference[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [mergeToast, setMergeToast] = useState<string | null>(null);
  const [unlockMap, setUnlockMap] = useState<Record<string, DifficultyTier>>({});

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const unlocked = await loadCollection();
      if (cancelled) return;
      const ids = new Set(unlocked.map((c) => c.id));
      const [prefs, profile] = await Promise.all([
        loadPreferences([...ids]),
        loadProfile(),
      ]);
      if (cancelled) return;
      const prefMap = new Map(prefs.map((p) => [p.cardId, p]));
      const rowMap = new Map<string, CardRow>();
      for (const card of loadAllCards()) {
        if (!ids.has(card.id)) continue;
        rowMap.set(card.id, {
          card,
          pref: prefMap.get(card.id) ?? { cardId: card.id, enabled: true, priority: 5 },
        });
      }
      const unlockLookup: Record<string, DifficultyTier> = {};
      const instances = profile.cardInstances ?? {};
      for (const id of ids) {
        unlockLookup[id] = (instances[id]?.unlockDifficulty ?? 'easy') as DifficultyTier;
      }
      setUnlockMap(unlockLookup);
      setUnlockedCount(ids.size);
      setRows(rowMap);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Debounce slider drags — flush after 400 ms of inactivity.
  useEffect(() => {
    if (pendingFlush.length === 0) return;
    const id = setTimeout(() => { savePreferences(pendingFlush); setPendingFlush([]); }, 400);
    return () => clearTimeout(id);
  }, [pendingFlush]);

  const handleChange = useCallback((pref: CardPreference) => {
    setRows((prev) => {
      const existing = prev.get(pref.cardId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(pref.cardId, { ...existing, pref });
      return next;
    });
    setPendingFlush((prev) => [...prev.filter((p) => p.cardId !== pref.cardId), pref]);
  }, []);

  const handleBulk = useCallback((rarity: Rarity, category: CategoryGroup, enabled: boolean) => {
    const updated: CardPreference[] = [];
    setRows((prev) => {
      const next = new Map(prev);
      for (const [id, row] of prev) {
        if (row.card.rarity === rarity && row.card.kind === category) {
          const newPref = { ...row.pref, enabled };
          next.set(id, { ...row, pref: newPref });
          updated.push(newPref);
        }
      }
      return next;
    });
    if (updated.length > 0) savePreferences(updated);
  }, []);

  // Bulk auto-toggle: enable/disable every card of a kind regardless of rarity.
  const handleAutoToggle = useCallback((category: CategoryGroup, enabled: boolean) => {
    const updated: CardPreference[] = [];
    setRows((prev) => {
      const next = new Map(prev);
      for (const [id, row] of prev) {
        if (row.card.kind === category) {
          const newPref = { ...row.pref, enabled };
          next.set(id, { ...row, pref: newPref });
          updated.push(newPref);
        }
      }
      return next;
    });
    if (updated.length > 0) savePreferences(updated);
  }, []);

  // Placeholder merge handler — surfaces a toast. Full wire-up needs a
  // persistence helper that consumes 3 instances and mints the upgraded
  // copy; persistence/** is outside this UI agent's scope, so we surface
  // the intent but don't mutate state yet.
  const handleMerge = useCallback((cardId: string) => {
    const row = rows.get(cardId);
    if (!row) return;
    setMergeToast(`Merge queued for ${row.card.name} — persistence hook pending`);
    setTimeout(() => setMergeToast(null), 2200);
  }, [rows]);

  const grouped = useMemo(() => {
    const result = new Map<CategoryGroup, Map<Rarity, CardRow[]>>();
    for (const cat of CATEGORY_ORDER) {
      const byRarity = new Map<Rarity, CardRow[]>(RARITIES.map((r) => [r, []]));
      result.set(cat, byRarity);
    }
    for (const row of rows.values()) {
      if (difficultyFilter !== 'all') {
        if (unlockMap[row.card.id] !== difficultyFilter) continue;
      }
      result.get(row.card.kind as CategoryGroup)?.get(row.card.rarity)?.push(row);
    }
    for (const byRarity of result.values()) {
      for (const [r, list] of byRarity) byRarity.set(r, list.sort(sortRows));
    }
    return result;
  }, [rows, difficultyFilter, unlockMap]);

  const enabledCount = useMemo(() => [...rows.values()].filter((r) => r.pref.enabled).length, [rows]);

  if (loading) {
    return <main className="garage-screen" data-testid="card-garage-screen"><div className="garage-loading">Loading collection…</div></main>;
  }

  return (
    <main className="garage-screen" data-testid="card-garage-screen" aria-label="Card Garage">
      <header className="garage-header">
        <button className="garage-back-btn" onClick={onBack} aria-label="Back" data-testid="garage-back">
          <ArrowLeft size={20} />
        </button>
        <div className="garage-header-copy">
          <h1 className="garage-title">Card Garage</h1>
          <p className="garage-subtitle">{unlockedCount} unlocked &middot; {enabledCount} active</p>
        </div>
      </header>

      <nav className="garage-filter-bar" aria-label="Difficulty filter" data-testid="garage-diff-filter">
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
        <div className="garage-toast" data-testid="garage-merge-toast">{mergeToast}</div>
      )}

      <div className="garage-body">
        {CATEGORY_ORDER.map((cat) => {
          const byRarity = grouped.get(cat);
          if (!byRarity) return null;
          const total = RARITIES.reduce((s, r) => s + (byRarity.get(r)?.length ?? 0), 0);
          if (total === 0) return null;
          return (
            <section key={cat} className="garage-section"
              aria-label={`${CATEGORY_LABELS[cat]} section`} data-testid={`garage-section-${cat}`}>
              <header className="garage-section-heading">
                <h2 className="garage-section-title">
                  {CATEGORY_LABELS[cat]}<span className="garage-section-count">{total}</span>
                </h2>
                <div className="garage-auto-toggles" data-testid={`garage-auto-${cat}`}>
                  <button
                    type="button" className="garage-auto-btn"
                    onClick={() => handleAutoToggle(cat, true)}
                    data-testid={`garage-auto-enable-${cat}`}
                  >
                    Auto: all on
                  </button>
                  <button
                    type="button" className="garage-auto-btn"
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
                  <div key={rarity} className="garage-rarity-group"
                    data-testid={`garage-group-${cat}-${rarity}`}>
                    <BulkRarityBar rarity={rarity} count={rarityRows.length}
                      onEnableAll={() => handleBulk(rarity, cat, true)}
                      onDisableAll={() => handleBulk(rarity, cat, false)} />
                    {rarityRows.map((row) => (
                      <CardRowItem
                        key={row.card.id}
                        row={row}
                        onChange={handleChange}
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
