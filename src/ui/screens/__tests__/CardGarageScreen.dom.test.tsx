import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { CardGarageScreen } from '../CardGarageScreen';

const mockInventory = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const mockPrefs = vi.hoisted(
  () => [] as Array<{ cardId: string; enabled: boolean; priority: number }>,
);

vi.mock('../../../platform/persistence/collection', () => ({
  loadCollectionInventory: () => Promise.resolve(mockInventory),
  loadPreferences: () => Promise.resolve(mockPrefs),
  mergeCollectionBucket: () => Promise.resolve(null),
  savePreferences: () => Promise.resolve(),
}));

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('CardGarageScreen', () => {
  beforeEach(() => {
    mockInventory.length = 0;
    mockPrefs.length = 0;
  });

  it('renders owned mythics in the tough section', async () => {
    mockInventory.push({
      card: {
        kind: 'tough',
        id: 'mythic-01',
        name: 'Mythic Test Card',
        tagline: '',
        archetype: 'bruiser',
        affiliation: 'kings_row',
        power: 10,
        resistance: 10,
        rarity: 'mythic',
        abilities: [],
      },
      unlockDifficulty: 'hard',
    });
    mockPrefs.push({ cardId: 'mythic-01::mythic', enabled: true, priority: 5 });

    render(wrap(<CardGarageScreen onBack={vi.fn()} />));

    await waitFor(() => {
      expect(screen.getByTestId('garage-row-mythic-01-mythic')).not.toBeNull();
    });
    expect(screen.getByTestId('garage-section-tough')).not.toBeNull();
    expect(screen.getByTestId('garage-group-tough-mythic')).not.toBeNull();
  });

  it('groups unlocked toughs by their rolled rarity instead of authored base rarity', async () => {
    mockInventory.push({
      card: {
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
      },
      unlockDifficulty: 'hard',
    });
    mockPrefs.push({ cardId: 'card-001::legendary', enabled: true, priority: 5 });

    render(wrap(<CardGarageScreen onBack={vi.fn()} />));

    await waitFor(() => {
      expect(screen.getByTestId('garage-row-card-001-legendary')).not.toBeNull();
    });
    expect(screen.getByTestId('garage-group-tough-legendary')).not.toBeNull();
    expect(screen.queryByTestId('garage-group-tough-common')).toBeNull();
  });

  it('enables merge when a bucket has two matching copies', async () => {
    mockInventory.push(
      {
        card: {
          kind: 'tough',
          id: 'card-001',
          name: 'Rolled Thorn',
          tagline: '',
          archetype: 'bruiser',
          affiliation: 'kings_row',
          power: 5,
          resistance: 5,
          rarity: 'common',
          abilities: [],
        },
        unlockDifficulty: 'easy',
      },
      {
        card: {
          kind: 'tough',
          id: 'card-001',
          name: 'Rolled Thorn',
          tagline: '',
          archetype: 'bruiser',
          affiliation: 'kings_row',
          power: 5,
          resistance: 5,
          rarity: 'common',
          abilities: [],
        },
        unlockDifficulty: 'hard',
      },
    );
    mockPrefs.push({ cardId: 'card-001::common', enabled: true, priority: 5 });

    render(wrap(<CardGarageScreen onBack={vi.fn()} />));

    await waitFor(() => {
      expect(screen.getByTestId('garage-row-card-001-common')).not.toBeNull();
    });
    expect(screen.getByTestId('garage-dupes-card-001-common').textContent).toBe('×2');
    expect(
      (
        screen.getByTestId(
          'garage-merge-card-001-common',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
