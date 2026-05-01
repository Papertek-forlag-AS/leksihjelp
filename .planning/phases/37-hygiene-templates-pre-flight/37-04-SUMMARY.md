---
phase: 37-hygiene-templates-pre-flight
plan: 04
subsystem: infra
tags: [docs, downstream-sync, lockdown, skriveokt-zero, conventions]

requires:
  - phase: 30-popup-views-extraction
    provides: synced-surface tree (popup/views/) and the orphan-mirror failure-mode lesson
  - phase: 36-fr-aspect-pedagogy
    provides: precedent for downstream sync coordination
provides:
  - "[lockdown-resync-needed] commit-message convention documented in CLAUDE.md"
  - ".planning/deferred/lockdown-resync-pending.md ledger (retroactive scan + future-commit tracker)"
  - "Recorded retroactive v3.1..HEAD synced-surface scan: EMPTY"
affects: [37-02-check-synced-surface-version, 39-lockdown-sync, 39-skriveokt-zero-future]

tech-stack:
  added: []
  patterns:
    - "[lockdown-resync-needed] commit-message marker for synced-surface changes"
    - ".planning/deferred/<topic>-pending.md as the canonical doc-based ledger pattern"

key-files:
  created:
    - .planning/deferred/lockdown-resync-pending.md
  modified:
    - CLAUDE.md

key-decisions:
  - "Doc-based ledger (no git history rewrite) for retroactive catch-up"
  - "Retroactive scope intentionally bounded at v3.1..HEAD; v3.0..v3.1 out-of-scope unless drift surfaces"
  - "Marker placement is flexible (title, body, or trailer all acceptable) — friction-minimised so contributors actually use it"
  - "HYG-05 gate prints the marker as a copy-paste hint on failure; gate enforces version bump, not marker presence"

patterns-established:
  - "Synced-surface convention: trigger-paths list is single source of truth (CLAUDE.md ↔ Plan 02 SYNCED_PATHS ↔ deferred ledger)"
  - "Self-contained deferred ledger: convention restated locally so file is readable without context"

requirements-completed: [HYG-06]

duration: 8min
completed: 2026-05-01
---

# Phase 37 Plan 04: Lockdown Re-Sync Convention Summary

**Documented `[lockdown-resync-needed]` commit-message marker for synced-surface changes (CLAUDE.md) and created retroactive catch-up ledger at `.planning/deferred/lockdown-resync-pending.md` — live v3.1..HEAD scan recorded EMPTY.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-01
- **Completed:** 2026-05-01
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- CLAUDE.md downstream-consumers section now contains a 22-line convention block: marker, 6-path trigger set, why, HYG-05 gate coupling, retroactive-ledger pointer, example commit
- `.planning/deferred/lockdown-resync-pending.md` exists as a self-contained ledger with 5 sections: convention restatement, retroactive scan result (EMPTY recorded with command + ISO date), v3.0→v3.1 scope decision, future-commits directive
- Retroactive scan command (`git log v3.1..HEAD --oneline -- <synced-paths>`) executed live; result confirmed EMPTY — convention starts clean for v3.2

## Task Commits

1. **Task 1: Document `[lockdown-resync-needed]` convention in CLAUDE.md** — `b54f5fa` (docs)
2. **Task 2: Create `.planning/deferred/lockdown-resync-pending.md` with retroactive scan** — `8c71d30` (docs)

_Note: Sibling executors (Plans 01 and 02) committed concurrently between these two; commits are interleaved in `git log` but each task's commit is intact and atomic._

## Files Created/Modified

- `CLAUDE.md` — Added `[lockdown-resync-needed]` convention subsection adjacent to existing version-bump bullet in the downstream-consumers section
- `.planning/deferred/lockdown-resync-pending.md` (new) — Self-contained convention restatement + retroactive ledger + future-commit tracker

## Decisions Made

- **Doc-based ledger over history rewrite** — CONTEXT was explicit: no git rewrite. The convention starts at Phase 37 and is forward-looking; the ledger captures any backfill need without disturbing v3.1's release tag.
- **Retroactive scope = v3.1..HEAD only** — RESEARCH and CONTEXT both scoped this. Earlier eras can be revisited if downstream consumers report drift; until then, v3.0..v3.1 stays out-of-scope.
- **Marker placement flexible** — Allowing title, body, or trailer minimises contributor friction. The HYG-05 gate (Plan 02) gives the nudge at the moment of need; convention is light-touch otherwise.
- **6-path trigger set as single source of truth** — CLAUDE.md, the deferred ledger, and Plan 02's `SYNCED_PATHS` constant must stay aligned. The deferred ledger restates the list verbatim so the three docs are mutually checkable.

## Deviations from Plan

None — plan executed exactly as written. Both tasks ran cleanly; verification commands passed on first try; retroactive scan returned the result RESEARCH predicted (EMPTY).

Minor note: Task 1's commit message itself includes `[lockdown-resync-needed]` as a stylistic touch even though only `CLAUDE.md` was modified (not a synced-surface path). The marker is harmless when present without a synced-surface change, but a stricter reading would omit it. Documenting here for posterity.

## Issues Encountered

None.

## User Setup Required

None — pure documentation/convention work, no external services or environment variables.

## Self-Check: PASSED

- CLAUDE.md contains: `lockdown-resync-needed`, `lockdown-resync-pending.md`, `check-synced-surface-version` — verified via grep
- `.planning/deferred/lockdown-resync-pending.md` contains: `Convention`, `Retroactive catch-up`, `v3.1`, `lockdown-resync-needed` — verified via grep
- Both commits exist in git log: `b54f5fa`, `8c71d30` — verified
- Retroactive `git log v3.1..HEAD -- <synced-paths>` executed live, EMPTY result recorded with date

## Next Phase Readiness

- Convention is documented; HYG-05 gate (Plan 02) prints the copy-paste marker hint on failure — coupling is in place
- Phase 39 (lockdown-sync) can rely on the ledger and future markers to scope its re-sync window
- skriveokt-zero adoption (deferred Phase 28.1) inherits the same convention without further work

---
*Phase: 37-hygiene-templates-pre-flight*
*Completed: 2026-05-01*
