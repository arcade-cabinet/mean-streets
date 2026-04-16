---
title: Mean Streets — Rules Reference (v0.2)
updated: 2026-04-15
status: current
domain: product
---

# Mean Streets — Rules Reference (v0.2)

Authoritative, implementation-level rules. Design intent lives in
[DESIGN.md](./DESIGN.md). When rules disagree with this file, this
file wins. This document supersedes every prior version. The v0.1
model (quarter-cards, backpacks, runners, active/reserve split,
buildup/combat phase split) is gone. An earlier v0.2 draft that kept
a hand is also gone — **there is no hand**.

The mental model is **War, but with cumulative effect**. Each turf is
a stack you build from the top down. Each turn you decide how your
side reacts to the opposition — reinforce, strike, recruit, retreat,
turtle — then resolution happens.

## 1. Objective

Hold your turfs. When all toughs on a turf are dead or recruited, the
opponent **seizes** it. Lose all your turfs → lose the match.

Turf count per player is set by difficulty (§13).

## 2. Card Anatomy

Every card is the **same full-sized MTG-style frame**:

```
┌──────────────────────────────┐
│ [Affiliation]        [Power] │
│                              │
│          Name                │
│          Tagline             │
│                              │
│ [Rarity]   [Type]   [Resist] │
└──────────────────────────────┘
```

- **Mobile (`phone-portrait`)**: affiliation hero anchored top-left,
  name below. Compact layout.
- **Desktop / tablet-landscape**: affiliation as centered portrait,
  name top-center.

No quarter-cards. No sub-slots. Every card is full-sized with its
own value.

### Card Types

| Type     | Core stats                                 | Role                                  |
|----------|--------------------------------------------|---------------------------------------|
| Tough    | power, resistance, archetype, affiliation  | Founds and anchors a turf             |
| Weapon   | power **or** resistance, category, abilities | Reinforces a tough; tangible or intangible |
| Drug     | power **or** resistance, category, abilities | Same as weapon, different category    |
| Currency | denomination ($100 / $1000)                | Bankrolls actions; affiliation buffer; can bribe |

All cards carry **rarity**: `common` / `rare` / `legendary`. Rarity
drives pack drop rates and factors into autobalance evaluation.

### Tangibles vs Intangibles

Modifiers come in two flavors:

- **Tangible** — contribute raw power/resistance to the stack
  (a knife adds +2 power; body armor adds +3 resist).
- **Intangible** — don't move the raw stat totals but **alter
  resolution**:
  - **Counter** — cancel an incoming strike outcome.
  - **Subtract** — reduce opponent power during resolution.
  - **Bribe-out** — a sufficient currency stack with friendly
    affiliation can buy off an incoming strike.
  - **Loyalty flip** — flip an attacker to fight for you.
  - **Self-attack** — a drug can redirect an opponent's queued
    strike onto one of their own turfs.

Intangibles fire during the **resolution phase** (§8) and can chain.
A card's abilities list declares whether its effect is tangible,
intangible, or both.

## 3. Collection — DRAWS Economy

There is **one deck** per player: your entire unlocked collection.
All cards (toughs and modifiers) are shuffled together into a single
draw pile at match start.

### Starter Grant

On first run, a new player receives:

- **4 × Tough Pack (5 cards)** — 20 toughs
- **1 × Weapon Pack (5 cards)**
- **1 × Drug Pack (5 cards)**
- **1 × Currency Pack (5 cards)**

Total starter: **35 cards** (20 toughs + 15 modifiers).

### Ongoing Unlocks

New cards only come from **packs earned by winning matches**. Harder
difficulties and Sudden Death award better packs. Pack contents roll
against rarity drop rates (§11). Your deck grows over time — this is
the permanent progression loop.

### Card Management (Not Deckbuilding)

There is no classic deckbuilding. Instead, a **collection management
UI** lets you curate your deck from everything you've unlocked:

- **Select / disable** individual cards. A disabled card is in your
  collection but excluded from the next match's draw pile.
- **Bulk select by rarity** — one-tap to enable/disable all commons,
  all rares, all legendaries.
