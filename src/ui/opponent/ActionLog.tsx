import { useCallback } from 'react';

interface ActionLogProps {
  entries: string[];
}

export function ActionLog({ entries }: ActionLogProps) {
  const visible = entries.slice(-5);
  const scrollAnchorRef = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div
      className="bg-stone-900/80 border border-stone-700 rounded overflow-y-auto font-mono"
      style={{ maxHeight: '120px' }}
    >
      {visible.length === 0 ? (
        <p className="text-xs text-stone-500 px-2 py-1">No actions yet</p>
      ) : (
        visible.map((entry, i) => (
          <p key={i} className="text-xs text-stone-400 px-2 py-0.5 leading-tight">
            {entry}
          </p>
        ))
      )}
      <div key={visible.length} ref={scrollAnchorRef} />
    </div>
  );
}
