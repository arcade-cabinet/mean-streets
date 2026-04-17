import type { ReactNode } from 'react';
import type { AppSettings } from '../deckbuilder/storage';
import { CardFrame } from '../cards';

export type DrawerTab = 'settings' | 'rules';

interface ModalFrameProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ModalFrame({ title, subtitle, onClose, children, className }: ModalFrameProps) {
  return (
    <div className="app-modal-backdrop" role="presentation">
      <div className={`app-modal ${className ?? ''}`.trim()}>
        <div className="app-modal-header">
          <div>
            <p className="app-modal-kicker">{subtitle}</p>
            <h2 className="app-modal-title">{title}</h2>
          </div>
          <button className="app-modal-close" onClick={onClose} aria-label="Close modal">
            <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
            <span className="utility-button-label">Close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

export function SettingsPanel({ settings, onClose, onChange }: SettingsPanelProps) {
  return (
    <div className="app-modal-body app-modal-body-compact">
      <label className="settings-row">
        <div>
          <span className="settings-label">Audio Enabled</span>
          <p className="settings-copy">Noir soundscape toggle for future audio work.</p>
        </div>
        <span className="settings-toggle">
          <input
            className="settings-toggle-input"
            type="checkbox"
            checked={settings.audioEnabled}
            onChange={(event) => onChange({ ...settings, audioEnabled: event.target.checked })}
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </span>
      </label>
      <label className="settings-row">
        <div>
          <span className="settings-label">Reduced Motion</span>
          <p className="settings-copy">Tones down presentation movement and heavy transitions.</p>
        </div>
        <span className="settings-toggle">
          <input
            className="settings-toggle-input"
            type="checkbox"
            checked={settings.motionReduced}
            onChange={(event) => onChange({ ...settings, motionReduced: event.target.checked })}
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </span>
      </label>
      <div className="app-modal-actions">
        <button className="menu-button menu-button-primary" onClick={onClose} data-testid="close-settings-button">
          <span className="menu-button-label">Done</span>
        </button>
      </div>
    </div>
  );
}

interface RulesPanelProps {
  compact?: boolean;
}

export function RulesPanel({ compact = false }: RulesPanelProps) {
  return (
    <div className={`app-modal-body ${compact ? 'app-modal-body-compact' : ''}`}>
      <section className="modal-section">
        <span className="modal-section-label">The War</span>
        <p className="modal-helper">Each side defends one active turf at a time. Stack toughs and modifiers to build power. When your turf falls, the next reserve promotes up. Lose all your turfs and you lose the war.</p>
      </section>
      <section className="modal-section">
        <span className="modal-section-label">Combat</span>
        <p className="modal-helper">Strikes deal damage based on your power vs their resistance. Toughs have HP — wounds accumulate across turns. No dice, no coin flips. Only board state and draw order.</p>
      </section>
      <section className="modal-section">
        <span className="modal-section-label">The Street</span>
        <p className="modal-helper">Heat rises as you play cards. High heat attracts raids — cops seize your toughs. Use the Black Market to trade modifiers, or send toughs to Holding to protect them.</p>
      </section>
    </div>
  );
}

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <ModalFrame title="Rules" subtitle="Street Brief" onClose={onClose}>
      <RulesPanel />
      <div className="app-modal-actions">
        <button className="menu-button menu-button-primary" onClick={onClose} data-testid="close-rules-button">
          <span className="menu-button-label">Understood</span>
        </button>
      </div>
    </ModalFrame>
  );
}

interface GameMenuDrawerProps {
  settings: AppSettings;
  activeTab: DrawerTab;
  onSelectTab: (tab: DrawerTab) => void;
  onClose: () => void;
  onChangeSettings: (settings: AppSettings) => void;
}

export function GameMenuDrawer({
  settings,
  activeTab,
  onSelectTab,
  onClose,
  onChangeSettings,
}: GameMenuDrawerProps) {
  return (
    <ModalFrame title="Game Menu" subtitle="Run Paused" onClose={onClose} className="app-modal-drawer">
      <div className="drawer-tab-row">
        <button className={`drawer-tab ${activeTab === 'settings' ? 'drawer-tab-active' : ''}`} onClick={() => onSelectTab('settings')}>
          <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
          <span className="utility-button-label">Settings</span>
        </button>
        <button className={`drawer-tab ${activeTab === 'rules' ? 'drawer-tab-active' : ''}`} onClick={() => onSelectTab('rules')}>
          <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
          <span className="utility-button-label">Rules</span>
        </button>
      </div>
      {activeTab === 'settings' ? (
        <SettingsPanel settings={settings} onClose={onClose} onChange={onChangeSettings} />
      ) : (
        <RulesPanel compact />
      )}
    </ModalFrame>
  );
}
