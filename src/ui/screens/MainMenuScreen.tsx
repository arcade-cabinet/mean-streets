import { useAppShell } from '../../platform';
import { AmbientSilhouetteLayer } from './VisualStage';

interface MainMenuScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onCards: () => void;
  onCollection: () => void;
  onGarage: () => void;
  canLoadGame: boolean;
  availablePacks?: number;
}

export function MainMenuScreen({
  onNewGame,
  onLoadGame,
  onCards,
  onCollection,
  onGarage,
  canLoadGame,
  availablePacks = 0,
}: MainMenuScreenProps) {
  const { layout } = useAppShell();
  const heroImage = `${import.meta.env.BASE_URL}assets/hero.png`;
  const logoImage = `${import.meta.env.BASE_URL}assets/logo.png`;
  const isPhonePoster =
    layout.deviceClass === 'phone' && layout.id === 'phone-portrait';

  return (
    <main
      className={`menu-shell ${isPhonePoster ? 'menu-shell-phone-poster' : 'menu-shell-hero'}`}
      data-testid="main-menu-screen"
      aria-label="Main Menu"
    >
      <div
        className="menu-backdrop"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden="true"
      />
      <AmbientSilhouetteLayer variant="menu" />
      <div className="menu-street-signage" aria-hidden="true">
        <span>No Dice</span>
        <strong>Own The Block</strong>
        <span>No Overnights</span>
      </div>

      <img
        src={logoImage}
        alt="Mean Streets"
        className="menu-logo"
        data-testid="menu-logo"
      />

      <nav className="menu-nav" aria-label="Menu Actions">
        <button
          className="menu-btn menu-btn-primary"
          onClick={onNewGame}
          data-testid="new-game-button"
        >
          New Game
        </button>

        <button
          className="menu-btn"
          onClick={onLoadGame}
          disabled={!canLoadGame}
          data-testid="load-game-button"
        >
          Load Game
        </button>

        <button
          className="menu-btn"
          onClick={onCollection}
          data-testid="collection-button"
        >
          Collection
        </button>

        <button
          className="menu-btn"
          onClick={onGarage}
          data-testid="garage-button"
        >
          Garage
        </button>

        <button
          className="menu-btn"
          onClick={onCards}
          data-testid="cards-button"
        >
          Cards
          {availablePacks > 0 && (
            <span className="menu-btn-badge">{availablePacks}</span>
          )}
        </button>
      </nav>
    </main>
  );
}
