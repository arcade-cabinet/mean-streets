/**
 * HeatMeter — shared cop-heat gauge (0..1).
 *
 * v0.3 §9: heat is a global resource accruing from escalation actions
 * (pushed strikes, kills, mythic trades). At ~0.8 the raid phase fires at
 * end-of-turn. The meter is centered at the top of GameScreen on tablet/
 * desktop and collapses to a small inline chip on phone-portrait.
 */
interface HeatMeterProps {
  /** Heat value in [0, 1]. */
  value: number;
  /** If true, renders the phone-portrait inline chip instead of the bar. */
  compact?: boolean;
  /** Raid-threshold fraction; rendered as a tick line on the bar. */
  raidThreshold?: number;
}

function heatLabel(value: number, threshold: number): string {
  if (value >= threshold) return 'RAID IMMINENT';
  if (value >= threshold * 0.75) return 'HIGH';
  if (value >= threshold * 0.5) return 'ELEVATED';
  if (value >= threshold * 0.25) return 'LOW';
  return 'COOL';
}

/** Map 0..1 to a color stop; green → amber → red as heat climbs. */
function heatColor(fraction: number): string {
  if (fraction >= 0.8) return 'var(--ms-heat-critical, #ef4444)';
  if (fraction >= 0.55) return 'var(--ms-heat-high, #f59e0b)';
  if (fraction >= 0.3) return 'var(--ms-heat-mid, #eab308)';
  return 'var(--ms-heat-cool, #22c55e)';
}

export function HeatMeter({ value, compact = false, raidThreshold = 0.8 }: HeatMeterProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  const fill = heatColor(clamped);
  const label = heatLabel(clamped, raidThreshold);
  const thresholdPct = Math.round(raidThreshold * 100);

  if (compact) {
    return (
      <div
        className={`heat-meter heat-meter-compact ${clamped >= raidThreshold ? 'heat-meter-imminent' : ''}`}
        data-testid="heat-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Heat ${pct} percent, ${label}`}
      >
        <span className="heat-meter-chip-label">HEAT</span>
        <span className="heat-meter-chip-value" style={{ color: fill }}>{pct}%</span>
        {clamped >= raidThreshold && <span className="heat-meter-chip-pulse" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div
      className={`heat-meter ${clamped >= raidThreshold ? 'heat-meter-imminent' : ''}`}
      data-testid="heat-meter"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Heat ${pct} percent, ${label}`}
    >
      <div className="heat-meter-header">
        <span className="heat-meter-title">HEAT</span>
        <span className="heat-meter-label" style={{ color: fill }}>{label}</span>
        <span className="heat-meter-value">{pct}%</span>
      </div>
      <div className="heat-meter-track">
        <div
          className="heat-meter-fill"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
        <div
          className="heat-meter-threshold"
          style={{ left: `${thresholdPct}%` }}
          aria-hidden="true"
          title={`Raid threshold (${thresholdPct}%)`}
        />
      </div>
    </div>
  );
}
