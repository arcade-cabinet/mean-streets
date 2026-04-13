interface StreetDividerProps {
  phase: string;
  roundNumber: number;
}

export function StreetDivider({ phase, roundNumber }: StreetDividerProps) {
  return (
    <div className="flex items-center gap-3 my-2 px-4">
      <div className="flex-1 border-t border-amber-700/60" />
      <div className="flex items-center gap-2 text-amber-500 font-mono text-xs tracking-widest select-none">
        <span className="uppercase">{phase}</span>
        <span className="text-amber-700">·</span>
        <span>ROUND {roundNumber}</span>
      </div>
      <div className="flex-1 border-t border-amber-700/60" />
    </div>
  );
}
