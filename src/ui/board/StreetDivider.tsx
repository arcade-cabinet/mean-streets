interface StreetDividerProps {
  phase: string;
  roundNumber: number;
}

export function StreetDivider({ phase, roundNumber }: StreetDividerProps) {
  return (
    <div className="street-divider">
      <div className="street-divider-line" />
      <div className="street-divider-copy">
        <span className="street-divider-phase">{phase}</span>
        <span className="street-divider-dot">·</span>
        <span>ROUND {roundNumber}</span>
      </div>
      <div className="street-divider-line" />
    </div>
  );
}
