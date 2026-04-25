---
phase: 12-pronoun-pro-drop-es-fr
plan: 01
subsystem: infra
tags: [css, manifest, grammar-tables, benchmark, release-gates]

# Dependency graph
requires:
  - phase: 11-aspect-mood-es-fr
    provides: "Phase 11 rule files (es-subjuntivo, es-imperfecto-hint, fr-subjonctif) and grammar-tables.js structure"
provides:
  - "ES_GUSTAR_CLASS_VERBS Set (15 verbs) in grammar-tables.js"
  - "CSS dot-colour bindings for es-pro-drop, es-gustar, fr-clitic-order"
  - "Manifest entries for all Phase 11 + 12 rule files"
  - "Release gate TARGETS for Phase 12 rules"
  - "Benchmark expectations for pro-drop, gustar, and clitic-order"
  - "FR benchmark clitic-order error line"
affects: [12-02-es-pro-drop-gustar, 12-03-fr-clitic-order]

# Tech tracking
tech-stack:
  added: []
  patterns: ["gustar-class verb Set for indirect-object pattern detection"]

key-files:
  created: []
  modified:
    - extension/content/spell-rules/grammar-tables.js
    - extension/styles/content.css
    - extension/manifest.json
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - benchmark-texts/expectations.json
    - benchmark-texts/fr.txt

key-decisions:
  - "Added Phase 11 missing manifest entries alongside Phase 12 entries to fix wiring gap"
  - "Used compound-free benchmark keys (es.39, es.41, es.32) to avoid format conflicts with existing es-por-para entries"

patterns-established:
  - "P3 hint CSS uses dotted grey underline (consistent with fr-bags, redundancy, fr-pp-agreement)"
  - "P2 warn CSS uses amber background (consistent with all other P2 rules)"

requirements-completed: [PRON-01, PRON-02, PRON-03]

# Metrics
duration: 2min
completed: 2026-04-25
---

# Phase 12 Plan 01: Infrastructure Wiring Summary

**Gustar-class verb table, CSS bindings, manifest entries (Phase 11+12), release gate TARGETS, and benchmark expectations for pronoun/pro-drop rules**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-25T10:03:28Z
- **Completed:** 2026-04-25T10:05:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added ES_GUSTAR_CLASS_VERBS (15 verbs) to grammar-tables.js for Plan 02 consumption
- Wired CSS dot-colour bindings for all three Phase 12 rule IDs
- Fixed Phase 11 manifest gap: added es-subjuntivo, es-imperfecto-hint, fr-subjonctif to content_scripts
- Extended release gate TARGETS (check-explain-contract.js, check-rule-css-wiring.js) with Phase 12 rules
- Added 4 benchmark expectations (es.39, es.41 pro-drop; es.32 gustar; fr.55 clitic-order)
- Added FR clitic-order error benchmark line

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ES_GUSTAR_CLASS_VERBS to grammar-tables.js and wire CSS bindings** - `55b4522` (feat)
2. **Task 2: Wire manifest, release gates, and benchmark expectations** - `f1c3517` (chore)

## Files Created/Modified
- `extension/content/spell-rules/grammar-tables.js` - Added ES_GUSTAR_CLASS_VERBS Set (15 gustar-class verbs)
- `extension/styles/content.css` - Added 3 CSS bindings (es-pro-drop P3, es-gustar P2, fr-clitic-order P2)
- `extension/manifest.json` - Added 6 rule file entries (3 Phase 11 + 3 Phase 12)
- `scripts/check-explain-contract.js` - Extended TARGETS with 3 Phase 12 rule paths
- `scripts/check-rule-css-wiring.js` - Extended TARGETS with 3 Phase 12 rule paths
- `benchmark-texts/expectations.json` - Added 4 entries for pro-drop, gustar, clitic-order
- `benchmark-texts/fr.txt` - Added clitic-order error line 55

## Decisions Made
- Added Phase 11 missing manifest entries alongside Phase 12 to fix a wiring gap (3 Phase 11 rules were in release gates but not in manifest)
- Used separate benchmark keys (es.39, es.41) for pro-drop instead of adding to es.27/es.34 which already have es-por-para expectations, since the format supports one rule per key

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- grammar-tables.js exports ES_GUSTAR_CLASS_VERBS for Plan 02 (es-gustar.js)
- CSS bindings ready for all three Phase 12 rule files
- Manifest has all entries; Plans 02 and 03 only need to create the rule .js files
- Release gates will validate the new rule files once they exist

---
*Phase: 12-pronoun-pro-drop-es-fr*
*Completed: 2026-04-25*
