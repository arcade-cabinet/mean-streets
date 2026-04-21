import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { CardsScreen } from '../CardsScreen';

const mockCollection = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const mockProfile = vi.hoisted(() => ({
  unlockedCardIds: [] as string[],
  cardInstances: {} as Record<
    string,
    { rolledRarity: string; unlockDifficulty: string }
  >,
  wins: 0,
  lastPlayedAt: null as string | null,
}));

vi.mock('../../../platform/persistence/collection', () => ({
  loadCollection: () => Promise.resolve(mockCollection),
}));

vi.mock('../../../platform/persistence/storage', () => ({
  loadProfile: () => Promise.resolve(mockProfile),
}));

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('CardsScreen', () => {
  beforeEach(() => {
    mockCollection.length = 0;
    mockProfile.unlockedCardIds = [];
    mockProfile.cardInstances = {};
    mockProfile.wins = 0;
    mockProfile.lastPlayedAt = null;
  });

  it('renders owned card instances with rolled rarity in the gallery', async () => {
    mockCollection.push({
      kind: 'tough',
      id: 'card-001',
      name: 'Rolled Thorn',
      tagline: '',
      archetype: 'bruiser',
      affiliation: 'kings_row',
      power: 5,
      resistance: 5,
      rarity: 'legendary',
      abilities: [],
    });
    mockProfile.unlockedCardIds = ['card-001'];
    mockProfile.cardInstances = {
      'card-001': {
        rolledRarity: 'legendary',
        unlockDifficulty: 'hard',
      },
    };

    const { container } = render(
      wrap(<CardsScreen onBack={vi.fn()} onStartGame={vi.fn()} />),
    );

    await waitFor(() => {
      expect(
        container.querySelector('.card-shell[data-testid="card-card-001"]'),
      ).not.toBeNull();
    });
    expect(
      container.querySelector('.card-shell[data-testid="card-card-001"]')
        ?.className,
    ).toContain(
      'card-rarity-legendary',
    );
    expect(screen.getByTestId('card-unlock-badge').textContent).toBe('H');
  });
});
