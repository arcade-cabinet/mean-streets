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

## Documented as follow-ups (not blocking 1.1-beta.1)
- LAUNDER currency can be spent as a bribe, destroying heat relief mid-war;
  UX trap deserves a future warning prompt or non-spendable tag.
- Catalog re-parses on every screen mount (Collection/CardGarage/Cards);
  move parse to module scope for scalability.
- Silhouette missing in prod when served via SPA-fallthrough web servers
  (Cloudflare/Netlify) returns HTML not 404; fallback fires correctly but
  wastes a fetch. Consider returning 404 for /assets/* in production deploy.
