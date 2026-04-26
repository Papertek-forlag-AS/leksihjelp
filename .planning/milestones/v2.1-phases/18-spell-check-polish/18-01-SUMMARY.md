---
phase: 18-spell-check-polish
plan: 01
subsystem: spell-check
tags: [spell-rules, demonstrative-gender, triple-letter, fixtures, release-gates]

# Dependency graph
requires:
  - phase: 17-compound-integration
    provides: nounGenus Map, validWords Set, spell-check-core infrastructure
provides:
  - nb-demonstrative-gender rule (priority 12) for den/det/denne/dette + noun mismatch
  - nb-triple-letter rule (priority 45) for accidental triple-letter typos
  - Fixture suites for both rules (12 cases each)
affects: [18-02-spell-check-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [demonstrative-gender check with adjective-gap lookahead, triple-to-double collapse with validWords gating]

key-files:
  created:
    - extension/content/spell-rules/nb-demonstrative-gender.js
    - extension/content/spell-rules/nb-triple-letter.js
    - fixtures/nb/nb-demonstrative-gender.jsonl
    - fixtures/nb/nb-triple-letter.jsonl
  modified:
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js

key-decisions:
  - "Demonstrative-gender uses amber dot (#f59e0b) matching nb-gender convention"
  - "Triple-letter uses red dot (#ef4444) matching typo convention"
  - "Triple-letter fixtures use words NOT in typoFix map to avoid dedup by typo-curated (priority 40)"

patterns-established:
  - "Demonstrative lookahead: check i+1 and i+2 for adjective gap, same as nb-gender article pattern"
  - "Triple-letter collapse: regex /(.)\\1\\1+/g -> '$1$1', gated on validWords membership"

requirements-completed: [SPELL-02, SPELL-03]

# Metrics
duration: 9min
completed: 2026-04-26
---

# Phase 18 Plan 01: Two New Spell-Check Rules Summary

**Demonstrative-gender mismatch (det/den/denne/dette + noun) and triple-letter typo detection with full release gate wiring**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-26T11:32:48Z
- **Completed:** 2026-04-26T11:41:36Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Demonstrative-gender rule flags "Det boka" with fix "Den boka", handles adjective gap ("Det store boka"), respects NB common-gender tolerance
- Triple-letter rule flags "bakkke" -> "bakke" style typos, only when collapse produces a known valid word
- Both rules wired into manifest, CSS dot colours, and both release gate TARGETS arrays (56/56 explain contract, 56/56 CSS wiring)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create nb-demonstrative-gender rule with fixtures** - `b9c5559` (feat)
2. **Task 2: Create nb-triple-letter rule with fixtures** - `86329c2` (feat)
3. **Task 3: Wire both rules into manifest, CSS, and release gates** - `29259ee` (chore)

## Files Created/Modified
- `extension/content/spell-rules/nb-demonstrative-gender.js` - Demonstrative-gender mismatch rule (priority 12)
- `extension/content/spell-rules/nb-triple-letter.js` - Triple-letter typo detection rule (priority 45)
- `fixtures/nb/nb-demonstrative-gender.jsonl` - 12 fixtures (5 positive, 7 negative)
- `fixtures/nb/nb-triple-letter.jsonl` - 12 fixtures (6 positive, 6 negative)
- `extension/manifest.json` - Added both rules to content_scripts js array
- `extension/styles/content.css` - Added CSS dot colour bindings
- `scripts/check-explain-contract.js` - Added both to TARGETS
- `scripts/check-rule-css-wiring.js` - Added both to TARGETS

## Decisions Made
- Demonstrative-gender uses amber dot (matching nb-gender/nb-compound-gender convention for gender errors)
- Triple-letter uses red dot (matching typo convention since these are keyboard errors)
- Triple-letter fixtures intentionally use words NOT in the curated typoFix map, because typo-curated at priority 40 would dedup overlapping findings at the same span

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Triple-letter fixtures needed multi-word text**
- **Found during:** Task 2
- **Issue:** spell-check-core.check() requires >=2 tokens (line 136: `if (tokens.length < 2) return []`). Single-word fixture texts like "bakkke" never reached the rule pipeline.
- **Fix:** Changed all fixtures to two-word texts (e.g., "Han bakkke" instead of "bakkke")
- **Files modified:** fixtures/nb/nb-triple-letter.jsonl
- **Verification:** All 12 fixtures pass P=1.0 R=1.0

**2. [Rule 1 - Bug] Triple-letter fixtures conflicted with typo-curated rule**
- **Found during:** Task 2
- **Issue:** Words like "bakkke", "fulll", "finnne", "takkk" exist in the curated typoFix map. The typo-curated rule (priority 40) fires first and dedupeOverlapping keeps its finding, suppressing the triple-letter rule (priority 45) on the same span.
- **Fix:** Replaced fixture words with ones NOT in typoFix: villlle, alllle, ballll, snilll, grillll, skillle
- **Files modified:** fixtures/nb/nb-triple-letter.jsonl
- **Verification:** All 12 fixtures pass P=1.0 R=1.0

---

**Total deviations:** 2 auto-fixed (2 bugs in fixture design)
**Impact on plan:** Both fixes necessary for fixture correctness. No scope creep. The rule itself works correctly on all triple-letter words; the fixtures just needed to avoid the 2-token minimum and typoFix overlap.

## Issues Encountered
None beyond the fixture design issues documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both new rules are live and tested
- All 8 release gates pass (pre-existing failures in nn-clean and nb-homophone are unrelated)
- Ready for 18-02 (manual spell-check button)

---
*Phase: 18-spell-check-polish*
*Completed: 2026-04-26*
