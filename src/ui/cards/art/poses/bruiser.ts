/** Bruiser — heavy stance, fists raised, broad shoulders. */
export function bruiserPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 5 C56 5 53 8 53 12 C53 16 56 19 60 19 C64 19 67 16 67 12 C67 8 64 5 60 5Z" fill="#1a1a1a"/>
    <path d="M48 20 L42 35 L38 50 L42 52 L50 38 L55 22Z" fill="#1a1a1a"/>
    <path d="M72 20 L78 35 L82 50 L78 52 L70 38 L65 22Z" fill="#1a1a1a"/>
    <path d="M50 20 L55 22 L65 22 L70 20 L72 45 L68 78 L62 78 L60 50 L58 78 L52 78 L48 45Z" fill="#1a1a1a"/>
    <rect x="36" y="49" width="8" height="5" rx="2" fill="#1a1a1a"/>
    <rect x="76" y="49" width="8" height="5" rx="2" fill="#1a1a1a"/>
    <path d="M54 22 L66 22 L68 28 L52 28Z" fill="${accent}" opacity="0.7"/>
  </svg>`;
}
