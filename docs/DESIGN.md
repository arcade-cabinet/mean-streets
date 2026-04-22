---
title: Game Design
updated: 2026-04-16
status: current
domain: product
---

# Mean Streets — Game Design (v0.3 Single-Lane)

This document owns the **vision and identity** of the game: why it
exists, what kind of game it is, and what it is not. Mechanical
detail lives in [RULES.md](./RULES.md). Launch readiness lives in
[PRODUCTION.md](./PRODUCTION.md). Tech stack lives in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Identity

Mean Streets is not a poker game, not a deckbuilder roguelike, not a
standard card battler. It is a **turf war** played with cards, won
one block at a time. The cards represent people, product, weapons,
and money on the streets. You are defending a block — not playing a
hand — and when this block falls, the next one promotes up.

## What It Is

- A **single-lane tactical game** — each war is fought one turf at a
  time, best-of-N where N is the difficulty's turf count.
- A **stack-based** game where every card you commit to the active
  turf builds cumulative power and resistance. Late-turf engagements
  are fortresses; early turfs are skirmishes.
- An **information-asymmetric** game — your side is fully visible to
  you; the opponent's stack is mostly face-down. Every move they
  make animates visibly, but what they're holding is hidden until
  you force a reveal.
- A game of **escalating pressure** — drawing heat attracts cops.
  Cash concentration, rarity stacking, and legendary firepower all
  make noise. Raids can wipe both sides' active tops and the shared
  Black Market pool.
- A game of **roles, not decks** — cards merge into higher tiers.
  AI grows alongside you. The meta shifts war-by-war.
- A game with **genuine rarity** — mythics are 10 hand-authored
  cards, acquired only by defeating an opponent's mythic in combat
  or by earning a Perfect War.

## What It Is Not

- Not random — no dice, no coin flip. Outcomes are deterministic
  functions of draw order + rarity rolls + seeded AI noise.
- Not a port of prior designs — the v0.3 model is a from-scratch
  rewrite of v0.2.
- Not abstract — every card is a named character with a gang, an
  archetype, and a role.
- Not a slot game — a turf is a stack, not a grid.
- Not a deckbuilder — your **collection** is your deck, curated
  through pack unlocks + merge + priority sliders.
- Not sudden-death-locked — the turf-progression model replaces
  Sudden Death as a tier; Permadeath is an explicit optional stake.

## Core Loop

```
New player first run:
  starter grant → 35 cards (20 toughs + 5 weapons + 5 drugs + 5 currency)

Before each war:
  Collection management pass (merge + prioritize + enable/disable)
    ↳ AI runs the same pass on its parallel collection
  Pick difficulty (higher = better rewards AND harder AI)

During a war:
  Active turf: 1 v 1, building stacks round by round
  Each turn: 3–5 actions (5 on first turn of each new active turf)
    ↳ draw / play / retreat / modifier-swap / queue strike /
      send to black market / send to holding / end turn
  End-of-turn resolution:
    1. Raid check (heat² × difficulty_coef)
    2. Combat two-pass: gross dominance → priority modifier chain
  Turf falls → next reserve promotes up → rebuild empty stack

End of war:
  Winner earns per-turf + war-outcome packs
  Loser earns nothing
  AI earns identical rewards when it wins
```

## Design Philosophy

### Single Lane, Cumulative Effect

The mental model is **War with depth**. Two active turfs face each
other. You build; the opponent builds. Strikes queue and resolve at
end of turn. When your active turf falls, the progression queue
brings in the next — empty, fresh, with a setup-turn budget. The
game is a best-of-N of these lane engagements.

### Determinism Over Randomness

The only randomness is:
- Deck draw order (seeded).
- Rarity rolls at pack open (seeded per pack).
- AI noise (difficulty-gated, seeded per match).
- Bribe-success rolls (seeded, thresholds known in advance).

Every mechanic computes from stack totals, damage tiers, heat
scalars, and deterministic priority chains. No dice.

### Base + Rolled Rarity

Every card has two rarity dimensions:

1. **Base rarity** (the floor) — authored into identity. Common-base
   cards can roll up to legendary, but never down.
2. **Rolled rarity** (the instance) — determined at pack open.
   Scales stats + ability effects by a ×1.0 / ×1.15 / ×1.3 / ×1.5 /
   ×1.7 multiplier.

Legendary-base cards have **signature abilities** no common-base
card can get regardless of rolled rarity. Mythic-base cards each
have unique game-warping abilities and are only acquired through
defeat-in-combat or Perfect War earning.

### Merging and Progression

