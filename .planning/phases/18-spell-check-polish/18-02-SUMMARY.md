---
phase: 18-spell-check-polish
plan: 02
subsystem: ui
tags: [spell-check, i18n, css, toast, button]

requires:
  - phase: 05-spell-check
    provides: spell-check DOM adapter, overlay system, marker rendering
provides:
  - Manual spell-check trigger button near active textarea
  - Toast feedback with finding count or clean confirmation
  - No-flash optimization (skip re-check when text unchanged)
  - i18n strings for NB/NN/EN
affects: [lockdown-consumer, spell-check-polish]

tech-stack:
  added: []
  patterns: [manual-trigger-button, toast-feedback, no-flash-optimization]

key-files:
  created: []
  modified:
    - extension/content/spell-check.js
    - extension/styles/content.css
    - extension/i18n/strings.js

key-decisions:
  - "Button uses absolute positioning anchored to textarea bottom-right, not fixed, for scroll compatibility"
  - "No-flash optimization compares text string equality with lastCheckedText rather than hash"
  - "Toast uses CSS animation (lh-toast-fade) with auto-remove after 2500ms via setTimeout"

patterns-established:
  - "Manual check button lifecycle: ensureButton on focus, hideButton on blur, positionButton on scroll/resize"

requirements-completed: [SPELL-01]

duration: 3min
completed: 2026-04-26
---

# Phase 18 Plan 02: Manual Spell-Check Button Summary

**Manual Aa button near active textarea with toast feedback showing finding count or "Ser bra ut!" confirmation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-26T11:32:56Z
- **Completed:** 2026-04-26T11:35:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Visible Aa button appears near focused textarea when spell-check is enabled
- Click triggers immediate check with toast showing "N feil funnet" or "Ser bra ut!"
- No-flash optimization skips re-render when text unchanged since last auto-check
- Full i18n coverage (NB/NN/EN) and dark mode CSS support

## Task Commits

Each task was committed atomically:

1. **Task 1: Add manual spell-check button and toast to spell-check.js** - `d184e1a` (feat)
2. **Task 2: Add button and toast CSS styling** - `32189d1` (feat)

## Files Created/Modified
- `extension/content/spell-check.js` - Added ensureButton, positionButton, hideButton, manualCheck, showToast functions; hooked into focus/blur/scroll lifecycle; added lastCheckedText tracking
- `extension/styles/content.css` - Added .lh-spell-check-btn pill styling, .lh-spell-toast with lh-toast-fade animation, dark mode variants
- `extension/i18n/strings.js` - Added spell_check_btn_title, spell_toast_errors, spell_toast_clean for NB/NN/EN

## Decisions Made
- Button uses absolute positioning anchored to textarea bottom-right for natural scroll behavior
- No-flash optimization uses simple string equality on lastCheckedText (no hashing overhead for short texts)
- Toast auto-removes via setTimeout + CSS fade animation for consistent 2.5s visibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Button and toast are lockdown-compatible (pure DOM, no chrome.storage calls)
- All release gates pass (network-silence, rule-css-wiring, bundle-size, fixtures)

---
*Phase: 18-spell-check-polish*
*Completed: 2026-04-26*
