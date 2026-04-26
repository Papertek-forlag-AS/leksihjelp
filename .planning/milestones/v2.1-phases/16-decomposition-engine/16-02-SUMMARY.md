---
phase: 16-decomposition-engine
plan: 02
subsystem: infra
tags: [compound-decomposition, vocab-seam, spell-check, false-positive-validation]

# Dependency graph
requires:
  - phase: 16-01
    provides: decomposeCompound function and bound closure in buildIndexes
provides:
  - getDecomposeCompound getter on __lexiVocab surface
  - decomposeCompound in spell-check vocab bag
  - Empirical FP validation (0% on NB and DE nounbanks)
affects: [17-compound-dict-lookup, 18-compound-spellcheck, 19-sarskriving-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns: [vocab-seam-getter-wiring, false-positive-validation-against-real-data]

key-files:
  created: []
  modified:
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - test/phase-16-unit.test.js

key-decisions:
  - "getDecomposeCompound returns null (not empty function) when state not ready, unlike Map/Set getters that return empty defaults"
  - "FP validation excludes compoundNouns set entries since those are known compounds by data definition"

patterns-established:
  - "Function-type getters return null rather than empty collections; consumers must null-check"

requirements-completed: [COMP-05, COMP-06]

# Metrics
duration: 3min
completed: 2026-04-26
---

# Phase 16 Plan 02: Vocab-Seam Wiring & FP Validation Summary

**decomposeCompound wired through vocab-seam and spell-check layers with 0% false-positive rate on real NB/DE nounbanks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-26T04:53:42Z
- **Completed:** 2026-04-26T04:57:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wired getDecomposeCompound getter onto __lexiVocab surface in vocab-seam.js
- Added decomposeCompound to spell-check.js vocab bag for Phase 17+ rule consumption
- Validated 0% false-positive rate on real NB nounbank (154 non-compound nouns) and DE nounbank (812 non-compound nouns)
- Both-sides validation completely prevents phantom compounds at scale

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire decomposeCompound through vocab-seam.js and spell-check.js** - `7e249ab` (feat)
2. **Task 2: False-positive validation against real nounbank** - `2eb132e` (test)

## Files Created/Modified
- `extension/content/vocab-seam.js` - Added getDecomposeCompound getter (returns null when state not ready)
- `extension/content/spell-check.js` - Added decomposeCompound to vocab bag passed to runCheck
- `test/phase-16-unit.test.js` - Added FP validation section (loads real nb.json/de.json, runs decomposeCompound on all non-compound nouns, asserts < 2% FP rate)

## Decisions Made
- getDecomposeCompound returns null (not a no-op function) when state is not ready, because it's a function rather than a collection. Consumers must null-check before calling. This differs from Map/Set getters that return empty defaults.
- FP validation filters out compoundNouns set entries (nounbank base entries) since those return null by design (stored entry guard). The test targets nounGenus entries from nounform/plural sources that aren't nounbank base entries.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 16 is COMPLETE: engine implemented (16-01), wired and validated (16-02)
- decomposeCompound available via VOCAB.getDecomposeCompound() for Phase 17 compound dictionary lookup
- decomposeCompound available in spell-check vocab bag for Phase 18 compound spell-check rules
- 0% FP rate confirms engine is safe to enable in production
- No blockers

---
*Phase: 16-decomposition-engine*
*Completed: 2026-04-26*
