---
title: Archive
updated: 2026-04-19
status: current
domain: context
---

# Archive

Documents that no longer reflect the current game / engine but are
preserved for historical reference. **Do not implement against
anything in this directory** — every file here is superseded.

## Contents

- `RULES-v0.2.md` — pre-single-lane rules. Replaced by [`../RULES.md`](../RULES.md).
- `plans/` — every shipped or killed PRD:
  - `production-polish.prq.md` — pre-1.0 polish runway. Shipped + post-1.0 work moved to [`../PRODUCTION.md`](../PRODUCTION.md).
  - `v0.2-handless-queue-resolve.prq.md` — shipped in v0.2 sim rewrite.
  - `v0.2-stack-redesign.prq.md` — shipped in v0.2 stack model.
  - `v0.3-impl.prq.md` — shipped in v1.0 / v1.1 (the omnibus rules-alignment PR closed the last gaps).
  - `v0.3-task-batch.md` — executable epic list for v0.3-impl. All 13 epics shipped.
  - `v0.3-paper-playtest.md` + `v0.3-paper-playtest-2.md` — paper-playtest research notes that fed into v0.3 RULES.md. Note: each carries a header banner flagging which proposals were rejected (e.g. Coup ability, shift-up Closed Ranks).

When a current doc cites "see archive/X" it should be doing so for
context only, not as authority.
