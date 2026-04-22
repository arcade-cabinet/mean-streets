import { CardFrame } from '../cards';
import type { DeckLoadout } from '../deckbuilder/storage';
import { AmbientSilhouetteLayer } from './VisualStage';

interface DeckGarageScreenProps {
  loadouts: DeckLoadout[];
  onCreateDeck: () => void;
  onEditDeck: (deckId: string) => void;
  onPlayDeck: (deckId: string) => void;
  onBack: () => void;
}

const GARAGE_ICONS = ['♠', '✦', '☠', '⚑', '✪', '♣', '◆'];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function deckIcon(deck: DeckLoadout): string {
  return GARAGE_ICONS[hashString(deck.name) % GARAGE_ICONS.length];
}

function deckSummary(deck: DeckLoadout): string {
  return `${deck.crewIds.length} crew • ${deck.modifierIds.length} mods`;
}

export function DeckGarageScreen({
  loadouts,
  onCreateDeck,
  onEditDeck,
  onPlayDeck,
  onBack,
}: DeckGarageScreenProps) {
  return (
    <div
      className="deck-garage-screen world-screen world-screen-garage"
      data-testid="deck-garage-screen"
    >
      <AmbientSilhouetteLayer variant="street" />
      <header className="deck-garage-header">
        <div className="deck-garage-heading">
          <p className="deckbuilder-kicker">Deck Garage</p>
          <h1 className="deckbuilder-title">Choose Your Box</h1>
          <div className="deckbuilder-rule" aria-hidden="true" />
          <p className="deckbuilder-subtitle">
            Pick a committed deck to run the street, or crack open a fresh box
            and build a new crew from scratch.
          </p>
        </div>

        <div className="deckbuilder-actions">
          <button className="deck-mini-button" onClick={onBack}>
            <CardFrame
              variant="button"
              className="card-frame-svg card-frame-svg-utility-button"
            />
            <span className="utility-button-label">Menu</span>
          </button>
        </div>
      </header>

      <section className="deck-garage-rail" aria-label="Saved decks">
        {loadouts.map((deck) => (
          <article key={deck.id} className="deck-box-card">
            <CardFrame
              variant="crew"
              className="card-frame-svg card-frame-svg-deck-box"
            />
            <div className="deck-box-top">
              <span className="deck-box-kicker">Saved Deck</span>
              <span className="deck-box-stamp">{deckIcon(deck)}</span>
            </div>
            <div className="deck-box-title">{deck.name}</div>
            <div className="deck-box-summary">{deckSummary(deck)}</div>
            <div className="deck-box-actions">
              <button
                className="menu-button menu-button-primary deck-box-action"
                onClick={() => onPlayDeck(deck.id)}
              >
                <CardFrame
                  variant="button"
                  className="card-frame-svg card-frame-svg-button"
                />
                <span className="menu-button-label">Play</span>
              </button>
              <button
                className="deck-mini-button deck-box-edit"
                onClick={() => onEditDeck(deck.id)}
              >
                <CardFrame
                  variant="button"
                  className="card-frame-svg card-frame-svg-utility-button"
                />
                <span className="utility-button-label">Edit</span>
              </button>
            </div>
          </article>
        ))}

        <article className="deck-box-card deck-box-card-new">
          <CardFrame
            variant="crew"
            className="card-frame-svg card-frame-svg-deck-box"
          />
          <div className="deck-box-flap" aria-hidden="true" />
          <div className="deck-box-top">
            <span className="deck-box-kicker">Fresh Box</span>
            <span className="deck-box-stamp">＋</span>
          </div>
          <div className="deck-box-title">New Deck</div>
          <div className="deck-box-summary">
            Open a new box, pull the cards, and start building.
          </div>
          <div className="deck-box-actions">
            <button
              className="menu-button menu-button-primary deck-box-action"
              onClick={onCreateDeck}
              data-testid="new-deck-button"
            >
              <CardFrame
                variant="button"
                className="card-frame-svg card-frame-svg-button"
              />
              <span className="menu-button-label">New</span>
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
