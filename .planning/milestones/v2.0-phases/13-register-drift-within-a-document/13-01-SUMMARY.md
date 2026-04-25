---
phase: 13-register-drift-within-a-document
plan: 01
subsystem: infra
tags: [spell-check, document-rules, two-pass-runner, release-gate, grammar-tables]

# Dependency graph
requires:
  - phase: 12-pronoun-pro-drop-es-fr
    provides: spell-check-core rule runner, grammar-tables exports
provides:
  - Two-pass document-rule runner (kind:'document' post-pass in spell-check-core.js)
  - detectDrift majority-vote helper exported from grammar-tables.js
  - BOKMAL_RIKSMAL_MAP with 12 riksmal->bokmal pairs
  - INFRA-10 release gate (check-stateful-rule-invalidation) + paired self-test
  - Manifest/CSS/gates/benchmark wiring for 4 doc-drift rules
affects: [13-02-PLAN, 13-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [document-rule post-pass, kind:'document' rule type, checkDocument(ctx,findings) API, fresh-recompute stateful testing]

key-files:
  created:
    - scripts/check-stateful-rule-invalidation.js
    - scripts/check-stateful-rule-invalidation.test.js
  modified:
    - extension/content/spell-check-core.js
    - extension/content/spell-rules/grammar-tables.js
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - benchmark-texts/de.txt
    - benchmark-texts/fr.txt
    - benchmark-texts/nb.txt
    - benchmark-texts/nn.txt
    - benchmark-texts/expectations.json
    - package.json

key-decisions:
  - "detectDrift returns null on ties (equal counts for top two registers) per CONTEXT.md"
  - "Gate test texts use 3:1 marker ratio to ensure clear majority for drift detection"

patterns-established:
  - "Document-rule post-pass: rules with kind:'document' get checkDocument(ctx, findings) called after all token-level rules"
  - "Fresh-recompute validation: edit-sequence gate tests drift->clean->drift cycle to catch stale-cache bugs"

requirements-completed: [INFRA-07, INFRA-10]

# Metrics
duration: 5min
completed: 2026-04-25
---

# Phase 13 Plan 01: Infrastructure Summary

**Two-pass document-rule runner with detectDrift majority-vote helper, INFRA-10 release gate, and full manifest/CSS/benchmark wiring for 4 doc-drift rules**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-25T11:55:00Z
- **Completed:** 2026-04-25T12:00:11Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Added document-rule post-pass loop to spell-check-core.js that filters kind:'document' rules and calls checkDocument(ctx, findings) after pass-1
- Exported detectDrift() majority-vote helper and BOKMAL_RIKSMAL_MAP (12 pairs) from grammar-tables.js
- Created INFRA-10 release gate with paired self-test validating drift->clean->drift edit sequences
- Wired all manifest entries, CSS bindings, gate TARGETS, and benchmark expectations for Plans 02/03

## Task Commits

Each task was committed atomically:

1. **Task 1: Two-pass runner + detectDrift helper + BOKMAL_RIKSMAL_MAP** - `4eaec2f` (feat)
2. **Task 2: Release gate + manifest/CSS/gates wiring + benchmark lines** - `f7f85dc` (feat)

## Files Created/Modified
- `extension/content/spell-check-core.js` - Added document-rule post-pass loop after pass-1
- `extension/content/spell-rules/grammar-tables.js` - Added detectDrift() and BOKMAL_RIKSMAL_MAP
- `scripts/check-stateful-rule-invalidation.js` - INFRA-10 release gate for stateful rule validation
- `scripts/check-stateful-rule-invalidation.test.js` - Paired self-test (baseline + broken + well-formed)
- `extension/manifest.json` - Added 4 doc-drift rule file entries
- `extension/styles/content.css` - Added 4 amber P2 warning CSS bindings
- `scripts/check-explain-contract.js` - Added 4 doc-drift paths to TARGETS
- `scripts/check-rule-css-wiring.js` - Added 4 doc-drift paths to TARGETS
- `benchmark-texts/{de,fr,nb,nn}.txt` - Appended register-drift lines
- `benchmark-texts/expectations.json` - Added 4 doc-drift expectations
- `package.json` - Added 2 new npm script entries

## Decisions Made
- detectDrift returns null on ties (equal counts for top two registers) to avoid arbitrary dominant assignment
- Gate test texts use 3:1 marker ratio to ensure clear majority for drift detection validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed gate test texts with tied marker counts**
- **Found during:** Task 2 (self-test verification)
- **Issue:** Original DE test text had 2 du + 2 Sie markers = tie, causing detectDrift to return null and the well-formed rule self-test to fail
- **Fix:** Restructured test text to have 3 du + 1 Sie for clear majority
- **Files modified:** scripts/check-stateful-rule-invalidation.js
- **Verification:** Self-test passes with corrected texts
- **Committed in:** f7f85dc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test data fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Two-pass runner infrastructure ready for Plans 02 (DE/FR address drift rules) and 03 (NB/NN register drift rules)
- All manifest/CSS/gate wiring pre-staged so Plans 02/03 can execute in parallel without conflict
- check-explain-contract and check-rule-css-wiring will fail until Plans 02/03 create the actual rule files (expected)

---
*Phase: 13-register-drift-within-a-document*
*Completed: 2026-04-25*
