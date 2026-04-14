import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppShell } from '../../platform';
import type { BackpackCard, CrewCard, ModifierCard } from '../../sim/turf/types';
import { CardFrame, QuarterCard } from '../cards';
import { createAutoDeckSelection, createDeckCatalog } from '../deckbuilder/catalog';
import {
  loadCrewPresets,
  loadDeckLoadouts,
  loadModifierPresets,
  saveCrewPreset,
  saveDeckLoadout,
  saveModifierPreset,
  type CardPreset,
  type DeckLoadout,
} from '../deckbuilder/storage';
import {
  MODIFIER_MINIMUMS,
  countModifierComposition,
  hasValidModifierComposition,
} from '../deckbuilder/rules';

interface DeckBuilderScreenProps {
  onBack: () => void;
  onStartGame: (deck: { crew: CrewCard[]; modifiers: ModifierCard[]; backpacks: BackpackCard[] }) => void;
  initialDeckId?: string | null;
  onDecksChanged?: (decks: DeckLoadout[]) => void;
}

type ModifierTab = 'all' | 'weapon' | 'product' | 'cash';
type SelectionMode = 'add' | 'remove' | null;

const CREW_GOAL = 25;
const MOD_GOAL = 25;

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function suggestedDeckName(crew: CrewCard[]): string {
  const lead = crew[0];
  if (!lead) return 'Street Loadout';
  return `${lead.affiliation} Run`;
}

function cardName(card: CrewCard | ModifierCard): string {
  if (card.type === 'crew') return card.displayName;
  if (card.type === 'cash') return `$${card.denomination}`;
  return card.name;
}

function backpackSummary(card: BackpackCard): string {
  return card.payload.map((payload) => payload.type === 'product' ? 'drug' : payload.type).join(' • ');
}

function applyPresetIds(
  presetIds: string[],
  allIds: string[],
  cap: number,
): string[] {
  return presetIds.filter((id) => allIds.includes(id)).slice(0, cap);
}

function cardIsLocked(card: CrewCard | ModifierCard): boolean {
  return card.type === 'cash' ? false : card.locked;
}

interface LaneHeaderProps {
  title: string;
  subtitle: string;
  count: number;
  goal: number;
  showPresetControls?: boolean;
  presetName: string;
  presetOptions: CardPreset[];
  selectedPresetId: string;
  onPresetNameChange: (value: string) => void;
  onPresetSelect: (value: string) => void;
  onSavePreset: () => void;
  children?: ReactNode;
}

