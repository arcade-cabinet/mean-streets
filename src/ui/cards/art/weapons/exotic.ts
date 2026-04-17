/** Exotic — brass knuckles with chain links draping from them. */
export function exoticPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <rect x="30" y="38" width="50" height="18" rx="4" fill="#1a1a1a"/>
    <circle cx="40" cy="42" r="5" fill="#1a1a1a"/>
    <circle cx="53" cy="42" r="5" fill="#1a1a1a"/>
    <circle cx="66" cy="42" r="5" fill="#1a1a1a"/>
    <circle cx="79" cy="42" r="4" fill="#1a1a1a"/>
    <circle cx="40" cy="42" r="3" fill="${accent}" opacity="0.5"/>
    <circle cx="53" cy="42" r="3" fill="${accent}" opacity="0.5"/>
    <circle cx="66" cy="42" r="3" fill="${accent}" opacity="0.5"/>
    <circle cx="79" cy="42" r="2.5" fill="${accent}" opacity="0.5"/>
    <rect x="34" y="52" width="42" height="6" rx="2" fill="#1a1a1a"/>
    <ellipse cx="72" cy="24" rx="5" ry="3.5" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>
    <ellipse cx="82" cy="28" rx="5" ry="3.5" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>
    <ellipse cx="90" cy="34" rx="5" ry="3.5" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>
    <ellipse cx="96" cy="41" rx="5" ry="3.5" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>
    <ellipse cx="72" cy="24" rx="3" ry="2" fill="none" stroke="${accent}" stroke-width="1" opacity="0.6"/>
    <ellipse cx="90" cy="34" rx="3" ry="2" fill="none" stroke="${accent}" stroke-width="1" opacity="0.6"/>
  </svg>`;
}
