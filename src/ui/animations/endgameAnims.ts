import gsap from 'gsap';

/**
 * Victory: remaining crew cards rise and glow gold.
 * Call this on the GameOverScreen container element after it mounts.
 */
export function animateVictory(containerEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.fromTo(containerEl, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    const title = containerEl.querySelector('[data-anim="title"]');
    if (title) {
      tl.fromTo(title,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' },
        0.3
      );
      tl.to(title,
        { textShadow: '0 0 30px rgba(245, 158, 11, 0.8)', duration: 0.6 },
        0.8
      );
    }
    const stats = containerEl.querySelectorAll('[data-anim="stat"]');
    if (stats.length > 0) {
      tl.fromTo(stats,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, duration: 0.4 },
        1.0
      );
    }
  });
}

/**
 * Defeat: board darkens, elements scatter/fade.
 */
export function animateDefeat(containerEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.fromTo(containerEl, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    const title = containerEl.querySelector('[data-anim="title"]');
    if (title) {
      tl.fromTo(title,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power2.out' },
        0.3
      );
      tl.to(title,
        { textShadow: '0 0 20px rgba(239, 68, 68, 0.6)', duration: 0.6 },
        0.8
      );
    }
    const stats = containerEl.querySelectorAll('[data-anim="stat"]');
    if (stats.length > 0) {
      tl.fromTo(stats,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, duration: 0.4 },
        1.2
      );
    }
  });
}
