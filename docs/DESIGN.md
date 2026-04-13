---
title: Game Design
updated: 2026-04-13
status: current
domain: product
---

# Mean Streets — Game Design Document

## Identity

Mean Streets is NOT a poker game, NOT a deckbuilder roguelike, NOT a standard card battler. It is a **turf war** played with cards. The cards represent people, product, weapons, and money on the streets. You're running an operation, not playing a hand.

## What It IS

- A tactical position-control game where every card placement is a decision
- A game where orientation matters — same card placed top vs bottom has opposite effects
- A game about building up operations and choosing when to strike
- A game where affiliations create real constraints and opportunities
- A game that rewards learning your deck — every card has a name and personality

## What It IS NOT

- Not random — no dice, no coin flip, outcomes are deterministic
- Not a port of the original POC — completely redesigned from the ground up
- Not abstract — every card is a named character with a gang, an archetype, and a role
- Not complicated to learn — you stack cards on other cards, top = attack, bottom = defend

## Core Loop

```
Build Deck (25 crew + 25 modifiers from collection)
    → Buildup Phase (place crew, stack modifiers, decide when to strike)
    → Combat Phase (5 actions/round, attack/build/reclaim)
    → Win by seizing all 5 opponent positions
    → Earn unlocks, build new decks
```

## Production Targets

| Target | Requirement |
|--------|-------------|
| Web | Primary development, simulation, and QA surface |
| Android | Store-ready Capacitor target |
| iOS | Store-ready Capacitor target |
| Persistence | Shared SQLite-backed repositories across web and native |
| Accessibility | Pointer drag/drop plus tap-to-arm/tap-to-place interaction path |
| Responsive UX | Explicit portrait, landscape, tablet, and fold-aware layout variants |

## Implementation Matrix

| System | Status | Production Expectation |
|--------|--------|------------------------|
| Deck flow | Implemented | `Menu -> DeckBuilder -> Buildup -> Combat -> GameOver` |
| Modifier deck legality | Implemented | 25 modifiers with category minimums enforced |
| Deterministic sim | Implemented | Seeded draw-order randomness only |
| Planner/policy AI | Active | Same engine powers runtime and simulation |
| Visual identity | In progress | Must align fully to `public/poc.html` before release |
| Category abilities | In progress | Visible rules must be fully resolved or hidden |
| Archetype abilities | In progress | Visible rules must be fully resolved or hidden |
| Persistence/profile | In progress | SQLite-backed, no localStorage product path |
| Unlock progression | In progress | Backed by profile state, not placeholder UI |
| Native/mobile UX | In progress | Touch-safe, safe-area aware, store-ready |

## Card Design

### Crew Card Layout

```
┌─────────────────────┐
│ [DRUG]  [PWR]  [WEAP]│  ← top: offensive quarter-card slots
│ [CASH]   👊   [CASH] │  ← center: affiliation + currency slots
│ [DRUG]  [RES]  [WEAP]│  ← bottom: defensive quarter-card slots
│     "Brick"          │  ← name
└─────────────────────┘
```

- PWR (Power): center top number — how hard you hit
- RES (Resistance): center bottom number — how much you absorb
- 6 quarter-card slots: drug/weapon top-left/right (offense), bottom-left/right (defense), cash center-left/right

### Quarter-Card Orientation

The same quarter-card has opposite effects based on placement:

| Card | Top Slot (Offense) | Bottom Slot (Defense) |
|------|-------------------|----------------------|
| Brass Knuckles | +2 power when attacking | +2 resistance when attacked |
| Purple Haze | Buff potency applied to target | Buff potency applied to self |
| $100 bill | Funds flip attempts / pushed attacks | Protects against being flipped |

This is the core strategic decision: do you use your Brass Knuckles to hit harder or to survive longer?

### Weapon Categories

5 categories, 10 weapons each = 50 total. Each weapon has dual offense/defense abilities based on placement.

| Category | Offense (top) | Defense (bottom) | Bonus Range |
|----------|--------------|-----------------|-------------|
| Bladed | LACERATE: target bleeds | PARRY: counter-damage | 1-3 |
| Blunt | SHATTER: destroy modifier on kill | BRACE: absorb damage | 2-4 |
| Explosive | BLAST: splash adjacent | DETERRENT: extra defense threshold | 2-4 |
| Ranged | REACH: target any position | OVERWATCH: damage placed crew | 1-2 |
| Stealth | AMBUSH: no retaliation | EVASION: dodge attacks | 1-2 |

### Drug Categories

5 categories, 10 drugs each = 50 total. Each drug has dual offense/defense abilities based on placement.

| Category | Offense (top) | Defense (bottom) | Potency Range |
|----------|--------------|-----------------|---------------|
| Stimulant | RUSH: skip cooldown | REFLEXES: counter-attack | 1-3 |
| Sedative | SUPPRESS: reduce power | NUMB: ignore damage | 2-4 |
| Hallucinogen | CONFUSE: easier flips | PARANOIA: harder flips against | 1-3 |
| Steroid | BULK: +power | FORTIFY: +resistance | 2-4 |
| Narcotic | BERSERK: +power, self-damage | PAINKILLERS: survive kills | 1-2 |

### Currency

Two denominations: $100 and $1000. Players always have 25x $100 + 5x $1000. Additional copies unlockable via achievements (ephemeral). In-game events can award bonus cash.

## Archetypes

Each crew card has an archetype that defines its special ability:

| Archetype | Ability | Strategic Role |
|-----------|---------|---------------|
| Bruiser | Ignores precision rule | Guaranteed attacker, always a threat |
| Snitch | Reveals opponent's cards | Intelligence gathering |
| Lookout | Accesses reserve positions | Reserve management |
| Enforcer | Double damage vs rival affiliations | Anti-rival specialist |
| Ghost | Attacks from reserves | Surprise strikes |
| Arsonist | Splash to adjacent positions | Area damage |
| Shark | Bonus when opponent has fewer cards | Finisher |
| Fence | Sacrifice = draw 2 | Card economy |
| Medic | Double healing on sacrifice | Sustain |
| Wheelman | Swap vanguard with hand | Repositioning |
| Hustler | Steal from opponent hand | Hand disruption |
| Sniper | Targets any card, not just front | Precision elimination |

## Affiliations

10 gangs + freelancers. Each gang has at-peace and at-war relationships:

- **At peace**: funded flip threshold is lower (easier to recruit)
- **At war**: funded flip threshold is higher (they resist)
- **Freelancers**: no allegiance, easiest to flip, fit anywhere in your deck

Affiliations affect deckbuilding (can you mix Kings Row and Iron Devils who are at war?) and combat (funded attacks against friendly gangs are cheaper).

## Win Condition

Seize all 5 of your opponent's active street positions. A position is seized when you kill or flip the crew occupying it. Reclaiming a seized position costs a crew card + a cash card, and the reclaimed crew starts at half power.

## Balance Philosophy

- Deterministic outcomes (no random mid-game)
- Only randomness is deck draw order
- All 4 card types must be actively used (not decorative)
- 50/50 win rate between equal players with equal decks
- Games last 12-20 rounds (~60 total actions)
- <5% stall rate, <2 passes per game

## Design History

The game evolved through major pivots:
1. POC: Shared 52-card deck, 4 suits, precision rule
2. Gang decks: 20 cards per faction, day/night dual-stats
3. Individual characters: 100 named fighters, archetypes, affiliations
4. Turf war: 5v5 position seizure, 4 card types, stacking
5. **Current**: Unified modifier system, 6 quarter-card slots, power/resistance split

Each pivot was driven by simulation data (10k+ games) identifying balance issues.
