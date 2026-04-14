---
title: Mean Streets — Rules Reference
updated: 2026-04-14
status: current
domain: product
---

# Mean Streets — Rules Reference

This is the authoritative, implementation-level rules document. Design intent
lives in [DESIGN.md](./DESIGN.md). When rules disagree with this file, this
file wins.

## 1. Objective

Seize all five of your opponent's active street positions. A position is
seized when the tough occupying it is killed or flipped (recruited).

## 2. Anatomy Of A Card

Every full-sized card has the **same visual frame** with six display slots:

```
  ┌─ top-left ─── top-center ── top-right ─┐
  │  (backpack-    (power /      (backpack- │
  │    gated)      archetype)     gated)    │
  │                                         │
  ├─ middle-left ─ affiliation ─ middle-rt ─┤
  │  (pocket)       (badge)      (pocket)   │
  │                                         │
  ├─ bottom-left ─ bot-center ── bottom-rt ─┤
  │  (backpack-    (resistance    (backpack- │
  │    gated)       / role)       gated)    │
  │                                         │
  │                 "Name"                  │
  └─────────────────────────────────────────┘
```

- **Pocket slots** (middle-left, middle-right): always usable. A tough can
  carry up to **two quarter-cards** in its pockets at any time.
- **Backpack-gated slots** (the four corners): only become active when the
  tough is carrying a **backpack**. A runner (tough + backpack) can carry up
  to **2 + 4 = 6** quarter-cards total.
- **Center column** displays the tough's stats (power top-center, resistance
  bottom-center) and affiliation badge.

Backpack cards use the same frame but only the **four corner slots** are
live — they have no power/resistance of their own.

### Card Types

| Type         | Full-sized? | Tunable stat             | Behaviour                             |
|--------------|-------------|--------------------------|---------------------------------------|
| Tough (crew) | Yes         | power, resistance        | Occupies active/reserve positions     |
| Backpack     | Yes         | (carrier for payload)    | Stages to reserve, transfers to tough |
| Weapon       | No (quarter)| bonus                    | Slot payload (pocket or backpack)     |
| Drug (product)| No (quarter)| potency                  | Slot payload (pocket or backpack)     |
| Cash         | No (quarter)| denomination ($100/$1000)| Slot payload (pocket or backpack)     |

Quarter-cards never exist independently in a hand or a draw pile. They live
inside pockets or backpacks only.

## 3. Deck Composition

A deck is **50 cards total**, decided during deckbuilding:

| Component      | Count                                 |
|----------------|---------------------------------------|
| Toughs         | 25                                    |
| Backpacks      | N (starting quota, simulation-tuned)  |
| Quarter-cards  | up to 25 — weapons + drugs + cash, all pre-packed into backpacks |

### Starting Backpack Quota

Every player starts with `N` backpack slots by default. `N` is set by
simulation tuning (target: each backpack carries ~3–4 quarter-cards on
average). Players can unlock **additional backpack slots** permanently
through achievements, just like unlocking additional cash denominations.

### Pre-Packing Rule

**All quarter-cards start the game inside backpacks.** During deckbuilding
the player:

1. Picks 25 toughs.
2. Decides how many of their N backpack slots to use (unused slots stay
   empty).
3. Stuffs weapons/drugs/cash into each backpack, 1–4 quarter-cards per
   backpack, up to a total of 25 quarter-cards across all backpacks.

No quarter-card enters the game outside a backpack. Mid-game
redistribution (through seizure, pocket transfers, payload dispersal) is
the only way quarter-cards change location.

## 4. Setup

- Both players' 25 toughs shuffle into their crew draw pile.
- Both players' packed backpacks shuffle into their backpack draw pile.
- Each player draws an opening hand of **3 toughs** and **up to 2 backpacks**
  into reserve (the exact draw numbers come from `TurfGameConfig`).
- Reserve backpacks begin **staged in reserve positions**. They can be
  transferred onto reserve toughs before first blood as part of the buildup
  phase (see §6).