- **Priority slider (1–10)** per card. A card's priority biases its
  **draw probability**, not a hard order. Priority 10 means it's
  more likely to come up early; priority 1 means it's still in the
  deck but rarely on top. This is a **soft influence**, not
  deterministic ordering — the deck is still shuffled, priorities
  just weight the shuffle.

Balance comes from pack drop rates and rarity tuning. Curation lets
you lean into a playstyle without letting you build a hand-picked
"optimal" deck.

## 4. Turfs — The Board

Your board is **N turfs** side by side. N set by difficulty (§13).
Each turf is a **stack**.

### Stack Model

A stack is an ordered pile of cards. Two positions matter:

- **Top card** — the **active** card. This is what the opponent
  sees. When the top is a tough, it's the tough currently defending
  (and the one who'll be struck by default). When the top is a
  modifier, see §6 below — not allowed, except during resolution.
- **Beneath** — everything played onto the turf previously. Each
  card beneath is either **face-down** (hidden from opponent) or
  **face-up** (revealed — see §9).

When no tough is active (you've ended turn with nothing on top, or
your top just died), the top is **face-down** to the opponent —
this is **Closed Ranks** status (§10).

### Placement Rules

1. **Modifiers can't be the first card of a stack.** A turf needs a
   tough to exist.
2. **Modifiers can't be the top card at end of turn.** A modifier
   has to be tucked beneath an active tough — either the current
   top, or one you play on top of the modifier in the same turn.
3. Currency can buffer affiliation conflict (see Affiliations
   below) even when it would otherwise violate rules about
   category.
4. **If you draw a modifier and can't legally place it this turn**
   (no tough to tuck it under, can't burn an action to fix it), the
   modifier is **lost** at end-of-turn — discarded, not returned.

### Cumulative Power & Resistance

The turf's totals aggregate **every card in the stack**:

- **Power** = Σ tough.power + Σ weapon.power + Σ drug.power
- **Resistance** = Σ tough.resistance + Σ weapon.resistance + Σ drug.resistance

Currency does **not** contribute to raw totals. Currency fuels
actions and bribes.

### Affiliations

Each tough has an affiliation. Cards in a stack are **loyal**,
**neutral**, **mediating**, or **rival** relative to each other
(directed graph in `src/data/pools/affiliations.json`).

- A tough with **loyal-stacked** affiliation grants the whole turf
  a small attack/defense bonus.
- Incoming card with **rival** affiliation: requires a **buffer**
  — a currency card on the turf, or a neutral/mediator tough —
  to be absorbed. No buffer → the incoming card is **discarded**
  on play.
- Buffers **spend** when they absorb a clash — a $100 bill on the
  turf can soak exactly one rival placement and then is consumed.
- Affiliation state shows on the composite: rival pairs glow red,
  loyal pairs glow gold.

## 5. Actions Per Turn

Each turn you have an **action budget**:

| Turn                    | Actions |
|-------------------------|---------|
| First turn of the match | 5       |
| Normal turn (Easy–Medium) | 3     |
| Normal turn (Hard)      | 4       |
| Normal turn (Nightmare+) | 3      |

**Drawing is an action.** That's why the opener is 5 — you need a
few draws before you can meaningfully act. After the opener, budget
tightens so every draw is a real cost.

### Action Menu

| Action          | Cost     | Effect                                          | Resolves        |
|-----------------|----------|--------------------------------------------------|-----------------|
| Draw            | 1 action | Draw top card from your deck                    | Immediate       |
| Play card       | 1 action | Place a tough or modifier onto a turf           | Immediate       |
| Retreat         | 1 action | Flip a card in your stack face-up; swap active  | Immediate       |
| Close ranks     | 0 (end) | End turn with no active tough → turtle status   | Immediate       |
| Queue: Direct Strike | 1 action | Target opponent turf for a direct strike   | End-of-turn     |
| Queue: Pushed Strike | 1 action | Spend $1 currency → splash strike          | End-of-turn     |
| Queue: Funded Recruit | 1 action | Spend currency → flip opponent tough      | End-of-turn     |
| End turn        | 0       | Declare done. Unspent actions are lost.         | —               |

### Turn Flow

1. **Both players take their full turns in parallel** — actions
   choose and queue independently. The UI signals when your
   opponent (AI) has ended.
2. **Turn does not advance until both players have ended.** There
   is no alternating-side first/second. Either player can end early
   without penalty; their remaining actions are forfeited.
3. **Resolution phase** (§8) fires once both have ended.
4. Next turn begins.

## 6. Playing Cards

### Toughs

A tough can be played onto:

- **An empty turf** — it becomes the foundation and the new top.
- **A turf with a living tough** — it becomes the new top; the old
  top drops into the stack beneath (face-up to you, face-down to
  the opponent — your fan is always fully face-up to yourself).

Affiliation rules (§4) apply on placement. Rival placement without
a buffer → discarded.

### Modifiers

A modifier (weapon / drug / currency) must be **tucked under an
active tough** by end of turn. The sequence is:

1. Play a modifier → it goes on top temporarily.
2. During the same turn, play a tough on top of it — the modifier
   is now tucked and legal.

Or, if there's already a tough on top you're willing to move:

1. Play modifier → temporarily on top.
2. Play tough → pushed on top of the modifier.

If you end a turn with a modifier as the top card, the engine
enforces placement rules: either the modifier moves to under the
previous top automatically (if there was one), or — if there's no
tough at all — **the modifier is discarded**.

Weapons and drugs declare at play time whether they orient
**offense** (power) or **defense** (resistance). Abilities carry
regardless of orientation.

## 7. Retreat

Spend 1 action to **retreat your current top tough**. What happens:

1. The current top card flips **face-up permanently** (it'll stay
   face-up in your stack forever — the opponent now knows it's
   there).
2. You choose **any face-up card from that turf's fan** to become
   the new active top. Any tough previously exposed via retreat is
   eligible. The modifiers attached to it remain where they are.
3. The action is spent. No artificial cap on retreats — you can
   retreat as many times as you have actions.

### Modgame Variant — Blind Swap

There's a playful option (settable in match setup): **swap active
with a deck pull**. Costs 1 action. Draws the top of your deck; if
it's a tough, it becomes the new active top and your old top flips
face-up in the stack. If the pulled card is a modifier, it tucks
and your old top stays active (no swap happened — the action was
still spent).

## 8. End-Of-Turn Resolution

Once both players have ended their turn, the resolution phase fires.

### Dominance

For each **queued strike**, the engine calculates a **dominance
score** for attacker and defender:

- **Attacker dominance** = attacker turf power + tangible weapon/drug
  contributions + affiliation loyalty bonus
- **Defender dominance** = defender turf resistance + tangible
  weapon/drug contributions + affiliation loyalty bonus

The **dominant side's queued action resolves first**. Ties break in
the defender's favor (the attacker has to overcome inertia to flip
the situation).

### Intangible Triggers

**Before** the attacker/defender's tangible power is applied,
intangible modifiers on both stacks fire in rarity order (legendary
first, then rare, then common), attacker-then-defender within a
rarity band:

- **Counter** cancels a specific queued strike outcome.
- **Subtract** reduces opponent dominance by a flat amount.
- **Bribe-out**: currency + loyal affiliation sufficient to buy
  off the strike — the attacker's action is forfeited and their
  cash transfers to the defender.
- **Loyalty flip**: attacker's striker flips onto defender's side
  for this resolution.
- **Self-attack**: redirects attacker's queued strike onto one of
  their own turfs (chosen by the mechanic, typically weakest).

After intangibles settle, tangible combat runs.

### Combat Outcomes

After intangibles and dominance calculation:

- **`attacker.P ≥ defender.R`** → **kill the top tough** on the
  defender's stack.
  - The defender's **next card is exposed** (becomes new top
    after resolution). **Modifiers tucked under the killed tough
    stay face-down** — this allows later intangible tricks.
  - Tangible weapons/drugs attached to the killed tough transfer
    to the attacker's striking turf (affiliation re-evaluated on
    transfer; rival transfers discarded).
