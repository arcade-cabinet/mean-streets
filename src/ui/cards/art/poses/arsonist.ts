/** Arsonist — arm extended holding a lighter, flame dancing at thumb, destructive lean. */
export function arsonistPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M62 5 C58 5 55 8 55 12 C55 16 58 19 62 19 C66 19 69 16 69 12 C69 8 66 5 62 5Z" fill="#1a1a1a"/>
    <path d="M52 20 L56 22 L68 22 L72 20 L74 46 L70 78 L64 78 L62 50 L60 78 L54 78 L50 46Z" fill="#1a1a1a"/>
    <path d="M52 20 L42 30 L38 44 L42 45 L48 32Z" fill="#1a1a1a"/>
    <path d="M72 20 L82 26 L90 24 L92 18 L88 16 L84 22Z" fill="#1a1a1a"/>
    <rect x="89" y="14" width="5" height="8" rx="1" fill="#1a1a1a"/>
    <rect x="90" y="12" width="3" height="4" rx="0.5" fill="#1a1a1a"/>
    <path d="M91 10 C90 8 89 6 91 4 C93 6 93 5 92 7 C94 5 95 3 94 1 C96 4 97 7 94 10 C96 8 96 12 93 12 C90 12 90 8 91 10Z" fill="${accent}" opacity="0.9"/>
    <circle cx="91" cy="11" r="1.5" fill="${accent}" opacity="0.6"/>
  </svg>`;
}
