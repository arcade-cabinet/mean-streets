import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AffiliationSymbol, getAffiliationRelation } from '../AffiliationSymbol';

describe('AffiliationSymbol', () => {
  it('renders an img with the correct src for a given affiliation', () => {
    const { container } = render(
      <AffiliationSymbol affiliation="kings_row" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('assets/affiliations/kings_row.svg');
  });

  it('renders with data-testid', () => {
    render(<AffiliationSymbol affiliation="iron_devils" />);
    expect(screen.getByTestId('affiliation-iron_devils')).not.toBeNull();
  });

  it('applies rival glow class when context is rival', () => {
    const { container } = render(
      <AffiliationSymbol affiliation="kings_row" context="rival" />,
    );
    expect(container.querySelector('.affiliation-symbol-glow-rival')).not.toBeNull();
  });

  it('applies loyal glow class when context is loyal', () => {
    const { container } = render(
      <AffiliationSymbol affiliation="kings_row" context="loyal" />,
    );
    expect(container.querySelector('.affiliation-symbol-glow-loyal')).not.toBeNull();
  });

  it('applies no glow class when context is none', () => {
    const { container } = render(
      <AffiliationSymbol affiliation="kings_row" context="none" />,
    );
    const el = container.querySelector('.affiliation-symbol');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('affiliation-symbol-glow-rival')).toBe(false);
    expect(el!.classList.contains('affiliation-symbol-glow-loyal')).toBe(false);
  });

  it('sets data-context attribute', () => {
    render(<AffiliationSymbol affiliation="jade_dragon" context="loyal" />);
    const el = screen.getByTestId('affiliation-jade_dragon');
    expect(el.getAttribute('data-context')).toBe('loyal');
  });

  it('applies custom size', () => {
    const { container } = render(
      <AffiliationSymbol affiliation="los_diablos" size={48} />,
    );
    const el = container.querySelector('.affiliation-symbol') as HTMLElement;
    expect(el.style.width).toBe('48px');
    expect(el.style.height).toBe('48px');
  });

  it('includes aria-label for accessibility', () => {
    render(<AffiliationSymbol affiliation="dead_rabbits" />);
    const el = screen.getByTestId('affiliation-dead_rabbits');
    expect(el.getAttribute('aria-label')).toBe('dead rabbits affiliation');
  });

  it('renders freelance affiliation', () => {
    render(<AffiliationSymbol affiliation="freelance" />);
    expect(screen.getByTestId('affiliation-freelance')).not.toBeNull();
  });
});

describe('getAffiliationRelation', () => {
  it('returns loyal for known loyal pairs', () => {
    expect(getAffiliationRelation('kings_row', 'cobalt_syndicate')).toBe('loyal');
  });

  it('returns rival for known rival pairs', () => {
    expect(getAffiliationRelation('kings_row', 'iron_devils')).toBe('rival');
  });

  it('returns none for same affiliation', () => {
    expect(getAffiliationRelation('kings_row', 'kings_row')).toBe('none');
  });

  it('returns none for neutral affiliations', () => {
    expect(getAffiliationRelation('kings_row', 'jade_dragon')).toBe('none');
  });

  it('returns none for empty strings', () => {
    expect(getAffiliationRelation('', 'kings_row')).toBe('none');
  });
});