## 5. Phases

The game has two phases:

### Buildup (up to 10 rounds)

- Both players act simultaneously each round.
- Legal actions each round:
  - **Place tough**: move a tough from hand into an empty active/reserve
    position.
  - **Stage backpack**: place a backpack from hand into an empty reserve
    position, or equip it onto an existing reserve tough.
  - **Transfer backpack**: move a staged backpack between reserve cards
    (see §7 — backpacks can only move among reserved cards in buildup).
- Buildup ends when either player **strikes** (first blood) or after ten
  rounds have elapsed.

### Combat

- Five actions per player per round, simultaneous.
- First blood draws permanent lane assignments — once combat starts,
  backpacks cannot be freely transferred between reserve cards. They move
  only with their carrier (runner) or through seizure.
- Actions available during combat:
  - **Direct attack**
  - **Funded attack** (cash-backed bribe / flip)
  - **Pushed attack** (drug + cash — splash)
  - **Equip runner**: swap a reserve tough carrying a backpack into an
    active position (free-swap rule, see §7).
  - **Retreat / reposition**: swap an active tough back to reserve (costs
    the turn).
  - **Dispense payload**: runner gives a backpack item to an active
    friendly, or uses it in an action (attack, stack).
  - **Reclaim**: retake a seized position with a tough + cash.
  - **Pass**: skip remaining actions for the round.

## 6. Backpacks — Mechanical Container

A backpack is a **mechanical full-sized card**. It has:

- Four payload slots (top-left, top-right, bottom-left, bottom-right).
- No name, no icon beyond a generic backpack glyph, no archetype, no
  affiliation. Every backpack is interchangeable.
- No inherent power or resistance. When equipped onto a tough, its four
  payload slots project onto that tough's four **corner** slots; the tough
  also gains a **runner symbol** overlay to indicate carrier status.

### Backpack Identity In Data

Backpacks are **not authored cards**. They do not live under
`config/raw/cards/` with stat arrays. They are a rule type defined in
`config/raw/cards/special.json` along with currency. Player-packed
instances are created during deckbuilding by the engine with IDs like
`backpack-player-A-1 ... backpack-player-A-N` and the specific payload
chosen by the player.

## 7. Runner Mechanics

A **runner** is a tough that is currently carrying a backpack. Runner is
an overlay role — the tough keeps its archetype, affiliation, stats, and
name; it gains the runner capabilities on top.

### Equipping A Backpack

- Backpacks can only be equipped to **reserve** cards, never active.
- Equip action:
  - If staged as an empty reserve position, a backpack equips onto a
    reserve tough by adjacent transfer.
  - A player-held backpack in hand can be placed onto a reserve tough as a
    single action.

### Free Swap

- Equipping a backpack onto a reserve tough grants **one free swap** —
  the runner may move into any empty active slot with **no turn
  penalty**, the one time.
- This is the runner's "entry" into the front line.
- After the free swap, any subsequent active ↔ reserve move costs a full
  turn (normal retreat penalty).

### Runner Payload Use

While the runner is in active play:

- The runner may **dispense** backpack items to:
  - itself (stack an item into one of its own pocket or corner slots),
  - another friendly active tough,
  - an opposing tough (as the payload of a direct/funded/pushed attack).
- Each dispense consumes one action.
- Backpack items can be left in the pack for future actions.

### Pocket Vs Backpack Capacity

A full-up runner can carry:

- 2 items in **pockets** (middle-left, middle-right).
- 4 items in **backpack corners** (top-left, top-right, bottom-left,
  bottom-right).

Total: **6 quarter-cards** of staged bonuses on a single tough. This is
the ceiling the mid/late game economy pushes toward and defends against.

### Empty Backpacks

- An empty backpack is still useful — it reserves the four corner slots
  on the runner for later payload pickup (e.g., from seized cards or
  pocket transfers between friendlies).
