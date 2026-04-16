import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Card as CardType, Rarity } from '../../sim/turf/types';
import { loadToughCards } from '../../sim/cards/catalog';
import { generateWeapons, generateDrugs, generateCurrency } from '../../sim/turf/generators';
import {
  loadCollection,
  loadPreferences,
  savePreferences,
  type CardPreference,
} from '../../platform/persistence/collection';

type CategoryGroup = 'tough' | 'weapon' | 'drug' | 'currency';

interface CardRow {
  card: CardType;
  pref: CardPreference;
}

interface CardGarageScreenProps {
  onBack: () => void;
}

const CATEGORY_ORDER: CategoryGroup[] = ['tough', 'weapon', 'drug', 'currency'];
const CATEGORY_LABELS: Record<CategoryGroup, string> = {
  tough: 'Toughs', weapon: 'Weapons', drug: 'Drugs', currency: 'Cash',
};
const RARITIES: Rarity[] = ['legendary', 'rare', 'common'];
const RARITY_LABELS: Record<Rarity, string> = {
  legendary: 'Legendary', rare: 'Rare', common: 'Common',
};
const RARITY_CLASS: Record<Rarity, string> = {
  legendary: 'garage-rarity-legendary', rare: 'garage-rarity-rare', common: 'garage-rarity-common',
};
const RARITY_ORDER: Record<Rarity, number> = { legendary: 0, rare: 1, common: 2 };

function sortRows(a: CardRow, b: CardRow): number {
  return RARITY_ORDER[a.card.rarity] - RARITY_ORDER[b.card.rarity] || a.card.name.localeCompare(b.card.name);
}

function loadAllCards(): CardType[] {
  return [...loadToughCards(), ...generateWeapons(), ...generateDrugs(), ...generateCurrency()];
}

interface BulkRarityBarProps {
  rarity: Rarity;
  count: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

function BulkRarityBar({ rarity, count, onEnableAll, onDisableAll }: BulkRarityBarProps) {
  return (
    <div className={`garage-bulk-bar ${RARITY_CLASS[rarity]}`} data-testid={`garage-bulk-${rarity}`}>
      <span className="garage-bulk-label">
        {RARITY_LABELS[rarity]} <span className="garage-bulk-count">({count})</span>
      </span>
      <div className="garage-bulk-actions">
        <button className="garage-bulk-btn" onClick={onEnableAll}
          aria-label={`Enable all ${rarity} cards`} data-testid={`garage-enable-all-${rarity}`}>
          Enable all
        </button>
        <button className="garage-bulk-btn" onClick={onDisableAll}
          aria-label={`Disable all ${rarity} cards`} data-testid={`garage-disable-all-${rarity}`}>
          Disable all
        </button>
      </div>
    </div>
  );
}

interface CardRowItemProps {
  row: CardRow;
  onChange: (pref: CardPreference) => void;
}

function CardRowItem({ row: { card, pref }, onChange }: CardRowItemProps) {
  return (
    <div
      className={`garage-row ${!pref.enabled ? 'garage-row-disabled' : ''}`}
      data-testid={`garage-row-${card.id}`}
    >
      <div className={`garage-row-rarity-pip ${RARITY_CLASS[card.rarity]}`} aria-hidden="true" />
      <span className="garage-row-name">{card.name}</span>
      <span className="garage-row-kind">{card.kind}</span>
      <label className="garage-toggle" aria-label={`${pref.enabled ? 'Disable' : 'Enable'} ${card.name}`}>
        <input
          type="checkbox"
          className="garage-toggle-input"
          checked={pref.enabled}
          onChange={() => onChange({ ...pref, enabled: !pref.enabled })}
          data-testid={`garage-toggle-${card.id}`}
        />
        <span className="garage-toggle-track" aria-hidden="true" />
      </label>
      <div className="garage-priority" aria-label={`Priority for ${card.name}: ${pref.priority}`}>
        <span className="garage-priority-value">{pref.priority}</span>
        <input
          type="range"
          className="garage-priority-slider"
          min={1} max={10} value={pref.priority}
          onChange={(e) => onChange({ ...pref, priority: Number(e.target.value) })}
          disabled={!pref.enabled}
          data-testid={`garage-priority-${card.id}`}
          aria-label={`Priority ${pref.priority} of 10`}
        />
      </div>
    </div>
  );
}

export function CardGarageScreen({ onBack }: CardGarageScreenProps) {
  const [rows, setRows] = useState<Map<string, CardRow>>(new Map());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingFlush, setPendingFlush] = useState<CardPreference[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const unlocked = await loadCollection();
      if (cancelled) return;
      const ids = new Set(unlocked.map((c) => c.id));
      const prefs = await loadPreferences([...ids]);
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

  const grouped = useMemo(() => {
    const result = new Map<CategoryGroup, Map<Rarity, CardRow[]>>();
    for (const cat of CATEGORY_ORDER) {
      const byRarity = new Map<Rarity, CardRow[]>(RARITIES.map((r) => [r, []]));
      result.set(cat, byRarity);
    }
    for (const row of rows.values()) {
      result.get(row.card.kind as CategoryGroup)?.get(row.card.rarity)?.push(row);
    }
    for (const byRarity of result.values()) {
      for (const [r, list] of byRarity) byRarity.set(r, list.sort(sortRows));
    }
    return result;
  }, [rows]);

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
      <div className="garage-body">
        {CATEGORY_ORDER.map((cat) => {
          const byRarity = grouped.get(cat);
          if (!byRarity) return null;
          const total = RARITIES.reduce((s, r) => s + (byRarity.get(r)?.length ?? 0), 0);
          if (total === 0) return null;
          return (
            <section key={cat} className="garage-section"
              aria-label={`${CATEGORY_LABELS[cat]} section`} data-testid={`garage-section-${cat}`}>
              <h2 className="garage-section-heading">
                {CATEGORY_LABELS[cat]}<span className="garage-section-count">{total}</span>
              </h2>
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
                      <CardRowItem key={row.card.id} row={row} onChange={handleChange} />
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
