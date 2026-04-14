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
  return 'Unknown card';
}

function cardUnlocked(c: AnyCard): boolean {
  return 'denomination' in c || (c as { unlocked: boolean }).unlocked;
}

function cardHint(c: AnyCard): string | undefined {
  return 'denomination' in c ? undefined : (c as { unlockCondition?: string }).unlockCondition;
}

function cardColor(c: AnyCard): string {
  if ('power' in c) return 'collection-card-title-crew';
  if ('bonus' in c) return 'collection-card-title-weapon';
  if ('potency' in c) return 'collection-card-title-drug';
  if ('denomination' in c) return 'collection-card-title-cash';
  return 'collection-card-title-muted';
}

function cardType(c: AnyCard): 'crew' | 'weapon' | 'product' | 'cash' {
  if ('power' in c) return 'crew';
  if ('bonus' in c) return 'weapon';
  if ('potency' in c) return 'product';
  return 'cash';
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
    <div className="collection-grid" data-testid="collection-grid">
      <div className="collection-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`collection-tab ${activeTab === tab.id ? 'collection-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="collection-grid-cards">
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
              data-testid={`collection-card-${card.id}`}
              data-card-type={cardType(card)}
              className={`collection-card ${
                !unlocked
                  ? 'collection-card-locked'
                  : selected
                    ? 'collection-card-selected'
                    : 'collection-card-idle'
              }`}
            >
              <div className={`collection-card-title ${unlocked ? cardColor(card) : 'collection-card-title-muted'}`}>
                {!unlocked && <span className="collection-card-lock">LOCK</span>}
                {cardName(card)}
              </div>
              <div className="collection-card-stat">{cardStat(card)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
