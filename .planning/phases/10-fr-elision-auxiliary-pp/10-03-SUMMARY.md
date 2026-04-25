---
phase: 10-fr-elision-auxiliary-pp
plan: 03
subsystem: spell-rules
tags: [french, pp-agreement, participle, avoir, feminine, plural, feature-gated]

requires:
  - phase: 10-fr-elision-auxiliary-pp
    provides: FR_AVOIR_FORMS in grammar-tables.js, participleToAux in vocab-seam-core.js
provides:
  - FR-03 PP agreement rule (fr-pp-agreement.js) behind opt-in toggle
  - Adjacent-window detection: [la/les] + [avoir-form] + [past-participle]
  - Accent-stripped participle matching for student text robustness
  - vocab.isFeatureEnabled wired in fixture runner for feature-gated rules
affects: []

tech-stack:
  added: []
  patterns:
    - "Feature-gated rules use ctx.vocab.isFeatureEnabled() guard at check() entry"
    - "Accent-stripped PP lookup via NFD normalize + combining mark removal for student robustness"
    - "hasAgreement compares against canonical base PP form, not raw student input"

key-files:
  created:
    - extension/content/spell-rules/fr-pp-agreement.js
    - fixtures/fr/pp-agreement.jsonl
  modified:
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - scripts/check-fixtures.js

key-decisions:
  - "Accent-stripped lookup needed because students frequently omit accents (mange vs mange); base-form comparison in hasAgreement prevents false negatives on stripped forms"
  - "vocab.isFeatureEnabled added to fixture runner vocab object to enable testing feature-gated rules (register, fr-pp-agreement)"

patterns-established:
  - "Feature-gated rule testing: fixture runner now provides isFeatureEnabled: () => true on vocab object"

requirements-completed: [FR-03]

duration: 13min
completed: 2026-04-25
---

# Phase 10 Plan 03: FR PP Agreement Rule Summary

**Adjacent-window PP agreement rule (la/les + avoir + participle) behind opt-in toggle with accent-stripped matching**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-25T04:02:09Z
- **Completed:** 2026-04-25T04:15:05Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- FR-03 rule detects missing feminine (-e) and plural (-s) PP agreement after DO pronouns la/les
- Accent-stripped matching handles student text without accents (mange -> mangee, not skipped as already-agreed)
- 31 positive + 16 acceptance fixtures with P=1.000 R=1.000 F1=1.000
- All release gates pass (explain-contract, CSS wiring, network silence, bundle size)
- 10.3b deferred scope documented in rule header

## Task Commits

Each task was committed atomically:

1. **Task 1: FR-03 PP agreement rule with fixtures and gate wiring**
   - `8eebc81` (test: add failing test for FR-03 PP agreement rule)
   - `cc45a51` (feat: implement FR-03 PP agreement rule with release gate wiring)

## Files Created/Modified
- `extension/content/spell-rules/fr-pp-agreement.js` - FR-03 PP agreement rule (opt-in, priority 72, hint severity)
- `fixtures/fr/pp-agreement.jsonl` - 47 fixture cases (31 positive, 16 acceptance)
- `extension/manifest.json` - Added fr-pp-agreement.js to content scripts
- `extension/styles/content.css` - P3 hint dotted style for fr-pp-agreement
- `scripts/check-explain-contract.js` - Added fr-pp-agreement.js to TARGETS
- `scripts/check-rule-css-wiring.js` - Added fr-pp-agreement.js to TARGETS
- `scripts/check-fixtures.js` - Added vocab.isFeatureEnabled for feature-gated rule testing

## Decisions Made
- Accent-stripped PP lookup needed: students write `mange` (no accent) which ends in `e`, falsely matching feminine agreement check. Solution: compare against canonical base PP form length after stripping accents from both.
- Added `vocab.isFeatureEnabled = () => true` to fixture runner: without this, feature-gated rules silently return [] during testing. Matches browser runtime wiring pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vocab.isFeatureEnabled to fixture runner**
- **Found during:** Task 1 (TDD GREEN)
- **Issue:** Feature-gated rules return [] when vocab.isFeatureEnabled is missing; fixture runner's vocab object from buildIndexes doesn't include it
- **Fix:** Added `vocab.isFeatureEnabled = () => true` after buildIndexes call in check-fixtures.js loadVocab
- **Files modified:** scripts/check-fixtures.js
- **Verification:** FR-03 fixtures now fire correctly (46/47 then 47/47 after accent fix)
- **Committed in:** cc45a51

**2. [Rule 1 - Bug] Fixed accent-stripped PP false negative in hasAgreement**
- **Found during:** Task 1 (TDD GREEN, fr-pp-30 failing)
- **Issue:** `mange` (accent-stripped `mangé`) ends in `e`, so hasAgreement falsely reported feminine agreement already present
- **Fix:** Compare accent-stripped word length against accent-stripped base PP length; only consider agreed if word is longer
- **Files modified:** extension/content/spell-rules/fr-pp-agreement.js
- **Verification:** fr-pp-30 now passes; all 47/47 fixtures green
- **Committed in:** cc45a51

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 complete (all 3 plans: infrastructure, elision/auxiliary, PP agreement)
- FR grammar rule suite now covers: contraction, preposition, gender, modal, BAGS placement, elision, etre/avoir auxiliary, PP agreement
- PP agreement defaults OFF (opt-in toggle) per plan spec

---
*Phase: 10-fr-elision-auxiliary-pp*
*Completed: 2026-04-25*
