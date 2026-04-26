---
phase: 21-dictionary-intelligence
plan: 02
subsystem: ui
tags: [false-friends, polysemy, senses, inline-lookup, floating-widget, content-script]

requires:
  - phase: 21-dictionary-intelligence
    provides: "Plan 01 popup rendering of false-friends and senses (reference implementation)"
provides:
  - "False-friend warning banner in floating-widget inline lookup card"
  - "Sense-grouped translations in floating-widget inline lookup card"
  - "sanitizeWarning helper in floating-widget IIFE scope"
  - "CSS hooks for false-friend and sense display in content.css"
affects: [lockdown-sync, content-css]

tech-stack:
  added: []
  patterns: [inline-style false-friend banner, sense-group replacement of flat translation]

key-files:
  created: []
  modified:
    - extension/content/floating-widget.js
    - extension/styles/content.css

key-decisions:
  - "Used inline styles with CSS class hooks (matching existing floating-widget pattern)"
  - "Senses replace flat translation entirely when present (not supplementary)"

patterns-established:
  - "sanitizeWarning in content script: escapeHtml then re-enable em/strong tags"
  - "Sense rendering filters by currentLang and handles form/forms array polymorphism"

requirements-completed: [FF-04, POLY-04]

duration: 2min
completed: 2026-04-26
---

# Phase 21 Plan 02: Floating-Widget False-Friends and Senses Summary

**False-friend warning banner and sense-grouped translations in floating-widget inline lookup card, with sanitizeWarning helper and content.css hooks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-26T18:54:37Z
- **Completed:** 2026-04-26T18:56:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- False-friend banner renders above translation in inline lookup when entry has falseFriends for current language
- Sense-grouped translations replace flat translation line when entry has senses for current language
- sanitizeWarning helper added to floating-widget IIFE for safe em/strong rendering
- CSS hooks in content.css for downstream lockdown consumer and dark-mode upgrade path

## Task Commits

Each task was committed atomically:

1. **Task 1: Add false-friend and sense rendering to floating-widget inline lookup** - `70bf579` (feat)
2. **Task 2: Add content.css styles for false-friend and sense display** - `9974710` (feat)

## Files Created/Modified
- `extension/content/floating-widget.js` - Added sanitizeWarning helper, false-friend banner rendering, sense-grouped translation rendering in showInlineLookup
- `extension/styles/content.css` - Added .lh-ff-banner and .lh-sense-group CSS rules

## Decisions Made
- Used inline styles with CSS class hooks (matching existing floating-widget pattern where card elements use inline styles but CSS classes provide override points)
- Senses replace flat translation entirely when present, matching popup.js behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Floating-widget now has full parity with popup for false-friend and sense rendering
- Ready for Phase 22 (Student Language Guidance) or browser verification

---
*Phase: 21-dictionary-intelligence*
*Completed: 2026-04-26*

## Self-Check: PASSED