function LaneHeader({
  title,
  subtitle,
  count,
  goal,
  showPresetControls = true,
  presetName,
  presetOptions,
  selectedPresetId,
  onPresetNameChange,
  onPresetSelect,
  onSavePreset,
  children,
}: LaneHeaderProps) {
  return (
    <div className="deck-lane-header">
      <div>
        <p className="deck-lane-kicker">{subtitle}</p>
        <div className="deck-lane-title-row">
          <h2 className="deck-lane-title">{title}</h2>
          <span className={`deck-counter ${count === goal ? 'deck-counter-complete' : ''}`}>
            {count}/{goal}
          </span>
        </div>
      </div>

      {(showPresetControls || children) && (
        <div className="deck-lane-controls">
          {children}
          {showPresetControls && (
            <>
              <div className="utility-field utility-field-select">
                <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
                <select
                  className="deck-select"
                  value={selectedPresetId}
                  onChange={(event) => onPresetSelect(event.target.value)}
                >
                  <option value="">Load preset</option>
                  {presetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="utility-field">
                <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
                <input
                  className="deck-input"
                  value={presetName}
                  onChange={(event) => onPresetNameChange(event.target.value)}
                  placeholder={`Name ${title.toLowerCase()} preset`}
                />
              </div>
              <button className="deck-mini-button" onClick={onSavePreset}>
                <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
                <span className="utility-button-label">Save</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function DeckBuilderScreen({ onBack, onStartGame, initialDeckId = null, onDecksChanged }: DeckBuilderScreenProps) {
  const { layout } = useAppShell();
  const { allCrew, allModifiers, allBackpacks } = useMemo(() => {
    const catalog = createDeckCatalog();
    return { allCrew: catalog.crew, allModifiers: catalog.modifiers, allBackpacks: catalog.backpacks };
  }, []);

  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [selectedBackpackIds, setSelectedBackpackIds] = useState<string[]>([]);
  const [modifierTab, setModifierTab] = useState<ModifierTab>('all');
  const [crewPresetName, setCrewPresetName] = useState('');
  const [modifierPresetName, setModifierPresetName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [selectedCrewPresetId, setSelectedCrewPresetId] = useState('');
  const [selectedModifierPresetId, setSelectedModifierPresetId] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [crewPresets, setCrewPresets] = useState<CardPreset[]>([]);
  const [modifierPresets, setModifierPresets] = useState<CardPreset[]>([]);
  const [savedDecks, setSavedDecks] = useState<DeckLoadout[]>([]);
  const [pointerDown, setPointerDown] = useState<'crew' | 'modifier' | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [initialDeckApplied, setInitialDeckApplied] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextCrew, nextMods, nextDecks] = await Promise.all([
        loadCrewPresets(),
        loadModifierPresets(),
        loadDeckLoadouts(),
      ]);
      setCrewPresets(nextCrew);
      setModifierPresets(nextMods);
      setSavedDecks(nextDecks);
    })();
  }, []);

  useEffect(() => {
    if (!initialDeckId || initialDeckApplied || savedDecks.length === 0) return;
    const deck = savedDecks.find((entry) => entry.id === initialDeckId);
    if (!deck) {
      setInitialDeckApplied(true);
      return;
    }
    setInitialDeckApplied(true);
    setSelectedDeckId(deck.id);
    setSelectedCrewIds(applyPresetIds(deck.crewIds, allCrew.map((card) => card.id), CREW_GOAL));
    setSelectedModifierIds(applyPresetIds(deck.modifierIds, allModifiers.map((card) => card.id), MOD_GOAL));
    setSelectedBackpackIds(deck.backpackIds ?? []);
    setDeckName(deck.name);
  }, [allCrew, allModifiers, initialDeckApplied, initialDeckId, savedDecks]);

  const visibleModifiers = useMemo(() => {
    if (modifierTab === 'all') return allModifiers;
    return allModifiers.filter((card) => card.type === modifierTab);
  }, [allModifiers, modifierTab]);

  const selectedCrew = useMemo(
    () => selectedCrewIds
      .map((id) => allCrew.find((card) => card.id === id))
      .filter((card): card is CrewCard => !!card),
    [allCrew, selectedCrewIds],
  );

  const selectedModifiers = useMemo(
    () => selectedModifierIds
      .map((id) => allModifiers.find((card) => card.id === id))
      .filter((card): card is ModifierCard => !!card),
    [allModifiers, selectedModifierIds],
  );

  const selectedBackpacks = useMemo(
    () => selectedBackpackIds
      .map((id) => allBackpacks.find((card) => card.id === id))
      .filter((card): card is BackpackCard => !!card),
    [allBackpacks, selectedBackpackIds],
  );

  const modifierComposition = useMemo(
    () => countModifierComposition(selectedModifiers),
    [selectedModifiers],
  );
  const hasLegalModifierMix = useMemo(
    () => hasValidModifierComposition(selectedModifiers),
    [selectedModifiers],
  );

  const canSaveDeck = selectedCrew.length === CREW_GOAL
    && selectedModifiers.length === MOD_GOAL
    && hasLegalModifierMix
    && deckName.trim().length > 0;
  const canStartGame = selectedCrew.length === CREW_GOAL
    && selectedModifiers.length === MOD_GOAL
    && hasLegalModifierMix;

  function toggleCrew(id: string, forcedMode?: SelectionMode) {
    setSelectedCrewIds((prev) => {
      const selected = prev.includes(id);
      const mode = forcedMode ?? (selected ? 'remove' : 'add');
      if (mode === 'add') {
        if (selected || prev.length >= CREW_GOAL) return prev;
        return [...prev, id];
      }
      return prev.filter((cardId) => cardId !== id);
    });
  }

  function toggleModifier(id: string, forcedMode?: SelectionMode) {
    setSelectedModifierIds((prev) => {
      const selected = prev.includes(id);
      const mode = forcedMode ?? (selected ? 'remove' : 'add');
      if (mode === 'add') {
        if (selected || prev.length >= MOD_GOAL) return prev;
        return [...prev, id];
      }
      return prev.filter((cardId) => cardId !== id);
    });
  }

  function toggleBackpack(id: string, forcedMode?: SelectionMode) {
    setSelectedBackpackIds((prev) => {
      const selected = prev.includes(id);
      const mode = forcedMode ?? (selected ? 'remove' : 'add');
      if (mode === 'add') {
        if (selected) return prev;
        return [...prev, id];
      }
      return prev.filter((cardId) => cardId !== id);
    });
  }

  function handleCrewPointerDown(id: string) {
    setPointerDown('crew');
    const nextMode: SelectionMode = selectedCrewIds.includes(id) ? 'remove' : 'add';
    setSelectionMode(nextMode);
    toggleCrew(id, nextMode);
  }

  function handleModifierPointerDown(id: string) {
    setPointerDown('modifier');
    const nextMode: SelectionMode = selectedModifierIds.includes(id) ? 'remove' : 'add';
    setSelectionMode(nextMode);
    toggleModifier(id, nextMode);
  }

  function handleBackpackPointerDown(id: string) {
    setPointerDown('modifier');
    const nextMode: SelectionMode = selectedBackpackIds.includes(id) ? 'remove' : 'add';
    setSelectionMode(nextMode);
    toggleBackpack(id, nextMode);
  }

  function stopPointerSelection() {
    setPointerDown(null);
    setSelectionMode(null);
  }

  function saveCrewSelectionPreset() {
    if (!crewPresetName.trim()) return;
    void (async () => {
      const next = await saveCrewPreset({
        id: nowId('crew-preset'),
        name: crewPresetName.trim(),
        cardIds: selectedCrewIds,
        updatedAt: new Date().toISOString(),
      });
      setCrewPresets(next);
      setCrewPresetName('');
    })();
  }

  function saveModifierSelectionPreset() {
    if (!modifierPresetName.trim()) return;
    void (async () => {
      const next = await saveModifierPreset({
        id: nowId('mod-preset'),
        name: modifierPresetName.trim(),
        cardIds: selectedModifierIds,
        updatedAt: new Date().toISOString(),
      });
      setModifierPresets(next);
      setModifierPresetName('');
    })();
  }

  function loadCrewSelectionPreset(presetId: string) {
    setSelectedCrewPresetId(presetId);
    const preset = crewPresets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setSelectedCrewIds(applyPresetIds(preset.cardIds, allCrew.map((card) => card.id), CREW_GOAL));
  }

  function loadModifierSelectionPreset(presetId: string) {
    setSelectedModifierPresetId(presetId);
    const preset = modifierPresets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setSelectedModifierIds(applyPresetIds(preset.cardIds, allModifiers.map((card) => card.id), MOD_GOAL));
  }

  function saveDeck() {
    if (!canSaveDeck) return;
    void (async () => {
      const nextDecks = await saveDeckLoadout({
        id: nowId('deck'),
        name: deckName.trim(),
        crewIds: selectedCrewIds,
        modifierIds: selectedModifierIds,
        backpackIds: selectedBackpackIds,
        updatedAt: new Date().toISOString(),
      });
      setSavedDecks(nextDecks);
      onDecksChanged?.(nextDecks);
      setSelectedDeckId(nextDecks[0]?.id ?? '');
      setDeckName('');
    })();
  }

  function handleStartGame() {
    if (!canStartGame) return;
    onStartGame({
      crew: selectedCrew,
      modifiers: selectedModifiers,
      backpacks: selectedBackpacks,
    });
  }

  function loadDeck(deckId: string) {
    setSelectedDeckId(deckId);
    const deck = savedDecks.find((entry) => entry.id === deckId);
    if (!deck) return;
    setSelectedCrewIds(applyPresetIds(deck.crewIds, allCrew.map((card) => card.id), CREW_GOAL));
    setSelectedModifierIds(applyPresetIds(deck.modifierIds, allModifiers.map((card) => card.id), MOD_GOAL));
    setSelectedBackpackIds(deck.backpackIds ?? []);
    setDeckName(deck.name);
  }

  function autoBuildDeck() {
    if ((selectedCrewIds.length > 0 || selectedModifierIds.length > 0) && !window.confirm('Auto Build will overwrite the current deck. Continue?')) {
      return;
    }

    const next = createAutoDeckSelection();
    const nextCrew = next.crewIds
      .map((id) => allCrew.find((card) => card.id === id))
      .filter((card): card is CrewCard => !!card);

    setSelectedDeckId('');
    setSelectedCrewIds(next.crewIds);
    setSelectedModifierIds(next.modifierIds);
    setSelectedBackpackIds(next.backpackIds);
    setDeckName((current) => current.trim() || suggestedDeckName(nextCrew));
  }

  return (
    <div
      className={`deckbuilder-shell deckbuilder-shell-${layout.deckbuilderVariant}`}
      data-testid="deckbuilder-screen"
      data-layout-variant={layout.deckbuilderVariant}
      onPointerUp={stopPointerSelection}
      onPointerCancel={stopPointerSelection}
      onPointerLeave={() => {
        if (!pointerDown) return;
        stopPointerSelection();
      }}
    >
      <header className="deckbuilder-header">
        <div className="deckbuilder-heading">
          <p className="deckbuilder-kicker">Deck Workshop</p>
          <h1 className="deckbuilder-title">Build The Crew</h1>
          <div className="deckbuilder-rule" aria-hidden="true" />
          <p className="deckbuilder-subtitle">
            Assemble muscle, product, and cash into a street-ready loadout before the first shot is fired.
          </p>
        </div>

        <div className="deckbuilder-actions">
          <div className="deckbuilder-actions-top">
            <div className="utility-field utility-field-select">
              <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
              <select className="deck-select" value={selectedDeckId} onChange={(event) => loadDeck(event.target.value)}>
                <option value="">Load saved deck</option>
                {savedDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="utility-field utility-field-wide deckbuilder-name-field">
              <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
              <input
                className="deck-input deck-input-wide"
                value={deckName}
                onChange={(event) => setDeckName(event.target.value)}
                placeholder="Name full deck loadout"
                data-testid="deck-name-input"
              />
            </div>
            <button className="deck-mini-button" onClick={saveDeck} disabled={!canSaveDeck} data-testid="save-deck-button">
              <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
              <span className="utility-button-label">Save Deck</span>
            </button>
            <button className="deck-mini-button" onClick={autoBuildDeck} data-testid="auto-build-button">
              <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
              <span className="utility-button-label">Auto Build</span>
            </button>
          </div>

          <div className="deckbuilder-actions-bottom">
            <button className="deck-mini-button" onClick={onBack}>
              <CardFrame variant="button" className="card-frame-svg card-frame-svg-utility-button" />
              <span className="utility-button-label">Menu</span>
            </button>
          <button
            className={`menu-button menu-button-primary deckbuilder-start-button ${!canStartGame ? 'menu-button-disabled' : ''}`}
            onClick={handleStartGame}
            disabled={!canStartGame}
            data-testid="start-game-button"
          >
            <CardFrame variant="button" className="card-frame-svg card-frame-svg-button" />
            <span className="menu-button-label">Start Game</span>
          </button>
          </div>
        </div>
      </header>

      <section className="deck-lane">
        <LaneHeader
          title="Crew"
          subtitle="Swipe or drag across full-size cards to mark the lineup."
          count={selectedCrew.length}
          goal={CREW_GOAL}
          presetName={crewPresetName}
          presetOptions={crewPresets}
          selectedPresetId={selectedCrewPresetId}
          onPresetNameChange={setCrewPresetName}
          onPresetSelect={loadCrewSelectionPreset}
          onSavePreset={saveCrewSelectionPreset}
        />

        <div className="deck-rail" data-testid="crew-rail">
          {allCrew.map((card) => {
            const selected = selectedCrewIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-card-type="crew"
                data-testid={`collection-card-${card.id}`}
                className={`deck-card deck-card-full ${selected ? 'deck-card-selected' : ''} ${card.locked ? 'deck-card-locked' : ''}`}
                onPointerDown={() => handleCrewPointerDown(card.id)}
                onPointerEnter={() => {
                  if (pointerDown === 'crew' && selectionMode) toggleCrew(card.id, selectionMode);
                }}
                disabled={card.locked}
                title={card.unlockCondition}
              >
                <CardFrame variant="crew" className="card-frame-svg card-frame-svg-deck-card" />
                <div className="deck-card-topline">
                  <span className="deck-card-power">P{card.power}</span>
                  <span className="deck-card-defense">R{card.resistance}</span>
                </div>
                <div className="deck-card-name">{card.displayName}</div>
                <div className="deck-card-meta">{card.affiliation}</div>
                <div className="deck-card-ability">{card.archetype}</div>
                {selected && <span className="deck-card-badge">Selected</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="deck-lane">
        <LaneHeader
          title="Modifiers"
          subtitle="Tap or drag through quarter-cards to stack the tools, cash, and product."
          count={selectedModifiers.length}
          goal={MOD_GOAL}
          presetName={modifierPresetName}
          presetOptions={modifierPresets}
          selectedPresetId={selectedModifierPresetId}
          onPresetNameChange={setModifierPresetName}
          onPresetSelect={loadModifierSelectionPreset}
          onSavePreset={saveModifierSelectionPreset}
        >
          <div className="deck-tab-row">
            {(['all', 'weapon', 'product', 'cash'] as ModifierTab[]).map((tab) => (
              <button
                key={tab}
                className={`deck-tab ${modifierTab === tab ? 'deck-tab-active' : ''}`}
                onClick={() => setModifierTab(tab)}
                data-testid={
                  tab === 'all'
                    ? 'tab-all'
                    : tab === 'weapon'
                      ? 'tab-weapons'
                      : tab === 'product'
                        ? 'tab-drugs'
                        : 'tab-cash'
                }
              >
                {tab === 'all' ? 'All' : tab === 'product' ? 'Drugs' : `${tab[0].toUpperCase()}${tab.slice(1)}s`}
              </button>
            ))}
          </div>
        </LaneHeader>

        <div className="deck-rail deck-rail-quarters" data-testid="modifier-rail">
          {visibleModifiers.map((card) => {
            const selected = selectedModifierIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-card-type={card.type}
                data-testid={`collection-card-${card.id}`}
                className={`deck-card deck-card-quarter ${selected ? 'deck-card-selected' : ''} ${cardIsLocked(card) ? 'deck-card-locked' : ''}`}
                onPointerDown={() => handleModifierPointerDown(card.id)}
                onPointerEnter={() => {
                  if (pointerDown === 'modifier' && selectionMode) toggleModifier(card.id, selectionMode);
                }}
                disabled={cardIsLocked(card)}
                title={card.type === 'cash' ? 'Cash card' : card.unlockCondition}
              >
                <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-deck-card" />
                <QuarterCard card={card} compact />
                <span className="deck-quarter-name">{cardName(card)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="deck-lane">
        <LaneHeader
          title="Kits"
          subtitle="Backpacks become runner payload. Stage them in reserve, then unpack them onto the street."
          count={selectedBackpacks.length}
          goal={12}
          showPresetControls={false}
          presetName=""
          presetOptions={[]}
          selectedPresetId=""
          onPresetNameChange={() => {}}
          onPresetSelect={() => {}}
          onSavePreset={() => {}}
        />

        <div className="deck-rail deck-rail-kits" data-testid="backpack-rail">
          {allBackpacks.map((card) => {
            const selected = selectedBackpackIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-card-type="backpack"
                data-testid={`collection-card-${card.id}`}
                className={`deck-card deck-card-quarter deck-card-kit ${selected ? 'deck-card-selected' : ''} ${card.locked ? 'deck-card-locked' : ''}`}
                onPointerDown={() => handleBackpackPointerDown(card.id)}
                onPointerEnter={() => {
                  if (pointerDown === 'modifier' && selectionMode) toggleBackpack(card.id, selectionMode);
                }}
                disabled={card.locked}
                title={card.unlockCondition}
              >
                <CardFrame variant="quarter" className="card-frame-svg card-frame-svg-deck-card" />
                <div className="deck-kit-header">
                  <span className="deck-kit-icon">{card.icon}</span>
                  <span className="deck-kit-size">{card.payload.length} load</span>
                </div>
                <span className="deck-quarter-name">{card.name}</span>
                <span className="deck-card-meta">{backpackSummary(card)}</span>
                {selected && <span className="deck-card-badge">Packed</span>}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="deckbuilder-footer">
        <div className="deckbuilder-summary">
          <span className={`deck-counter ${selectedCrew.length === CREW_GOAL ? 'deck-counter-complete' : ''}`}>Crew {selectedCrew.length}/25</span>
          <span className={`deck-counter ${selectedModifiers.length === MOD_GOAL ? 'deck-counter-complete' : ''}`}>Mods {selectedModifiers.length}/25</span>
          <span className={`deck-counter ${selectedBackpacks.length > 0 ? 'deck-counter-complete' : ''}`}>Kits {selectedBackpacks.length}</span>
          <span
            className={`deck-counter ${modifierComposition.weapon >= MODIFIER_MINIMUMS.weapon ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-weapons"
          >
            Weapons {modifierComposition.weapon}/3
          </span>
          <span
            className={`deck-counter ${modifierComposition.product >= MODIFIER_MINIMUMS.product ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-drugs"
          >
            Drugs {modifierComposition.product}/3
          </span>
          <span
            className={`deck-counter ${modifierComposition.cash >= MODIFIER_MINIMUMS.cash ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-cash"
          >
            Cash {modifierComposition.cash}/3
          </span>
        </div>
        <div className="deckbuilder-footnote">
          <span className="deckbuilder-footnote-label">Street Brief</span>
          <span className="deckbuilder-note">Selected cards stay highlighted until removed or replaced by a loaded preset.</span>
        </div>
      </footer>
    </div>
  );
}
