---
phase: 22-aa-og-confusion
plan: 01
subsystem: spell-check
tags: [norwegian, grammar, homophones, å-og, spell-rules]

requires:
  - phase: none
    provides: n/a
provides:
  - "Dedicated å/og confusion detection rule (nb-aa-og.js)"
  - "Posture-verb exception handling for sitter/står/ligger/går patterns"
  - "12 regression fixtures for å/og rule"
affects: [nb-homophones, spell-check, content-css]

tech-stack:
  added: []
  patterns: ["posture-verb exception set for progressive aspect"]

key-files:
  created:
    - extension/content/spell-rules/nb-aa-og.js
    - fixtures/nb/aa-og.jsonl
  modified:
    - extension/content/spell-rules/nb-homophones.js
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - fixtures/nb/homophone.jsonl

key-decisions:
  - "Priority 15 for å/og rule (higher than homophones at 40) — most common NB error"
  - "Red-600 CSS dot colour signals high-severity grammar error"
  - "Removed å/og from homophones entirely rather than keeping fallback"

patterns-established:
  - "POSTURE_VERBS exception set: sitter/står/ligger/går progressive aspect is correct Norwegian"

requirements-completed: [AAOG-01, AAOG-02, AAOG-03, AAOG-04]

duration: 5min
completed: 2026-04-26
---

# Phase 22 Plan 01: å/og Confusion Detection Summary

**Dedicated å/og rule with posture-verb exceptions, bidirectional detection (og-to-å and å-to-og), 12 fixtures at P=1.0 R=1.0**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-26T22:00:47Z
- **Completed:** 2026-04-26T22:05:19Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created nb-aa-og.js with priority 15, two detection directions, and posture-verb exceptions
- Direction 1: flags "og" when preceded by infinitive trigger and followed by verb form
- Direction 2: flags "å" when followed by article/pronoun/preposition or between two non-verbs
- POSTURE_VERBS set correctly exempts "sitter og leser" progressive aspect pattern
- Removed å/og logic from nb-homophones.js to prevent double-flagging
- All 6 release gates pass

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing fixtures** - `c516c06` (test)
2. **Task 1 GREEN: Implement rule + update homophones** - `79ad81c` (feat)
3. **Task 2: Wire into manifest, CSS, gates** - `0b588be` (chore)

## Files Created/Modified
- `extension/content/spell-rules/nb-aa-og.js` - Dedicated å/og confusion detection rule
- `extension/content/spell-rules/nb-homophones.js` - Removed å/og logic (moved to dedicated rule)
- `fixtures/nb/aa-og.jsonl` - 12 regression fixtures (5 flag, 7 clean)
- `fixtures/nb/homophone.jsonl` - Removed 3 å/og fixtures
- `extension/manifest.json` - Added nb-aa-og.js to content_scripts
- `extension/styles/content.css` - Added .lh-spell-aa_og red-600 dot colour
- `scripts/check-explain-contract.js` - Added nb-aa-og.js to TARGETS
- `scripts/check-rule-css-wiring.js` - Added nb-aa-og.js to TARGETS

## Decisions Made
- Priority 15 chosen (higher than homophones at 40) because å/og is the most common NB student error
- Red-600 (#dc2626) CSS colour signals high-severity grammar error, distinct from orange homophones
- Complete removal of å/og from homophones rather than keeping as fallback — dedicated rule has broader trigger coverage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rule is fully wired and all release gates pass
- Ready for browser verification (manual spot-check of popover rendering)

---
*Phase: 22-aa-og-confusion*
*Completed: 2026-04-26*
