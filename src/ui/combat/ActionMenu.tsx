/**
 * ActionMenu — horizontal action type selector bar for combat phase.
 * Shows available attack types and disables them when no valid attackers exist.
 */

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
      className={`px-4 py-2 rounded text-xs font-bold tracking-widest uppercase transition-all border
        ${isSelected
          ? 'bg-amber-500 text-stone-900 border-amber-400 shadow-lg shadow-amber-900/50'
          : disabled
            ? 'bg-stone-800 text-stone-600 border-stone-700 cursor-not-allowed'
            : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700 hover:text-amber-200'
        }`}
    >
      {label}
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
      <span className={`text-stone-500 text-xs font-mono ${orientation === 'horizontal' ? 'mr-2' : ''}`}>
        ACT <span className="text-amber-300 font-bold">{actionsRemaining}</span>
      </span>

      <ActionButton label="Direct" action="direct" selected={selected} disabled={exhausted || !hasDirectReady} onSelect={onSelect} />
      <ActionButton label="Funded" action="funded" selected={selected} disabled={exhausted || !hasFundedReady} onSelect={onSelect} />
      <ActionButton label="Pushed" action="pushed" selected={selected} disabled={exhausted || !hasPushReady} onSelect={onSelect} />
      <ActionButton label="Stack" action="stack" selected={selected} disabled={exhausted} onSelect={onSelect} />

      <div className={orientation === 'vertical' ? 'h-px bg-stone-700 my-1' : 'w-px bg-stone-700 self-stretch mx-1'} />

      <button
        onClick={onPass}
        data-testid="action-pass"
        className="px-4 py-2 rounded text-xs font-bold tracking-widest uppercase transition-all border bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
      >
        Pass
      </button>
    </div>
  );
}
