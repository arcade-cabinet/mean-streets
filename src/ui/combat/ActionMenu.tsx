/**
 * ActionMenu — horizontal action type selector bar for combat phase.
 * Shows available attack types and disables them when no valid attackers exist.
 */

import { CardFrame } from '../cards';

interface ActionMenuProps {
  selected: string | null;
  onSelect: (action: string) => void;
  onPass: () => void;
  actionsRemaining: number;
  hasDirectReady: boolean;
  hasFundedReady: boolean;
  hasPushReady: boolean;
  orientation?: 'horizontal' | 'vertical';
}

interface ActionButtonProps {
  label: string;
  action: string;
  selected: string | null;
  disabled: boolean;
  onSelect: (action: string) => void;
}

function ActionButton({ label, action, selected, disabled, onSelect }: ActionButtonProps) {
  const isSelected = selected === action;
  return (
    <button
      onClick={() => !disabled && onSelect(action)}
      disabled={disabled}
      data-testid={`action-${action}`}
      className={`game-action-button ${
        isSelected
          ? 'game-action-button-selected'
          : disabled
            ? 'game-action-button-disabled'
            : 'game-action-button-idle'
      }`}
    >
      <CardFrame variant="button" className="card-frame-svg card-frame-svg-action-button" />
      <span className="game-action-button-label">{label}</span>
    </button>
  );
}

export function ActionMenu({
  selected,
  onSelect,
  onPass,
  actionsRemaining,
  hasDirectReady,
  hasFundedReady,
  hasPushReady,
  orientation = 'horizontal',
}: ActionMenuProps) {
  const exhausted = actionsRemaining <= 0;

  return (
    <div className={`game-action-menu ${orientation === 'vertical' ? 'game-action-menu-vertical' : 'game-action-menu-horizontal'}`}>
      <CardFrame variant="button" className="card-frame-svg card-frame-svg-action-menu" />
      <span className={`game-action-readout ${orientation === 'horizontal' ? 'game-action-readout-inline' : ''}`}>
        ACT <span className="game-action-readout-value">{actionsRemaining}</span>
      </span>

      <ActionButton label="Direct" action="direct" selected={selected} disabled={exhausted || !hasDirectReady} onSelect={onSelect} />
      <ActionButton label="Funded" action="funded" selected={selected} disabled={exhausted || !hasFundedReady} onSelect={onSelect} />
      <ActionButton label="Pushed" action="pushed" selected={selected} disabled={exhausted || !hasPushReady} onSelect={onSelect} />
      <ActionButton label="Stack" action="stack" selected={selected} disabled={exhausted} onSelect={onSelect} />

      <div className={orientation === 'vertical' ? 'game-action-divider game-action-divider-vertical' : 'game-action-divider game-action-divider-horizontal'} />

      <button
        onClick={onPass}
        data-testid="action-pass"
        className="game-action-button game-action-button-pass"
      >
        <CardFrame variant="button" className="card-frame-svg card-frame-svg-action-button" />
        <span className="game-action-button-label">Pass</span>
      </button>
    </div>
  );
}