- **`P < R` but `P ≥ R/2`** → **sick** the top tough. Sicked toughs
  don't contribute power on the next turn.
- **`P < R/2`** → **busted**. The attacker's action is wasted.

### Strike Targeting

Default target is **the top of the defender's stack**. Archetype
and legendary abilities alter this:

- **Strike bottom** (Shark archetype, Foundation Breaker
  legendary): targets oldest tough.
- **Strike anywhere** (Ghost archetype, Phantom Strike legendary):
  choose any tough on the stack.

### Pushed Strike

The queued strike spent 1 currency card from the attacker's turf.
Power for this strike becomes `P + denomination / 100` (so $100 =
+1, $1000 = +10). On success, the strike also **sicks the tough
directly beneath** the killed one.

### Funded Recruit

The queued recruit spent $1000 total in currency from the
attacker's turf. Target is a specific opponent tough (default: top;
archetype abilities can target deeper). Flip succeeds if
`sum(your.currency.denomination) ≥ target.resistance × affiliationMult`:

- Freelance target → 0.5
- Target shares affiliation with a tough on your striking turf → 0.7
- Rival affiliation → 1.5
- Otherwise → 1.0

On success, the target tough transfers to the top of your striking
turf. On fail, cash is spent, nothing moves.

### Seize

If a turf has **zero living toughs** after resolution, the opponent
**seizes** it:

