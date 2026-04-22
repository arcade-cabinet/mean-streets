/**
 * ResolutionOverlay — end-of-turn playback.
 *
 * Sim resolvePhase runs synchronously the moment both sides commit
 * end_turn. State is already final by the time this overlay mounts — we
 * just animate the *already-resolved* queued strikes in dominance order
 * for visual feedback. Tap-to-skip is wired: any tap on the backdrop
 * completes immediately. The parent unmounts us once `turnNumber` has
 * bumped, which is the signal the sim has fully advanced.
 *
 * No dependency on framer-motion; pure React with CSS-driven transitions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueuedAction } from '../../sim/turf/types';

interface ResolutionOverlayProps {
  /** All queued strikes from BOTH sides at the moment of End Turn, in
   * the dominance order the sim will resolve them. */
  strikes: QueuedAction[];
  /** Whether a raid fired this resolve. Triggers the red flash phase. */
  raidFired: boolean;
  /** Number of mythics that flipped sides during this resolve. */
  mythicsFlipped: number;
  /** Called when the playback finishes (or tap-to-skip). */
  onDone: () => void;
  /** Milliseconds per strike step. Defaults to 600. */
  stepMs?: number;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'raid' }
  | { kind: 'strike'; index: number }
  | { kind: 'mythic' }
  | { kind: 'done' };

export function ResolutionOverlay({
  strikes, raidFired, mythicsFlipped, onDone, stepMs = 600,
}: ResolutionOverlayProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase({ kind: 'done' });
    // onDone() is called by the useEffect when phase becomes 'done',
    // so we don't call it here to avoid the double-callback.
  }, []);

  // Drive the phase state machine on mount + each phase change. Each
  // branch schedules the next transition and returns a single cleanup
  // closure that clears the timer reference.
  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    if (phase.kind === 'idle') {
      setPhase(raidFired ? { kind: 'raid' } : { kind: 'strike', index: 0 });
      return clear;
    }
    if (phase.kind === 'raid') {
      timerRef.current = setTimeout(() => {
        setPhase({ kind: 'strike', index: 0 });
      }, stepMs);
      return clear;
    }
    if (phase.kind === 'strike') {
      if (phase.index >= strikes.length) {
        setPhase(mythicsFlipped > 0 ? { kind: 'mythic' } : { kind: 'done' });
        return clear;
      }
      timerRef.current = setTimeout(() => {
        setPhase({ kind: 'strike', index: phase.index + 1 });
      }, stepMs);
      return clear;
    }
    if (phase.kind === 'mythic') {
      timerRef.current = setTimeout(() => {
        setPhase({ kind: 'done' });
      }, stepMs);
      return clear;
    }
    if (phase.kind === 'done') onDone();
    return clear;
  }, [phase, stepMs, strikes.length, raidFired, mythicsFlipped, onDone]);

  if (phase.kind === 'done') return null;

  const currentStrike =
    phase.kind === 'strike' && phase.index < strikes.length ? strikes[phase.index] : null;

  return (
    <div
      className="resolution-overlay"
      role="status"
      aria-live="polite"
      aria-label="Resolving end of turn"
      onClick={finish}
      data-testid="resolution-overlay"
    >
      {phase.kind === 'raid' && (
        <div className="resolution-raid-flash" data-testid="resolution-raid-flash">
          <span className="resolution-raid-title">RAID</span>
          <span className="resolution-raid-sub">Market cleared · Tops seized</span>
        </div>
      )}
      {currentStrike && (
        <div
          className={`resolution-strike resolution-strike-${currentStrike.kind}`}
          data-testid={`resolution-strike-${phase.kind === 'strike' ? phase.index : ''}`}
        >
          <span className="resolution-strike-side">Side {currentStrike.side}</span>
          <span className="resolution-strike-kind">
            {currentStrike.kind === 'direct_strike' ? 'DIRECT'
              : currentStrike.kind === 'pushed_strike' ? 'PUSHED'
                : 'RECRUIT'}
          </span>
          <span className="resolution-strike-arrow">
            T{currentStrike.turfIdx + 1} → T{currentStrike.targetTurfIdx + 1}
          </span>
        </div>
      )}
      {phase.kind === 'mythic' && (
        <div className="resolution-mythic" data-testid="resolution-mythic">
          <span className="resolution-mythic-title">MYTHIC FLIP</span>
          <span className="resolution-mythic-sub">
            {mythicsFlipped} mythic{mythicsFlipped === 1 ? '' : 's'} changed hands
          </span>
        </div>
      )}
      <div className="resolution-skip">Tap anywhere to skip</div>
    </div>
  );
}
