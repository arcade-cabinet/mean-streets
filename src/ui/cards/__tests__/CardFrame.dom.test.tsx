import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardFrame } from '../CardFrame';

describe('CardFrame', () => {
  it('renders an SVG element', () => {
    const { container } = render(<CardFrame variant="crew" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('is hidden from assistive tech', () => {
    const { container } = render(<CardFrame variant="card" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies custom className', () => {
    const { container } = render(<CardFrame variant="slot" className="test-frame" />);
    expect(container.querySelector('.test-frame')).not.toBeNull();
  });

  it('uses rarity accent only for card variant', () => {
    const { container: c1 } = render(<CardFrame variant="card" rarity="legendary" />);
    const path1 = c1.querySelector('svg path')!;
    expect(path1.getAttribute('fill')).toContain('245, 158, 11');

    const { container: c2 } = render(<CardFrame variant="crew" rarity="legendary" />);
    const path2 = c2.querySelector('svg path')!;
    expect(path2.getAttribute('fill')).toContain('178, 42, 30');
  });

  it('uses common stroke for card variant with common rarity', () => {
    const { container } = render(<CardFrame variant="card" rarity="common" />);
    const rect = container.querySelector('svg rect')!;
    expect(rect.getAttribute('stroke')).toContain('148, 163, 184');
  });

  it('uses rare stroke for card variant with rare rarity', () => {
    const { container } = render(<CardFrame variant="card" rarity="rare" />);
    const rect = container.querySelector('svg rect')!;
    expect(rect.getAttribute('stroke')).toContain('56, 189, 248');
  });

  it('renders all SVG structural elements', () => {
    const { container } = render(<CardFrame variant="card" />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelectorAll('path').length).toBe(3);
  });
});
