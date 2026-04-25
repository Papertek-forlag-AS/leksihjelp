---
phase: 10-fr-elision-auxiliary-pp
plan: 01
subsystem: spell-rules
tags: [french, avoir, etre, grammar-tables, passe-compose, contraction, benchmark]

requires:
  - phase: 09-es-ser-estar-por-para-personal-a
    provides: grammar-tables.js IIFE pattern with DE/ES tables
provides:
  - FR_AVOIR_FORMS, FR_ETRE_FORMS, FR_ETRE_VERBS, FR_ETRE_PARTICIPLES in grammar-tables.js
  - buildParticipleToAux reads passe_compose key for FR verbs
  - Narrowed fr-contraction.js (prepositional only, no vowel elision)
  - grammar_fr_pp_agreement feature toggle (defaults OFF)
  - Benchmark fr.txt line for FR-02 etre/avoir validation
affects: [10-02-fr-elision, 10-03-fr-etre-avoir]

tech-stack:
  added: []
  patterns:
    - "FR auxiliary tables follow same Map/Set pattern as DE/ES tables"
    - "buildParticipleToAux uses optional chaining for multi-language conjugation key support"

key-files:
  created: []
  modified:
    - extension/content/spell-rules/grammar-tables.js
    - extension/content/vocab-seam-core.js
    - extension/content/spell-rules/fr-contraction.js
    - extension/data/grammarfeatures-fr.json
    - benchmark-texts/fr.txt
    - benchmark-texts/expectations.json

key-decisions:
  - "Forward-looking benchmark expectation for fr-etre-avoir deferred to Plan 02 (rule does not exist yet, gate would fail)"
  - "FR_ETRE_PARTICIPLES includes both accented and unaccented forms for student text robustness"

patterns-established:
  - "FR auxiliary data reuses same grammar-tables IIFE pattern as DE/ES"

requirements-completed: [FR-01, FR-02, FR-03]

duration: 3min
completed: 2026-04-25
---

# Phase 10 Plan 01: FR Shared Infrastructure Summary

**FR avoir/etre grammar tables, passe_compose vocab-seam extension, narrowed fr-contraction to prepositions only, PP agreement toggle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-25T03:56:20Z
- **Completed:** 2026-04-25T03:59:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added FR_AVOIR_FORMS, FR_ETRE_FORMS, FR_ETRE_VERBS, FR_ETRE_PARTICIPLES to grammar-tables.js for Plan 02/03 consumption
- Extended buildParticipleToAux to read both perfektum (DE) and passe_compose (FR) conjugation keys
- Refactored fr-contraction.js to only handle prepositional contractions (de le -> du, a le -> au, etc.), removing vowel elision logic now owned by fr-elision.js (Plan 02)
- Added grammar_fr_pp_agreement feature toggle that defaults OFF (opt-in only)
- Added "J'ai alle au parc" benchmark line to fr.txt for FR-02 validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FR tables to grammar-tables.js and extend buildParticipleToAux** - `dda91b3` (feat)
2. **Task 2: Narrow fr-contraction.js, add PP toggle, add benchmark lines** - `2444f71` (feat)

## Files Created/Modified
- `extension/content/spell-rules/grammar-tables.js` - Added FR avoir/etre conjugation tables and DR MRS VANDERTRAMP fallback data
- `extension/content/vocab-seam-core.js` - Extended buildParticipleToAux to read passe_compose key
- `extension/content/spell-rules/fr-contraction.js` - Refactored to prepositional contractions only
- `extension/data/grammarfeatures-fr.json` - Added grammar_fr_pp_agreement feature toggle
- `benchmark-texts/fr.txt` - Added etre/avoir error line for FR-02 validation
- `benchmark-texts/expectations.json` - Updated line numbers after fr.txt insertion

## Decisions Made
- Deferred fr-etre-avoir benchmark expectation to Plan 02 since the rule does not exist yet and the gate would fail
- Included both accented and accent-stripped forms in FR_ETRE_FORMS and FR_ETRE_PARTICIPLES for student text robustness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed forward-looking benchmark expectation for fr-etre-avoir**
- **Found during:** Task 2 (benchmark expectations)
- **Issue:** Plan specified adding fr-etre-avoir expectation, but that rule ships in Plan 02; check-benchmark-coverage gate fails on missing rules
- **Fix:** Deferred the expectation entry to Plan 02 when the rule will exist
- **Files modified:** benchmark-texts/expectations.json
- **Verification:** npm run check-benchmark-coverage exits 0
- **Committed in:** 2444f71 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep release gates green. The expectation will be added in Plan 02 alongside the rule itself.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FR grammar tables ready for fr-etre-avoir.js rule (Plan 02)
- fr-contraction.js narrowed, clearing space for fr-elision.js (Plan 02)
- Benchmark line in place for FR-02 validation once rule ships
- grammar_fr_pp_agreement toggle ready for Plan 03

---
*Phase: 10-fr-elision-auxiliary-pp*
*Completed: 2026-04-25*
