import heroImage from '../../assets/hero.png';
import { useAppShell } from '../../platform';

interface MainMenuScreenProps {
  onNewGame: () => void;
  onSettings: () => void;
}

interface MenuButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
  testId: string;
}

function MenuButton({ label, onClick, disabled = false, tone = 'secondary', testId }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`menu-button ${tone === 'primary' ? 'menu-button-primary' : ''} ${disabled ? 'menu-button-disabled' : ''}`}
    >
      <span className="menu-button-label">{label}</span>
    </button>
  );
}

export function MainMenuScreen({
  onNewGame,
  onSettings,
}: MainMenuScreenProps) {
  const { layout } = useAppShell();

  return (
    <div className="menu-shell" data-testid="main-menu-screen" data-menu-variant={layout.menuVariant}>
      <div className="menu-backdrop" style={{ backgroundImage: `url(${heroImage})` }} />
      <div className="menu-grain" />

      <section className={`menu-content menu-content-${layout.menuVariant}`}>
        <div className="menu-copy">
          <p className="menu-kicker">Southside Tactical Card War</p>
          <h1 className="menu-title">MEAN STREETS</h1>
          <p className="menu-subtitle">
            Stack heat, push product, and seize the block in a deterministic turf war with no dice and no coin flips.
          </p>
        </div>

        <div className={`menu-actions menu-actions-${layout.menuVariant}`}>
          <MenuButton label="New Game" onClick={onNewGame} tone="primary" testId="new-game-button" />
          <MenuButton label="Settings" onClick={onSettings} testId="settings-button" />
        </div>
      </section>
    </div>
  );
}
