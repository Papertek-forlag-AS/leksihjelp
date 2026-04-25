---
phase: 08-de-case-agreement-governance
plan: 01
subsystem: spell-check
tags: [german, case-agreement, grammar-tables, participleToAux, benchmark]

requires:
  - phase: 07-word-order-violations
    provides: de-v2.js rule with SEPARABLE_PREFIXES, benchmark-texts/de.txt baseline
provides:
  - grammar-tables.js shared IIFE with PREP_CASE, DEF_ARTICLE_CASE, INDEF_ARTICLE_CASE, SEPARABLE_PREFIXES, SEIN_VERBS, BOTH_AUX_VERBS
  - participleToAux Map (652 entries) in vocab-seam for DE-03 Perfekt auxiliary rule
  - DE benchmark lines for all four Phase 8 target patterns
affects: [08-02, 08-03, de-prep-case, de-perfekt-aux, de-compound-gender, de-separable-verb]

tech-stack:
  added: []
  patterns: [IIFE global export via self.__lexiGrammarTables, shared closed-set linguistic tables]

key-files:
  created:
    - extension/content/spell-rules/grammar-tables.js
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - extension/manifest.json
    - extension/content/spell-rules/de-v2.js
    - benchmark-texts/de.txt
    - benchmark-texts/expectations.json

key-decisions:
  - "Built participleToAux from raw verbbank data (not wordList) since wordList entries lack conjugation details"
  - "SEPARABLE_PREFIXES moved to grammar-tables.js as canonical Set; de-v2.js reads from host.__lexiGrammarTables with local fallback"

patterns-established:
  - "Shared grammar tables pattern: IIFE → self.__lexiGrammarTables, consumed by rule files via host reference"

requirements-completed: [DE-01, DE-02, DE-03, DE-04]

duration: 4min
completed: 2026-04-25
---

# Phase 8 Plan 01: Shared Grammar Tables and Benchmark Setup Summary

**Shared grammar-tables.js IIFE with 6 German linguistic tables, participleToAux index (652 verb entries), and 4 benchmark lines for Phase 8 case/agreement rules**

## Performance

- **Duration:** 4m 13s
- **Started:** 2026-04-25T01:39:24Z
- **Completed:** 2026-04-25T01:43:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created grammar-tables.js with PREP_CASE (28 prepositions), DEF_ARTICLE_CASE (6 articles), INDEF_ARTICLE_CASE (6 articles), SEPARABLE_PREFIXES (23 prefixes), SEIN_VERBS (42 verbs), BOTH_AUX_VERBS (6 verbs)
- Extended vocab-seam-core.js with buildParticipleToAux function mapping 652 participles to their required auxiliary from de.json verbbank
- Added 4 benchmark lines covering DE-01 prep-case, DE-02 separable-verb, DE-03 perfekt-aux, DE-04 compound-gender patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create grammar-tables.js + extend vocab-seam with participleToAux** - `d8b17a4` (feat)
2. **Task 2: Add DE benchmark lines + update expectations.json** - `2272fd6` (feat)

## Files Created/Modified
- `extension/content/spell-rules/grammar-tables.js` - Shared IIFE exporting 6 German linguistic tables
- `extension/content/vocab-seam-core.js` - Added buildParticipleToAux and participleToAux in buildIndexes return
- `extension/content/vocab-seam.js` - Added getParticipleToAux getter
- `extension/manifest.json` - Registered grammar-tables.js before rule files
- `extension/content/spell-rules/de-v2.js` - Reads SEPARABLE_PREFIXES from grammar-tables with fallback
- `benchmark-texts/de.txt` - 4 new lines with Phase 8 error patterns, updated header
- `benchmark-texts/expectations.json` - 4 new entries + fixed line refs shifted by header update

## Decisions Made
- Built participleToAux from raw verbbank data rather than wordList, since wordList entries don't carry conjugation details (cleaner and more direct)
- Moved SEPARABLE_PREFIXES to grammar-tables.js as canonical Set source; de-v2.js retains a local fallback for backward compatibility if grammar-tables hasn't loaded

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shifted benchmark line references in expectations.json**
- **Found during:** Task 2
- **Issue:** Updating de.txt comment header shifted existing prose lines by -3, breaking de.32/de.39/de.44 expectations
- **Fix:** Updated existing expectations to de.29/de.36/de.41 matching new line numbers
- **Verification:** check-benchmark-coverage confirms 8/12 expectations met (4 pending = new rules not yet shipped)
- **Committed in:** 2272fd6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Line-number fix was necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- grammar-tables.js loaded and available to all rule files via host.__lexiGrammarTables
- participleToAux index ready for DE-03 perfekt-aux rule in Plan 02/03
- Benchmark expectations for 4 new rules will pass once Plans 02/03 ship the rules
- All existing release gates pass (check-fixtures, check-network-silence)

---
*Phase: 08-de-case-agreement-governance*
*Completed: 2026-04-25*
