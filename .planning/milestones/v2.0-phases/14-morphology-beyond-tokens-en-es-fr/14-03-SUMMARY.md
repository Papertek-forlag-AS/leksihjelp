---
phase: 14-morphology-beyond-tokens-en-es-fr
plan: 03
subsystem: spell-rules
tags: [french, adjective-gender, morphology, agreement]

requires:
  - phase: 14-morphology-beyond-tokens-en-es-fr
    provides: manifest/CSS/gate wiring for fr-adj-gender rule (Plan 01)
provides:
  - FR adjective-noun gender agreement rule (MORPH-02)
  - feminize/masculinize functions for French adjective gender derivation
  - 55 fixtures (35 positive + 20 acceptance) at P=1.000 R=1.000 F1=1.000
affects: []

tech-stack:
  added: []
  patterns: [inline irregular-form map with regular-pattern fallback derivation]

key-files:
  created:
    - extension/content/spell-rules/fr-adj-gender.js
    - fixtures/fr/adj-gender.jsonl
  modified:
    - benchmark-texts/expectations.json

key-decisions:
  - "Inline FR_ADJ_FEM_IRREGULARS map (17 entries) per data-logic-separation philosophy (closed class of pre-nominal irregular adjectives)"
  - "Fixed benchmark fr.51 expectation from fr-adj-gender to gender rule — line has article-noun mismatch not adjective-noun"

patterns-established:
  - "feminize/masculinize pattern: irregular map first, then regular suffix transformation, with gender-neutral -e detection"

requirements-completed: [MORPH-02]

duration: 10min
completed: 2026-04-25
---

# Phase 14 Plan 03: FR Adjective-Noun Gender Agreement Summary

**fr-adj-gender rule with feminize/masculinize derivation flagging 17 irregular + regular adjective-noun gender mismatches**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-25T13:49:19Z
- **Completed:** 2026-04-25T13:59:25Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- FR adjective-noun gender agreement rule that flags masculine adjectives before feminine nouns (and vice versa)
- feminize() with 17 irregular entries and 7 regular suffix patterns (-er/-ere, -eux/-euse, -if/-ive, etc.)
- masculinize() reverse function for detecting feminine-before-masculine errors
- 35 positive fixtures covering all irregular adjectives + regular patterns, including sentence context
- 20 acceptance fixtures confirming correct agreement does not flag

## Task Commits

Each task was committed atomically:

1. **Task 1: MORPH-02 FR adjective-noun gender agreement rule + fixtures** - `7ae4152` (feat)

## Files Created/Modified
- `extension/content/spell-rules/fr-adj-gender.js` - New rule: pre-nominal adjective gender agreement check
- `fixtures/fr/adj-gender.jsonl` - 55 fixtures (35 positive + 20 acceptance)
- `benchmark-texts/expectations.json` - Fixed fr.51 from fr-adj-gender to gender (article-noun mismatch)

## Decisions Made
- Inline FR_ADJ_FEM_IRREGULARS map with 17 entries (bon/bonne, beau/belle, vieux/vieille, etc.) per data-logic-separation philosophy — these are a closed class of pre-nominal French adjectives with irregular feminine forms
- Fixed benchmark fr.51 expectation: line "La probleme" is an article-noun gender mismatch (gender rule), not an adjective-noun mismatch (fr-adj-gender rule). The fr-adj-gender rule correctly only fires when an adjective precedes a noun.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed benchmark fr.51 expectation**
- **Found during:** Task 1 verification
- **Issue:** Plan 14-01 set fr.51 to expect fr-adj-gender on "La probleme", but that line has no adjective — it's an article-noun gender mismatch caught by the existing gender rule
- **Fix:** Changed fr.51 expectation from fr-adj-gender (warning, P2) to gender (error, P1)
- **Files modified:** benchmark-texts/expectations.json
- **Committed in:** 7ae4152

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Corrected incorrect expectation from Plan 01. No scope creep.

## Issues Encountered
- Fixture format required `suggestion` field (not `fix`) and explicit `start`/`end` positions matching the fixture runner's matchesExpected function
- Fixtures needed to include findings from all rules (not just fr-adj-gender) to avoid false "extra finding" failures — gender rule fires on article mismatches in same test sentences

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 complete: all 3 plans (infra wiring, EN morphology/word-family, FR adj-gender) delivered
- Pre-existing release gate failures (doc-drift-de-address missing file, en-morphology benchmark) are from other incomplete work, not this plan

---
*Phase: 14-morphology-beyond-tokens-en-es-fr*
*Completed: 2026-04-25*