- A runner may retreat to reserve, but retreating costs the turn (no
  free-swap benefit on the way back).

### Seizure

- If a runner is seized (killed or flipped) while carrying a backpack,
  the **backpack and all its remaining contents** transfer to the
  opponent.
- The opponent may then use the backpack immediately if able (e.g.,
  dispense its payload to one of their active or reserve cards) or stash
  it on one of their own reserve toughs.
- Carrying heavy backpacks into combat therefore trades lethality for
  logistics risk.

## 8. Precision Rule

A tough with attack value `A` may target a defender with attack value `D`
only when `A <= D * precisionMult` (currently `3.0`). The **Bruiser**
archetype ignores precision.

## 9. Attack Types

### Direct Attack

Attacker's effective power (crew power + top weapon bonus + top drug
potency, once unlocked) vs defender's effective defense (crew resistance
+ bottom weapon + bottom drug). If `atk >= def` → kill. Otherwise →
wound (reduce defender resistance).

### Funded Attack

Attacker stakes **offensive cash** (center-left slot). Flip threshold =
`defender resistance + defensive cash`, modified by:

- Freelance defender → threshold × 0.5 (easy to recruit).
- Same affiliation → threshold × 0.7.

If `offensiveCash >= threshold` → flip (defender joins attacker's side).
Otherwise → busted (cash spent, no flip).

### Pushed Attack

Crew + offensive drug + offensive cash. Push power =
`drug potency + floor(cash / 10)`.

- `push >= defender defense` → kill/flip + splash damage to adjacent
  positions (up to `potency - 1` neighbours weakened).
- `push >= floor(defense / 2)` → partial weaken (sick state).
- Otherwise → busted.

## 10. Win Condition

The match ends when one player has seized **5 of the opponent's
5 active street positions**, or on timeout after `maxRounds` (default
100). On timeout, the player with more seized positions wins; ties
break to the player who struck first.

## 11. Balance Philosophy

- Deterministic engine. The only randomness in a match is the draw order
  (seeded).
- 50/50 winrate between equal players with equal decks, measured across
  release-profile seeds.
- All card types must be meaningfully used — no decorative cards.
- Games last 12–20 rounds (~60 total actions).
- `<5%` stall rate, `<2` passes per game.
- Every card in the catalog must pass the autobalance gate before a
  release (coverage threshold in `release-gate.test.ts`).

## 12. Unlock Model

- **Baseline set**: a curated subset of toughs, weapons, drugs,
  backpacks, and cash denominations is unlocked by default for all
  players.
- **Achievement unlocks**: additional cards and backpack slots unlock
  permanently through gameplay achievements. Unlocks are additive —
  once earned, always available.
- **Expansions ≠ re-tunes**: once a card is shipped and locked, its
  stats never change. Future expansions add new cards instead of
  re-tuning existing ones (Brawl Stars model).

## 13. Glossary

- **Tough**: a full-sized crew card. Has power, resistance, archetype, and
  affiliation.
- **Backpack**: a mechanical full-sized container card with four payload
  slots. Equipped only in reserve, transfers onto a tough to create a
  **runner**.
- **Runner**: a tough currently carrying a backpack. Gains free-swap,
  payload dispensing, and increased quarter-card capacity (2 pockets + 4
  backpack corners).
- **Pocket slot**: middle-left / middle-right display slot on any
  full-sized card. Holds one quarter-card each. Always active.
- **Backpack-gated slot**: top-left, top-right, bottom-left, bottom-right
  corners on a tough. Only activated when the tough is carrying a
  backpack.
- **Quarter-card**: weapon, drug, or cash. Never exists independently.
  Lives inside a pocket slot or a backpack.
- **Seize**: kill or flip an opponent's tough, clearing their active
  position and taking their carried stash.
- **First blood**: the first attack of the combat phase. Ends buildup
  and locks backpacks to their current carriers.

Implementation status for each rule listed here tracks in
[PRODUCTION.md](./PRODUCTION.md).
