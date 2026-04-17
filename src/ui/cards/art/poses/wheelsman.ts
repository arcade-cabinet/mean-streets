/** Wheelsman — behind a steering wheel, leaning forward, getaway driver. */
export function wheelsmanPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 4 C56 4 53 7 53 11 C53 15 56 18 60 18 C64 18 67 15 67 11 C67 7 64 4 60 4Z" fill="#1a1a1a"/>
    <path d="M50 19 L54 21 L66 21 L70 19 L72 42 L68 78 L62 78 L60 44 L58 78 L52 78 L48 42Z" fill="#1a1a1a"/>
    <path d="M70 19 L78 24 L82 36 L82 46 L78 46 L76 36Z" fill="#1a1a1a"/>
    <path d="M50 19 L42 24 L38 36 L38 46 L42 46 L44 36Z" fill="#1a1a1a"/>
    <circle cx="60" cy="42" r="18" fill="none" stroke="#1a1a1a" stroke-width="4"/>
    <circle cx="60" cy="42" r="3.5" fill="#1a1a1a"/>
    <line x1="60" y1="24" x2="60" y2="38" stroke="#1a1a1a" stroke-width="3"/>
    <line x1="43" y1="52" x2="57" y2="44" stroke="#1a1a1a" stroke-width="3"/>
    <line x1="77" y1="52" x2="63" y2="44" stroke="#1a1a1a" stroke-width="3"/>
    <path d="M42 52 Q60 62 78 52" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  </svg>`;
}
