---
title: Mean Streets — Rules Reference (v0.2)
updated: 2026-04-14
status: current
domain: product
---

# Mean Streets — Rules Reference (v0.2 Stack Redesign)

Authoritative, implementation-level rules. Design intent lives in
[DESIGN.md](./DESIGN.md). When rules disagree with this file, this file
wins. This document supersedes every prior version; v0.1 concepts
(quarter-cards, backpacks, runners, buildup/combat split, 5-slot
active/reserve boards) are removed.

## 1. Objective

Hold onto your turfs. When all crew on a turf are dead or recruited, the
opponent **seizes** that turf. You lose the match when you run out of
turfs.

The number of turfs per player is set by difficulty (§11).

## 2. Anatomy Of A Card

Every card has the **same full-sized MTG-style frame**:

```
  ┌─────────────────────────────────────────┐
  │ [Affiliation Hero Image]      [Power]   │  ← power (top-right)
  │                                         │
  │   Tough / Weapon / Drug / Currency      │  ← name (center)
  │              Tagline                    │
  │                                         │
  │ [Rarity]         [Type]       [Resist]  │  ← resistance (bottom-right)
  │              "Name"                     │
  └─────────────────────────────────────────┘
```

- **Mobile (`phone-portrait`)**: affiliation hero image is anchored
  top-left; card name below. Compact landscape layout.
- **Desktop / tablet-landscape**: affiliation symbol is rendered as the
  centered portrait; card name top-center. Classic MTG portrait layout.

There are no quarter-cards. There are no sub-slots. Every card is a
first-class, full-sized card with its own power and/or resistance value.

### Card Types

| Type     | Stats                         | Role                              |
|----------|-------------------------------|-----------------------------------|
| Tough    | power, resistance, archetype, affiliation | Founds or reinforces a turf |
| Weapon   | power (offense) OR resist (defense), category | Adds to turf's cumulative power/resist |
| Drug     | power OR resist, category     | Same as weapon, different category |
| Currency | denomination ($100 / $1000)   | Funds actions, buffers affiliation clashes |

All cards carry a **rarity grade**: `common` / `rare` / `legendary`.
Rarity drives pack drop rate and factors into autobalance evaluation.

## 3. Deck Composition

A player has **one deck**. It holds every card the player owns (unlocked
via packs — see §10). Toughs and modifiers (weapons, drugs, currency)
are shuffled together into a **single draw pile**.

There is no deckbuilding in v0.2. Your deck is your collection. Balance
comes from pack drop rates and rarity tuning, not from player curation.

### Starter Collection

On first run, a new player receives:

- **4 × Tough Pack (5 cards)** — 20 toughs total
- **1 × Weapon Pack (5 cards)**
- **1 × Drug Pack (5 cards)**
- **1 × Currency Pack (5 cards)**

Total starter: **35 cards** (20 toughs + 15 modifiers).

Packs follow rarity drop rates (§10). Further cards unlock by opening
packs earned through wins.

## 4. Turfs (Your Board)

Your board is **N turfs**, side by side. N is set by difficulty (§11).
Each turf is a **cumulative stack of cards** owned by you.

### Stack Display

The stack is **not visibly stacked**. The UI shows a dynamic composite
"top card" that aggregates what is in play on that turf, in logical
order:

1. The roster of toughs (names, archetypes, affiliations)
2. Weapons in play
3. Drugs in play
4. Cash in play
5. Affiliations in play (with loyalty/rivalry symbols)
6. Cumulative **Power** and **Resistance** totals

Tapping the composite opens a fan modal (desktop) or swipe-through
pager (mobile) showing every card in the stack with its contribution
highlighted.

### Cumulative Power & Resistance

- **Power** = Σ tough.power + Σ weapon.power + Σ drug.power
- **Resistance** = Σ tough.resistance + Σ weapon.resistance + Σ drug.resistance

Cash does not contribute to raw power/resistance. Cash fuels actions
(pushed strikes, reclaims) and can buffer affiliation conflicts (§5).

### Affiliation Stacking

Each tough carries an affiliation. When two cards on the same turf have
**incompatible affiliations** (rivals), the conflict must be resolved
before either card can enter play:

- **Compatible / neutral**: add freely.
- **Rivals with no buffer**: the incoming card is **discarded from hand**
  (the player cannot add it to that turf). The player must have a
  **buffer** — a tough with a neutral or mediating affiliation, or a
  **Currency card** already on the turf — to absorb the clash.
- Affiliation compatibility is a directed graph authored in
  `src/data/pools/affiliations.json` with `loyal` / `rival` /
  `neutral` / `mediator` relationships.

