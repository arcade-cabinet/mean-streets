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
    <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none flex flex-col z-10">
      <div className="flex-1 bg-amber-500/30 flex items-center justify-center border-b border-amber-400/50">
        <span className="text-amber-300 text-[10px] font-black tracking-widest drop-shadow">
          OFFENSE
        </span>
      </div>
      <div className="flex-1 bg-blue-500/30 flex items-center justify-center border-t border-blue-400/50">
        <span className="text-blue-300 text-[10px] font-black tracking-widest drop-shadow">
          DEFENSE
        </span>
      </div>
    </div>
  );
}
