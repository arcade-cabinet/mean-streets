---
title: Mean Streets — Rules Reference (v0.3)
updated: 2026-04-17
status: current
domain: product
---

# Mean Streets — Rules Reference (v0.3)

Authoritative, implementation-level rules. Design intent lives in
[DESIGN.md](./DESIGN.md). When rules disagree with this file, this
file wins. This supersedes every prior version.

The mental model: **War with cumulative effect, but played on a
single lane.** Each player defends one active turf at a time.
Building up your stack is building up your position. When your
active turf falls, the next one promotes up — and you rebuild. Lose
all your turfs and you lose the war.

## 1. Objective

Hold your turfs. Each player has N turfs arranged as a progression
queue. Only one turf per player is **active** — the front line.
Reserves sit behind, empty, waiting.

When your active turf falls (no living toughs after resolution),
the next reserve promotes up and becomes your new active turf,
empty stack. Lose all your turfs and you lose the war.

**Turf count by difficulty** (§14). Default Medium = 4 turfs.

## 2. Card Anatomy

Every card shares the same full-sized MTG-style frame:

```
┌──────────────────────────────┐
│ [Difficulty]         [Power] │
│ [Affiliation]                │
│                              │
│          Name                │
│          Tagline             │
│                              │
│ [Rarity]   [Type]   [Resist] │
└──────────────────────────────┘
```

- **Top-left**: difficulty icon (where the card was unlocked; §13).
- **Top-right**: Power (attack) for tough/weapon/drug; denomination for currency.
- **Affiliation hero image**: on mobile, anchored top-left below difficulty icon. On desktop, centered portrait.
- **Border color**: reflects rolled rarity (grey/blue/gold/red for common/uncommon/rare/legendary; custom for mythic).

### Card Types

| Type     | Stats                                      | Role                              |
|----------|--------------------------------------------|-----------------------------------|
| Tough    | power, resistance, HP, archetype, affiliation | Defends a turf; carries modifiers |
| Weapon   | power or resistance, category              | Offensive or defensive modifier   |
| Drug     | power or resistance, category              | Same as weapon, different role    |
| Currency | denomination ($100 / $1000)                | Bribes, buffers, heat pressure. **Only two authored denominations exist: $100 and $1000.** All amounts ≥$500 (bribes, bail) are sums of these denominations. |

### Rarity: Base + Rolled

Two dimensions on every card:

- **Base rarity** — authored into the card's identity. Some cards
  start at common, some at rare, legendary-base cards have signature
  abilities no other card has.
- **Rolled rarity** — the specific instance's rarity at pack open.
  Every card can roll up from its base but never below.

Tiers: **Common / Uncommon / Rare / Legendary / Mythic**.

- Common-base: can roll common through legendary. Never mythic.
- Uncommon-base: can roll uncommon through legendary.
- Rare-base: rolls rare through legendary.
- Legendary-base: always legendary.
- **Mythic-base: always mythic. Fixed pool of 10 authored cards with
  signature game-warping abilities.** (§13)

Rolled rarity applies a stat + ability scaling multiplier:

| Rolled     | Stat multiplier | Ability effect scaling |
|------------|-----------------|------------------------|
| Common     | ×1.0            | ×1.0                   |
| Uncommon   | ×1.15           | ×1.15                  |
| Rare       | ×1.3            | ×1.3                   |
| Legendary  | ×1.5            | ×1.5                   |
| Mythic     | ×1.7            | ×1.7 + signature       |

So a common-rolled LACERATE gives +1 attack; legendary-rolled gives
+1.5 → rounded +2. Exact rounding rules in §12.

Legendary-base cards carry signature abilities: **chain-striker
(legendary = 2 hits), strike-retreated, long-shot, launder,
low-profile**, etc. These never appear on common-base cards
regardless of rolled rarity.

Mythic-base cards each carry unique signature abilities. (§13)

## 3. Collection — Profile + DRAWS

Each profile has a persistent collection: every unlocked card at
its rolled rarity + unlock-difficulty tag. Cards persist across
wars.

### First-run starter grant

On profile creation, both player and AI receive matched starter
collections delivered as 7 standard (5-card) mixed packs:

