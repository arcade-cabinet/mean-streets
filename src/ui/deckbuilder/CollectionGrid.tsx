import type { ModifierCard } from '../../sim/turf/types';
import type { CharacterCard } from '../../sim/cards/schemas';

export type TabId = 'all' | 'crew' | 'weapons' | 'drugs' | 'cash';
export type AnyCard = CharacterCard | ModifierCard;

interface CollectionGridProps {
  crewCards: CharacterCard[];
  modifiers: ModifierCard[];
  selectedIds: Set<string>;
  onToggle: (card: AnyCard) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'crew', label: 'Crew' },
  { id: 'weapons', label: 'Weapons' }, { id: 'drugs', label: 'Drugs' },
  { id: 'cash', label: 'Cash' },
];

function cardStat(c: AnyCard): string {
  if ('power' in c) return `PWR ${c.power} / RES ${c.resistance}`;
  if ('bonus' in c) return `+${c.bonus} ${c.category}`;
  if ('potency' in c) return `${c.potency}pt ${c.category}`;
  if ('denomination' in c) return `$${c.denomination}`;
  return '';
}

function cardName(c: AnyCard): string {
  if ('displayName' in c) return c.displayName;
  if ('name' in c) return c.name;
  if ('denomination' in c) return `Cash $${c.denomination}`;
  return c.id;
}

function cardUnlocked(c: AnyCard): boolean {
  return 'denomination' in c || (c as { unlocked: boolean }).unlocked;
}

function cardHint(c: AnyCard): string | undefined {
  return 'denomination' in c ? undefined : (c as { unlockCondition?: string }).unlockCondition;
}

function cardColor(c: AnyCard): string {
  if ('power' in c) return 'text-amber-200';
  if ('bonus' in c) return 'text-red-300';
  if ('potency' in c) return 'text-purple-300';
  if ('denomination' in c) return 'text-green-300';
  return 'text-stone-300';
}

export function CollectionGrid({ crewCards, modifiers, selectedIds, onToggle, activeTab, onTabChange }: CollectionGridProps) {
  const allCards: AnyCard[] = [...crewCards, ...modifiers];
  const visible = allCards.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'crew') return 'power' in c;
    if (activeTab === 'weapons') return 'bonus' in c;
    if (activeTab === 'drugs') return 'potency' in c;
    if (activeTab === 'cash') return 'denomination' in c;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b border-stone-700">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1 text-xs font-bold rounded uppercase tracking-wider transition-colors
              ${activeTab === tab.id
                ? 'bg-amber-600 text-stone-900'
                : 'bg-stone-800 text-stone-400 hover:text-amber-300 hover:bg-stone-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 content-start">
        {visible.map(card => {
          const unlocked = cardUnlocked(card);
          const selected = selectedIds.has(card.id);
          const hint = cardHint(card);
          return (
            <button
              key={card.id}
              title={!unlocked && hint ? `Locked: ${hint}` : cardName(card)}
              disabled={!unlocked}
              onClick={() => onToggle(card)}
              className={`text-left p-2 rounded border transition-all
                ${!unlocked
                  ? 'border-stone-700 bg-stone-900 opacity-40 cursor-not-allowed'
                  : selected
                    ? 'border-amber-500 bg-amber-900/30 ring-1 ring-amber-500'
                    : 'border-stone-600 bg-stone-800 hover:border-amber-600 hover:bg-stone-700'
                }`}
            >
              <div className={`text-[11px] font-bold leading-tight truncate ${unlocked ? cardColor(card) : 'text-stone-500'}`}>
                {!unlocked && <span className="mr-1">🔒</span>}
                {cardName(card)}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">{cardStat(card)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
