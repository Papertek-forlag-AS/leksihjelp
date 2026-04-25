---
phase: 09-es-ser-estar-por-para-personal-a
plan: 01
subsystem: spell-rules
tags: [spanish, ser-estar, por-para, personal-a, grammar-tables]

requires:
  - phase: 08-de-case-agreement-governance
    provides: grammar-tables.js IIFE pattern and DE tables
provides:
  - ES_SER_FORMS and ES_ESTAR_FORMS conjugation sets
  - ES_COPULA_ADJ mapping (56 adjectives to ser/estar/both)
  - ES_POR_PARA_TRIGGERS (12 high-confidence confusion patterns)
  - ES_HUMAN_NOUNS set (28 common human-denoting nouns)
  - ES_COPULA_VERBS set for personal-a copula exclusion
  - ES subject pronouns in SUBJECT_PRONOUNS for POS classification
  - Benchmark expectations for es-ser-estar, es-por-para, es-personal-a
affects: [09-02-PLAN, 09-03-PLAN]

tech-stack:
  added: []
  patterns: [multi-language grammar-tables IIFE extension]

key-files:
  created: []
  modified:
    - extension/content/spell-rules/grammar-tables.js
    - extension/content/spell-check-core.js
    - benchmark-texts/es.txt
    - benchmark-texts/expectations.json

key-decisions:
  - "Accent-stripped keys throughout (vacio, debil, nino) since tokenizer lowercases and students omit tildes"
  - "Both accented and accent-stripped forms in ES_ESTAR_FORMS/ES_SER_FORMS for robustness"
  - "Forward-looking benchmark expectations added now; check-benchmark-coverage will pass after Plans 02+03"

patterns-established:
  - "ES tables follow same IIFE pattern as DE tables in grammar-tables.js"

requirements-completed: [ES-01, ES-02, ES-03]

duration: 3min
completed: 2026-04-25
---

# Phase 9 Plan 01: ES Shared Grammar Tables Summary

**ES copula/preposition/personal-a trigger tables and subject pronouns for Spanish grammar governance rules**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-25T02:45:40Z
- **Completed:** 2026-04-25T02:48:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended grammar-tables.js with 6 ES-specific tables (112 new lines) alongside existing DE tables
- Added ES subject pronoun set to spell-check-core.js for tagged-token POS classification
- Set benchmark expectations for 4 ES target lines across 3 rule IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend grammar-tables.js with ES trigger tables** - `0a36040` (feat)
2. **Task 2: Add ES subject pronouns + benchmark expectations** - `a2d96ed` (feat)

## Files Created/Modified
- `extension/content/spell-rules/grammar-tables.js` - Added ES_SER_FORMS, ES_ESTAR_FORMS, ES_COPULA_ADJ, ES_POR_PARA_TRIGGERS, ES_HUMAN_NOUNS, ES_COPULA_VERBS
- `extension/content/spell-check-core.js` - Added es entry to SUBJECT_PRONOUNS
- `benchmark-texts/es.txt` - Moved ser/estar, por/para, personal-a to CURRENTLY COVERED
- `benchmark-texts/expectations.json` - Added es.27, es.34, es.42, es.43 expectations

## Decisions Made
- Used accent-stripped keys throughout (vacio, debil, nino) since the tokenizer lowercases and students routinely omit tildes
- Included both accented and accent-stripped forms in conjugation sets for maximum robustness
- Added benchmark expectations now (forward-looking); check-benchmark-coverage will fail until Plans 02+03 ship the actual rule files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted benchmark line numbers after header edit**
- **Found during:** Task 2 (benchmark expectations)
- **Issue:** The plan referenced es.txt line numbers 30, 37, 45, 46 based on the original header. Updating the header (moving items from FUTURE to COVERED, removing 3 lines) shifted content lines by -3.
- **Fix:** Used actual line numbers after header edit: es.27, es.34, es.42, es.43
- **Files modified:** benchmark-texts/expectations.json
- **Verification:** grep confirmed target phrases at corrected line numbers
- **Committed in:** a2d96ed (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary correction after header restructuring. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared tables ready for consumption by Plan 02 (es-ser-estar + es-por-para rules) and Plan 03 (es-personal-a rule)
- Benchmark expectations in place; check-benchmark-coverage will pass once rule files are implemented

---
*Phase: 09-es-ser-estar-por-para-personal-a*
*Completed: 2026-04-25*

## Self-Check: PASSED
