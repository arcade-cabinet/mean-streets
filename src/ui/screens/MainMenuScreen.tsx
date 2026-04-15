import { useAppShell } from '../../platform';
import { ArchiveRestore, Crosshair } from 'lucide-react';
import { CardFrame } from '../cards';

interface MainMenuScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  canLoadGame: boolean;
}

interface MenuButtonProps {
  label: string;
  detail: string;
  icon: 'crosshair' | 'load';
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
  testId: string;
}

function MenuButton({ label, detail, icon, onClick, disabled = false, tone = 'secondary', testId }: MenuButtonProps) {
  const Icon = icon === 'crosshair'
    ? Crosshair
    : ArchiveRestore;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`menu-button ${tone === 'primary' ? 'menu-button-primary' : ''} ${disabled ? 'menu-button-disabled' : ''}`}
    >
      <CardFrame variant="button" className="card-frame-svg card-frame-svg-button" />
      <span className="menu-button-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="menu-button-copy">
        <span className="menu-button-label">{label}</span>
        <span className="menu-button-detail">{detail}</span>
      </span>
    </button>
  );
}

export function MainMenuScreen({
  onNewGame,
  onLoadGame,
  canLoadGame,
}: MainMenuScreenProps) {
  const { layout } = useAppShell();
  const heroImage = `${import.meta.env.BASE_URL}assets/hero.png`;
  const logoImage = `${import.meta.env.BASE_URL}assets/logo.png`;

  return (
    <main className="menu-shell" data-testid="main-menu-screen" data-menu-variant={layout.menuVariant} aria-label="Main Menu">
      <div className="menu-backdrop" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true" />
      <div className="menu-grain" aria-hidden="true" />

      <h1 className="menu-title-a11y">Mean Streets: Precision Starvation</h1>

      <img
        src={logoImage}
        alt="Mean Streets: Precision Starvation"
        className={`menu-logo menu-logo-${layout.menuVariant}`}
        data-testid="menu-logo"
      />

      <section className={`menu-content menu-content-${layout.menuVariant}`} aria-label="Menu Actions">
        <div className="menu-topbar">
          <div className={`menu-actions menu-actions-${layout.menuVariant}`}>
            <MenuButton
              label="New Game"
              detail="Build your deck and take the street."
              icon="crosshair"
              onClick={onNewGame}
              tone="primary"
              testId="new-game-button"
            />
            <MenuButton
              label="Load Game"
              detail={canLoadGame ? 'Resume a committed run from the last save.' : 'No committed run saved yet.'}
              icon="load"
              onClick={onLoadGame}
              disabled={!canLoadGame}
              testId="load-game-button"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
