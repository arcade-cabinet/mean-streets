/** Stack — thick money stack with banded bills, seen from a slight angle. */
export function stackPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M24 62 L24 56 L96 56 L96 62Z" fill="#1a1a1a"/>
    <path d="M24 56 L24 50 L96 50 L96 56Z" fill="#1a1a1a" opacity="0.85"/>
    <path d="M24 50 L24 44 L96 44 L96 50Z" fill="#1a1a1a" opacity="0.75"/>
    <path d="M24 44 L24 38 L96 38 L96 44Z" fill="#1a1a1a" opacity="0.65"/>
    <path d="M24 38 L24 32 L96 32 L96 38Z" fill="#1a1a1a" opacity="0.55"/>
    <path d="M24 32 L24 26 L96 26 L96 32Z" fill="#1a1a1a" opacity="0.45"/>
    <path d="M96 26 L96 62 L100 58 L100 22 Z" fill="#1a1a1a" opacity="0.6"/>
    <path d="M24 26 L96 26 L100 22 L28 22 Z" fill="#1a1a1a" opacity="0.5"/>
    <line x1="24" y1="50" x2="96" y2="50" stroke="${accent}" stroke-width="1.5" opacity="0.5"/>
    <line x1="24" y1="44" x2="96" y2="44" stroke="${accent}" stroke-width="1" opacity="0.35"/>
    <line x1="24" y1="38" x2="96" y2="38" stroke="${accent}" stroke-width="1" opacity="0.3"/>
    <rect x="36" y="46" width="48" height="8" rx="1" fill="${accent}" opacity="0.6"/>
    <line x1="36" y1="50" x2="84" y2="50" stroke="#1a1a1a" stroke-width="1.5"/>
    <text x="60" y="53" text-anchor="middle" font-family="serif" font-size="6" font-weight="bold" fill="#1a1a1a" opacity="0.8">$$$</text>
  </svg>`;
}