The UI surfaces hand-drawn SVG affiliation symbols bound to Koota
traits so rival pairs glow red and loyal pairs glow gold on the
composite.

## 5. Drawing & Playing

### Draw Rules

- Player draws **1 card** at the start of their turn.
- **Draw gate**: the player cannot *play* a modifier (weapon / drug /
  currency) unless they have **at least one tough** in play on some
  turf. If their hand is modifier-only and their board is empty,
  every action must be "play a tough" — modifiers stay in hand.
- Hand size: unlimited. There is no discard-to-limit at end of turn.
- A card may be voluntarily discarded from hand at any time (free
  action) to get rid of an unplayable affiliation clash.

### Play Rules

- A tough is played onto a specific turf. It joins that turf's stack.
- A modifier is played onto a specific turf that already has at least
  one tough. Weapons and drugs contribute power or resistance based on
  orientation chosen at play time (**offense** → power, **defense** →
  resistance). Currency joins the turf's cash pool.
- A turf has no slot cap. A stack can grow arbitrarily large —
  late-game turfs resemble fortresses.

## 6. Actions Per Turn

| Turn type                 | Actions |
|---------------------------|---------|
| First turn of the match   | 5       |
| Normal turn (Easy–Medium) | 3       |
| Normal turn (Hard)        | 4       |
| Normal turn (Nightmare+)  | 3       |

Actions are spent on:

1. **Play a card** — tough or modifier (subject to draw gate in §5).
2. **Strike (direct)** — attack an opponent's turf stack (§7).
3. **Strike (pushed)** — cash-backed splash strike (§7).
4. **Recruit (funded)** — cash-backed flip attempt (§7).
5. **Discard** — free, does not cost an action.
6. **End turn** — pass remaining actions (free).

There is no first-blood / phase split. Every turn from turn 1 onward
can strike. The 5-action opener gives the first player setup parity
against the second player's tempo.

## 7. Combat — Striking The Stack

Strikes target an **opponent's turf stack** as a single entity. The
stack's aggregated Power and Resistance (§4) are the combat values.

### Direct Strike

Your turf's **Power** vs. opponent turf's **Resistance**.

- `P ≥ R` → **kill the top tough** on the target stack. Modifiers
  carried by that tough (the weapons / drugs / cash stacked since the
  tough was played) **flip ownership** and transfer to the striker's
  own turf stack at the top. Affiliation clashes are re-evaluated on
  transfer — incompatible transfers are **discarded** instead.
- `P < R` but `P ≥ R / 2` → **sick** the top tough (marked, cannot
  contribute power next turn).
- `P < R / 2` → **busted** (nothing happens, action lost).

### Striking Position — Bottom vs Anywhere

Some archetypes and legendary cards grant **strike-bottom** or
**strike-anywhere** rules, replacing the default "top tough" target:

- **Strike bottom** (Shark archetype, *Foundation Breaker* legendary):
  target the oldest tough on the stack — bypasses fresh reinforcements.
- **Strike anywhere** (Ghost archetype, *Phantom Strike* legendary):
  choose which tough to target.

Default rule remains "top of the stack."

### Pushed Strike

Spend **1 Currency card** from your turf as part of the strike. Power
becomes `P + cash.denomination / 100` (so $100 = +1, $1000 = +10) for
that strike. On success, the strike also **sicks the tough directly
beneath** the killed tough.

### Funded Recruit

Spend **$1000** total in Currency from your turf. Target an opponent
tough on the top of their stack. Flip succeeds if
`sum(your.currency) ≥ target.resistance × affiliationMult`, where:

- Freelance target → 0.5
- Same affiliation as a tough on your striking turf → 0.7
- Rival affiliation → 1.5
- Otherwise → 1.0

On success, the target tough **joins your turf** (transfers to top of
striking stack). On fail, cash is spent, nothing moves.

## 8. Seized Turf

When a turf has **zero living toughs** (all killed or recruited), the
turf is **seized by the opponent**. The seizing player:

