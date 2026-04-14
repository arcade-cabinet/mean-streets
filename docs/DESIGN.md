---
title: Game Design
updated: 2026-04-14
status: current
domain: product
---

# Mean Streets — Game Design

This document owns the **vision and identity** of the game: why it exists,
what kind of game it is, and what it is not. Mechanical detail lives in
[RULES.md](./RULES.md). Launch readiness lives in
[PRODUCTION.md](./PRODUCTION.md). Tech stack lives in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Identity

Mean Streets is not a poker game, not a deckbuilder roguelike, not a standard
card battler. It is a **turf war** played with cards. The cards represent
people, product, weapons, and money on the streets. You are running an
operation, not playing a hand.

## What It Is

- A tactical position-control game where every card placement is a decision.
- A game about building up operations and choosing when to strike.
- A game where affiliations create real constraints and opportunities.
- A game that rewards learning your deck — every card has a name and a
  personality.
- A game where the mid- and late-game economy is about **seizing,
  redistributing, and repackaging** held cash, drugs, and weapons, not pure
  crew attrition.

## What It Is Not

- Not random — no dice, no coin flip; outcomes are deterministic.
- Not a port of the original POC — completely redesigned from the ground up.
- Not abstract — every card is a named character with a gang, an archetype,
  and a role.
- Not complicated to learn — full-sized cards hold quarter-card payloads in
  fixed slots; slot position determines effect.

## Core Loop

```
Build deck (25 toughs + backpacks packed with weapons/drugs/cash)
  → Buildup (place toughs, stage runners, pack reserve positions)
  → Combat (5 actions/round, simultaneous, attack/build/reclaim)
  → Seize all 5 opponent positions → win
  → Earn unlocks, build new decks
```

## Design Philosophy

### Determinism Over Randomness

The only randomness is deck draw order. All outcomes (attacks, flips,
seizures, splash) are resolved from card stats and board state. Removing
dice forced every mechanic to pull its weight. Simulation proved 50/50
winrate holds without luck.

### All Card Types Must Matter

If a card type (weapon, drug, cash, backpack, runner) cannot be removed
without breaking a strategic axis, it earns its place. The balance gate
refuses to ship a version where any card type is decorative.

### Every Card Is Unique

No generic slots; no "a weapon." Each weapon, drug, and tough is an authored
card with a name, stats, and a place in the catalog. The Brawl Stars model:
shipped cards are never re-tuned once locked. Expansions add new cards.

### Seize → Redistribute, Not Seize → Discard

Quarter-cards (weapons, drugs, cash) never vanish on seizure. They transfer
to the opponent with the carrier. The mid- and late-game are about turning
captured stash into pressure, not grinding through dead HP pools.

## Ship Target: Mobile First

- Web is the development and QA harness.
- Primary store targets are Android and iOS via Capacitor.
- Every mechanic and UI decision must survive the mobile-touch surface,
  safe areas, and portrait orientation as the default.

Detailed launch criteria and platform gates live in
[PRODUCTION.md](./PRODUCTION.md).

## Design History

The game evolved through major pivots. Each pivot was driven by simulation
data (10k+ games) identifying balance issues:

1. **POC** — Shared 52-card deck, 4 suits, precision rule.
2. **Gang decks** — 20 cards per faction, day/night dual-stats.
3. **Individual characters** — 100 named fighters, archetypes, affiliations.
4. **Turf war** — 5v5 position seizure, 4 card types, stacking.
5. **Unified modifier system** — Quarter-card slots, single power/resistance.
6. **Backpacks and runners** — Solves the quarter-card draw problem;
   reserve-only staging, free-swap into active, mid-game economy built on
   captured stash.

## Future Direction

- **Authored lore pass** — every card's name, tagline, and ability text
  starts procedurally generated and is enriched in an editorial pass.
- **Achievement-driven unlocks** — baseline set unlocked by default;
  additional toughs, weapons, drugs, backpacks, cash denominations earn
  through gameplay.
- **Expansions** — future content ships as net-new cards; shipped cards
  keep their stats forever.
