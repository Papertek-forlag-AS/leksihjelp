---
phase: 16-decomposition-engine
plan: 01
subsystem: infra
tags: [compound-decomposition, NB, NN, DE, TDD, vocab-seam-core]

# Dependency graph
requires: []
provides:
  - decomposeCompound function for NB/NN/DE compound splitting
  - LINKERS_BY_LANG config constant
  - Bound closure on buildIndexes return object
  - 16 unit tests covering all decomposition cases
affects: [17-compound-dict-lookup, 18-compound-spellcheck, 19-sarskriving-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns: [both-sides-validation, recursive-decomposition, triple-consonant-elision]

key-files:
  created:
    - test/phase-16-unit.test.js
  modified:
    - extension/content/vocab-seam-core.js

key-decisions:
  - "Depth guard set to >2 (max 4 components = 3 splits) matching plan truths for 4-part success and 5-part rejection"
  - "Triple-consonant elision tries restoring dropped char unconditionally when left ends with repeated chars, rather than checking remainder[0]"

patterns-established:
  - "decomposeCompound return shape: { parts: [{word, genus, linker}], gender, confidence }"
  - "Stored nounGenus entry always takes Tier 1 precedence over decomposition"

requirements-completed: [COMP-05, COMP-06]

# Metrics
duration: 4min
completed: 2026-04-26
---

# Phase 16 Plan 01: Decomposition Engine Core Summary

**Recursive compound splitter for NB/NN/DE with both-sides noun validation, linking elements, and triple-consonant elision**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-26T04:46:57Z
- **Completed:** 2026-04-26T04:51:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Implemented `decomposeCompound` function handling NB/NN (s, e linkers) and DE (s, n, en, er, e, es linkers) compound splitting
- Both-sides validation prevents phantom compounds (left AND right must be known nouns)
- Recursive decomposition up to 4 components with triple-consonant elision support
- 16 unit tests covering all decomposition cases (zero-fuge, linker-fuge, recursive, elision, guards)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for decomposeCompound** - `07d4ca7` (test)
2. **Task 2: Implement decomposeCompound and pass all tests** - `f515436` (feat)

## Files Created/Modified
- `test/phase-16-unit.test.js` - 16 unit tests for compound decomposition (NB/DE, recursive, elision, guards)
- `extension/content/vocab-seam-core.js` - Added LINKERS_BY_LANG constant, decomposeCompound function (~110 LOC), bound closure in buildIndexes return, exported on module API

## Decisions Made
- Depth guard uses `> 2` instead of plan's `> 3` to correctly limit to 4 components (3 splits). The plan text said "max 4 components" but specified depth > 3 which allows 5 components; the test truths (4-part passes, 5-part fails) were authoritative.
- Triple-consonant elision does not require `remainder[0] === lastChar` guard. The elision means the letter was dropped, so the remainder starts with the next character, not the dropped one. The algorithm unconditionally tries restoring when left ends with a double letter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Depth guard off-by-one**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Plan specified `depth > 3` but that allows 5 components (depth 0 through 3 = 4 splits). Plan truths require 4-part max.
- **Fix:** Changed guard to `depth > 2` to enforce max 4 components (3 splits)
- **Files modified:** extension/content/vocab-seam-core.js
- **Verification:** Test 9 (4-part) passes, Test 10 (5-part) returns null
- **Committed in:** f515436

**2. [Rule 1 - Bug] Triple-consonant elision guard too strict**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Initial implementation checked `remainder[0] === lastChar` but in elision the dropped letter is absent from remainder (e.g., "nattime" splits to "natt" + "ime", not "natt" + "time")
- **Fix:** Removed the `remainder[0] === lastChar` check; the restored form `lastChar + remainder` is sufficient validation
- **Files modified:** extension/content/vocab-seam-core.js
- **Verification:** Test 14 (nattime -> natt + time) passes
- **Committed in:** f515436

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes align implementation with plan's test truths. No scope creep.

## Issues Encountered
- Pre-existing `check-network-silence` failure in `spell-check.js:797-800` (fetch/URL in report endpoint). Unrelated to Phase 16 changes. Logged to deferred-items.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `decomposeCompound` is available as raw function export and as bound closure in buildIndexes
- Downstream phases (17-19) can consume it for dictionary lookup, spell-check acceptance, and sarskriving expansion
- No blockers

---
*Phase: 16-decomposition-engine*
*Completed: 2026-04-26*
