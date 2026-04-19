# Dragon Ledger — 1.0 alpha → 1.1-beta.1 freeze audit

Each item closed in this PR with the commit that addressed it.

## Blocking (1.0 rule promise violated)
1. Mythic globally-exclusive invariant didn't survive across wars → **71ab8f8**
   Profile now persists ownedMythicIds per side; new match seeds pool as
   catalog − (player owned ∪ AI owned); mythicAssignments pre-populated.
2. Orphan LAUNDER card shipped with locked=true, no unlock path → **3194c2a**
   Flipped locked=false; card now drops from legendary currency rolls.
3. Active-run resume was seed-only; sim change = silent save corruption → **3194c2a**
   Added simVersion stamp to ActiveRunState; resume discards stale saves.
4. Closed Ranks flag never cleared → permanent defensive lockout turn 2+ → **7daa95f**
   resolvePhase now resets closedRanks alongside action-budget reset.
5. Loyal-stack bonus firing at 1 tough (RULES §4 says 3+) → **09b61e4 / d1aea47**

## Major UX in frozen shape
6. Card portraits had no image-fallback wiring → **3194c2a**
   <img> gets onError → card-portrait-initials fallback with card.name initials.
7. Zero lazy-load on card images → **3194c2a**
   loading="lazy" on both tough and modifier renders.

## Minor freeze integrity
8. unlockDifficulty migration cast was brittle → **41887ad**
   LEGACY_SUDDEN_DEATH const + DO-NOT-REMOVE comment + unknown cast hardens
   against future type-sweep cleanups silently deleting the migration.

## Build/deploy integrity (caught by CI)
9. Dependabot auto-bumped sql.js 1.11.0 → 1.14.1, breaking jeep-sqlite
   WASM ABI (LinkError at runtime in browser tests) → **6d71837 / 68435e1**
   Pinned to 1.11.0 exactly; added dependabot ignore so the bump can't
   silently return. 95 browser tests pass.
10. DifficultyScreen.browser.test.tsx asserted 6 tiles, not 5 → **6d71837**
    Missed in the Sudden Death removal sweep (DOM variant was updated,
    browser variant wasn't).
11. Python workspace (image-extraction) had no dependabot coverage → **ae64508**
    Added pip ecosystem entry so CVE alerts + weekly bumps fire.

## Closed in this PR (second-pass fixes)
12. **AI earns no packs on AI wins** → **519c878**
    App.tsx handleGameOver now branches on winner: player-win opens
    packs into player collection (unchanged), AI-win queues pending
    packs and opens them into aiProfile via the existing helpers.
    DESIGN.md §Core Loop "AI earns identical rewards when it wins"
    now holds.
13. **tsconfig excluded src/sim** → **1191df8**
    Added tsconfig.sim.json project ref with node types; surfaced 3
    dead code files (deleted) and 2 real latent bugs (wrong TurfMetrics
    field names in effects.ts; missing type re-exports in benchmarks.ts).

## Documented as follow-ups (not blocking 1.1-beta.1)
- LAUNDER currency can be spent as a bribe, destroying heat relief mid-war;
  UX trap deserves a future warning prompt or non-spendable tag.
- Catalog re-parses on every screen mount (Collection/CardGarage/Cards);
  move parse to module scope for scalability.
- Silhouette missing in prod when served via SPA-fallthrough web servers
  (Cloudflare/Netlify) returns HTML not 404; fallback fires correctly but
  wastes a fetch. Consider returning 404 for /assets/* in production deploy.
- **Perfect War escalating currency fallback is flat $500 forever**
  (rewards.ts:163). RULES §13.4 says $500 → $1000 → $1500 → … but the
  escalation state was deferred to "persistence layer" that doesn't
  implement it. Only affects players who win 11+ Perfect Wars.
- **AI planner doesn't see justPromoted**. It's passive (extra budget at
  turn start) so it works, but the planner doesn't pre-bias toward
  promoted-turf aggression. Medium follow-up.
