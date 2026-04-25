---
phase: 14-morphology-beyond-tokens-en-es-fr
plan: 01
subsystem: infra
tags: [vocab-seam, irregular-forms, morphology, overregularization]

requires:
  - phase: 13-register-drift-within-a-document
    provides: vocab-seam-core index builder pattern, manifest/CSS/gate wiring pattern
provides:
  - buildIrregularForms index builder in vocab-seam-core.js (171 entries for EN)
  - Manifest entries for en-morphology, en-word-family, fr-adj-gender rule files
  - CSS dot-colour bindings for 3 new rule IDs
  - Release gate TARGETS updated (check-explain-contract, check-rule-css-wiring)
  - check-spellcheck-features irregularForms assertions
  - Benchmark expectations for Phase 14 EN and FR lines
affects: [14-02-en-rules, 14-03-fr-rule]

tech-stack:
  added: []
  patterns: [irregularForms Map pattern for overregularization detection]

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - scripts/check-spellcheck-features.js
    - benchmark-texts/expectations.json
    - benchmark-texts/fr.txt

key-decisions:
  - "buildIrregularForms generates wrong forms via simple suffixing (+ed, +d, +s, +es) with consonant doubling for short verbs"
  - "Added FR benchmark line 57 for single-line 'un bon humeur' test case (cross-line case on lines 36-37 not supported by per-line runner)"

patterns-established:
  - "irregularForms Map: keyed by wrong regular form, value is {correct, type, base}"

requirements-completed: [MORPH-01, MORPH-02, MORPH-03]

duration: 6min
completed: 2026-04-25
---

# Phase 14 Plan 01: Infrastructure Wiring Summary

**buildIrregularForms index (171 entries) in vocab-seam-core.js with manifest/CSS/gate/benchmark wiring for 3 new morphology rules**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-25T13:39:40Z
- **Completed:** 2026-04-25T13:46:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built irregularForms Map with 171 entries covering EN irregular verb past tense and noun plural overregularization
- Wired manifest, CSS, and all 3 release gate TARGETS for en-morphology, en-word-family, fr-adj-gender
- Added 6 benchmark expectations (EN lines 27/34/38/39, FR lines 51/57)
- Extended check-spellcheck-features with irregularForms assertions proving feature-gate independence

## Task Commits

Each task was committed atomically:

1. **Task 1: Build irregularForms index in vocab-seam-core.js** - `953b44c` (feat)
2. **Task 2: Manifest, CSS, release gates, and benchmark wiring** - `f79e538` (chore)

## Files Created/Modified
- `extension/content/vocab-seam-core.js` - Added buildIrregularForms() and exposed irregularForms on buildIndexes return
- `extension/manifest.json` - 3 new rule files in content_scripts
- `extension/styles/content.css` - CSS dot-colour bindings for en-morphology, en-word-family, fr-adj-gender
- `scripts/check-explain-contract.js` - Added 3 rules to TARGETS
- `scripts/check-rule-css-wiring.js` - Added 3 rules to TARGETS
- `scripts/check-spellcheck-features.js` - Added irregularForms assertions for EN
- `benchmark-texts/expectations.json` - 6 new Phase 14 expectations
- `benchmark-texts/fr.txt` - Added line 57 for single-line "un bon humeur" test

## Decisions Made
- buildIrregularForms uses simple suffixing (+ed, +d for e-ending verbs, +s, +es) with consonant doubling for short verbs ending in consonant
- Added FR benchmark line 57 for single-line "un bon humeur" since the per-line benchmark runner cannot handle cross-line cases (lines 36-37)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added check-rule-css-wiring TARGETS update**
- **Found during:** Task 2
- **Issue:** Plan specified check-explain-contract TARGETS but not check-rule-css-wiring TARGETS
- **Fix:** Added 3 new rules to check-rule-css-wiring.js TARGETS to keep both gates in sync
- **Files modified:** scripts/check-rule-css-wiring.js
- **Committed in:** f79e538

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for CSS gate correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- irregularForms index ready for Plan 02 (EN morphology + word-family rules)
- Manifest/CSS/gates ready for Plan 03 (FR adj-gender rule)
- Benchmark expectations set; will show unmet until Plans 02/03 implement the rules

---
*Phase: 14-morphology-beyond-tokens-en-es-fr*
*Completed: 2026-04-25*
