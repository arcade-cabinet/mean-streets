---
title: Documentation Index
updated: 2026-04-23
status: current
domain: docs
---

# Mean Streets — Documentation Index

This file is the canonical map of the `docs/` directory. Every root doc should
have frontmatter, a single owning domain, and a clear "what this document owns"
boundary.

`docs/PRODUCTION.md` is the single tracker for remaining release and polish
work. `docs/STATE.md` records what is already true on the shipped line. Use
this page to route yourself to the right source of truth before editing code or
copy.

## Pillars By Domain

| Domain | Owner doc | What it owns |
|--------|-----------|--------------|
| docs | `docs/README.md` | Documentation map, pillar ownership, frontmatter contract |
| product | `docs/DESIGN.md` | Brand, fantasy, player journey, future direction |
| product | `docs/RULES.md` | Authoritative gameplay rules and mechanical invariants |
| creative | `docs/LORE.md` | World fiction, faction tone, narrative guardrails |
| technical | `docs/ARCHITECTURE.md` | Runtime structure, data flow, subsystem ownership |
| quality | `docs/TESTING.md` | Test lanes, release gate, fixture/test expectations |
| ui | `docs/VISUAL_REVIEW.md` | Fixture workflow, screenshot targets, visual review notes |
| release | `docs/PRODUCTION.md` | Remaining launch blockers and post-launch polish tracker |
| context | `docs/STATE.md` | Current shipped state, milestone history, recent releases |
| ops | `docs/DEPLOYMENT.md` | CI/CD, Pages, native build environments, secrets |
| ops | `docs/RELEASE.md` | Release-please, artifact validation, rollback runbook |
| ops | `docs/LAUNCH_READINESS.md` | Manual pre-submit QA, signing, store handoff checklist |
| product | `docs/store-listing.md` | Store copy, screenshots, ratings, open metadata questions |

## Frontmatter Contract

Every root markdown file in `docs/` must include:

```yaml
---
title: <human-readable title>
updated: YYYY-MM-DD
status: current | draft | archived
domain: docs | product | creative | technical | quality | ui | release | context | ops
---
```

`updated` should move whenever the document meaningfully changes. `status`
should stay `current` for live source-of-truth docs and move to `draft` or
`archived` otherwise.

## Current Documentation Shape

The docs set is intentionally split by logical domain:

- Product: `DESIGN.md`, `RULES.md`, `store-listing.md`
- Creative: `LORE.md`
- Technical: `ARCHITECTURE.md`
- Quality: `TESTING.md`
- UI review: `VISUAL_REVIEW.md`
- Ops: `DEPLOYMENT.md`, `RELEASE.md`, `LAUNCH_READINESS.md`
- Release tracking and context: `PRODUCTION.md`, `STATE.md`
- Planning archive: `docs/plans/`

No single file should try to be both the design doc and the release tracker.
If a change touches multiple domains, update each owning doc rather than
stuffing cross-domain notes into one place.

## Remaining Work Snapshot

For the exact live tracker, read `docs/PRODUCTION.md`. At a glance, the
remaining work is:

- Product polish: continue branded onboarding/difficulty copy and iconography
- Visual polish: finish the remaining world-treatment pass on non-combat
  support screens and continue screenshot art direction
- Content: mythic art/editorial pass, lore/writer sign-off
- Release ops: store metadata finalization, signing secrets, physical-device QA
- Balance hygiene: continue lock coverage toward 100% for the balance catalog

If a task is not listed in `docs/PRODUCTION.md`, it is not a tracked remaining
work item yet.

## How To Use This Folder

1. Start here to identify the owning domain.
2. Read the owner doc before making product or technical changes.
3. If work is still outstanding after the change, add it to
   `docs/PRODUCTION.md`.
4. If the change materially affects screenshots or fixture expectations, update
   `docs/VISUAL_REVIEW.md`.
5. If the change alters shipped scope or release history, update
   `docs/STATE.md`.
