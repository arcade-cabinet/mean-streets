---
title: Mean Streets
updated: 2026-04-17
status: current
---

# Mean Streets: Turf War

A gritty tactical turf-war card game built for mobile-first release.
You run a street crew, arm your fighters, push product, and seize
enemy territory — one block at a time — through deterministic
stack-based combat. No dice.

## Production Shape

- **Primary targets**: iOS and Android via Capacitor
- **Web role**: development, simulation, responsive QA, browser automation
- **Persistence**: Capacitor SQLite on native and web OPFS
- **Release gate**: seeded simulation benchmarks + autobalance
  convergence (AI-vs-AI Medium winrate in [0.48, 0.52] for 3
  consecutive runs) + full lock-state analysis

## How It Works

Each player has a single unified deck built from every card they've
unlocked. New players start with a 35-card starter (4×5 tough packs +
1 each weapon, drug, and currency pack); subsequent wins and pack
openings grow the collection. Cards are also **merged** (2 commons →
1 uncommon, 2 uncommons → 1 rare, 2 rares → 1 legendary) for
progression depth.

Win the **war** by seizing all of your opponent's turfs.

- **Toughs**: named fighters with Power, Resistance, HP, gang
  affiliation, archetype identity, and optional signature abilities
  at rare/legendary/mythic tiers
- **Weapons**: bladed, blunt, explosive, ranged, or stealth — add
  power or resistance to the tough they're equipped to
- **Drugs**: stimulant, sedative, hallucinogen, steroid, or narcotic
  — similar mechanics, different category for deck diversity
- **Currency**: $100 bills and $1000 stacks — fuel pushed strikes,
  funded recruits, bribes, affiliation buffers, and contribute to
  heat pressure
- **Mythic cards** (v0.3): 10 hand-authored game-warping toughs with
  unique signature abilities, acquired only by defeating an
  opponent's mythic in combat or earning a Perfect War

## The Board (v0.3 single-lane)

Each player has N turfs in a **progression queue** (N varies by
difficulty: 5 for Easy, 4 for Medium, 3 for Hard, 2 for Nightmare,
1 for Ultra-Nightmare). Only ONE turf per side is **active** at a
time — the current engagement. Reserves queue behind.

Turfs are stacks of cards. You build up cumulative power and
resistance on your active turf. When your active turf falls (no
living toughs after resolution), the next reserve promotes up — you
start fresh with a new 5-action setup turn. Lose all turfs → lose
the war.

## Combat (v0.3)

Both players take their full action budget in parallel. When both
end turn, resolution phase fires:

1. **Raid check first** — shared heat scalar (from stack rarity
   concentration + currency pressure) rolls against difficulty
   coefficient. A raid wipes the Black Market and sweeps face-up
   active tops to Lockup. Bail is $500.
2. **Combat resolution** — two passes per queued strike:
   - **Pass 1 (gross dominance)**: attacker cumulative power +
     tangibles + loyalty vs defender's equivalents. Sort queued
     strikes by dominance; ties favor defender.
   - **Pass 2 (priority chain)**: Affiliations → Currency (bribes
     probabilistic: $500=70%, $1000=85%, $2000=95%, $5000=99%) →
     Drugs → Weapons. First intangible to cancel/redirect wins.
3. **Tangible damage** in tiers based on P/R ratio:
   - P < R: glance (0 damage)
   - R ≤ P < 1.5R: wound (damage = P-R+1)
   - 1.5R ≤ P < 2R: serious wound (damage = P-R+2)
   - P ≥ 2R: crushing (damage = P-R+3)
   - P ≥ 3R: instant kill
4. **HP clamping**: wounded toughs have effective P/R scaled to
   hp/maxHp ratio — attrition is real.
5. **Seize reconciliation**: empty defender turf → promoteReserveTurf.

### Actions per turn (v0.3)

3-5 actions per turn (5 on the first turn of each new active turf,
3-4 normally depending on difficulty). Drawing is an action.

- **Draw** — pull top of deck into pending slot
- **Play** — pending → turf (affiliation rules apply; rival needs buffer)
- **Retreat** — flip current top face-up permanently; swap in any
  revealed card as new top
- **Modifier Swap** — move a mod between toughs on active turf
- **Send to Black Market** — tough + mods to the shared pool; trade
  for higher-rarity mods or heal a wounded tough
- **Send to Holding** — voluntary cop exposure for heat relief;
  probabilistic bribe / lockup / raid outcome
- **Queue Strike** (direct / pushed / funded recruit) — resolved at
  end of turn
- **End Turn** — unspent actions forfeit