Your collection grows not just by unlocking new cards, but by
**merging duplicates**. The pyramid: 2 commons → 1 uncommon, 2
uncommons → 1 rare, 2 rares → 1 legendary. Legendary is the merge
ceiling; mythics cannot be merged. The merged card inherits the
higher unlock-difficulty tag of its sources.

The **AI progresses in parallel**. It earns the same packs you do
when it wins. It runs its own curation pass before each war. The
game shifts over time — your opponent isn't static.

### Visibility Asymmetry

Your own fan: fully face-up.
Opponent's fan: mostly face-down, except what retreats or resolution
have revealed. Tucked modifiers beneath the top are face-down to
the opponent until resolution forces a reveal.

**Movement is always visible.** You see draws, plays, retreats,
swaps, sends-to-holding. You just don't see CARD FACES unless
they're face-up. This is the psychological layer — what they don't
know they have is what they use against you.

### Heat + Raids As Natural Escalation

Heat is a shared scalar that grows with stack rarity concentration
and currency pressure. At turn end, raid probability = `heat² ×
difficulty_coef`. Raids resolve **before** combat: Black Market is
wiped, face-up active tops go to Lockup, or die outright when
Permadeath is active. Bail is $500 (cops pocket everything above).

This replaces Sudden Death as the escalation mechanic. The pressure
isn't time-of-match; it's **how loud you're playing**. A cautious
player on Easy might go many turns without a raid; a legendary-stacked
cash-heavy board on Hard will draw cops by turn 3.

### Tangibles vs Intangibles

Modifiers come in two flavors:
- **Tangible** — contributes raw numbers (LACERATE +1 atk, BRACE +1
  def). Applied in dominance calc.
- **Intangible** — alters resolution flow (PARRY counters, bribes
  cancel, Mythic CLEAN_SLATE wipes heat). Fires in priority order
  during Pass 2.

Priority during Pass 2: affiliations → currency (bribes) → drugs →
weapons. Later categories cascade from earlier ones. A successful
bribe cancels before any weapon counter fires.

### Damage Tiers, Not Binary Outcomes

Strikes resolve in four tiers based on P/R ratio:
- P < R: glance (0 damage, busted)
- R ≤ P < 1.5R: wound (damage = P-R+1)
- 1.5R ≤ P < 2R: serious wound (damage = P-R+2)
- P ≥ 2R: crushing (damage = P-R+3)
- P ≥ 3R: instant kill

Wounded toughs persist, but their effective P and R clamp to
`hp/maxHp` ratio. This rewards attrition — you can chip a tough
down over multiple turns before the final blow. Healing becomes a
real defensive axis via PATCHUP drugs, FIELD_MEDIC auras,
RESUSCITATE one-shots, or Black Market heals.

### Black Market and Holding As Economic Levers

Displaced modifiers end up in the shared Black Market pool. Either
player can spend toughs + currency to trade up or heal wounded
toughs. The pool depletes over time as raids wipe it and players pull
from it.

Holding is the deliberate heat-relief mechanic. Send a tough to
Holding voluntarily (via action) to remove their modifier-carried
heat from play. Cops may accept a bribe (tough returns with fewer
mods), lock them up (mods seized, tough returns in N turns), or
escalate to a full raid. The weights shift with heat — the louder
you are, the more likely the cops take extreme action.

### Mythics As Game-Warping Earnings

Only 10 mythic cards exist in the game. Ever. Each has a unique
signature ability — Silhouette's STRIKE_TWO, Warlord's CHAIN_THREE,
Accountant's CLEAN_SLATE, Architect's BUILD_TURF, Informer's
INSIGHT, Ghost's STRIKE_RETREATED, Fixer's TRANSCEND, Magistrate's
IMMUNITY, Phantom's NO_REVEAL, Reaper's ABSOLUTE.

You earn mythics by:
1. Winning a Perfect War (awards one from the unassigned pool).
2. Defeating an opponent's mythic in combat (it flips to your
   collection).

There's no Coup ability, no buy-up path. Mythics are loyalty-locked
— they swear allegiance to whoever earns them, and only combat
defeat rebinds them.

### Difficulty Shapes The Game

AI looseness, player action economy, turf count, heat coefficient,
lockup duration, and reward multiplier all scale with difficulty.
Easy is a 5-turf sandbox with a noisy AI and rare raids. Nightmare
is 2 turfs and a surgical AI. **Ultra-Nightmare** is 1 turf,
2-ply lookahead, forced Permadeath, and perma-lockup — toughs sent
to Lockup never return, and raid-seized toughs die before custody.

## Difficulty Tiers

