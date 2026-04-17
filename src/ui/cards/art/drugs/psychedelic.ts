/** Psychedelic — stylised mushroom with a spiralling eye motif above it. */
export function psychedelicPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M52 62 L55 44 L65 44 L68 62Z" fill="#1a1a1a"/>
    <path d="M42 44 C42 28 78 28 78 44Z" fill="#1a1a1a"/>
    <path d="M50 44 C50 34 70 34 70 44Z" fill="${accent}" opacity="0.4"/>
    <circle cx="60" cy="36" r="4" fill="#1a1a1a"/>
    <circle cx="60" cy="36" r="2.5" fill="${accent}" opacity="0.8"/>
    <circle cx="60" cy="36" r="1" fill="#1a1a1a"/>
    <path d="M60 18 Q68 14 72 8 Q66 10 60 6 Q54 10 48 8 Q52 14 60 18Z" fill="#1a1a1a"/>
    <path d="M60 18 Q66 15 69 10 Q64 11 60 8 Q56 11 51 10 Q54 15 60 18Z" fill="${accent}" opacity="0.6"/>
    <path d="M60 20 C56 20 52 22 52 26 C52 30 56 32 60 32 C64 32 68 30 68 26 C68 22 64 20 60 20Z" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
    <path d="M60 22 C57 22 54 24 54 26 C54 28 57 30 60 30 C63 30 66 28 66 26 C66 24 63 22 60 22Z" fill="none" stroke="${accent}" stroke-width="1" opacity="0.7"/>
  </svg>`;
}