## Development

```bash
pnpm install
pnpm run dev                   # Vite dev server
pnpm run build                 # Production build (tsc + vite)
pnpm run lint                  # Biome
pnpm run test                  # Node + DOM unit tests
pnpm run test:browser          # Real Chromium tests (Vitest + Playwright)
pnpm run test:e2e              # Playwright desktop smoke flow
pnpm run test:e2e:full         # Full local E2E + visual + governor suite
pnpm run test:visual           # Playwright visual fixture capture
pnpm run test:visual:fullpage  # Full-page visual fixture capture
pnpm run test:analysis:slow    # Slow sim-backed curated sweep
pnpm run test:release          # Release gate
pnpm run analysis:benchmark    # Balance benchmark
pnpm run analysis:autobalance  # Iterative stat tuning
pnpm run analysis:lock:persist # Lock state persistence
pnpm run cards:compile         # raw/ → compiled/ catalog build
pnpm run cap:sync              # Build + sync to Capacitor
```

## Tech Stack

React 19, TypeScript 6, Vite 8, Koota ECS, Yuka.js AI, Capacitor 8,
SQLite, Zod 4, GSAP, Howler, Tone, Vitest, Playwright, Maestro, Biome

## Project Structure

```
config/
  raw/cards/           # Authored per-card JSON
    toughs/            # 100 toughs (55C / 25U / 15R / 5L)
    weapons/           # 50 weapons (28C / 12U / 8R / 2L)
    drugs/             # 50 drugs (28C / 12U / 8R / 2L)
    currency/          # 3 currency cards ($100, $1000, Clean Money)
    mythics/           # 10 hand-authored mythics (not in packs)
  compiled/            # Build-time outputs (gitignored)
public/
  assets/mythics/      # 10 SVG placeholders with shared gold-ring treatment
src/
  sim/turf/            # Game engine: single-lane, HP, heat, market, holding
    heat.ts            # shared heat scalar + raid probability
    market.ts          # Black Market send/trade/heal/wipe
    holding.ts         # Holding + Lockup + bribe mechanics
    resolve.ts         # raid → combat 2-pass → seize reconciliation
    ai/                # GOAP planner + curator (pre-war collection curation)
  sim/cards/           # Zod schemas (5-tier rarity), compile transforms,
                       # catalog loaders, seeded PRNG
  sim/packs/           # Pack generator (rolled rarity), rewards
                       # (Absolute/Overwhelming/Decisive/Standard +
                       # Perfect/Flawless/Dominant/Won), mythic pool
  sim/analysis/        # Dev-only: benchmark, sweep, lock, autobalance
  ecs/                 # Koota ECS bridge (single-lane hooks)
  ui/                  # React screens + components
    board/             # TurfView (single-lane), TurfCompositeCard
                       # (HP bar), HeatMeter, BlackMarketPanel,
                       # HoldingPanel, MythicBadge, StackFanModal
    screens/           # MainMenu, Difficulty (5 tiers, no Sudden Death),
                       # Game, CardGarage (merge UI), Collection,
                       # PackOpening, GameOver
    affiliations/      # AffiliationSymbol + MythicSymbol
  platform/            # Capacitor shell, SQLite persistence, AI profile mirror
  data/                # Game tunables (turf-sim.json), affiliation graph
e2e/                   # Playwright specs, 4 device profiles
docs/                  # Design, rules, architecture, production, visual review
  archive/             # Historical specs (RULES-v0.2.md)
  plans/               # Active work plans + paper playtests
```

## Source of Truth

- [docs/DESIGN.md](./docs/DESIGN.md) — vision and identity
- [docs/DESIGN.md](./docs/DESIGN.md) — vision + identity
- [docs/RULES.md](./docs/RULES.md) — authoritative gameplay mechanics (v0.3)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — technical architecture
- [docs/STATE.md](./docs/STATE.md) — current branch state + release log
- [docs/PRODUCTION.md](./docs/PRODUCTION.md) — partial systems + post-1.0 polish
- [docs/RELEASE.md](./docs/RELEASE.md) — release-please tag-and-publish runbook
- [docs/LAUNCH_READINESS.md](./docs/LAUNCH_READINESS.md) — pre-store-submit manual sweep
- [docs/TESTING.md](./docs/TESTING.md), [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), [docs/VISUAL_REVIEW.md](./docs/VISUAL_REVIEW.md) — ops/quality runbooks
- [docs/LORE.md](./docs/LORE.md), [docs/store-listing.md](./docs/store-listing.md) — narrative + store metadata

## License

TBD