- **7 × 5-card standard pack** — 35 cards total

Each slot independently rolls a card type from the weighted
probabilities in `turf-sim.json::packEconomy.typeWeights`
(tough 50% / weapon 20% / drug 20% / currency 10%). Rarity rolls
use `rarityWeights` (common 70% / rare 25% / legendary 5%).

Total starter: 35 cards each side.

> Note: v0.3 uses a single mixed-type pack model (type rolled per slot
> from weighted probabilities in `turf-sim.json`). There are no
> type-locked pack kinds. "Weapon Pack" and "Drug Pack" here are
> shorthand for packs with elevated type weights, not separate pack
> types.

### Pack awards

Both sides earn packs from war outcomes (§13). AI's collection
grows in parallel with player's — invisibly tracked in SQLite.
AI earns the same bundles that the player earns, representing
the AI "learning" across sessions.

All packs in v0.3 are **mixed-type**: each slot independently rolls
a card type from weighted probabilities (tough 50% / weapon 20% /
drug 20% / currency 10%, configurable in `turf-sim.json`). Pack size
(1, 3, or 5 cards) varies by reward tier (§13.1–13.2). There are no
type-locked packs.

### Pack drop rates

Pack draws roll by **base-rarity per slot** (which card shows up):

| Base rarity | Per-slot pull rate |
|-------------|--------------------|
| Common      | 55%                |
| Uncommon    | 28%                |
| Rare        | 14%                |
| Legendary   | 3%                 |
| Mythic      | 0% (not in packs)  |

Each card then rolls its **instance rarity** (per §2) based on its
base rarity's roll distribution. Distributions are sim-tuned.

### Unlock difficulty tag

Every card instance is tagged with the difficulty it was unlocked
at. Cards unlocked at higher difficulties earn a **bonus reward
multiplier** that diminishes at lower difficulties — incentivizing
you to play at higher tiers without punishing you for dropping down.

### Collection Management (not deckbuilding)

Before each new war, both player and AI go through **card
curation**:

