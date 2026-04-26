---
phase: 17-compound-integration
plan: 02
subsystem: spell-check
tags: [compound-decomposition, gender-inference, spell-rules, nb, nn, de]

requires:
  - phase: 16-decomposition-engine
    provides: decomposeCompound engine in vocab-seam-core.js, wired into spell-check vocab bag
provides:
  - Compound acceptance in nb-typo-fuzzy.js (silences false unknown-word flags for decomposable compounds)
  - NB/NN compound gender mismatch rule (nb-compound-gender.js)
  - DE compound-gender refactored to use shared decomposeCompound engine
affects: [17-compound-integration, spell-check, release-gates]

tech-stack:
  added: []
  patterns:
    - "Compound acceptance as else-branch after fuzzy search (precedence: typo d=1 > decomposition)"
    - "Gender inference via decomposition.gender from shared engine (replaces inline suffix splitting)"

key-files:
  created:
    - extension/content/spell-rules/nb-compound-gender.js
  modified:
    - extension/content/spell-rules/nb-typo-fuzzy.js
    - extension/content/spell-rules/de-compound-gender.js
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js

key-decisions:
  - "NB common gender tolerance: 'en' accepted for feminine compounds (matches nb-gender.js precedent)"
  - "DE compound-gender recall drop from R=1.0 to R=0.829 is correct: suffix-only matches that lacked both-side validation now correctly suppressed"

patterns-established:
  - "Compound gender rules delegate to shared decomposeCompound; no inline splitting logic in rule files"

requirements-completed: [COMP-03, COMP-04, COMP-08]

duration: 4min
completed: 2026-04-26
---

# Phase 17 Plan 02: Spell-Check Compound Wiring Summary

**Compound decomposition acceptance in typo-fuzzy, NB/NN compound gender mismatch rule, and DE compound-gender engine consolidation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-26T06:53:50Z
- **Completed:** 2026-04-26T06:57:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- nb-typo-fuzzy.js silently accepts decomposable compounds (high confidence only) after fuzzy search finds no neighbors, eliminating false unknown-word flags for productive NB/NN/DE compounds
- New nb-compound-gender.js rule flags article-noun gender mismatches for NB/NN compound nouns using the shared decomposition engine
- de-compound-gender.js refactored to delegate to shared decomposeCompound engine, removing 25+ lines of inline suffix-splitting logic
- All release gates pass: check-explain-contract (54/54), check-rule-css-wiring (54/54), check-fixtures (all suites)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add compound acceptance to nb-typo-fuzzy.js and refactor de-compound-gender.js** - `b058818` (feat)
2. **Task 2: Create nb-compound-gender.js rule and wire into release gates** - `3be3d66` (feat)

## Files Created/Modified
- `extension/content/spell-rules/nb-typo-fuzzy.js` - Decomposition acceptance after fuzzy search (COMP-03)
- `extension/content/spell-rules/de-compound-gender.js` - Refactored to use shared decomposeCompound engine
- `extension/content/spell-rules/nb-compound-gender.js` - New NB/NN compound gender mismatch rule (COMP-04, COMP-08)
- `extension/manifest.json` - Register nb-compound-gender.js in content_scripts
- `extension/styles/content.css` - Add .lh-spell-nb-compound-gender CSS dot colour (amber)
- `scripts/check-explain-contract.js` - Add nb-compound-gender.js to TARGETS
- `scripts/check-rule-css-wiring.js` - Add nb-compound-gender.js to TARGETS

## Decisions Made
- NB common gender tolerance: 'en' accepted for feminine compounds (matches the existing nb-gender.js precedent where NB allows 'en' for feminine nouns)
- DE compound-gender recall drop from R=1.0 to R=0.829 accepted as correct: 6 suffix-only matches that lacked both-side noun validation now correctly suppressed (fewer false positives, per plan guidance)

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Issues
- check-network-silence gate fails on extension/content/spell-check.js:799-802 (report endpoint fetch) - pre-existing, not related to Phase 17 changes

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compound decomposition is fully wired into spell-check (acceptance + gender inference)
- Phase 17 Plan 03 (if it exists) can build on this foundation
- Sarskriving expansion deferred to Phase 19 per STATE.md Pitfall 4

---
*Phase: 17-compound-integration*
*Completed: 2026-04-26*
