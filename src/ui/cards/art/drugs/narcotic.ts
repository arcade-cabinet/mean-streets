/** Narcotic — heat-sealed powder bag with tied top, product stencil lines. */
export function narcoticPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M38 28 L42 24 L78 24 L82 28 L84 60 Q84 68 60 68 Q36 68 36 60Z" fill="#1a1a1a"/>
    <path d="M42 24 L78 24 L74 18 L46 18Z" fill="#1a1a1a"/>
    <path d="M46 18 L74 18 L72 14 L48 14Z" fill="#1a1a1a"/>
    <path d="M40 30 L80 30 L82 52 Q80 64 60 64 Q40 64 38 52Z" fill="${accent}" opacity="0.25"/>
    <path d="M44 38 L76 38" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
    <path d="M42 46 L78 46" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
    <path d="M44 54 L76 54" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
    <rect x="52" y="30" width="16" height="6" rx="1" fill="${accent}" opacity="0.6"/>
    <line x1="56" y1="32" x2="64" y2="32" stroke="#1a1a1a" stroke-width="1.5"/>
    <line x1="60" y1="30" x2="60" y2="36" stroke="#1a1a1a" stroke-width="1.5"/>
  </svg>`;
}
