---
phase: 06-structural-infrastructure-register-stylistic-polish
plan: 01
subsystem: infra
tags: [intl-segmenter, severity, css-tiers, release-gates, quotation-suppression]

# Dependency graph
requires:
  - phase: 05-student-experience-polish
    provides: check-explain-contract gate, check-rule-css-wiring gate, spell-check DOM adapter
provides:
  - ctx.sentences via Intl.Segmenter on every check() call
  - ctx.suppressedFor.structural populated by quotation-suppression pre-pass
  - severity field on all 26 existing rules (error/warning/hint contract)
  - P2 amber dot and P3 grey dotted underline CSS classes
  - severity-aware DOM adapter in spell-check.js
  - Extended check-explain-contract with severity validation
  - Extended check-rule-css-wiring with severity-tier coverage
affects: [06-02, 06-03, Phase 7+]

# Tech tracking
tech-stack:
  added: [Intl.Segmenter]
  patterns: [severity-field contract, suppressedFor.structural convention, priority-band CSS tiers]

key-files:
  created:
    - extension/content/spell-rules/quotation-suppression.js
  modified:
    - extension/content/spell-check-core.js
    - extension/content/spell-check.js
    - extension/styles/content.css
    - extension/manifest.json
    - extension/content/spell-rules/README.md
    - scripts/check-explain-contract.js
    - scripts/check-explain-contract.test.js
    - scripts/check-rule-css-wiring.js
    - scripts/check-rule-css-wiring.test.js

key-decisions:
  - "Intl.Segmenter with graceful fallback to single-sentence for older runtimes"
  - "All existing rules ship as severity: 'error' -- warning/hint introduced in Plan 03"
  - "en-homophones excluded from TARGETS lists (returns {nb, en} not {nb, nn}) -- deferred to future plan"

patterns-established:
  - "severity field required on every rule; check-explain-contract validates at release"
  - "ctx.suppressedFor.structural convention: pre-passes populate, structural rules honor, grammar rules ignore"
  - "P2 warning = amber dot (.lh-spell-warn), P3 hint = grey dotted underline (.lh-spell-hint)"

requirements-completed: [INFRA-05, INFRA-11, INFRA-12]

# Metrics
duration: 8min
completed: 2026-04-24
---

# Phase 6 Plan 01: Structural Infrastructure Summary

**Sentence segmenter (ctx.sentences), quotation-span suppression, P1/P2/P3 severity tiers in CSS and DOM adapter, severity field on all 26 rules, extended release gates**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-24T19:03:03Z
- **Completed:** 2026-04-24T19:10:50Z
- **Tasks:** 2
- **Files modified:** 35

## Accomplishments
- ctx.sentences populated via Intl.Segmenter on every check() call with graceful fallback
- ctx.suppressedFor.structural initialized and populated by new quotation-suppression.js pre-pass at priority 3
- All 26 existing rules now carry severity: 'error'; core runner stamps severity onto findings automatically
- P2 amber dot and P3 grey dotted underline CSS tiers ready for Plan 03's warning/hint rules
- spell-check.js DOM adapter maps severity to correct CSS class suffix and sizes hint markers as word-width underlines
- check-explain-contract validates severity field (SEVERITY_MISSING code), covers 23 rules
- check-explain-contract:test covers broken-explain, severity-missing, and well-formed scenarios
- check-rule-css-wiring covers 23 rules including quotation-suppression, homophones, context-typo
- README.md documents priority bands, suppressedFor convention, and Phase 13 document-state seam shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Sentence segmenter + quotation suppression + severity on all rules + manifest** - `c2132c4` (feat)
2. **Task 2: Severity-aware CSS tiers + DOM adapter + extended gates** - `7001010` (feat)

## Files Created/Modified
- `extension/content/spell-check-core.js` - ctx.sentences, ctx.suppressedFor.structural, severity stamping
- `extension/content/spell-rules/quotation-suppression.js` - NEW pre-pass rule at priority 3
- `extension/content/spell-check.js` - severity-aware marker and popover CSS class mapping
- `extension/styles/content.css` - P2 amber, P3 grey dotted underline, quotation-suppression transparent
- `extension/manifest.json` - quotation-suppression.js added to content_scripts
- `extension/content/spell-rules/README.md` - Priority bands, suppressedFor, Phase 13 seam docs
- `scripts/check-explain-contract.js` - severity validation, expanded TARGETS
- `scripts/check-explain-contract.test.js` - severity-missing test scenario
- `scripts/check-rule-css-wiring.js` - expanded TARGETS
- `scripts/check-rule-css-wiring.test.js` - severity-aware scratch rules
- 25 rule files - severity: 'error' field added

## Decisions Made
- Intl.Segmenter with graceful fallback to single-sentence for older runtimes (Node < 18, legacy browsers)
- All existing rules ship as severity: 'error' -- warning and hint tiers introduced in Plan 03
- en-homophones excluded from TARGETS lists because its explain returns {nb, en} not {nb, nn} -- deferred to future plan for alignment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Infrastructure complete for Plan 02 (register/stylistic rules) and Plan 03 (Phase 6 structural rules)
- All rules carry severity field; new rules can use 'warning' or 'hint' severity
- ctx.sentences and ctx.suppressedFor.structural available for structural rules
- en-homophones explain contract needs alignment in a future plan (returns {nb, en} instead of {nb, nn})

---
*Phase: 06-structural-infrastructure-register-stylistic-polish*
*Completed: 2026-04-24*
