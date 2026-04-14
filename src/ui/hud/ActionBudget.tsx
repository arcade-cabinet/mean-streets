interface ActionBudgetProps {
  remaining: number;
  total: number;
}

export function ActionBudget({ remaining, total }: ActionBudgetProps) {
  if (total === 0) return null;

  return (
    <div className="game-budget">
      <span className="game-budget-label">ACT</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`game-budget-dot ${i < remaining ? 'game-budget-dot-live' : ''}`}
        />
      ))}
    </div>
  );
}
