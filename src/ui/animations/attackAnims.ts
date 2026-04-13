import gsap from 'gsap';
import type { AttackOutcome } from '../../sim/turf/types';

/** Kill: target shatters — shrinks, rotates, fades out. */
export function animateKill(targetEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .to(targetEl, { scale: 0, rotation: 15, opacity: 0, duration: 0.8, ease: 'power2.in' });
  });
}

/** Flip: card flips horizontally (scaleX collapses then expands). */
export function animateFlip(targetEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .to(targetEl, { scaleX: 0, duration: 0.4, ease: 'power2.in' })
      .to(targetEl, { scaleX: 1, duration: 0.4, ease: 'power2.out' });
  });
}

/** Wound/Sick: shake left-right + red border flash. */
export function animateWound(targetEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .to(targetEl, { x: -5, duration: 0.05, repeat: 5, yoyo: true })
      .to(targetEl, { x: 0, duration: 0.1 })
      .to(targetEl, { borderColor: '#ef4444', duration: 0.2 })
      .to(targetEl, { borderColor: '', duration: 0.3 });
  });
}

/** Miss/Bust: attacker recoils and snaps back. */
export function animateMiss(attackerEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .to(attackerEl, { x: -10, duration: 0.15, ease: 'power2.out' })
      .to(attackerEl, { x: 0, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
  });
}

/** Splash: adjacent positions pulse a red glow simultaneously. */
export function animateSplash(adjacentEls: HTMLElement[]): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    adjacentEls.forEach(el => {
      tl.to(el, { boxShadow: '0 0 15px rgba(239,68,68,0.8)', duration: 0.3 }, 0)
        .to(el, { boxShadow: 'none', duration: 0.3 }, 0.3);
    });
  });
}

/** Seize: position bounces to signal ownership change. */
export function animateSeize(positionEl: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .fromTo(
        positionEl,
        { scale: 1.1 },
        { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' },
      );
  });
}

/**
 * Dispatch the right animation for an AttackOutcome.
 * Game state is already updated before this is called — animation is visual polish only.
 */
export function animateOutcome(
  outcome: Pick<AttackOutcome, 'type'>,
  targetEl: HTMLElement | null,
  attackerEl: HTMLElement | null,
  adjacentEls?: HTMLElement[],
): Promise<void> {
  switch (outcome.type) {
    case 'kill':    return targetEl   ? animateKill(targetEl)     : Promise.resolve();
    case 'flip':    return targetEl   ? animateFlip(targetEl)     : Promise.resolve();
    case 'sick':    return targetEl   ? animateWound(targetEl)    : Promise.resolve();
    case 'miss':    return attackerEl ? animateMiss(attackerEl)   : Promise.resolve();
    case 'busted':  return attackerEl ? animateMiss(attackerEl)   : Promise.resolve();
    case 'seized':  return targetEl   ? animateSeize(targetEl)    : Promise.resolve();
    default:        return Promise.resolve();
  }
}
