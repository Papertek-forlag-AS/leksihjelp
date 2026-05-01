---
phase: 38-extension-uat-batch-bug-fix-loop-regr
plan: 01
subsystem: testing
tags: [uat, walkthrough, fr-aspect-hint, vocab-seam, sidecars, language-routing, browser-verification]

# Dependency graph
requires:
  - phase: 36-mood-aspect-pedagogy-and-vocab-seam-coverage-gate
    provides: F36-1 fr-aspect-hint rule + v2.9.15 vocab-seam fix that this walkthrough re-confirms
  - phase: 37-hygiene-templates-pre-flight
    provides: HYG-01 walkthrough template, HYG-02 finding template, HYG-03 verification_kind:human-browser-walk auto-mode pause convention, HYG-07 vocab pre-flight gate
provides:
  - UAT-EXT-01 walkthrough log (warm-up — first in locked Phase 38 sequence)
  - F38-1 blocker finding: fr-aspect-hint silent in real Chrome (FR input → NB dictionary; FR sidecars 404; pipeline gap universal across languages)
  - F38-2 minor (deferred) finding: NN locale partial — explanation body stays in NB
  - First exercise of the Phase 38 walk-and-document loop; validates HYG-03 auto-mode pause discipline end-to-end
affects:
  - Phase 38-01.1 (decimal-insert blocker fix plan, queued — must land before 38-05 release asset can ship)
  - Phase 38-04 (DE Lær mer 4+2 walk) — accumulates NN signal for F38-2 deferred fix
  - Phase 38-05 (release asset) — BLOCKED on F38-1 closure; FIX-04 must not bundle a known-blocker build
  - Phase 39 (lockdown sync) — consumes Phase 38 tagged head; depends on F38-1 fix landing first

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Walk-and-document discipline: agent instantiates walkthrough log + drafts steps (deterministic), pauses at human-browser-walk checkpoint, walker fills observed fields + files findings, agent resumes to commit + close out. No fix attempted in walk plan — fixes go to decimal-insert plans."
    - "HYG-03 hard-pause validated end-to-end: verification_kind:human-browser-walk frontmatter stopped auto-mode at the walker step despite auto-mode being active; walker resumed manually; flow worked as designed."

key-files:
  created:
    - .planning/uat/UAT-EXT-01.md
    - .planning/uat/findings/F38-1.md
    - .planning/uat/findings/F38-2.md
    - .planning/uat/findings/.gitkeep
  modified:
    - .planning/STATE.md (Session Continuity — checkpoint position, then closeout)

key-decisions:
  - "F38-1 (blocker) requires a decimal-insert fix plan (38-01.1) appended BEFORE Phase 38-05 ships the release asset — FIX-04 must not bundle a known-blocker build"
  - "F38-2 (minor) deferred per walker; NOT decimal-inserted into Phase 38 — Phase 38-04 (DE Lær mer 4+2 walk, includes NN+EN cross-locale walks) will accumulate more NN signal before a dedicated NN coverage phase closes the class"
  - "Sidecar-pipeline gap is universal (pitfalls-nb.json also 404), not FR-specific — F38-1 fix should regenerate sidecars for all languages, not just FR"
  - "Probable proximate cause of fr-aspect-hint silence: per-input language not propagating from popup to spell-check seam (NB rules fired on French tokens) — F38-1 hypothesis to verify in the fix plan"

patterns-established:
  - "Browser walks catch Node-vs-browser divergence class that release gates structurally cannot exercise (all 14 gates green; real-Chrome walk caught language-routing gap on first try) — confirms STATE v3.2 entry Pitfall 2 framing"
  - "Pre-flight evidence (check-vocab-deployment exit 0, ext_version, idb_revision, browser_version, reload_ts) is the difference between a walk and a walk-not-completed — Pitfall 1 (stale-artifact) defended"

requirements-completed: [UAT-EXT-01]

# Metrics
duration: ~30min (agent-side; walker time additional)
completed: 2026-05-01
---

# Phase 38 Plan 01: F36-1 fr-aspect-hint browser confirmation (warm-up) Summary

**Real-Chrome warm-up walk surfaced a blocker (F38-1: fr-aspect-hint silent — French input scored against NB dictionary, FR sidecars 404) and a deferred minor (F38-2: NN locale partial); validates HYG-03 auto-mode pause + walk-and-document discipline end-to-end.**

## Performance

- **Duration:** ~30 min agent-side (Task 1 instantiation + Task 2 commit/closeout); walker time additional
- **Started:** 2026-05-01T16:52:00+02:00
- **Completed:** 2026-05-01 (closeout)
- **Tasks:** 2 (Task 1: instantiate walkthrough log; Task 2: walker performs walk + agent commits artifacts)
- **Files modified:** 4 created, 1 modified

## Accomplishments

- UAT-EXT-01 walkthrough log instantiated, populated by walker, committed with full pre-flight evidence and walker sign-off
- F36-1 fr-aspect-hint browser confirmation completed (negative result — rule does NOT fire as expected in real Chrome)
- 2 findings filed with HYG-02-compliant frontmatter (severity, sync_status, walkthrough_id, discovered, regression_fixture_id=TBD, status=open)
- HYG-03 hard-pause validated end-to-end: agent paused at Task 2 despite auto-mode active; walker resumed; closeout proceeded
- Pre-flight gate (check-vocab-deployment exit 0 at HEAD cc523ae1) confirmed all 6 languages aligned — defect is NOT stale-vocab class

