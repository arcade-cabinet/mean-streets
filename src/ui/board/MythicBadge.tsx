/**
 * MythicBadge — compact mythic indicator plate.
 *
 * v0.3 mythics are 10 unique, pool-owned cards that swap sides on kill.
 * The badge renders as a tiny crest in the card's upper-right corner. A
 * 'compact' variant is used for hand/compact card shells where space is
 * tight. Consumed by `<Card>` (auto-enables on rarity === 'mythic') and
 * standalone in StackFanModal / TurfCompositeCard to flag mythic toughs.
 */

interface MythicBadgeProps {
  /** Compact pill variant for tight card shells. */
  compact?: boolean;
  /** Optional owner indicator — shows a tiny A/B chip alongside the badge. */
  owner?: 'A' | 'B';
  /** Turn the badge into a button (e.g. tap to show mythic details modal). */
  onClick?: () => void;
}

export function MythicBadge({ compact = false, owner, onClick }: MythicBadgeProps) {
  const Root = onClick ? 'button' : 'div';
  return (
    <Root
      className={`mythic-badge ${compact ? 'mythic-badge-compact' : ''}`}
      aria-label={owner ? `Mythic card owned by ${owner}` : 'Mythic card'}
      data-testid="mythic-badge"
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className="mythic-badge-crest" aria-hidden="true">
        {/* Crude dagger-through-crown silhouette; CSS handles glow/pulse. */}
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
          <path d="M12 2 L14 6 L18 5 L16 9 L20 10 L16 12 L18 16 L13 14 L12 22 L11 14 L6 16 L8 12 L4 10 L8 9 L6 5 L10 6 Z" />
        </svg>
      </span>
      {!compact && <span className="mythic-badge-label">MYTHIC</span>}
      {owner && (
        <span className={`mythic-badge-owner mythic-badge-owner-${owner}`}>
          {owner}
        </span>
      )}
    </Root>
  );
}