- **Enable/disable** individual cards (disabled = excluded from this
  war's draw pile).
- **Priority slider (1-10)** per card instance — biases shuffle.
- **Auto-prioritize** toggle — surfaces the AI's recommended
  priorities for the player to accept or reject.
- **Merge**: 2 duplicate cards at the same rolled rarity →
  1 instance rolled one tier up.
  - Pyramid cost: 2 commons → 1 uncommon, 2 uncommons → 1 rare,
    2 rares → 1 legendary.
  - Legendary is the merge ceiling (mythics cannot be created
    via merge).
  - Merged result takes the **higher unlock difficulty** of the
    two sources.
- **Auto-merge** toggle — AI recommends merges, player accepts/rejects.

## 4. Turfs — Single-Lane Progression

Each player has N turfs. Only one turf per player is **active** —
the current engagement. Reserves queue behind.

- Each turf is a **stack** (ordered sequence of StackedCards).
- A StackedCard is `{ card, faceUp }`. Face state determines what
  the opponent sees.
- The top of the stack is the current **active tough**.

### Active / Reserve / Match end

- You and your opponent each have one active turf.
- Strikes, plays, retreats, closed ranks — all operate on your
  active turf only.
- **When your active turf falls** (no living tough after resolution),
  the next reserve promotes up and becomes your new empty active turf.
- **New-turf setup budget**: on the first turn of a newly-promoted
  active turf, you get the 5/4/3 bonus action budget (same curve as
  match opening).
- **Match ends when**:
  - You have no turfs left (active seized + reserves exhausted) →
    you lose.
  - Both players reach zero turfs on the same resolution → draw.
  - No timeout — games end on seizure.

### Placement rules on active turf

1. **First card of stack must be a tough.** Modifiers cannot be
   played onto an empty turf.
2. **Modifier cannot be the top card at end of turn.** A modifier
   tucked under a tough during play is legal temporarily (same
   turn) but must be under a tough by end-of-turn or lost to the
   Black Market.
3. **One weapon and one drug per TOUGH.** A tough can hold at most
   one weapon and one drug simultaneously. Currency is unlimited
   per tough.
4. **Play on full slot: rejected.** If you try to play a weapon on
   a tough that already has one, the play fails. You must swap
   first (§8.3).

### Affiliations & loyalty

Each tough has an affiliation. Stacks with 3+ toughs of the same
dominant affiliation get a **loyal stack bonus** (+2 attack,
+2 defense to the turf). Freelancer toughs are neutral to all
affiliations and don't break loyalty.

**Rival affiliation placement:**
- When a rival-affiliated tough is played on a turf, an affiliation
  conflict arises. Resolution order:
  1. If a **mediating tough** (neutral) is in the stack → placement
     free.
  2. Otherwise, consume the **cheapest denomination currency** from
     the turf-wide pool as a buffer. Currency is spent (vanishes).
  3. If no buffer available → placement rejected, card discarded.

## 5. Actions Per Turn

Action budget:

| Turn                                    | Actions |
|-----------------------------------------|---------|
| First turn of a new active turf (Easy)  | 5       |
| First turn of a new active turf (Medium)| 6       |
| First turn of a new active turf (Hard+) | 5       |
| Normal (Easy–Medium)                    | 3       |
| Normal (Hard)                           | 4       |
| Normal (Nightmare+)                     | 3       |

> Medium gets 6 actions on the first turn of each new active turf
> (post-1.0 balance decision: first-mover advantage compensation).

Drawing is an action.

### Action list

| Action                  | Cost | Effect                                          | Resolves        |
|-------------------------|------|-------------------------------------------------|-----------------|
| Draw                    | 1    | Draw top card from your deck into pending slot  | Immediate       |
| Play card               | 1    | Place pending card onto a tough or empty turf   | Immediate       |
| Modifier swap           | 1    | Move a modifier between toughs on your turf     | Immediate       |
| Retreat                 | 1    | Flip current top face-up; swap in another tough | Immediate       |
| Send to Black Market    | 1    | Send a tough (+ modifiers) to market; trade     | Immediate       |
| Send to Holding         | 1    | Send a tough to Holding; risk cops              | Immediate       |
| Queue: Direct Strike    | 1    | Queue a direct strike at opponent's active turf | End-of-turn     |
| Queue: Pushed Strike    | 1    | Spend 1 currency; splash strike                 | End-of-turn     |
| Queue: Funded Recruit   | 1    | Spend currency to flip opponent's tough         | End-of-turn     |
| Discard pending         | 0    | Discard the currently-drawn pending card (free). Note: discarded pending **vaporizes** — there is no per-player discard pile in v0.3. | —               |
| End turn                | 0    | Declare done; forfeits remaining actions (free) | —               |

### Turn flow

1. Both players take their full action budget in parallel. No
   alternating side-by-side.
2. Visibility during actions:
   - **You see every movement** the opponent makes — draws, plays,
     swaps, retreats. Card FACES stay hidden per §9.
3. After both players end their turn, resolution phase fires.
4. **Resolution order**: raid resolution **before** combat
   resolution.

## 6. Drawing & Playing

### Drawing

- Draw uses 1 action. Pulls the top of your deck into your
  **pending slot** (single card, visible to both you and opponent —
  but only you see its face).
- You cannot draw if pending is non-null.
- When pending is a tough: next `play_card` plays it.
- When pending is a modifier: next `play_card` tucks it onto a
  living tough of your choice on your active turf (first one
  legal).

### Unplayable pending at turn end

- **If pending is a modifier and no legal placement exists by turn
  end → modifier sent to Black Market.**
- If pending is a tough with an unresolvable rival conflict → tough
  discarded.

## 7. Damage & HP

Every tough in play has HP. HP starts equal to rolled Resistance.

### Damage calc on a strike

Given attacker effective Power P and defender Resistance R:

| Ratio           | Tier          | Damage                 |
|-----------------|---------------|------------------------|
| P < R           | Glance        | 0 (busted)             |
| R ≤ P < 1.5R    | Wound         | P - R + 1 (min 1)      |
| 1.5R ≤ P < 2R   | Serious wound | P - R + 2              |
| P ≥ 2R          | Crushing      | P - R + 3              |
| P ≥ 3R          | Instant kill  | HP → 0 regardless      |

When HP ≤ 0 → tough dies.

### Wounded P/R clamping

A wounded tough's effective stats scale with HP ratio:

- `effective_P = base_P × (current_HP / max_HP)`
- `effective_R = base_R × (current_HP / max_HP)`

Rounded down for display. Tangible modifiers (LACERATE, BRACE, etc.)
apply their full bonuses on top of the clamped stats.

### Healing chain

Five layers, cheapest to most expensive:

1. **PATCHUP** (common drug) — heals +1 HP to owner tough at end of
   each turn.
2. **FIELD_MEDIC** (rare tough ability) — heals +1 HP to any wounded
   tough on the same turf at end of each turn.
3. **RESUSCITATE** (rare drug) — restores full HP to owner tough
   once, then consumed.
4. **The Medic** (legendary tough, one per collection) — full heal
   action. Once per war.
5. **Black Market heal** (§8.2) — flexible outlet when abilities
   aren't available.

## 8. Repositioning Actions

### 8.1 Retreat

Spend 1 action. Select your active top tough. Stack-sequence effect:

- The current top flips **face-up permanently**.
- You choose any face-up card in your stack fan to promote up to the
  new top (they swap positions).
- Their modifiers travel with them.
- Face state of all shifted cards is preserved.
- No cap on retreats.

### 8.2 Black Market

Spend 1 action. Send any of your living toughs (+ their attached
modifiers) to the Black Market.

**Options at Black Market:**

1. **Trade** (rarity-gated):
   - 2 common mods → 1 uncommon mod from the pool
   - 2 uncommon mods → 1 rare mod
   - 2 rare mods → 1 legendary mod
   - Bribing up a tier: add $1000 currency to promote trade by one tier
   - Trades consume the source mods.
2. **Heal**:
   - Spend 1 common tough (as a bribe sacrifice) → heal +2 HP to any
     one of your wounded toughs.
   - Spend 2 commons → full heal of any one common tough.
   - Spend 2 uncommons → full heal of any one uncommon tough.
   - ...and so on, scaling with tough rarity.
   - Mythic toughs cannot be healed at market (they're on their own).

**Cumulative trades**: a single action can send multiple toughs.
Each additional tough costs 1 more action. Once all toughs intended
are sent, tap to fan out all their combined modifiers and choose
which to offer.

**Return rule**: if you send a tough to the market and don't
complete a trade that turn, they return **free at end-of-turn**
before resolution phase. Action was spent, but the tough is back.

### 8.3 Modifier swap

Spend 1 action. Move one modifier from one of your toughs to another
on your same active turf.

- Swap between two non-active toughs: modifier stays face-down
  (unless previously revealed).
- Swap to or from the active top: modifier becomes face-up.
- **Slot conflict resolution**: if the target tough already has a
  matching slot-type modifier (weapon or drug), the two modifiers
  **swap**. Both retain their attachment to the new owner.

### 8.4 Send to Holding

Spend 1 action. Send any of your living toughs (+ modifiers) to
Holding.

Each turn toughs are in Holding, a **holding check** fires:

- **Heat-weighted check probability**: `p = min(1, heat × 0.5)`.
- If triggered, outcome determined by continuous heat-weighted probability
  (code is authoritative — `holding.ts:holdingCheck`):
  - **Bribe** (more likely at low heat): cops take the highest-rarity
    attached modifier, tough returns next end-of-turn.
    `bribeThreshold = bribeSuccess(tough, 0) × (1-heat) + 0.1 × (1-heat)`
  - **Lockup** (more likely at high heat): tough + all modifiers seized
    for N turns (duration per difficulty). No raid is triggered from
    holdingCheck directly.
  - If no check fires: tough returns free at end-of-turn (no cost
    beyond the initial action spent to send them).

> The outcome is **binary (bribe or lockup)** once the check fires.
> Raid escalation from Holding is handled separately via the normal
> raid probability curve (§10.2) — high heat raises raid odds
> independently.

**Bribe persuasion formula** (for reference; exact values in `turf-sim.json`):

- `success = holdingBase + (rarity_rank × holdingRarityWeight) + min(holdingAmountCap, amount / holdingAmountScale)`
- Baseline (no offered currency): `~0.5 + (rarity_rank × 0.1)`.

A legendary tough offering $500 has higher success chance than a
common tough offering $2000.

**Lockup duration**:
- Easy / Medium: 1 turn
- Hard: 2 turns
- Nightmare: 3 turns

**Return rule**: if nothing happens (no holding check fires), tough
returns free at end-of-turn before resolution.

### 8.5 Close Ranks (end-of-turn status, not an action)

At end of turn, if your active turf's **top is a tough**:
- You may choose to **Close Ranks** — flip the top face-down to the
  opponent (you still see it).
- Defensive bonus inverse to difficulty:

| Difficulty      | Closed Ranks defense bonus |
|-----------------|----------------------------|
| Easy            | +50% resistance            |
| Medium          | +35%                       |
| Hard            | +20%                       |
| Nightmare       | +10%                       |
| Ultra-Nightmare | +5%                        |

- **Closed Ranks is unavailable if you have any other face-up tough
  in your stack.** The "close ranks" button is disabled in that case.
- **Modifiers beneath the closed-ranked top tough retain their prior
  face-up/face-down state.** Closing Ranks only affects the top tough's
  visibility, not deeper stack entries.

## 9. Information Asymmetry

- **Your own fan**: always fully face-up to you.
- **Opponent's fan**: defaults to face-down. Cards become face-up
  only via:
  - **Retreat** exposes one card permanently.
  - **Resolution** flips the top face-up (mandatory on every
    resolution, even Closed Ranks).
  - **Abilities** that force a reveal (e.g., Long-shot).

**Tucked modifiers under the top are face-down until resolution
forces a reveal.** Resolution phase always reveals the top tough's
modifiers to the opponent so intangibles can play out. Modifiers
under deeper toughs stay face-down forever unless their tough is
revealed.

**Movement is always visible.** You see the opponent draw, play,
retreat, swap, send to holding/market. You see CARDS MOVING. You
just don't see their FACE unless they're face-up.

## 10. End-of-Turn Resolution

Once both players have ended their turn, the resolution phase fires
in strict order.

### 10.1 Heat accumulation

Before raid or combat checks, recalculate total heat:

- Per-card rarity contribution (common / uncommon / rare / legendary
  / mythic): 0.005 / 0.010 / 0.020 / 0.050 / 0.100
- Per-turf currency concentration: `max(0, (total_currency - 500) / 10000)`
- **LAUNDER** (legendary currency ability): -0.1 heat per turn.
- **LOW_PROFILE** (rare drug ability): halves its owner tough's
  heat contribution.
- Mythic ability **CLEAN_SLATE**: one-shot, resets heat to 0.0 when
  played.

Total heat = A's contribution + B's contribution, clamped [0, 1].

### 10.2 Raid check

Raid probability per turn:

```
p = heat² × difficulty_coefficient
```

Coefficients:
- Easy: 0.5
- Medium: 0.7
- Hard: 1.0
- Nightmare: 1.3
- Ultra-Nightmare: 1.5

Roll d1000. If roll < p × 1000 → raid fires.

**Raid effects**:
- **Black Market wiped**: all pooled modifiers destroyed.
- Any face-up top tough on either side's active turf → **Lockup**
  with all attached modifiers seized (unless bail paid; see below).
- If Permadeath is active, that raid seizure kills the tough
  immediately instead of sending it to Lockup; attached modifiers are
  confiscated with the body and do not enter the Black Market.
- Raids do NOT touch Closed Ranks turfs (face-down top = plausible
  deniability).

**Bail**: at the moment of lockup, defender may pay **$500** from
turf currency to prevent lockup. Cops always pocket $500+; any
additional currency is kept by cops (corrupt). Tough returns to
stack immediately.

**If a raid seizes the only tough on your active turf → turf is
seized** before combat (counted as normal turf loss). Under Permadeath,
that same seizure kills the tough instead of adding a Lockup entry.

### 10.3 Combat resolution — two-pass

**Pass 1: Gross Dominance**

For each queued attack, compute attacker dominance:

```
dominance = attacker.cumulative_P + affiliation_loyal_bonus - defender.cumulative_R
```

Cumulative stats are sum of all toughs + tangible modifiers in the
stack. **Used for Pass 1 ordering only, not damage calc.**

Sort queued attacks by dominance, highest first. Primary tiebreaker:
highest defender R wins. Secondary tiebreaker: alphabetical by side
(side 'A' resolves first on further ties).

**Pass 2: Priority-Ordered Modifier Chain**

For each queued strike in dominance order:

1. **Affiliations** — apply loyal bonuses, rival penalties, buffer
   check. Freelancers (including mythics) are neutral — don't affect
   loyalty calculations.
2. **Currency pressure** — defender may **bribe** to cancel the strike.
   Bribes draw from the **turf-wide currency pool** (all currency cards
   in the defending turf's stack), not from a single tough's attached
   currency. **LAUNDER currency is excluded from bribe spend pools.**
   Bribes are probabilistic:
   - $500 → 70% success
   - $1000 → 85%
   - $2000 → 95%
   - $5000 → 99%
   Roll. If bribe succeeds → strike canceled, currency spent (vanishes).
3. **Drugs** — tangible drug effects applied (RUSH, FORTIFY, etc.);
   intangibles trigger (PAINKILLERS, CONFUSE, loyalty flip).
4. **Weapons** — tangible weapon effects applied (LACERATE, BRACE,
   etc.); counter-intangibles trigger (PARRY, EVASION, DETERRENT).

Each priority tier can cancel or redirect the strike. First
cancellation wins — subsequent tiers skipped for that strike.

**Queued strike dissolution**: if a queued strike's source tough is no
longer on top of the attacking turf at resolution time — because it was
killed, held, raided, retreated, or a card was placed on top — the
strike **dissolves**. No damage is dealt.

If the strike survives all priority checks, **tangible combat**
resolves per §7 damage calc.

### 10.4 Seize reconciliation

After all strikes resolve, clean up:

- Any tough at 0 HP → dead. Modifiers → Black Market. Tough's
  position in stack is cleared.
- Next tough in stack promotes to top. Promoted tough's face state
  is preserved.
- If the promoted tough has a modifier slot filled AND the dead
  tough's modifiers would exceed capacity → excess mods go to Black
  Market. (This shouldn't normally trigger because dead tough's
  mods go directly to market, not to the promoted tough.)
- **Active turf has zero toughs** → turf seized, opponent promotes
  a reserve turf.

### 10.5 End-of-turn cleanup

- Heal ticks: PATCHUP (owner), FIELD_MEDIC (turf), RESUSCITATE (if
  triggered). Applied in priority order.
- Pending slot: unplayable modifiers → Black Market.
- Queue cleared on both sides.
- `turnEnded` reset on both sides.
- Turn counter increments.
- Action budgets reset per §5.

## 11. Mythic Cards

Mythics are a **fixed pool of 10 hand-authored cards** with
game-warping abilities.

### Properties

- Always roll mythic rarity (no downgrade, no upgrade path).
- Never appear in packs. Acquired **only through specific in-game
  actions** (§13.4).
- Have stats roughly equivalent to strongest equivalent legendary,
  multiplied by ×1.7.
- Always freelancer affiliation. Loyal to themselves + owner. Don't
  interact with affiliation graph.
- **Flip on kill**: when a mythic is killed in combat, the
  killing-side tough's owner **unlocks the mythic into their
  collection**. The mythic transfers over at end of combat
  resolution.

### Mythic example abilities

Each of the 10 mythics has a unique signature ability. The pool
(hand-authored):

1. **The Silhouette** — STRIKE_TWO: single strike hits top + one card
   below in the opponent's stack.
2. **The Accountant** — CLEAN_SLATE: one-shot, resets heat to 0.0.
3. **The Architect** — BUILD_TURF: carve out an extra reserve turf
   when played (even at Ultra-Nightmare).
4. **The Informer** — INSIGHT: see opponent's heat contribution per
   card (normally hidden).
5. **The Ghost** — STRIKE_RETREATED: targets a face-up-via-retreat
   tough specifically.
6. **The Warlord** — CHAIN_THREE: single strike hits top, next, and
   next-next (3 kills in one resolution).
7. **The Fixer** — TRANSCEND: immune to affiliation penalties.
8. **The Magistrate** — IMMUNITY: cannot be sent to Holding (cops
   can't touch).
9. **The Phantom** — NO_REVEAL: never revealed by resolution.
10. **The Reaper** — ABSOLUTE: always deals minimum wound damage
    even on glance.

### Mythic constraints

- **Globally exclusive**: at most one side may hold any given mythic at
  any time. The pool of 10 is shared between player and AI; flip-on-kill
  transfers ownership without creating a second copy. No two sides can
  hold the same mythic simultaneously.
- At most **one mythic per player's collection** at any time.
- Cannot be merged (merge ceiling = legendary).
- Cannot be healed at Black Market.
- Unlock-difficulty tag: set to the difficulty on which it was
  defeated/earned.

## 12. Rounding

Stats that result from ability scaling are rounded **nearest
integer** (ties round up). So `+1.5` from rolled legendary →
`+2`. Base stats always integer-authored.

## 13. Economy & Progression

### 13.1 Rewards — per turf seized

When a player (or AI) seizes an opponent turf, a reward is computed
based on how quickly:

| Turns to seize | Rating              | Reward                                      |
|----------------|---------------------|---------------------------------------------|
| 1              | Absolute Victory    | 5-card pack (mixed type, rolled per slot)   |
| 2              | Overwhelming Victory| 3-card pack (mixed type, rolled per slot)   |
| ≤ 3            | Decisive Victory    | 1-card pack (mixed type, rolled per slot)   |
| > 3            | Standard Victory    | (no pack)                                   |

All reward packs use the same mixed-type model (§3). Both sides earn
independently — the winner of each turf gets the bonus. So a war
with many turfs can produce many per-turf packs.

### 13.2 Rewards — war outcome

End-of-war bonus for the war winner only:

| Outcome            | Reward                                    |
|--------------------|-------------------------------------------|
| Perfect War        | 1 mythic draw (or $500 if pool exhausted) |
| Flawless War       | 5-card pack                               |
| Dominant War       | 3-card pack                               |
| Won War            | 1-card pack                               |

Where:
- **Perfect War**: every seizure rated Absolute, no losses.
- **Flawless War**: every seizure rated Decisive or better, no losses.
- **Dominant War**: no losses, some standard victories.
- **Won War**: won despite losing turfs.

Losses (war or per-turf) earn nothing. AI earns by the same rules.

### 13.3 High-difficulty bonus

Wars played at higher difficulty earn a reward-quality **multiplier**:

- Easy: ×1.0
- Medium: ×1.2
- Hard: ×1.4
- Nightmare: ×1.6
- Ultra-Nightmare: ×2.0

Multiplier affects roll probability of higher-rarity rolls in pack
openings. Applies to player AND AI.

Permadeath is a separate run modifier available on every tier. When
active, pack openings stack an additional ×1.25 reward-quality
multiplier on top of the selected difficulty. Ultra-Nightmare forces
Permadeath.

### 13.4 Mythic acquisition

- **Combat**: defeat an opponent's tough carrying a mythic → unlock
  the mythic into your collection.
- **Perfect War**: earn 1 mythic draw from the unassigned pool of 10.
- **Ten-mythics-claimed fallback**: once all 10 mythics are
  assigned, Perfect Wars award escalating currency instead ($500 →
  $1000 → $1500 → etc.).

## 14. Difficulty

| Tier              | Turfs | Actions/turn | Permadeath | Perma-lockup |
|-------------------|-------|--------------|------------|--------------|
| Easy              | 5     | 3            | Optional   | No           |
| Medium            | 4     | 3            | Optional   | No           |
| Hard              | 3     | 4            | Optional   | No           |
| Nightmare         | 2     | 3            | Optional   | No           |
| Ultra-Nightmare   | 1     | 3            | Forced     | Yes          |

**Permadeath / Body Bags**: if active, a raid-seized top tough dies
immediately instead of entering Lockup. Bail still prevents the seizure.
This is separate from Ultra-Nightmare's **perma-lockup**, where toughs
that do reach Lockup never return.

The new-game flow presents a centered difficulty modal over the landing
page: three base tiers on the first row, then Nightmare, Permadeath, and
Ultra-Nightmare on the second row. Difficulty choice affects:
- Starting turf count
- Per-turn action budget
- AI skill (top-K sampling, noise, lookahead)
- Raid probability coefficient
- Reward multiplier (§13.3)
- Whether Permadeath is optional or forced

## 15. AI Difficulty

AI decision quality modulates by difficulty:

| Tier             | AI strategy                                        |
|------------------|----------------------------------------------------|
| Easy             | Top-5 sampling, 30% noise                          |
| Medium           | Top-3 sampling, 15% noise                          |
| Hard             | Top-2 sampling, 5% noise, +1 action                |
| Nightmare        | Best action, 0% noise, −1 player action            |
| Ultra-Nightmare  | Best + 2-ply lookahead, 1-turf match, forced Permadeath + perma-lockup |

AI also runs collection curation (merge + enable/disable + priority)
before each war using the same planner that scores moves. AI's
collection grows in parallel with player's from rewards.

## 16. Visibility Summary

**What you see from your opponent:**
- Every **movement** (draw, play, retreat, swap, send to
  market/holding, strike queue).
- Cards animated moving from pile to slot, between toughs, between
  turfs.
- The **face** of their active top tough (face-up or face-down).
- Tough names/images on face-up cards.
- Stack size indicator (N cards total).

**What you don't see:**
- Face-down cards' identities (anywhere in the stack).
- Their hand (there is no hand).
- Their pending slot face.
- Intangible abilities attached to face-down modifiers (even if
  you'd like to guess).

Your opponent sees the same one-way information about you.

## 17. Paper-Playtested & Open Tuning Points

Specific numbers (damage tiers, heat coefficients, bribe success %,
raid probability multiplier) are initial estimates. All should be
simulation-tuned:

```bash
pnpm run analysis:benchmark        # winrate per difficulty
pnpm run analysis:autobalance      # iterative stat tuning
pnpm run analysis:lock:persist     # persist lock state
```

Target: 48-52% AI-vs-AI winrate at Medium with full starter catalog.
Re-baseline expected after each major rule change.

## 18. Glossary

- **Active turf**: your current turf in play. Attacks, plays, and
  retreats all operate here.
- **Reserve turf**: a turf behind your active. Promotes up when the
  active falls.
- **Stack**: ordered sequence of StackedCards on a turf.
- **StackedCard**: `{ card, faceUp }` wrapper.
- **Pending slot**: single card drawn but not yet played.
- **Dominance**: attacker P + tangibles - defender R; used for
  strike ordering in Pass 1.
- **Tangible**: modifier effect contributing to raw P/R (flat
  numbers).
- **Intangible**: modifier effect altering resolution (counter,
  subtract, bribe, loyalty flip, self-attack).
- **Closed Ranks**: end-of-turn posture with face-down top (not
  possible with face-up deeper toughs).
- **Black Market**: shared pool of displaced modifiers; supports
  trades + heals.
- **Holding**: temporary lockup from cops; bribe or escape.
- **Lockup**: permanent (or N-turn) custody after failed bribe.
- **Raid**: probabilistic police intervention, clears market, locks
  up active tops.
- **Mythic**: game-warping card, fixed pool of 10, acquired only
  via combat or Perfect War.
- **Base rarity**: card's authored minimum rarity.
- **Rolled rarity**: instance-specific rarity at pack-open.
- **Unlock-difficulty tag**: the difficulty at which a specific
  instance was unlocked.
- **Perfect / Flawless / Dominant / Won War**: war outcome ratings.

This file is the authoritative spec. The paper-playtest research that
fed it and the v0.2 ruleset that preceded it both live in git history
(`git log -- docs/RULES.md` and earlier paths under `docs/plans/` and
`docs/archive/`).
