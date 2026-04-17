/** Enforcer — wide stance, weapon at side, intimidating. */
export function enforcerPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 4 C56 4 53 7 53 11 C53 15 56 18 60 18 C64 18 67 15 67 11 C67 7 64 4 60 4Z" fill="#1a1a1a"/>
    <path d="M48 19 L53 21 L67 21 L72 19 L75 48 L70 78 L64 78 L60 50 L56 78 L50 78 L45 48Z" fill="#1a1a1a"/>
    <path d="M72 19 L80 30 L82 45 L78 46 L74 32Z" fill="#1a1a1a"/>
    <path d="M48 19 L40 30 L38 45 L42 46 L46 32Z" fill="#1a1a1a"/>
    <rect x="80" y="38" width="3" height="18" rx="1" fill="#1a1a1a"/>
    <rect x="79" y="38" width="5" height="4" rx="1" fill="${accent}" opacity="0.7"/>
    <path d="M52 19 L68 19 L70 24 L50 24Z" fill="${accent}" opacity="0.5"/>
  </svg>`;
}
