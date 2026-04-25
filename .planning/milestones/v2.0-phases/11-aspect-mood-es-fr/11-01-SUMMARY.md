---
phase: 11-aspect-mood-es-fr
plan: 01
subsystem: infra
tags: [vocab-seam, grammar-tables, spell-check, subjuntivo, imperfecto, subjonctif, css]

requires:
  - phase: 10-fr-elision-aux-pp
    provides: grammar-tables.js IIFE pattern, CSS dot-colour binding pattern
provides:
  - TENSE_FEATURES/GROUP entries for subjuntivo, imperfecto, subjonctif
  - 7 reverse-lookup Maps (esPresensToVerb, esSubjuntivoForms, esImperfectoForms, esPreteritumToVerb, frPresensToVerb, frSubjonctifForms, frSubjonctifDiffers)
  - Trigger tables (ES_SUBJUNTIVO_TRIGGERS, ES_PRETERITO_ADVERBS, ES_PRETERITO_PHRASES, ES_IMPERFECTO_ADVERBS, ES_IMPERFECTO_PHRASES, FR_SUBJONCTIF_TRIGGERS)
  - CSS bindings for es-subjuntivo, es-imperfecto-hint, fr-subjonctif
affects: [11-02-PLAN, 11-03-PLAN]

tech-stack:
  added: []
  patterns: [buildMoodIndexes raw-data pattern, accent-stripped reverse-lookup, homophony guard (frSubjonctifDiffers)]

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/spell-rules/grammar-tables.js
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - scripts/check-spellcheck-features.js
    - benchmark-texts/expectations.json

key-decisions:
  - "Used accent-stripped variants in reverse-lookup Maps for ES (students omit accents)"
  - "FR homophony guard (frSubjonctifDiffers) compares subjonctif vs presens per verb+person to avoid false positives"
  - "ES data uses presens/preteritum keys (not presente/preterito) with former sub-object for conjugation forms"

patterns-established:
  - "buildMoodIndexes: raw-data-only index builder following buildParticipleToAux pattern"
  - "Accent-stripped reverse lookup: both accented and stripped forms mapped for student tolerance"

requirements-completed: [MOOD-01, MOOD-02, MOOD-03]

duration: 9min
completed: 2026-04-25
---

# Phase 11 Plan 01: Mood/Aspect Infrastructure Summary

**Reverse-lookup indexes for ES subjuntivo/imperfecto and FR subjonctif with trigger tables and CSS bindings**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-25T08:39:19Z
- **Completed:** 2026-04-25T08:48:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended TENSE_FEATURES/GROUP with subjuntivo, imperfecto, subjonctif entries
- Built 7 reverse-lookup Maps from raw verbbank data (ES: 779 presens, 654 subjuntivo, 3744 imperfecto forms; FR: presens, subjonctif, homophony guard)
- Added 6 trigger/adverb tables to grammar-tables.js for all three MOOD rules
- CSS dot-colour bindings wired for three new rule IDs
- Release gates extended with TARGETS and mood-index assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend vocab-seam TENSE_FEATURES/GROUP + build reverse-lookup indexes** - `c40bbb0` (feat)
2. **Task 2: Add trigger tables, CSS bindings, update release gates + benchmark expectations** - `255f0dc` (feat)

## Files Created/Modified
- `extension/content/vocab-seam-core.js` - buildMoodIndexes function, TENSE_FEATURES/GROUP extensions, mood indexes in return object
- `extension/content/spell-rules/grammar-tables.js` - ES_SUBJUNTIVO_TRIGGERS, ES_PRETERITO_ADVERBS, ES_PRETERITO_PHRASES, ES_IMPERFECTO_ADVERBS, ES_IMPERFECTO_PHRASES, FR_SUBJONCTIF_TRIGGERS
- `extension/styles/content.css` - CSS bindings for es-subjuntivo, es-imperfecto-hint, fr-subjonctif
- `scripts/check-explain-contract.js` - Added 3 new rule file TARGETS
- `scripts/check-rule-css-wiring.js` - Added 3 new rule file TARGETS
- `scripts/check-spellcheck-features.js` - Added mood index population assertions for ES and FR
- `benchmark-texts/expectations.json` - Added es.38 expectation for MOOD-01

## Decisions Made
- Used accent-stripped variants in reverse-lookup Maps for ES since students often omit accents
- FR homophony guard (frSubjonctifDiffers) compares subjonctif vs presens per verb+person to suppress false positives where forms are identical (e.g., parler je/tu/il presens = subjonctif)
- Discovered ES data uses `presens`/`preteritum` keys with `former` sub-object (not `presente`/`preterito` as plan interfaces suggested) -- adapted accordingly

## Deviations from Plan

None - plan executed exactly as written. Minor data-shape adaptation (ES uses `presens` not `presente`, pronoun keys in `former` sub-object) handled inline.

## Issues Encountered
- check-fixtures exits 1 on baseline (pre-existing fr/grammar F1=0.429 with failed cases) -- not caused by this plan's changes, confirmed identical behavior with stashed changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All reverse-lookup indexes and trigger tables ready for Plan 02 (ES subjuntivo + imperfecto rules) and Plan 03 (FR subjonctif rule)
- check-explain-contract, check-rule-css-wiring, and check-benchmark-coverage will fail until Plan 02/03 create the rule files (expected, documented in plan)

---
*Phase: 11-aspect-mood-es-fr*
*Completed: 2026-04-25*
