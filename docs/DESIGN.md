---
title: Game Design
updated: 2026-04-14
status: current
domain: product
---

# Mean Streets — Game Design (v0.2 Stack Redesign)

This document owns the **vision and identity** of the game: why it exists,
what kind of game it is, and what it is not. Mechanical detail lives in
[RULES.md](./RULES.md). Launch readiness lives in
[PRODUCTION.md](./PRODUCTION.md). Tech stack lives in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Identity

Mean Streets is not a poker game, not a deckbuilder roguelike, not a
standard card battler. It is a **turf war** played with cards. The cards
represent people, product, weapons, and money on the streets. You are
defending a block, not playing a hand.

## What It Is

- A MTG-style full-sized card game where every card on your turf is
  visible and contributes.
- A **stack-based** tactical game — your turfs are cumulative piles, and
  their top reads as a dynamic composite of who's there, what they're
  carrying, and what allegiances are in play.
- A game about **affiliation geometry** — drawing rivals without a
  buffer forces you to discard. Planning your crew's social fabric is
  as important as planning its firepower.
- A game with **packs, not deckbuilding**. You own a collection. You
  play the collection. Your skill shows up in how you deploy it
  turn-to-turn.
- A game with **difficulty as a serious axis**. Easy teaches; Nightmare
  and Sudden Death are earned.

## What It Is Not

- Not random — no dice, no coin flip; outcomes are deterministic.
- Not a port of the original POC — completely redesigned from the
  ground up.
- Not abstract — every card is a named character with a gang, an
  archetype, and a role.
- Not a quarter-card game. v0.1's pocket/backpack/runner system is
  retired. Every card is first-class.
- Not a deckbuilder. Your collection IS your deck.

## Core Loop

```
Open starter pack (20 toughs + 15 modifiers)
  → Pick difficulty (2×3 grid)
  → Draw 1 card per turn
  → 3–5 actions per turn: play cards, strike, recruit
  → Keep your turfs alive
  → Seize opponent's turfs to win
  → Earn packs; harder difficulty = better packs
  → Sudden Death on win = rarity-boosted rewards
```

## Design Philosophy

### Determinism Over Randomness

The only randomness is deck draw order and difficulty-gated AI noise.
All combat resolves from stack totals. Removing dice forced every
mechanic to pull its weight.

### Every Card Is Unique

100 named toughs, each with an archetype and an affiliation. Weapons
and drugs are authored categories with flavor. Currency is the
economic bedrock. The Brawl Stars model: shipped cards are never
re-tuned once locked; expansions ship net-new cards.

### Affiliation As Geometry

Affiliations are not cosmetic tags. They are a directed graph of
loyalties and rivalries. Rival toughs on the same turf **cannot
coexist** without a buffer. This makes every turf a puzzle — balancing
raw power against social compatibility.

### Stack, Don't Slot

Positions have no fixed slot count. A turf is a **pile** of cards you
commit to that block. Early turfs are small; late turfs are towers.
The UI never shows the pile visibly — it shows a live composite that
summarizes who's there, what they carry, and their cumulative
Power/Resistance.

### Strike The Stack, Not The Slot

Combat targets an entire opponent turf as a single aggregate. Default
strikes hit the top tough. Special archetypes and legendaries unlock
**strike-bottom** and **strike-anywhere** to target older foundations
or cherry-pick threats.

### Rarity As A Balance Lever

Commons anchor the median. Rares provide statistical edges at a 25%
drop rate. Legendaries are 5% drops with signature abilities. The
autobalancer weights winrate by expected deck frequency, so
under-sampled legendaries get a wider pass band than common filler.

### Difficulty Shapes The Game

AI looseness, player action economy, and turf count all scale with
difficulty. Easy is a sandbox with 5 turfs and a noisy AI. Nightmare
is 2 turfs and a surgical AI. Ultra-Nightmare is 1 turf, 2-ply
lookahead, and Sudden Death locked on.

## Difficulty Grid

```
┌──────────┬──────────┬──────────┐
│  Easy    │  Medium  │  Hard    │  ← default row
│  5 turfs │  4 turfs │  3 turfs │
├──────────┼──────────┼──────────┤
│ Nightmare│  Sudden  │  Ultra-  │  ← advanced row
│  2 turfs │  Death   │ Nightmare│
│          │  1 turf  │  1 turf  │
└──────────┴──────────┴──────────┘
```

The Sudden Death cell is a **toggle** that overlays any of the other
difficulties. Ultra-Nightmare is its own tier that **locks Sudden
Death on**.

## Ship Target: Web First, Mobile Soon

- **Web** is the current ship target (GitHub Pages, auto-deploy on
  merge to `main`).
- **Mobile** (Android via debug APK first, then signed release; iOS to
  follow) resumes once the web build is locked.
- Every mechanic and UI decision must survive the mobile-touch surface,
  safe areas, and portrait orientation as the default — but we don't
  fire mobile releases until the v0.2 web build is stable.

Detailed launch criteria and platform gates live in
[PRODUCTION.md](./PRODUCTION.md).

## Design History

1. **POC** — Shared 52-card deck, 4 suits, precision rule.
2. **Gang decks** — 20 cards per faction, day/night dual-stats.
3. **Individual characters** — 100 named fighters, archetypes,
   affiliations.
4. **Turf war v0.1** — 5v5 position seizure, 4 card types, backpacks
   and runners, quarter-card slotting.
5. **Stack redesign v0.2** *(current)* — MTG-style full-sized cards,
   stack-based turfs, pack economy, rarity grades, difficulty grid.
   Scrapped: quarter-cards, backpacks, runners, active/reserve split,
   buildup/combat phase split, deckbuilding.

## Future Direction

- **Authored lore pass** — every card's name, tagline, and ability
  text starts procedurally generated and is enriched in an editorial
  pass. v0.1 creative writing (100 tough names, archetypes,
  affiliations, taglines) carries forward into v0.2 intact.
- **Pack economy expansion** — seasonal packs, themed affiliation
  bundles, and milestone packs awarded for collection completion.
- **Expansions** — future content ships as net-new cards; shipped
  cards keep their stats forever.
