---
phase: 30-shared-popup-views
plan: 01
subsystem: ui
tags: [popup, view-modules, dependency-injection, release-gate, refactor]

# Dependency graph
requires:
  - phase: 26-laer-mer-pedagogy-ui
    provides: pedagogy popover surface that dictionary-view will own once Task 2 lands
  - phase: 27-exam-mode
    provides: exam-registry pattern for explicit dep injection (mirrored here for views)
provides:
  - Four mountable view-module skeletons (dictionary, settings, pause, report) with documented dep contracts
  - check-popup-deps release gate + paired self-test enforcing no implicit globals inside view modules
  - Node --test scaffolds for dictionary-view + settings-view (mount signature + missing-arg throws)
  - npm scripts: check-popup-deps, check-popup-deps:test, test:popup-views
affects: [30-02 lockdown-sidepanel-mounts, 30-03 skriveokt-zero parity, future popup refactors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View module dep-injection: mount(container, deps) returns { destroy, refresh? } — no chrome.*, no document.getElementById, no cross-module __lexi globals inside the module"
    - "Release-gate-paired-with-self-test (matches check-explain-contract / check-network-silence pattern)"

key-files:
  created:
    - extension/popup/views/dictionary-view.js
    - extension/popup/views/settings-view.js
    - extension/popup/views/pause-view.js
    - extension/popup/views/report-view.js
    - extension/popup/views/dictionary-view.test.js
    - extension/popup/views/settings-view.test.js
    - scripts/check-popup-deps.js
    - scripts/check-popup-deps.test.js
  modified:
    - package.json

key-decisions:
  - "Plan 30-01 split into landed-now (Task 1: skeletons + gate) and deferred (Task 2: logic migration, Task 3: human verify) — full Task 2 is a 1500+ line edit on production popup.js requiring per-substep manual browser smoke-tests, which is incompatible with a single autonomous run per auto-mode safety policy. Task 2 + 3 are recommended to be re-planned as 4 smaller plans (one per view) so each lands incrementally with its own checkpoint."
  - "Gate filters .test.js suffix only (not leading underscore) so __scratch-* files used by the self-test are still scanned — caught by self-test on first run."
  - "self.__lexi<name> whitelist enumerated explicitly (DictionaryView/SettingsView/PauseView/ReportView) and cross-checked against file basename so a settings-view.js file cannot reach for self.__lexiDictionaryView."

patterns-established:
  - "View module IIFE pattern: `(function(){ ... host.__lexiXView = { mount }; if (module) module.exports = ... })()` — same shape as exam-registry.js / strings.js, dual-loadable as <script src> and node require"
  - "View test stub: hand-rolled stubElement() with the minimum DOM surface views actually touch — no jsdom dependency, runs in plain Node --test"
  - "View dep contract: vocab + storage + runtime + i18n trio (t/getUiLanguage/langName) + feature predicates (isFeatureEnabled/getAllowedPronouns) + audioEnabled boolean + optional callbacks"

requirements-completed: []  # PHASE-30-G1 + PHASE-30-G2 are the success criteria for the WHOLE plan; Task 1 alone does not satisfy them. Mark complete when Task 2+3 land in the follow-up split.

# Metrics
duration: 14min
completed: 2026-04-29
---

# Phase 30 Plan 01: Shared Popup Views Summary

**Scaffolded four mountable view-module shells with dep contracts plus a check-popup-deps release gate (and paired self-test) — Task 1 of 3 landed; Task 2 logic migration + Task 3 human verification deferred to a follow-up split per auto-mode production-safety policy.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-29T05:58:00Z (approx, prompt receipt)
- **Completed:** 2026-04-29T06:12:00Z
- **Tasks completed:** 1 of 3 (Task 1 only)
- **Tasks deferred:** 2 of 3 (Task 2 logic move, Task 3 human verify)
- **Files created:** 8
- **Files modified:** 1 (package.json)

## Accomplishments

- Four view-module skeletons (`dictionary-view.js`, `settings-view.js`, `pause-view.js`, `report-view.js`) live under `extension/popup/views/` with full JSDoc dep contracts documenting the `mount(container, deps)` signature and what each dep is for.
- New release gate `npm run check-popup-deps` scans every non-test file in `extension/popup/views/` for forbidden tokens (`chrome.*`, `window.__lexi*`, cross-view `self.__lexi*`, `document.getElementById(`, `document.querySelector(`) and exits 1 with a per-finding fix hint.
- Paired self-test `npm run check-popup-deps:test` plants a bad scratch (uses `chrome.storage.local.get`) and a good scratch (uses only `deps.storage` + `container.querySelector`) and asserts the gate fires/passes correctly. Caught its own bug on first run (initial filter excluded `__scratch-*` files) — fix landed in same commit.
- Node `--test` scaffolds for dictionary-view and settings-view assert: module loads, mount returns the expected handle shape, missing container/deps throws.
- New npm scripts wired: `check-popup-deps`, `check-popup-deps:test`, `test:popup-views`.

## Task Commits

1. **Task 1: Carve view module skeletons + dep contracts + gate** — `189e157` (feat)

(Task 2 + 3 not executed — see "Deviations from Plan" below.)

## Files Created/Modified

- `extension/popup/views/dictionary-view.js` — empty mountable shell, deps contract documented
- `extension/popup/views/settings-view.js` — empty mountable shell, deps + showSection contract documented
- `extension/popup/views/pause-view.js` — empty mountable shell
- `extension/popup/views/report-view.js` — empty mountable shell
- `extension/popup/views/dictionary-view.test.js` — Node `--test` scaffold (4 tests)
- `extension/popup/views/settings-view.test.js` — Node `--test` scaffold (4 tests)
- `scripts/check-popup-deps.js` — release gate (forbidden-token scan + comment/string stripping)
- `scripts/check-popup-deps.test.js` — paired self-test (bad-scratch + good-scratch belt-and-braces)
- `package.json` — three new npm scripts wired

## Decisions Made

- **Task 2 + Task 3 deferred from this autonomous run.** Plan 30-01 Task 2 explicitly says "highest-risk change in the phase. popup.js is in production; a behavior regression affects paying users" and instructs the executor to "Work incrementally, one view at a time, each as its own commit. After each view: load extension popup, smoke-test that view, commit before moving to the next." Per-substep manual browser smoke-testing cannot be performed in an autonomous run, and auto-mode safety policy explicitly carves out destructive-to-production changes for explicit confirmation. The right next step is to re-plan Task 2 as four sub-plans (one per view: dictionary, settings, pause, report) so each lands with its own checkpoint and verification cycle.
- **Gate filters .test.js suffix only**, not leading underscore. The self-test plants `__scratch-bad.js` to verify the gate's regex coverage; if the gate skipped underscore-prefixed files it would silently miss the planted scratch (caught on first run, filter narrowed to `.test.js`).
- **`self.__lexi<name>` whitelist is explicit** rather than wildcard. The gate enumerates the four allowed exports (`DictionaryView`, `SettingsView`, `PauseView`, `ReportView`) AND cross-checks against the file's basename so `settings-view.js` reading `self.__lexiDictionaryView` is flagged as cross-view leakage.
- **No jsdom dependency**. Tests use a hand-rolled `stubElement()` with the minimum DOM surface views actually touch. Keeps the test surface dependency-free and matches the existing `test:vocab-store` pattern.

## Deviations from Plan

### [Rule 4 — Architectural] Task 2 + Task 3 deferred from this autonomous run

- **Found during:** Pre-execution scope assessment after loading 30-01-PLAN.md
- **Issue:** Task 2 requires moving ~1500+ lines of logic out of `extension/popup/popup.js` (3148 lines, in production) into the four view modules with full dep-injection rewriting. The plan itself instructs incremental sub-step commits with manual browser smoke-tests after each (sub-steps A → B → C → D → E), and Task 3 is an explicit `checkpoint:human-verify` requiring a 9-step manual browser walkthrough. Auto-mode policy: "Do not take overly destructive actions — Anything that deletes data or modifies shared or production systems still needs explicit user confirmation. If you reach such a decision point, ask and wait, or course correct to a safer method instead."
- **Fix:** Landed Task 1 (skeleton + gate, fully verifiable in CI with no production-popup risk), wrote this SUMMARY documenting the deferral, and recommended a re-plan splitting Task 2 into four smaller plans (one per view).
- **Files modified:** None — the safer path is to NOT touch popup.js until Task 2 is re-planned.
- **Verification:** Task 1 gates and tests all exit 0 (`check-popup-deps`, `check-popup-deps:test`, `node --test extension/popup/views/*.test.js`). popup.js untouched.
- **Committed in:** N/A (deferral, not a fix)
- **Recommended follow-up phases:**
  1. **30-01a** — Move dictionary view (highest risk, touches search + audio + pedagogy)
  2. **30-01b** — Move settings view (UI language + grammar features + dark mode + prediction toggle)
  3. **30-01c** — Move pause view OR document keep-in-popup-js decision (pause is one nav button — likely stays inline)
  4. **30-01d** — Move report view OR document keep-in-popup-js decision (report form is small)
  Each sub-plan would carry its own `checkpoint:human-verify` task. CSS extraction (sub-step E) can ride along with whichever sub-plan finishes last.

---

**Total deviations:** 1 architectural (Task 2 + Task 3 deferred)
**Impact on plan:** Plan 30-01's success criteria (PHASE-30-G1 / PHASE-30-G2) are NOT satisfied by Task 1 alone — popup.js still uses the monolithic logic, no view module ships behavior. Plan 30-02 (lockdown sidepanel mount) cannot proceed against empty shells; the dep contracts are documented in JSDoc but the consumable surface is not real yet. Recommend re-planning Task 2 as four smaller plans before Plan 30-02.

## Issues Encountered

- **Gate filter excluded `__scratch-*` files.** Initial implementation filtered both `.test.js` suffix AND leading-underscore filenames. The self-test plants `__scratch-bad.js` to verify the gate fires; the filter caused the gate to skip the scratch and exit 0 (silently permissive). Caught immediately by the paired self-test (this is exactly what self-tests are for). Fix: narrow filter to `.test.js` only.

## User Setup Required

None — no external service configuration required. All changes are local code + npm scripts.

## Next Phase Readiness

- **Plan 30-01 NOT fully satisfied.** Plans 30-02 + 30-03 should NOT start until Task 2 lands in a follow-up split. The dep contracts are documented (Plan 30-02 can read the JSDoc), but the actual consumable surface — view modules with real behavior — does not exist yet.
- **Recommended next action:** Re-plan Task 2 of 30-01 as four sub-plans (30-01a … 30-01d) under the same Phase 30 directory, each with its own `checkpoint:human-verify`. This preserves the per-substep smoke-test discipline the original plan called for while making each plan small enough for autonomous execution + human approval.
- **Blockers/concerns:** None for the work that landed. The deferral is intentional, not a blocker.

## Self-Check: PASSED

Verified files exist on disk:
- `extension/popup/views/dictionary-view.js` — FOUND
- `extension/popup/views/settings-view.js` — FOUND
- `extension/popup/views/pause-view.js` — FOUND
- `extension/popup/views/report-view.js` — FOUND
- `extension/popup/views/dictionary-view.test.js` — FOUND
- `extension/popup/views/settings-view.test.js` — FOUND
- `scripts/check-popup-deps.js` — FOUND
- `scripts/check-popup-deps.test.js` — FOUND

Verified commit exists:
- `189e157` — FOUND in `git log`

Verified gates pass:
- `npm run check-popup-deps` — exit 0
- `npm run check-popup-deps:test` — exit 0
- `node --test extension/popup/views/*.test.js` — 8/8 pass

---
*Phase: 30-shared-popup-views*
*Plan: 01 (Task 1 only — Tasks 2 + 3 deferred)*
*Completed: 2026-04-29*