## Task Commits

1. **Task 1: Instantiate UAT-EXT-01 walkthrough log from template** — `92ea7eb` (docs)
2. **Hard-pause STATE record** — `8294e25` (docs) [interim, between Task 1 commit and walker resume]
3. **Task 2: Record walker outcomes (UAT-EXT-01.md populated + F38-1 + F38-2 filed)** — `66248a7` (docs)

**Plan metadata:** _pending — final commit captures this SUMMARY + STATE/ROADMAP updates_

## Files Created/Modified

- `.planning/uat/UAT-EXT-01.md` — F36-1 fr-aspect-hint warm-up walkthrough log (pre-flight + 6 steps + outcome)
- `.planning/uat/findings/F38-1.md` — blocker: fr-aspect-hint silent in real Chrome (FR input → NB dictionary; FR sidecars 404; pipeline gap universal)
- `.planning/uat/findings/F38-2.md` — minor (deferred): NN locale partial — explanation body stays in NB
- `.planning/uat/findings/.gitkeep` — preserves findings directory in git
- `.planning/STATE.md` — Session Continuity updated (checkpoint position recorded, then closeout)

## Decisions Made

- **F38-1 fix sequencing:** F38-1 is a blocker. A decimal-insert fix plan (38-01.1) MUST be appended to Phase 38 before Plan 38-05 (release asset) ships. FIX-04 release asset must not bundle a known-blocker build.
- **F38-2 deferral:** Per walker classification (minor + explicit defer), F38-2 is NOT decimal-inserted into Phase 38. Phase 38-04 (DE Lær mer 4+2 walk, includes 2 NN+EN cross-locale walks) will accumulate more NN-gap signal; a dedicated NN coverage phase closes the class downstream.
- **Sidecar regeneration scope:** Step 6 confirmed `pitfalls-nb.json` also 404, so the sidecar-pipeline gap is universal. F38-1 fix should regenerate sidecars for all 6 languages, not just FR.
- **F38-1 proximate-cause hypothesis (to verify in fix plan):** Per-input language plumbing not propagating popup foreign-language to spell-check seam, OR seam ignores `lang` and runs all enabled rules with NB winning by ordering/priority. Console pattern: `[lexi-spell] markers rendered` fires; NB rule flags `j'ai`; fr-aspect-hint silent.

## Deviations from Plan

None — plan executed exactly as written. The plan's purpose was to walk and document; both tasks ran to spec and surfaced exactly the kind of defect the walk-and-document loop is designed to catch. No auto-fixes attempted (per plan's explicit "DO NOT fix any defects in this plan" directive).

## Issues Encountered

None on the agent side. The defects surfaced (F38-1, F38-2) are the walkthrough's findings — that's the deliverable, not an issue with execution.

## User Setup Required

None.

## Next Phase Readiness

**Phase 38 progression:**

- **38-01.1 (decimal-insert, queued):** Fix F38-1. Likely scope: (a) regenerate sidecar files for all 6 languages via vocab-sync pipeline; (b) audit per-input language propagation from popup → content-script seam → rule dispatch; (c) add fixture or `benchmark-texts/expectations.json` entry asserting fr-aspect-hint fires when popup language=fr (resolves `regression_fixture_id` per HYG-02). Must include FIX-02 regression artifact (HARD criterion). Bumps `extension/manifest.json` + `package.json` + `backend/public/index.html` per HYG-04.
- **38-02 (canonical popup view 9-step walkthrough):** Independent of F38-1 — different surface (popup views, not content-script spell-check pipeline). Can proceed in parallel or after 38-01.1; orchestrator's call.
- **38-05 (release asset):** BLOCKED on F38-1 closure. FIX-04 must not bundle a known-blocker build. Confirm 38-01.1 lands and `regression_fixture_id` resolves before 38-05 starts.

**Outstanding blockers exiting Plan 38-01:**

- F38-1 (blocker, open, regression_fixture_id: TBD) — see `.planning/uat/findings/F38-1.md`
- F38-2 (minor, deferred, regression_fixture_id: TBD) — see `.planning/uat/findings/F38-2.md`; NOT a Phase 38 blocker per walker classification

**Validated discipline (positive outcome):**

- HYG-01 (template): walkthrough log instantiated cleanly, all observable fields filled
- HYG-02 (finding template): 2 findings filed with HARD-required `regression_fixture_id: TBD`
- HYG-03 (auto-mode pause): hard-paused at human-browser-walk checkpoint despite auto-mode active; walker resumed manually
- HYG-07 (vocab pre-flight): exit 0 at HEAD cc523ae1 confirmed walk was against deployed-aligned vocab — defect is NOT stale-artifact class

## Self-Check: PASSED

- `.planning/uat/UAT-EXT-01.md` exists with walker sign-off, all observed fields filled, no `observed: TBD` lines
- `.planning/uat/findings/F38-1.md` exists with full HYG-02 frontmatter
- `.planning/uat/findings/F38-2.md` exists with full HYG-02 frontmatter
- Commits `92ea7eb`, `8294e25`, `66248a7` exist in git log

---
*Phase: 38-extension-uat-batch-bug-fix-loop-regr*
*Plan: 01*
*Completed: 2026-05-01*
