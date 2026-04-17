/** Ghost — fading edges, hunched, partial transparency. */
export function ghostPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a1a" stop-opacity="0.9"/><stop offset="1" stop-color="#1a1a1a" stop-opacity="0.15"/></linearGradient></defs>
    <path d="M60 8 C56 8 53 11 53 15 C53 19 56 22 60 22 C64 22 67 19 67 15 C67 11 64 8 60 8Z" fill="#1a1a1a" opacity="0.85"/>
    <path d="M50 23 L55 25 L65 25 L70 23 L72 50 L68 78 L52 78 L48 50Z" fill="url(#gf)"/>
    <path d="M50 23 L42 38 L40 50 L44 50Z" fill="#1a1a1a" opacity="0.5"/>
    <path d="M70 23 L78 38 L80 50 L76 50Z" fill="#1a1a1a" opacity="0.5"/>
    <circle cx="57" cy="14" r="1.5" fill="${accent}" opacity="0.9"/>
    <circle cx="63" cy="14" r="1.5" fill="${accent}" opacity="0.9"/>
  </svg>`;
}
