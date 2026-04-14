/**
 * PlayerHand — fixed bottom bar showing the player's crew and modifier cards.
 * Two sections: full-size crew tiles (left) and quarter-size modifier cards (right).
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAppShell } from '../../platform';
import { useHand } from '../../ecs/hooks';
import { CardFrame } from '../cards';
import type { BackpackCard, CrewCard, ModifierCard } from '../../sim/turf/types';
import { CardFan } from './CardFan';

function CrewTile({ card }: { card: CrewCard }) {
  return (
    <div className="hand-crew-tile">
      <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-hand-crew" />
      <p className="hand-crew-name">
        {card.displayName}
      </p>
      <p className="hand-crew-archetype">
        {card.archetype}
      </p>
      <p className="hand-crew-stats">
        P{card.power}/R{card.resistance}
      </p>
    </div>
  );
}

function ModifierTile({ card, compact }: { card: ModifierCard; compact: boolean }) {
  const tone =
    card.type === 'cash'
      ? 'hand-modifier-tile-cash'
      : card.type === 'weapon'
        ? 'hand-modifier-tile-weapon'
        : 'hand-modifier-tile-drug';
  const value =
    card.type === 'cash'
      ? `$${card.denomination}`
      : card.type === 'weapon'
        ? `+${card.bonus}`
        : `+${card.potency}`;
  const meta =
    card.type === 'cash'
      ? 'cash'
      : card.type === 'weapon'
        ? card.category
        : card.category;

  return (
    <div className={`hand-modifier-tile ${tone} ${compact ? 'hand-modifier-tile-compact' : ''}`}>
      <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-hand-crew" />
      <p className="hand-modifier-title">{card.type === 'cash' ? value : card.name}</p>
      <p className="hand-modifier-meta">{meta}</p>
      <p className="hand-modifier-value">{card.type === 'cash' ? 'bank' : value}</p>
    </div>
  );
}

function BackpackTile({ card, compact }: { card: BackpackCard; compact: boolean }) {
  const payloadSummary = card.payload.map(payload => payload.type === 'product' ? 'drug' : payload.type).join(' / ');
  return (
    <div className={`hand-modifier-tile hand-modifier-tile-backpack ${compact ? 'hand-modifier-tile-compact' : ''}`}>
      <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-hand-crew" />
      <p className="hand-modifier-title">{card.name}</p>
      <p className="hand-modifier-meta">{card.icon} kit</p>
      <p className="hand-modifier-value">{card.payload.length} payload</p>
      {!compact && <p className="hand-modifier-meta">{payloadSummary}</p>}
    </div>
  );
}

interface PlayerHandProps {
  placement?: 'bottom' | 'side';
  presentation?: 'fan' | 'stack';
}

export function PlayerHand({ placement = 'bottom', presentation = 'fan' }: PlayerHandProps) {
  const { layout } = useAppShell();
  const { crew, modifiers, backpacks } = useHand('A');
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const handPresentation = compact ? 'stack' : presentation;
  const [activeSection, setActiveSection] = useState<'crew' | 'mods' | 'kits'>('crew');

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

  const backpackFanItems = backpacks.map((card, i) => ({
    card: card as unknown,
    type: 'backpack' as const,
    index: i,
  }));

  function renderCrewCard(card: unknown): ReactNode {
    return <CrewTile card={card as CrewCard} />;
  }

  function renderModCard(card: unknown): ReactNode {
    return <ModifierTile card={card as ModifierCard} compact={compact} />;
  }

  function renderBackpackCard(card: unknown): ReactNode {
    return <BackpackTile card={card as BackpackCard} compact={compact} />;
  }

  return (
    <div className={placement === 'side' ? 'game-hand game-hand-side' : 'game-hand game-hand-bottom'}>
      <div className={`game-hand-inner ${placement === 'side' ? 'game-hand-inner-side' : 'game-hand-inner-bottom'}`}>
        {compact && placement === 'bottom' && (
          <div className="game-hand-tabs" role="tablist" aria-label="Hand sections">
            <button
              className={`game-hand-tab ${activeSection === 'crew' ? 'game-hand-tab-active' : ''}`}
              onClick={() => setActiveSection('crew')}
              role="tab"
              aria-selected={activeSection === 'crew'}
            >
              Crew {crew.length}/25
            </button>
            <button
              className={`game-hand-tab ${activeSection === 'mods' ? 'game-hand-tab-active' : ''}`}
              onClick={() => setActiveSection('mods')}
              role="tab"
              aria-selected={activeSection === 'mods'}
            >
              Mods {modifiers.length}/25
            </button>
            <button
              className={`game-hand-tab ${activeSection === 'kits' ? 'game-hand-tab-active' : ''}`}
              onClick={() => setActiveSection('kits')}
              role="tab"
              aria-selected={activeSection === 'kits'}
            >
              Kits {backpacks.length}
            </button>
          </div>
        )}

        <div className={`game-hand-section ${compact && placement === 'bottom' && activeSection !== 'crew' ? 'game-hand-section-hidden' : ''}`}>
          <span className="game-hand-label">
            Crew: {crew.length}/25
          </span>
          <CardFan cards={crewFanItems} renderCard={renderCrewCard} presentation={handPresentation} compact={compact} />
        </div>

        {(!compact || placement !== 'bottom') && (
          <div className={placement === 'side' ? 'game-hand-divider game-hand-divider-side' : 'game-hand-divider game-hand-divider-bottom'} />
        )}

        <div className={`game-hand-section ${compact && placement === 'bottom' && activeSection !== 'mods' ? 'game-hand-section-hidden' : ''}`}>
          <span className="game-hand-label">
            Mods: {modifiers.length}/25
          </span>
          <CardFan cards={modFanItems} renderCard={renderModCard} presentation={handPresentation} compact={compact} />
        </div>

        {(!compact || placement !== 'bottom') && (
          <div className={placement === 'side' ? 'game-hand-divider game-hand-divider-side' : 'game-hand-divider game-hand-divider-bottom'} />
        )}

        <div className={`game-hand-section ${compact && placement === 'bottom' && activeSection !== 'kits' ? 'game-hand-section-hidden' : ''}`}>
          <span className="game-hand-label">
            Kits: {backpacks.length}
          </span>
          <CardFan cards={backpackFanItems} renderCard={renderBackpackCard} presentation={handPresentation} compact={compact} />
        </div>
      </div>
    </div>
  );
}
