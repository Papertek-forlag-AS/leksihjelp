---
phase: 07-word-order-violations-nb-de-fr
plan: 01
subsystem: infra
tags: [pos-tagging, word-order, spell-check, fixtures]

requires:
  - phase: 06-structural-infrastructure
    provides: sentence segmentation, suppression framework, severity tiers
provides:
  - "ctx.getTagged(i) cached POS-tagged token view with isFinite/isSubordinator/isSubject"
  - "SUBORDINATORS and SUBJECT_PRONOUNS constants for nb/nn/de/fr"
  - "buildFiniteStems for DE separable-verb stem recognition"
  - "findFiniteVerb, findSubordinator, isMainClause, tokensInSentence helpers on __lexiSpellCore"
  - ">=2x acceptance ratio enforcement for word-order fixture files"
  - "Phase 13 document-state seam shape documentation"
affects: [07-02, 07-03, phase-08, phase-13]

tech-stack:
  added: []
  patterns: [tagged-token-view, pos-classification, acceptance-ratio-enforcement]

key-files:
  created: []
  modified:
    - extension/content/spell-check-core.js
    - scripts/check-fixtures.js
    - extension/content/spell-rules/README.md

key-decisions:
  - "classifyPOS receives pre-lowercased input from getTagged to avoid double-lowercase"
  - "Acceptance ratio counted per rule-specific fixture file only, not across all clean fixtures"

patterns-established:
  - "ctx.getTagged(i): cached POS-tagged token view consumed by word-order rules (priority 70+)"
  - "ACCEPTANCE_RATIO_RULES: word-order rules must have >=2x acceptance vs positive fixtures"

requirements-completed: [INFRA-06]

duration: 2min
completed: 2026-04-24
---

# Phase 7 Plan 01: Word-Order Infrastructure Summary

**Tagged-token POS view (ctx.getTagged) with finite-verb/subordinator/subject classification for nb/nn/de/fr, plus acceptance ratio fixture enforcement for word-order rules**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-24T20:03:47Z
- **Completed:** 2026-04-24T20:05:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ctx.getTagged(i) returns cached POS-tagged tokens with isFinite, isSubordinator, isSubject fields
- DE separable-verb stems recognized via buildFiniteStems (e.g. "stehe" from "stehe auf")
- Four structural helpers exported: findFiniteVerb, findSubordinator, isMainClause, tokensInSentence
- Fixture runner enforces >=2x acceptance ratio for word-order rule IDs (nb-v2, de-v2, de-verb-final, fr-bags)
- README.md documents Phase 13 document-state seam with kind, signature, priority, invalidation protocol

## Task Commits

Each task was committed atomically:

1. **Task 1: Tagged-token view + POS helpers** - `d8294f5` (feat)
2. **Task 2: Fixture ratio enforcement + Phase 13 seam docs** - `4e48050` (feat)

## Files Created/Modified
- `extension/content/spell-check-core.js` - Tagged-token POS view, constants, helpers
- `scripts/check-fixtures.js` - Acceptance ratio enforcement for word-order rules
- `extension/content/spell-rules/README.md` - Expanded Phase 13 seam documentation

## Decisions Made
- classifyPOS receives pre-lowercased input to avoid redundant toLowerCase calls
- Acceptance ratio enforcement counts only per rule-specific fixture file (not cross-file clean cases)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tagged-token view ready for consumption by word-order rules in Plans 07-02 and 07-03
- All release gates pass (fixtures, explain-contract, CSS wiring, network silence)

---
*Phase: 07-word-order-violations-nb-de-fr*
*Completed: 2026-04-24*

## Self-Check: PASSED
