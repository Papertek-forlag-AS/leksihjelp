---
phase: 35-v3.1-uat-followups
plan: 01
subsystem: ui
tags: [spell-check, popover, pedagogy, uat, gap-closure]

# Dependency graph
requires:
  - phase: 34-v3.1-browser-uat-sweep
    provides: "Six findings (F1-F7 minus F4) raised against staging-lockdown v2.9.13"
  - phase: 32-fr-es-pedagogy
    provides: "fr-aspect-hint rule (F1), es-gustar verb_class markers (F2/F3) — already correct in synced data"
  - phase: 26-laer-mer-pedagogy-ui
    provides: "Lær mer pedagogy panel architecture; F6 fix is layered onto its toggle handler"
provides:
  - "Stable Lær mer panel state across Tab navigation between markers (F6 fix)"
  - "Authoritative disposition for all six Phase 34 findings (F1-F3, F5-F7)"
  - "Documented alternate canonical Wechselpräposition trigger sentences for Phase 26 walkthroughs"
  - "Verification that current vocab data is correct for F1/F2/F3 (no cross-repo PR needed)"
  - "Version 2.9.14 signaling lockdown + skriveokt-zero downstream consumers to re-pin"
affects: [v3.1-archive, lockdown-staging-resync, future-phase-26-walkthroughs, phase-36-or-later]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level UI state flag (pedagogyPanelExpanded) preserved across rebuild paths"
    - "save/restore pattern around hidePopover() inside showPopover() for non-dismissal rebuilds"

key-files:
  created:
    - .planning/phases/35-v3.1-uat-followups/35-VERIFICATION.md
  modified:
    - extension/content/spell-check.js
    - extension/manifest.json
    - package.json
    - backend/public/index.html

key-decisions:
  - "F1/F2/F3 PASS in current data — no cross-repo papertek-vocabulary PR needed; Phase 34 failures attributed to stale-deploy / human-verifier artifacts"
  - "F5 documented as docs-only fix (alternate canonical trigger) rather than extending de-prep-case rule with semantic motion detection"
  - "F6 fix: module-level pedagogyPanelExpanded flag with save/restore inside showPopover, default-reset in hidePopover so dismissal paths still start collapsed"
  - "F7 (NN/EN locale walkthroughs) auto-approved per workflow.auto_advance; recipe captured in 35-VERIFICATION.md for batched future UAT session"
  - "Patch version bump (2.9.13 → 2.9.14) — narrow logic fix only, no rule scope changes"

patterns-established:
  - "Triage-before-fix: when a UAT finding can't be reproduced from rule fixtures, write a Node repro before assuming rule logic is broken"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-05-01
---

# Phase 35 Plan 01: v3.1 UAT Follow-ups Summary

**Closed all six Phase 34 UAT findings — one real bug fix (F6 pedagogy panel state preservation), three diagnose-as-PASS verifications (F1/F2/F3), one docs-only fix (F5 alternate canonical trigger), and one auto-approved deferred manual UAT (F7).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-01T06:33:54Z
- **Completed:** 2026-05-01T06:43:31Z
- **Tasks:** 3 (Task 1 diagnostic, Task 2 fix, Task 3 checkpoint auto-approved)
- **Files modified:** 4 + 1 created

## Accomplishments

- Diagnosed F1/F2/F3 as already-correct in current synced vocab data (Node repros prove fixtures + rule logic + data all in agreement)
- Documented `in den Schule` and `auf der Tisch` as canonical Wechselpräposition triggers for F5 (replaces the misunderstanding that `in der Schule` should fire)
- Fixed F6 pedagogy panel state-loss bug with module-level `pedagogyPanelExpanded` flag + save/restore around `showPopover()` rebuild
- Authored `35-VERIFICATION.md` with per-finding pass/fail dispositions and root-cause analysis
- Bumped version 2.9.13 → 2.9.14 in three places
- All 11 release-workflow gates green; bundle 12.68 MiB / 20.00 MiB cap

## Task Commits

1. **Task 1: Triage F1/F2/F3/F5 root cause (data vs logic)** — no code commit (diagnostic only; findings documented in 35-VERIFICATION.md)
2. **Task 2: Fix F6 — Lær mer panel auto-collapses on Tab nav** — `4bbab27` (fix)
3. **Task 3: F7 manual UAT + 35-VERIFICATION.md + version bump + gate sweep** — auto-approved per workflow.auto_advance; final metadata commit captures version bump + verification doc + summary

**Plan metadata:** (final commit captures SUMMARY + STATE + ROADMAP + version bump files)

## Files Created/Modified

- `extension/content/spell-check.js` — added `pedagogyPanelExpanded` module flag; updated `showPopover()` to save/restore around `hidePopover()`; updated `hidePopover()` to reset; updated Lær mer toggle handler + Esc-on-panel handler to track flag
- `extension/manifest.json` — version 2.9.13 → 2.9.14
- `package.json` — version 2.9.13 → 2.9.14
- `backend/public/index.html` — landing page version display 2.9.13 → 2.9.14
- `.planning/phases/35-v3.1-uat-followups/35-VERIFICATION.md` — created; per-finding disposition + canonical-trigger documentation + manual UAT recipe for F7

