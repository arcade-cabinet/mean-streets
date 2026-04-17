/** Hustler — smooth stance, dealing cards with one hand, counting bills with the other. */
export function hustlerPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 5 C56 5 53 8 53 12 C53 16 56 19 60 19 C64 19 67 16 67 12 C67 8 64 5 60 5Z" fill="#1a1a1a"/>
    <path d="M50 20 L54 22 L66 22 L70 20 L72 46 L68 78 L62 78 L60 48 L58 78 L52 78 L48 46Z" fill="#1a1a1a"/>
    <path d="M70 20 L80 30 L84 38 L80 40 L74 32Z" fill="#1a1a1a"/>
    <path d="M50 20 L38 28 L34 36 L38 37 L44 28Z" fill="#1a1a1a"/>
    <rect x="30" y="33" width="6" height="8" rx="1" transform="rotate(-20 33 37)" fill="${accent}" opacity="0.85"/>
    <rect x="33" y="30" width="6" height="8" rx="1" transform="rotate(-10 36 34)" fill="${accent}" opacity="0.7"/>
    <rect x="36" y="28" width="6" height="8" rx="1" transform="rotate(0 39 32)" fill="${accent}" opacity="0.55"/>
    <rect x="80" y="34" width="10" height="4" rx="1" fill="#1a1a1a"/>
    <rect x="80" y="34" width="10" height="2" rx="1" fill="${accent}" opacity="0.6"/>
  </svg>`;
}
