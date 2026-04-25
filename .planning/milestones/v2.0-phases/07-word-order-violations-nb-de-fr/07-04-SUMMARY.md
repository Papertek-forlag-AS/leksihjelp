---
phase: 07-word-order-violations-nb-de-fr
plan: 04
subsystem: spell-check
tags: [nb-v2, word-order, fixtures, false-positives, gap-closure]

requires:
  - phase: 07-02
    provides: NB V2 + DE V2 word-order rules and fixture files
  - phase: 07-03
    provides: DE verb-final + FR BAGS rules and fixture files
provides:
  - False-positive-free NB V2 rule with five targeted guards
  - Green check-fixtures gate (exit 0) for Phase 7 release
  - Complete fixture expected arrays with sibling-rule co-fires declared
affects: [phase-08, release-workflow]

tech-stack:
  added: []
  patterns:
    - "Multi-guard false-positive suppression in word-order rules"
    - "Acceptance fixture ratio enforcement (2x acceptance-to-positive)"

key-files:
  created: []
  modified:
    - extension/content/spell-rules/nb-v2.js
    - fixtures/nb/v2.jsonl
    - fixtures/de/v2.jsonl
    - fixtures/de/verb-final.jsonl
    - fixtures/fr/bags.jsonl

key-decisions:
  - "Question-initial guard restricted to sentences ending with ? to avoid suppressing fronted-adverb V2 violations"
  - "Complement clause guard uses broad verb detection (isFinite + verbForms + verbInfinitive + MODAL_VERBS) to catch cross-dialect verbs"
  - "Added frå to NN subordinator list for subordinate clause detection"
  - "Added preposition-object guard to prevent flagging pronoun objects of prepositions as subjects"

patterns-established:
  - "Guard stacking: question-initial -> subordinator -> embedded-wh -> subordinator-between -> coordinate-conjunction -> complement-clause -> preposition-object -> NN-article -> detection"

requirements-completed: [INFRA-06, WO-01, WO-02, WO-03, WO-04]

duration: 16min
completed: 2026-04-24
---

# Phase 7 Plan 4: Gap Closure Summary

**NB V2 false-positive elimination with five guards plus fixture co-fire alignment making check-fixtures exit 0**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-24T20:53:14Z
- **Completed:** 2026-04-24T21:09:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Eliminated all NB V2 false positives across 8 non-Phase-7 fixture files (nb/clean, nb/grammar, nn/clean, nn/saerskriving, nn/typo) with five targeted guards
- Updated 43 Phase-7 fixture expected arrays to declare sibling-rule co-fires
- Added "une belle femme" acceptance fixture and 99 additional acceptance fixtures to meet 2x ratio
- All 26 fixture files pass with F1=1.000, npm run check-fixtures exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix nb-v2 false positives** - `386128e` (fix)
2. **Task 2: Update fixture expected arrays and add acceptance cases** - `effa682` (feat)

## Files Created/Modified
- `extension/content/spell-rules/nb-v2.js` - Added 5 false-positive guards: question-initial, coordinate conjunction, complement clause, preposition object, NN article disambiguation
- `fixtures/nb/v2.jsonl` - Updated expected arrays for co-fires, added 1 acceptance fixture
- `fixtures/de/v2.jsonl` - Updated 15 expected arrays, added 41 acceptance fixtures
- `fixtures/de/verb-final.jsonl` - Updated 12 expected arrays, fixed 2 corrupted entries, added 44 acceptance fixtures
- `fixtures/fr/bags.jsonl` - Updated 15 expected arrays, added "une belle femme" + 79 acceptance fixtures

## Decisions Made
- Question-initial guard requires "?" at sentence end to avoid suppressing legitimate V2 violations on fronted adverbs that are verb-homonyms ("Saa vi gikk hjem." -- "saa" as adverb "then", not verb "saw")
- Complement clause guard checks isFinite + verbForms + verbInfinitive + MODAL_VERBS to detect earlier verbs even across dialect boundaries (NB "sier" in NN text)
- Added "fraa" to NN subordinator list (was missing, causing false positives on "fraa dei er seks aar")
- Preposition-object guard added to handle "Utan dei ville..." where "dei" is preposition object, not sentence subject

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Question-initial guard caused two regressions**
- **Found during:** Task 1
- **Issue:** Initial guard checked knownPresens/knownPreteritum directly, missing modals ("skal") and hitting verb-homonym adverbs ("saa", "naar")
- **Fix:** Refined to use isFinite + MODAL_VERBS, restricted to sentences ending with "?" to avoid suppressing fronted-adverb violations
- **Files modified:** extension/content/spell-rules/nb-v2.js
- **Committed in:** 386128e

**2. [Rule 2 - Missing Critical] NN subordinator "fraa" was missing**
- **Found during:** Task 1
- **Issue:** "fraa" (NN equivalent of NB "fra/siden") not in SUBORDINATORS.nn, causing false positives on subordinate clauses
- **Fix:** Added "fraa" to NN subordinator set
- **Files modified:** extension/content/spell-rules/nb-v2.js
- **Committed in:** 386128e

**3. [Rule 2 - Missing Critical] Preposition-object false positives**
- **Found during:** Task 1
- **Issue:** "Utan dei ville livet..." flagged "dei ville" as V2 violation, but "dei" is object of preposition "Utan", not sentence subject
- **Fix:** Added PREPOSITIONS_WITH_OBJECTS set and guard checking if token before subject pronoun is a preposition
- **Files modified:** extension/content/spell-rules/nb-v2.js
- **Committed in:** 386128e

**4. [Rule 3 - Blocking] Acceptance ratio failures**
- **Found during:** Task 2
- **Issue:** Phase 7 fixture files had fewer than 2x acceptance-to-positive ratio, blocking check-fixtures exit
- **Fix:** Added 99 acceptance fixtures across de/v2, de/verb-final, fr/bags with co-fire declarations
- **Files modified:** fixtures/de/v2.jsonl, fixtures/de/verb-final.jsonl, fixtures/fr/bags.jsonl
- **Committed in:** effa682

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and gate compliance. No scope creep.

## Issues Encountered
- Fixture field naming mismatch: expected arrays used "fix" but fixture runner matches on "suggestion" -- fixed during Task 2
- ID collisions when adding acceptance fixtures to de/verb-final.jsonl -- renumbered duplicates

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 is complete -- all four word-order rules (nb-v2, de-v2, de-verb-final, fr-bags) have green fixtures
- All release gates pass (check-fixtures, check-explain-contract, check-rule-css-wiring, check-network-silence, check-benchmark-coverage)
- Ready for Phase 8 planning

---
*Phase: 07-word-order-violations-nb-de-fr*
*Completed: 2026-04-24*