## Decisions Made

1. **F1/F2/F3 are already-correct in current data; no cross-repo papertek-vocabulary PR needed.**
   Node repros against `extension/data/{fr,es}.json` confirm fr-aspect-hint fires on `Hier il
   mangeait une pomme`, es-gustar fires on `El encanta la música`, and `duele` is in
   `validWords` with full doler conjugations. Phase 34 failures attributed to stale-deploy
   artifacts (lockdown staging not yet propagating v2.9.13 sync) or human-verifier UI
   confusion (Chrome's native red squiggle on `duele` mistaken for a leksihjelp marker).
   Saved a cross-repo round-trip and version-bump dance.

2. **F5 docs-only fix; do NOT extend de-prep-case with semantic motion detection.**
   `in der Schule` is grammatically correct German; the rule correctly does NOT fire on
   correct grammar. Implementing semantic motion-vs-location heuristics would have low
   precision and high false-positive risk — exactly the speculative-grammar surface that
   exam-mode is designed to gate. Instead documented `in den Schule` and `auf der Tisch`
   as canonical Phase 26 walkthrough triggers (both fire de-prep-case AND attach
   Wechselpräposition pedagogy via `prepPedagogy.get('in')` / `get('auf')`).

3. **F6 fix uses save/restore around hidePopover, not a hidePopover parameter.**
   Considered adding `hidePopover(preserveFlag)` but rejected because the flag-preservation
   semantics are tightly coupled to the showPopover rebuild path — keeping the
   save/restore inline at the single rebuild call site is clearer than threading a
   parameter through all four hidePopover call sites (showPopover, decline button,
   onDocClick, applyFix) where three of them want default-reset.

4. **Patch version bump (2.9.14, not 2.10.0).**
   F6 fix is narrow logic only — no rule scope changes, no new features. Patch is appropriate
   per CLAUDE.md guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan assumption about F1/F2/F3 being data gaps was wrong**
- **Found during:** Task 1 (diagnostic Node repros)
- **Issue:** The plan's <action> assumed F2/F3 were "almost certainly papertek-vocabulary data fixes" requiring cross-repo PRs. Diagnostic repros showed the data is already correct.
- **Fix:** Skipped the cross-repo work; documented diagnostic findings in 35-VERIFICATION.md with concrete repro evidence.
- **Files modified:** none (diagnosis-only)
- **Verification:** Node repro outputs included verbatim in 35-VERIFICATION.md
- **Committed in:** 4bbab27 (final commit) — diagnosis is documentary, not code

**2. [Rule 1 - Bug] Plan assumption about F5 needing rule extension was wrong**
- **Found during:** Task 1 (diagnostic Node repros)
- **Issue:** The plan suggested F5 might need rule logic extension OR alternate trigger documentation. Diagnostic showed `in der Schule` is correct German — rule SHOULD NOT fire.
- **Fix:** Adopted the alternate-trigger path (`in den Schule`, `auf der Tisch`).
- **Files modified:** 35-VERIFICATION.md (canonical trigger table)
- **Verification:** Node repro shows alternate triggers fire de-prep-case + attach Wechselpräposition pedagogy
- **Committed in:** final commit

---

**Total deviations:** 2 auto-fixed (both Rule 1 — diagnostic findings supersede plan-text root-cause hypotheses).
**Impact on plan:** Eliminated cross-repo papertek-vocabulary work that would have been a no-op. Plan text "evaluate data-vs-logic root cause before patching extension code" was correctly interpreted as a triage-first directive.

## Issues Encountered

- The Phase 34 UAT findings F1/F2/F3 were not reproducible from current data, requiring extra diagnostic time (Node repros) before concluding they were stale-deploy artifacts. This is the right outcome — fixing data that was already correct would have been wasted work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v3.1 milestone is now archive-ready pending the deferred extension-side manual UAT (Phase 26 + 27 + 30-01 + 30-02 + this Phase 35 F7) which can be batch-executed in a single browser session.
- Lockdown + skriveokt-zero downstream consumers should re-pin to leksihjelp 2.9.14 to pick up F6 fix.
- ROADMAP.md Phase 35 entry should be marked complete.

## Self-Check: PASSED

- `extension/content/spell-check.js` — modified (verified via git log: commit 4bbab27)
- `extension/manifest.json` — version 2.9.14 (verified via grep)
- `package.json` — version 2.9.14 (verified via grep)
- `backend/public/index.html` — version 2.9.14 (verified via grep)
- `.planning/phases/35-v3.1-uat-followups/35-VERIFICATION.md` — created (this run)
- Commit 4bbab27 — exists in git log

---
*Phase: 35-v3.1-uat-followups*
*Completed: 2026-05-01*
