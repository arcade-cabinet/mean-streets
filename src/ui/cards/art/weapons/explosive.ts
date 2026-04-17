/** Explosive — molotov bottle with rag fuse, flame at top. */
export function explosivePose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M50 42 L48 36 L50 28 L56 24 L64 24 L70 28 L72 36 L70 42Z" fill="#1a1a1a"/>
    <rect x="56" y="20" width="8" height="6" rx="1" fill="#1a1a1a"/>
    <rect x="57" y="14" width="6" height="8" rx="1" fill="#1a1a1a"/>
    <path d="M58 14 L62 14 L63 8 L61 6 L59 8Z" fill="#1a1a1a"/>
    <path d="M50 42 L44 62 Q45 75 60 76 Q75 75 76 62 L70 42Z" fill="#1a1a1a"/>
    <path d="M54 44 L52 58 Q53 68 60 69 Q67 68 68 58 L66 44Z" fill="${accent}" opacity="0.3"/>
    <path d="M59 6 C58 4 57 2 59 0 C61 2 61 1 60 3 C62 1 63 0 62 -1 C64 2 64 5 61 6 C63 4 63 8 60 8 C57 8 57 4 59 6Z" fill="${accent}" opacity="0.9"/>
    <path d="M57 10 C56 8 57 6 59 7 C58 9 59 10 60 9 C60 11 58 12 57 10Z" fill="${accent}" opacity="0.7"/>
  </svg>`;
}
