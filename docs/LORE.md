---
title: Lore
updated: 2026-04-17
status: current
domain: creative
---

# Mean Streets — Lore

World, characters, and tone. Gameplay mechanics live in
[RULES.md](./RULES.md). Design philosophy lives in [DESIGN.md](./DESIGN.md).

## The World

A city without a name. Dense, grey, divided by blocks. Whoever holds the
block controls the block — what moves through it, who pays, who bleeds. There
are no heroes. There are no villains. There are only crews and debts.

The streets are old. Some of these crews have been here longer than the roads.
Others showed up with money and muscle and bought in fast. The cops know
everyone by name. They take their cut. They leave the rest alone unless the
noise gets loud enough to embarrass someone downtown.

This is not a story about redemption. It is a story about who is still
standing when the smoke clears.

## Tone

- **Noir.** Every character has an angle.
- **Street-level.** Nobody is glamorous. Taglines are terse.
- **No glorification.** Cards are named people with consequences attached.
- **Dry.** When something is funny, it doesn't know it.

## Affiliations

Ten crews operate in the city. Each has loyal allies, bitter rivals, and
neutral arrangements maintained by mutual convenience.

| Crew | Territory | Character |
|------|-----------|-----------|
| **Kings Row** | Uptown | Old money muscle. Run the uptown rackets. |
| **Iron Devils** | Waterfront | Dockyard thugs. Control the docks. |
| **Jade Dragon** | Chinatown | Silent operators. Watch everything. |
| **Los Diablos** | Industrial | Burn it down first. Questions later. |
| **Southside Saints** | Southside | Community first. Protect the block. |
| **The Reapers** | Unknown | Nobody knows who leads them. Nobody asks twice. |
| **Dead Rabbits** | Old Quarter | Been here since before the roads were paved. |
| **Neon Snakes** | The Strip | Night crawlers. Own every club. |
| **Black Market** | Everywhere | If it exists, they sell it. No questions. |
| **Cobalt Syndicate** | Financial District | White collar criminals with blue collar muscle. |

**Freelance**: No crew. No loyalty. Just the job. Mythic cards are always
freelance — they answer to no one except whoever earned them.

### Loyalty Graph (summarized)

- Kings Row ↔ Cobalt Syndicate (mutual loyal)
- Iron Devils ↔ Southside Saints (mutual loyal)
- Jade Dragon — Black Market (loyal one-way, Black Market mediates for many)
- Los Diablos ↔ Neon Snakes (mutual loyal)
- Dead Rabbits — Black Market (loyal one-way)

Jade Dragon, Southside Saints, and Dead Rabbits serve as mediators in the
most volatile pairings — their neutral presence prevents flashpoints.

## Archetypes

Twelve roles define how a tough operates in the field:

| Archetype | Role |
|-----------|------|
| **Bruiser** | Raw power. Takes hits, dishes them back harder. |
| **Enforcer** | Disciplined muscle. Consistent threat, hard to kill. |
| **Shark** | Aggressive, fast, closes on weakness. |
| **Ghost** | Operates unseen. Hard to target, hard to predict. |
| **Fixer** | Makes things work across impossible arrangements. |
| **Hustler** | Adapts, pivots, turns limited resources into position. |
| **Lookout** | Defensive. Watches, holds, calls warnings. |
| **Fence** | Moves product and favors both directions. |
| **Snitch** | Information is their currency. Dangerous to both sides. |
| **Medic** | Keeps the crew alive. Not a fighter — until cornered. |
| **Wheelman** | Gets people in and out. Logistics under pressure. |
| **Arsonist** | Chaos. The option you reach for when order has failed. |

## The Ten Mythics

A fixed pool of ten individuals who operate above faction politics. Each is
unique. Each carries one game-warping ability. They earn loyalty — they are
never born into it.

Mythics are freelance. They do not contribute to or benefit from affiliation
loyalty stacks.

---

**The Silhouette** — *"You never see the second blade."*
Archetype: Shark. Ability: STRIKE_TWO.
A single strike from The Silhouette hits the opponent's top tough and the card
directly beneath it in the same resolution. The second blade doesn't announce
itself.

---

**The Accountant** — *"The ledger always balances. Somehow."*
Archetype: Fence. Ability: CLEAN_SLATE.
On play: resets the shared heat meter to 0.0. One-shot. The Accountant has
made things disappear before. Heat is just another number.

---

**The Architect** — *"Every block needs a blueprint."*
Archetype: Hustler. Ability: BUILD_TURF.
On play: carves out an additional reserve turf for your side — even past
Ultra-Nightmare's one-turf cap. One-shot. The Architect finds the angle others
missed.

---

**The Informer** — *"I know what they're carrying. I always do."*
Archetype: Snitch. Ability: INSIGHT.
Passive while in play: you see the opponent's per-card heat contribution,
normally hidden. You know what's face-down on their stack. The Informer is
the most dangerous person in the room — and everyone in the room knows it.

---

**The Ghost** — *"The one they retreated doesn't feel safe anymore."*
Archetype: Ghost. Ability: STRIKE_RETREATED.
Strikes bypass the opponent's top tough and target any face-up-via-retreat
card in their stack. Glass cannon — Power 9, Resistance 5. If you have a
retreated tough you haven't repositioned, The Ghost is already behind you.

---

**The Warlord** — *"Three bodies before breakfast."*
Archetype: Bruiser. Ability: CHAIN_THREE.
A single strike hits the opponent's top three toughs in one resolution. Each
hit calculates damage against that tough's individual resistance. Works best
against lightly defended stacks. Against fortresses, the chain absorbs.

---

**The Fixer** — *"Colors don't matter. Only the deal."*
Archetype: Fixer. Ability: TRANSCEND.
Immune to affiliation penalties. Rival affiliations don't drain buffer or
trigger discard when The Fixer is in play. Loyal bonuses still apply to
other toughs on the turf — The Fixer simply doesn't participate in that
calculation. Opens compositions that affiliation conflict would otherwise
close off.

---

**The Magistrate** — *"Due process is a convenience. Mine."*
Archetype: Lookout. Ability: IMMUNITY.
Cannot be sent to Holding — by the player, by the AI, by raid sweeps. When
cops lock up active tops, The Magistrate is excluded. Resistance 9. The
strongest defensive wall in the game. Particularly brutal in Nightmare
and Ultra-Nightmare where lockup durations are permanent.

---

**The Phantom** — *"You saw something. You're not sure."*
Archetype: Ghost. Ability: NO_REVEAL.
Never revealed by resolution phase. Even as the active top, The Phantom stays
face-down to the opponent. Modifiers tucked under The Phantom are also hidden
from forced-reveal events. The opponent has to guess what's attached — forever,
or until they kill it.

---

**The Reaper** — *"Glancing blows still leave marks."*
Archetype: Enforcer. Ability: ABSOLUTE.
Strikes never glance. Even when Power is below the target's Resistance (the
tier that normally deals zero damage), The Reaper deals 1 damage minimum.
Over a long engagement against a high-resistance stack, no attack is wasted.
The wear accumulates. Eventually the wall cracks.

---

## Acquiring a Mythic

There are two paths:

1. **Defeat one in combat.** Kill an opponent's mythic tough in resolution.
   It transfers to your collection at the end of that combat. Loyalty follows
   the winner, not the loser.

2. **Perfect War.** Seize every turf in Absolute Victory with zero losses.
   Draw one mythic from the unassigned pool.

Once all ten are assigned across active collections, Perfect Wars award
escalating currency instead. The mythics keep circulating through combat —
they never leave the game.

At most one mythic per player's collection at any time. They cannot be merged.