```
Easy       (5 turfs, 3 actions/turn, raid coef 0.5, lockup 1 turn)
Medium     (4 turfs, 3 actions/turn, raid coef 0.7, lockup 1 turn)
Hard       (3 turfs, 4 actions/turn, raid coef 1.0, lockup 2 turns)
Nightmare  (2 turfs, 3 actions/turn, -1 player action,
            raid coef 1.3, lockup 3 turns)
Ultra-     (1 turf,  3 actions/turn, 2-ply AI lookahead,
 Nightmare  raid coef 1.5, PERMA lockup)
```

Sudden Death no longer exists as a difficulty. **Permadeath** is now
a separate "Body Bags" run modifier available on every tier and forced
by Ultra-Nightmare. It sharpens the raid system instead of replacing
it: bail still matters, but an unbailed raid seizure kills the top
tough and confiscates the attached stack.

## Victory Ratings

Per turf you seize:
- **Absolute Victory** — 1 turn to seize. Reward: 5-card pack.
- **Overwhelming Victory** — 2 turns. Reward: 3-card pack.
- **Decisive Victory** — ≤3 turns. Reward: 1-card pack.
- **Standard Victory** — >3 turns. No bonus.

Per war outcome (winner only):
- **Perfect War** — all Absolute, no losses. Reward: 1 Mythic draw
  (or $500 after pool exhausted).
- **Flawless War** — all Decisive+, no losses. Reward: 5-card pack.
- **Dominant War** — no losses, some standard. Reward: 3-card pack.
- **Won War** — won despite losing turfs. Reward: 1-card pack.

Rewards stack: per-turf + war-outcome. A Perfect War of 4 Absolute
turfs = 4×5-card + 1 Mythic draw.

## Ship Target: Web First, Mobile Soon

- **Web** is the current ship target (GitHub Pages, auto-deploy on
  merge to `main`).
- **Mobile** (Android debug APK first, then signed release; iOS
  follows) resumes once the v0.3 web build is locked.
- Every mechanic and UI decision must survive the mobile-touch
  surface, safe areas, and portrait orientation as the default.

Detailed launch criteria and platform gates live in
[PRODUCTION.md](./PRODUCTION.md).

## Terminology

| Current term | Legacy term | Notes |
|-------------|-------------|-------|
| **Tough** | Crew / Character | "Crew" is v0.1/v0.2 language. The canonical term is "tough." |
| **Turf** | Position / Lane | Each turf is a stack; there is only one active turf per side. |
| **Stack** | Board / Grid | Ordered StackedCard sequence on a turf. Not a grid. |
| **Active turf** | Front | `turfs[0]`, the current engagement. |
| **Reserve turf** | Bench / Backup | Queued behind active; promotes up on seizure. |
| **Modifier** | Attachment / Slot card | Weapon / Drug / Currency cards equipping a tough. |
| **Discard pending** | Discard | The `discard` action vaporizes the card — there is no discard pile. |

When writing code, tests, or docs: always use "tough," never "crew."

## Design History

1. **POC** — Shared 52-card deck, 4 suits, precision rule.
2. **Gang decks** — 20 cards per faction, day/night dual-stats.
3. **Individual characters** — 100 named fighters, archetypes,
   affiliations.
4. **Turf war v0.1** — 5v5 position seizure, quarter-card slotting,
   backpack/runner system.
5. **Stack redesign v0.2** — MTG-style full cards, stack-based
   turfs, handless queue-and-resolve. Scrapped: quarter-cards,
   backpacks, active/reserve split, phase split, Sudden Death as
   a tier.
6. **Single-lane v0.3** — 1v1 active engagement, reserves as
   progression queue, HP + damage tiers, heat + raids, Black Market
   + Holding, base + rolled rarity with merge progression, 10
   hand-authored mythics with game-warping signatures, parallel AI
   collection growth.
7. **v1.0.0** *(shipped 2026-04-18)* — card art pipeline (213 PNG
   silhouettes), draw flow redesign (pending → contextual placement),
   procedural SFX via Tone.js, phone layout, balance lock at
   winRateA 0.5049, automerge for dependabot.

## Future Direction

- **Authored lore expansion** — flesh out each mythic's
  tagline/backstory beyond the draft text. Expand card art beyond
  geometric SVG placeholders.
- **Pack economy expansion** — seasonal packs, themed affiliation
  bundles, milestone packs for catalog completion.
- **Expansion sets** — future content ships as net-new cards.
  Shipped cards keep their stats forever.
- **Multiplayer** — once the single-player v0.3 core is locked, the
  same engine supports asynchronous PvP. The AI-mirror pattern
  makes the transition natural: the "opponent's curated collection"
  is already first-class in the data model.

The v0.3 implementation plan, executable epic breakdown, and paper-
playtest research that fed these designs all shipped and live only in
git history now. Use `git log` if you need to reconstruct the path that
got us here.
