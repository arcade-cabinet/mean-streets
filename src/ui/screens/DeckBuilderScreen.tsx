import { useState, useMemo } from 'react';
import { generateAllCards } from '../../sim/cards/generator';
import { createRng, randomSeed } from '../../sim/cards/rng';
import { generateWeapons, generateDrugs, generateCash } from '../../sim/turf/generators';
import type { CrewCard, ModifierCard } from '../../sim/turf/types';
import type { CharacterCard } from '../../sim/cards/schemas';
import { CollectionGrid, DeckSummary } from '../deckbuilder';
import type { TabId, AnyCard } from '../deckbuilder';

interface DeckBuilderScreenProps {
  onStartGame: (deck: { crew: CrewCard[]; modifiers: ModifierCard[] }) => void;
}

const CREW_GOAL = 25;
const MOD_GOAL = 25;

function toCrewCard(c: CharacterCard): CrewCard {
  return { ...c, type: 'crew' as const };
}

export function DeckBuilderScreen({ onStartGame }: DeckBuilderScreenProps) {
  const { allCrew, allWeapons, allDrugs, allCash } = useMemo(() => {
    const crewSeed = randomSeed();
    const modSeed = randomSeed();
    const rng = createRng(modSeed);
    return {
      allCrew: generateAllCards(crewSeed, CREW_GOAL),
      allWeapons: generateWeapons(rng),
      allDrugs: generateDrugs(rng),
      allCash: generateCash(),
    };
  }, []);

  const allModifiers: ModifierCard[] = useMemo(
    () => [...allWeapons, ...allDrugs, ...allCash],
    [allWeapons, allDrugs, allCash],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const selectedCrew = useMemo(
    () => allCrew.filter(c => selectedIds.has(c.id)).map(toCrewCard),
    [allCrew, selectedIds],
  );
  const selectedModifiers = useMemo(
    () => allModifiers.filter(m => selectedIds.has(m.id)),
    [allModifiers, selectedIds],
  );

  const crewCount = selectedCrew.length;
  const modCount = selectedModifiers.length;
  const canStart = crewCount === CREW_GOAL && modCount === MOD_GOAL;

  function handleToggle(card: AnyCard) {
    const isCrew = 'power' in card && 'resistance' in card;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) {
        next.delete(card.id);
      } else {
        const currentCrew = [...prev].filter(id => allCrew.some(c => c.id === id)).length;
        const currentMods = prev.size - currentCrew;
        if (isCrew && currentCrew >= CREW_GOAL) return prev;
        if (!isCrew && currentMods >= MOD_GOAL) return prev;
        next.add(card.id);
      }
      return next;
    });
  }

  function handleStart() {
    onStartGame({ crew: selectedCrew, modifiers: selectedModifiers });
  }

  return (
    <div className="h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-stone-700 bg-stone-900">
        <h1 className="text-amber-400 font-bold text-lg tracking-widest uppercase">Build Your Deck</h1>
        <div className="text-stone-400 text-sm">
          Crew&nbsp;
          <span className={crewCount === CREW_GOAL ? 'text-green-400 font-bold' : 'text-amber-300 font-bold'}>
            {crewCount}/{CREW_GOAL}
          </span>
          &nbsp;&nbsp;Mods&nbsp;
          <span className={modCount === MOD_GOAL ? 'text-green-400 font-bold' : 'text-amber-300 font-bold'}>
            {modCount}/{MOD_GOAL}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CollectionGrid
            crewCards={allCrew}
            modifiers={allModifiers}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="w-56 overflow-hidden">
          <DeckSummary
            selectedCrew={selectedCrew}
            selectedModifiers={selectedModifiers}
          />
        </div>
      </div>

      <footer className="px-6 py-3 border-t border-stone-700 bg-stone-900 flex justify-end">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`px-8 py-2 rounded font-bold text-sm tracking-widest uppercase transition-all
            ${canStart
              ? 'bg-amber-600 text-stone-900 hover:bg-amber-500 shadow-lg shadow-amber-900/40'
              : 'bg-stone-700 text-stone-500 cursor-not-allowed'
            }`}
        >
          Start Game
        </button>
      </footer>
    </div>
  );
}
