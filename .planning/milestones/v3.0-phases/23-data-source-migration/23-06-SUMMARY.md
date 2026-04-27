---
phase: 23-data-source-migration
plan: 06
subsystem: infra
tags: [release-gates, sc-06, gates-02, network-silence, baseline-cap]

requires:
  - phase: 23-data-source-migration
    provides: SC-06 architectural commitment that vocab-bootstrap is the only sanctioned fetch site

provides:
  - SC-06 carve-out documented and self-test enforced in check-network-silence
  - check-baseline-bundle-size release gate (200 KB cap on extension/data/nb-baseline.json)
  - Paired self-test for the new gate (oversized fires, well-formed passes, absent skips)
  - CLAUDE.md Release Workflow updated to step 7 with the new gate

affects: [23-03 (baseline builder will be measured by this gate), 23-05 (bootstrap adds the sanctioned fetch sites this gate's carve-out blesses)]

tech-stack:
  added: []
  patterns:
    - "Skip-when-absent gate: a release gate that exits 0 with a SKIP message if its target artifact does not yet exist; becomes meaningful once the producing plan ships. Lets gate land in an early wave without coupling to later plans."
    - "Carve-out by scan-set omission: SC-06 sanctioned files (vocab-bootstrap, vocab-updater, vocab-store) are kept outside SCAN_TARGETS/SCAN_DIRS rather than added to a whitelist. Self-test plants a fetch in the omitted path and asserts the gate stays green — proves the carve-out is real and not silent regex drift."

key-files:
  created:
    - scripts/check-baseline-bundle-size.js
    - scripts/check-baseline-bundle-size.test.js
  modified:
    - scripts/check-network-silence.js
    - scripts/check-network-silence.test.js
    - package.json
    - CLAUDE.md

key-decisions:
  - "Carve-out documented at the top of check-network-silence.js (header comment) AND enforced behaviourally by the self-test planting fetch() in vocab-bootstrap.js — code comment alone would drift; behavioural test alone would obscure intent. Both layers belt-and-braces."
  - "check-baseline-bundle-size measures the SOURCE pretty-printed file (extension/data/nb-baseline.json), not the packaged minified zip entry. Earlier signal than check-bundle-size (which measures the whole 20 MiB-cap zip) and dimensioned correctly for a tiny baseline."
  - "Skip-when-absent semantics chosen over hard-fail or stub-file. Hard-fail would block plans 23-02, 23-04, 23-05 (whose work is independent of the baseline file). A stub would be a lie. SKIP + informational message is honest and unblocks the wave."

patterns-established:
  - "Skip-when-absent gates: gate scripts in this repo can exit 0 with a SKIP marker when their target artifact does not yet exist, becoming meaningful once a downstream plan produces the artifact."
  - "SC-06 carve-out registry: scripts/check-network-silence.js header is the canonical inventory of sanctioned-fetch files. Future plans adding a new sanctioned site must update both the header and the self-test scenarios."

requirements-completed: [GATES-01, GATES-02]

duration: 3min
completed: 2026-04-27
---

# Phase 23 Plan 06: Release Gates for Bootstrap Path Summary

**SC-06 carve-out enforced by self-test plant-in-vocab-bootstrap, plus a 200 KB cap on extension/data/nb-baseline.json with a skip-when-absent self-test.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-27T00:50:06Z
- **Completed:** 2026-04-27T00:53:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Documented SC-06 sanctioned bootstrap path (vocab-bootstrap.js, vocab-updater.js, vocab-store.js) in check-network-silence.js header. Carve-out is enforced by scan-set omission, and the self-test now plants a fetch() inside vocab-bootstrap.js to prove the gate stays green — guarding against accidental scan-scope expansion.
- Added new release gate `check-baseline-bundle-size` (200 KB cap on extension/data/nb-baseline.json) with paired self-test covering oversized (250 KB → exit 1), well-formed (5 KB → exit 0), and absent (skip → exit 0) scenarios. try/finally restoration so an aborted run never leaves the repo broken.
- Wired both `check-baseline-bundle-size` and `check-baseline-bundle-size:test` into package.json scripts.
- Updated CLAUDE.md Release Workflow to insert the new gate as step 7 (between the packaged-zip and benchmark-coverage gates) with rationale referencing Phase 23's bundled-data removal.

## Task Commits

1. **Task 1: SC-06 carve-out in check-network-silence + self-test** — `907d26e` (feat)
2. **Task 2: check-baseline-bundle-size gate + self-test + CLAUDE.md** — `2be199f` (feat)

## Files Created/Modified

- `scripts/check-baseline-bundle-size.js` — New 200 KB cap gate. SKIP/PASS/FAIL semantics with informational skip when baseline absent (pre-plan-23-03).
- `scripts/check-baseline-bundle-size.test.js` — Paired self-test. Phase A oversized→fire, Phase B small→pass, Phase C absent→skip. Backs up real baseline in try/finally.
- `scripts/check-network-silence.js` — Added SC-06 sanctioned bootstrap path documentation block in header.
- `scripts/check-network-silence.test.js` — New scenario plants fetch() in extension/background/vocab-bootstrap.js and asserts gate stays green; restore in finally.
- `package.json` — Added check-baseline-bundle-size + check-baseline-bundle-size:test script entries.
- `CLAUDE.md` — Inserted new step 7 (check-baseline-bundle-size) and renumbered 8-12.

## Decisions Made

- **Skip-when-absent for baseline gate.** Plans 23-02/04/05/06 ship before plan 23-03 produces the baseline file. A hard-fail gate would block this wave; a stub baseline would be a lie. SKIP + informational message is honest and unblocks the wave while the gate becomes meaningful once 23-03 lands.
- **Carve-out enforced by both header comment and self-test plant.** Documentation alone drifts; behavioural test alone obscures intent. Together they make the SC-06 contract self-explanatory and self-policing.
- **Source file measured (not packaged zip).** check-bundle-size already measures the 20 MiB packaged zip. Measuring the pretty-printed source file in check-baseline-bundle-size gives an earlier, dimensioned-correctly signal for a 200 KB cap.

## Deviations from Plan

None — plan executed exactly as written. The plan's contemplated narrowing of `extension/content/**.js` did not apply, since the existing `check-network-silence.js` SCAN_TARGETS already lists exact files (spell-check-core.js, spell-check.js, word-prediction.js) plus the `extension/content/spell-rules` directory walk. vocab-store.js was already outside the scan set; the carve-out is enforced by omission, which is exactly what the plan asked for. Documentation was added per the plan's instruction.

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- One harmless coordination event with parallel plan 23-02: package.json received simultaneous additive edits (script entries from both plans). Confirmed via `git log --oneline` that 23-02's commit `d882469` included both my entries and theirs cleanly merged on disk before its commit; I committed only the diff that remained. No conflict, no rework.

## Next Phase Readiness

- GATES-01 and GATES-02 satisfied. Phase 23 gate inventory now complete.
- check-baseline-bundle-size will exit 0 (SKIP) until plan 23-03 produces extension/data/nb-baseline.json. From that point onward it enforces the 200 KB cap.
- check-network-silence carve-out is in place ahead of plan 23-05's vocab-bootstrap.js / vocab-updater.js implementations — plan 23-05 can add fetch() there without releasing-gate friction.

## Self-Check: PASSED

- FOUND: scripts/check-baseline-bundle-size.js
- FOUND: scripts/check-baseline-bundle-size.test.js
- FOUND: 907d26e (Task 1)
- FOUND: 2be199f (Task 2)
- Verified `npm run check-network-silence`, `check-network-silence:test`, `check-baseline-bundle-size`, and `check-baseline-bundle-size:test` all exit 0.

---
*Phase: 23-data-source-migration*
*Completed: 2026-04-27*
