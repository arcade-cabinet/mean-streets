/**
 * OrientationOverlay — shown during a modifier drag over a crew position.
 * Top half = OFFENSE (amber), bottom half = DEFENSE (blue).
 * Pointer-events: none so it doesn't interfere with drop target events.
 */

interface OrientationOverlayProps {
  visible: boolean;
}

export function OrientationOverlay({ visible }: OrientationOverlayProps) {
  if (!visible) return null;

  return (
    <div className="orientation-overlay">
      <div className="orientation-overlay-half orientation-overlay-half-offense">
        <span className="orientation-overlay-label orientation-overlay-label-offense">
          OFFENSE
        </span>
      </div>
      <div className="orientation-overlay-half orientation-overlay-half-defense">
        <span className="orientation-overlay-label orientation-overlay-label-defense">
          DEFENSE
        </span>
      </div>
    </div>
  );
}
