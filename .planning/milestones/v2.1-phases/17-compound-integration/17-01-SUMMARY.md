---
phase: 17-compound-integration
plan: 01
subsystem: ui
tags: [compound-decomposition, dictionary-popup, floating-widget, i18n]

requires:
  - phase: 16-decomposition-engine
    provides: decomposeCompound algorithm, buildIndexes nounGenus map, vocab-seam getDecomposeCompound
provides:
  - renderCompoundCard function in popup.js for compound word display
  - nounGenusMap construction at dictionary load in popup
  - compound decomposition fallback in floating-widget inline lookup
  - compound_label i18n key (NB, NN, EN)
affects: [18-post-decomposition-polish, 19-sarskriving-expansion]

tech-stack:
  added: []
  patterns: [compound-card-rendering, component-click-navigation]

key-files:
  created: []
  modified:
    - extension/popup/popup.html
    - extension/popup/popup.js
    - extension/styles/popup.css
    - extension/content/floating-widget.js
    - extension/i18n/strings.js

key-decisions:
  - "Compound card uses purple badge to visually distinguish from normal POS badges"
  - "Floating-widget shows simplified breakdown string (no clickable components) matching widget context"
  - "Decomposition only attempted when combined results are empty -- stored nounbank always wins"

patterns-established:
  - "Compound card pattern: badge + breakdown + clickable components + gender"
  - "Component click triggers performSearch and updates search input value"

requirements-completed: [COMP-01, COMP-02]

duration: 3min
completed: 2026-04-26
---

# Phase 17 Plan 01: Compound Integration UI Summary

**Compound decomposition wired into popup dictionary and floating-widget with clickable component breakdown, gender badge, and i18n labels**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-26T06:54:09Z
- **Completed:** 2026-04-26T06:57:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Unknown compound words in popup now render a "Sammensatt ord" card with visual breakdown, gender badge, and clickable component buttons
- Each component button triggers a dictionary search for that word, enabling drill-down learning
- Floating-widget inline lookup shows compound breakdown instead of "not found" for decomposable unknown words
- Stored nounbank entries always take precedence over compound decomposition (no false positives for known words)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire vocab-seam-core into popup and build nounGenusMap** - `494c19a` (feat)
2. **Task 2: Implement renderCompoundCard and floating-widget fallback** - `78c17f6` (feat)

## Files Created/Modified
- `extension/popup/popup.html` - Added vocab-seam-core.js script tag before popup.js
- `extension/popup/popup.js` - Added nounGenusMap, tryDecomposeQuery, renderCompoundCard, decomposition in performSearch
- `extension/styles/popup.css` - Added compound-badge, compound-breakdown, compound-component-btn styles with dark mode
- `extension/content/floating-widget.js` - Added decomposition fallback in showInlineLookup via vocab-seam
- `extension/i18n/strings.js` - Added compound_label key for NB, NN, EN

## Decisions Made
- Used purple (#7c3aed) badge for compound label to visually distinguish from green accent POS badges
- Floating-widget shows flat breakdown text (no clickable components) since widget context differs from popup
- Decomposition attempt placed after all search phases (direct, inflection, fallback direction) to ensure known words always win

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing check-network-silence failure in spell-check.js (bug report endpoint) -- not caused by this plan's changes, out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compound decomposition UI complete, ready for Phase 18 post-decomposition polish
- All release gates pass (except pre-existing network-silence issue unrelated to this plan)

---
*Phase: 17-compound-integration*
*Completed: 2026-04-26*
