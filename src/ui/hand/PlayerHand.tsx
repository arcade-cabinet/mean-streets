/**
 * PlayerHand — fixed bottom bar showing the player's crew and modifier cards.
 * Two sections: full-size crew tiles (left) and quarter-size modifier cards (right).
 */

import type { ReactNode } from 'react';
import { useHand } from '../../ecs/hooks';
import { QuarterCard } from '../cards';
import type { CrewCard, ModifierCard } from '../../sim/turf/types';
import { CardFan } from './CardFan';

function CrewTile({ card }: { card: CrewCard }) {
  return (
    <div
      className="bg-stone-800 border border-stone-600 rounded flex flex-col items-center justify-between px-1 py-1 select-none"
      style={{ width: '60px', height: '80px' }}
    >
      <p className="text-amber-100 text-[9px] font-bold leading-tight w-full truncate text-center">
        {card.displayName}
      </p>
      <p className="text-stone-400 text-[8px] uppercase tracking-wide text-center leading-tight">
        {card.archetype}
      </p>
      <p className="text-[9px] font-mono font-bold text-stone-300">
        P{card.power}/R{card.resistance}
      </p>
    </div>
  );
}

export function PlayerHand() {
  const { crew, modifiers } = useHand('A');

  const crewFanItems = crew.map((card, i) => ({
    card: card as unknown,
    type: 'crew' as const,
    index: i,
  }));

  const modFanItems = modifiers.map((card, i) => ({
    card: card as unknown,
    type: 'modifier' as const,
    index: i,
  }));

  function renderCrewCard(card: unknown): ReactNode {
    return <CrewTile card={card as CrewCard} />;
  }

  function renderModCard(card: unknown): ReactNode {
    return <QuarterCard card={card as ModifierCard} compact />;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur border-t border-stone-700 z-40">
      <div className="flex items-stretch gap-2 px-3 py-2">
        {/* Crew section */}
        <div className="flex flex-col min-w-0">
          <span className="text-stone-400 text-[10px] uppercase tracking-widest font-semibold mb-1">
            Crew: {crew.length}/25
          </span>
          <CardFan cards={crewFanItems} renderCard={renderCrewCard} />
        </div>

        <div className="w-px bg-stone-700 self-stretch mx-1" />

        {/* Modifier section */}
        <div className="flex flex-col min-w-0">
          <span className="text-stone-400 text-[10px] uppercase tracking-widest font-semibold mb-1">
            Mods: {modifiers.length}/25
          </span>
          <CardFan cards={modFanItems} renderCard={renderModCard} />
        </div>
      </div>
    </div>
  );
}
