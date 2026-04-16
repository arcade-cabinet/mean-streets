import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MYTHIC_IDS, MythicSymbol } from '../MythicSymbol';

describe('MythicSymbol', () => {
  it('renders the correct SVG src for a given mythic id', () => {
    const { container } = render(<MythicSymbol mythicId="mythic-01" />);
    const img = container.querySelector('img.mythic-symbol-art');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/mythics/mythic-01.svg');
  });

  it('renders the shared gold ring svg in addition to the art', () => {
    const { container } = render(<MythicSymbol mythicId="mythic-02" />);
    // Two SVGs are NOT expected — the ring is one inline SVG and the art is an
    // <img>. So the container should have exactly one inline svg (the ring).
    const inlineSvgs = container.querySelectorAll('svg.mythic-symbol-ring');
    expect(inlineSvgs).toHaveLength(1);
    // And the ring should have two concentric <circle> elements.
    const circles = inlineSvgs[0].querySelectorAll('circle');
    expect(circles).toHaveLength(2);
  });

  it('renders with a stable data-testid for every id in the roster', () => {
    for (const id of MYTHIC_IDS) {
      const { unmount } = render(<MythicSymbol mythicId={id} />);
      expect(screen.getByTestId(`mythic-${id}`)).not.toBeNull();
      unmount();
    }
  });

  it('applies custom size via inline style on both wrapper and art', () => {
    const { container } = render(
      <MythicSymbol mythicId="mythic-03" size={72} />,
    );
    const el = container.querySelector('.mythic-symbol') as HTMLElement;
    expect(el.style.width).toBe('72px');
    expect(el.style.height).toBe('72px');
    const img = container.querySelector(
      'img.mythic-symbol-art',
    ) as HTMLImageElement;
    expect(img.width).toBe(72);
    expect(img.height).toBe(72);
  });

  it('applies the active halo class when active=true', () => {
    const { container } = render(
      <MythicSymbol mythicId="mythic-04" active />,
    );
    expect(container.querySelector('.mythic-symbol-active')).not.toBeNull();
  });

  it('omits the active halo class when active is false or unset', () => {
    const { container } = render(<MythicSymbol mythicId="mythic-04" />);
    expect(container.querySelector('.mythic-symbol-active')).toBeNull();
  });

  it('throws when given an invalid mythic id', () => {
    // Defensive check: catalog drift should fail loud, not render a 404 img.
    // We intentionally suppress React's error-boundary console noise.
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() =>
        render(<MythicSymbol mythicId="not-a-mythic" />),
      ).toThrow(/invalid mythicId/);
    } finally {
      console.error = originalError;
    }
  });

  it('exposes the canonical 10-mythic roster via MYTHIC_IDS', () => {
    expect(MYTHIC_IDS).toHaveLength(10);
    for (const id of MYTHIC_IDS) {
      expect(id).toMatch(/^mythic-\d{2}$/);
    }
    // All ids are unique.
    expect(new Set(MYTHIC_IDS).size).toBe(10);
  });
});
