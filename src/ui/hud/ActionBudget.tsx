interface ActionBudgetProps {
  remaining: number;
  total: number;
}

export function ActionBudget({ remaining, total }: ActionBudgetProps) {
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-stone-500 text-xs font-mono mr-1">ACT</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border ${
            i < remaining
              ? 'bg-amber-400 border-amber-400'
              : 'bg-transparent border-stone-600'
          }`}
        />
      ))}
    </div>
  );
}
