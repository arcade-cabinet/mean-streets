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
      className="action-log"
    >
      {visible.length === 0 ? (
        <p className="action-log-empty">No actions yet</p>
      ) : (
        visible.map((entry, i) => (
          <p key={i} className="action-log-entry">
            {entry}
          </p>
        ))
      )}
      <div key={visible.length} ref={scrollAnchorRef} />
    </div>
  );
}