- Takes all remaining modifiers on the seized turf (they transfer to
  one of the seizer's turfs of their choice).
- Removes the turf from the defender's board.
- The defender loses **1 turf**. The match continues on their
  remaining turfs.

When a player has **zero turfs left**, they lose the match.

## 9. AI Difficulty

AI looseness modulates by difficulty tier — not by changing rules, but
by changing decision noise and action optimality:

| Tier            | AI strategy                                      |
|-----------------|--------------------------------------------------|
| Easy            | Top-5 action sampling, 30% random noise          |
| Medium          | Top-3 action sampling, 15% random noise          |
| Hard            | Top-2 action sampling, 5% random noise, +1 action |
| Nightmare       | Best action, 0% noise, −1 player action          |
| Ultra-Nightmare | Best action + 2-ply lookahead, sudden-death auto-on |

AI tuning lives in `src/data/ai/turf-sim.json` under `aiDifficulty`.

## 10. Pack Economy & Rarity

### Rarity Grades

| Grade     | Base drop rate | Autobalance treatment                 |
|-----------|----------------|---------------------------------------|
| Common    | 70%            | Stats near catalog median             |
| Rare      | 25%            | Stats 1.15–1.3× median                |
| Legendary | 5%             | Stats 1.4–1.8× median, unique ability |

### Packs

A pack is a bundle of 1, 3, or 5 cards in a specific category.

| Pack              | Contents                                              |
|-------------------|-------------------------------------------------------|
| Tough Pack (5)    | 5 toughs (70/25/5 rarity roll per card)               |
| Weapon Pack (5)   | 5 weapons                                             |
| Drug Pack (5)     | 5 drugs                                               |
| Currency Pack (5) | 5 currency cards (always common — no rarity roll)     |
| Single Pack (1)   | 1 card of a single category (chosen at open time)     |
| Triple Pack (3)   | 3 cards of a single category                          |

Packs are the only way to acquire new cards. Wins award packs; harder
difficulties and sudden-death mode award better packs.

### Sudden-Death Drop Bonus

When Sudden Death is active and the player wins, a **rarity upgrade
die** rolls on every card in the pack: 30% chance to bump each card
one rarity tier. Legendary-tier bumps cap there.

### Autobalance With Rarity

Autobalance (`pnpm run analysis:lock`) now:

1. Weights a card's winrate by its **expected deck frequency** (drop
   rate × collection size distribution).
2. Treats under-drawn legendaries more leniently (smaller sample size).
3. Rejects stat changes that would move a common into rare-rangestats
   without also promoting its rarity.

## 11. Difficulty & Turf Count

| Tier              | Turfs | Actions/turn | Sudden Death |
|-------------------|-------|--------------|--------------|
| Easy              | 5     | 3            | Optional     |
| Medium            | 4     | 3            | Optional     |
| Hard              | 3     | 4            | Optional     |
| Nightmare         | 2     | 3            | Optional     |
| Sudden Death      | 1     | 3            | Forced on    |
| Ultra-Nightmare   | 1     | 3            | Forced on, +2-ply AI |

The new-game screen presents a **2×3 icon grid**:

```
┌──────────┬──────────┬──────────┐
│  Easy    │  Medium  │  Hard    │
├──────────┼──────────┼──────────┤
│ Nightmare│  Sudden  │  Ultra-  │
│          │  Death   │ Nightmare│
└──────────┴──────────┴──────────┘
```

Ultra-Nightmare **permanently enables Sudden Death** for that match;
the toggle visually locks on when Ultra is selected.

## 12. Win Condition

- **Match win**: reduce opponent to zero turfs (all seized).
- **Sudden Death**: same rule, but each player only has 1 turf, so a
  single successful seizure ends the match.
- No timeout. Games terminate on seizure or voluntary forfeit.

## 13. Balance Philosophy

- Deterministic engine. The only randomness in a match is the draw
  order (seeded) and optional AI noise (seeded per difficulty tier).
- 50/50 winrate between AI-vs-AI runs on same difficulty with full
  baseline collection.
- Every card in the catalog must pass the autobalance gate
  (coverage threshold in `release-gate.test.ts`).
- Pack drop rates are simulation-proven to produce collection curves
  that reach 80% catalog coverage within ~40 pack openings.

## 14. Glossary

- **Turf**: a cumulative stack of cards owned by one player on one
  board slot. Lost when all its toughs are dead or recruited.
- **Stack**: the ordered sequence of cards played onto a turf.
- **Tough**: a crew card. The only card type that counts for turf
  survival.
- **Modifier**: any non-tough card (weapon, drug, currency).
- **Draw gate**: the rule preventing a modifier from being played
  when the player has zero toughs anywhere on the board.
- **Strike**: any combat action (direct, pushed, funded recruit).
- **Seize**: reduce an opponent's turf to zero toughs; take its
  modifiers and remove the turf from the defender's board.
- **Sudden Death**: 1-turf mode with rarity-boosted pack rewards on
  win.
- **Buffer**: a tough or currency card on a turf that mediates
  between rival-affiliated cards.
- **Pack**: a bundle of 1/3/5 cards of a single category. Awarded
  for wins; only way to acquire new cards.

Implementation status for each rule here tracks in
[PRODUCTION.md](./PRODUCTION.md).