- All remaining modifiers on the seized turf transfer to one of the
  seizer's turfs (their choice).
- Turf removed from defender's board.
- If that was the defender's last turf → **match over**.

## 9. Information Asymmetry

### Your Fan (self)

When you open the fan view of your own turf, every card is
**face-up** — you see your full stack.

### Opponent's Fan

The opponent's fan shows a **mix of face-down and face-up cards**:

- Every card they've played stays **face-down** by default.
- A card becomes **face-up to you** only when it's been **revealed**
  — by a retreat, by resolution flipping a dying tough's top card,
  or by an ability.
- Their current top is visible if a tough is active. If they're in
  **Closed Ranks** (§10), even the top is face-down.

This information asymmetry is the core of the psychological layer.
What you don't know they have is what they use against you.

### Resolution Reveals

During the resolution phase:

- The **top** of any attacked turf always flips face-up (even if
  the turf was in Closed Ranks).
- Modifiers **tucked under** a killed tough stay **face-down** —
  this preserves intangibles for future tricks.
- Retreats expose a card **permanently** face-up. Once revealed,
  always revealed.

## 10. Closed Ranks (Turtling)

You may end your turn with **no active tough** on a turf. Doing so
puts that turf into **Closed Ranks**:

- The top is **face-down** to the opponent — they can't see what
  (if anything) is there.
- You **cannot strike or recruit** this turn (you turtled).
- The turf gets a **defensive bonus** inversely proportional to
  difficulty:

| Difficulty     | Closed Ranks defense bonus |
|----------------|----------------------------|
| Easy           | +50% resistance            |
| Medium         | +35%                       |
| Hard           | +20%                       |
| Nightmare      | +10%                       |
| Ultra-Nightmare | +5%                       |

- If the turf is **attacked**, during resolution its **top flips
  face-up** and combat resolves normally with the bonus applied.

The trade: you give up offense and draw info economy in exchange
for unreadable defense. Late-game turf-pressure use case: when the
opponent has too much info on your hand, closing ranks clears the
read.

## 11. AI Difficulty

AI looseness modulates by difficulty — not by changing rules, but
by changing decision noise and optimality:

| Tier             | AI strategy                                        |
|------------------|----------------------------------------------------|
| Easy             | Top-5 action sampling, 30% random noise            |
| Medium           | Top-3 action sampling, 15% random noise            |
| Hard             | Top-2 action sampling, 5% random noise, +1 action  |
| Nightmare        | Best action, 0% noise, −1 player action            |
| Ultra-Nightmare  | Best action + 2-ply lookahead, sudden-death auto-on |

AI tuning lives in `src/data/ai/turf-sim.json` under `aiDifficulty`.

## 12. Pack Economy & Rarity

### Rarity Grades

| Grade     | Base drop rate | Stats target                   |
|-----------|----------------|--------------------------------|
| Common    | 70%            | Near catalog median            |
| Rare      | 25%            | 1.15–1.3× median               |
| Legendary | 5%             | 1.4–1.8× median + unique ability |

### Packs

A pack is a bundle of 1, 3, or 5 cards in a category.

| Pack              | Contents                                        |
|-------------------|--------------------------------------------------|
| Tough Pack (5)    | 5 toughs (70/25/5 roll per card)                |
| Weapon Pack (5)   | 5 weapons                                        |
| Drug Pack (5)     | 5 drugs                                          |
| Currency Pack (5) | 5 currency cards (always common, no rarity roll) |
| Single Pack (1)   | 1 card of a single category                      |
| Triple Pack (3)   | 3 cards of a single category                     |

Harder difficulties and Sudden Death award better packs.

### Sudden Death Drop Bonus

When Sudden Death is active and the player wins, each card in the
awarded pack rolls a **rarity-upgrade die**: 30% chance to bump
one tier. Legendary caps there.

### Autobalance With Rarity

Autobalance (`pnpm run analysis:lock`):

1. Weights a card's winrate by its **expected deck frequency**
   (drop rate × collection size distribution).
2. Lenient on under-drawn legendaries (smaller sample size).
3. Rejects stat changes that would move a common into rare-range
   stats without also promoting rarity.

## 13. Difficulty & Turf Count

| Tier             | Turfs | Actions/turn | Sudden Death        |
|------------------|-------|--------------|---------------------|
| Easy             | 5     | 3            | Optional            |
| Medium           | 4     | 3            | Optional            |
| Hard             | 3     | 4            | Optional            |
| Nightmare        | 2     | 3            | Optional            |
| Sudden Death     | 1     | 3            | Forced on           |
| Ultra-Nightmare  | 1     | 3            | Forced on, +2-ply AI |

The new-game screen presents a **2×3 icon grid**:

```
┌──────────┬──────────┬──────────┐
│  Easy    │  Medium  │  Hard    │
├──────────┼──────────┼──────────┤
│ Nightmare│  Sudden  │  Ultra-  │
│          │  Death   │ Nightmare│
└──────────┴──────────┴──────────┘
```

Ultra-Nightmare permanently locks Sudden Death on.

## 14. Win Condition

- **Match win**: reduce opponent to zero turfs.
- **Sudden Death**: 1 turf each — a single seize ends it.
- No timeout. Games end on seize or forfeit.

## 15. Balance Philosophy

- Deterministic engine. Only randomness is the draw order (seeded)
  and seeded AI noise.
- 50/50 AI-vs-AI winrate on Medium with full baseline collection.
- Every catalog card must pass the autobalance gate (coverage
  threshold in `release-gate.test.ts`).
- Pack drop rates are sim-proven to reach 80% catalog coverage
  within ~40 pack openings.

## 16. Glossary

- **Turf**: a stack of cards on one board slot. Lost when all its
  toughs are dead or recruited.
- **Stack**: ordered sequence of cards on a turf. Mix of face-up
  and face-down.
- **Top / Active**: the card currently on top of the stack. Can be
  a tough (normal) or face-down (Closed Ranks).
- **Tough**: crew card. Only card type that counts for turf
  survival.
- **Modifier**: weapon / drug / currency. Can't be stack bottom,
  can't be stack top at end of turn.
- **Tangible**: modifier that contributes raw power/resistance.
- **Intangible**: modifier that alters resolution (counter,
  subtract, bribe-out, loyalty-flip, self-attack).
- **Draw gate**: rule preventing a modifier from being played when
  there's no tough to tuck it under.
- **Queued action**: strike or recruit declared this turn,
  resolved at end-of-turn.
- **Dominance**: aggregated power/resistance + tangibles +
  affiliation bonus; determines resolution order.
- **Retreat**: action that flips current top face-up and swaps in
  a different exposed card as active.
- **Closed Ranks**: end-of-turn state with no active tough;
  face-down top + defensive bonus; can't act offensively.
- **Strike**: any queued combat (direct, pushed, funded).
- **Seize**: reduce opponent turf to zero toughs; take modifiers;
  remove turf.
- **Buffer**: tough (neutral/mediator) or currency card that lets
  rival-affiliated cards coexist on a turf. Currency buffers are
  consumed on use.
- **Pack**: 1/3/5-card bundle in one category. Only way to unlock
  new cards.

Implementation status per rule tracks in
[PRODUCTION.md](./PRODUCTION.md).
