---
phase: 07-word-order-violations-nb-de-fr
plan: 02
subsystem: spell-check
tags: [word-order, v2-inversion, nb, nn, de, spell-rules, fixtures]

requires:
  - phase: 07-word-order-violations-nb-de-fr
    provides: ctx.getTagged POS-tagged view, findFiniteVerb, tokensInSentence, acceptance ratio enforcement
provides:
  - "NB V2 rule (nb-v2.js): flags subject+verb after fronted adverbials/wh-words in NB/NN"
  - "DE V2 rule (de-v2.js): same for German, with separable-verb prefix stripping"
  - "31 positive + 64 acceptance NB fixtures (2.1x ratio)"
  - "31 positive + 63 acceptance DE fixtures (2.0x ratio)"
  - "4 benchmark expectations for V2 violations"
affects: [07-03, phase-08]

tech-stack:
  added: []
  patterns: [adjacent-subject-verb-detection, separable-prefix-stripping, direct-finite-check]

key-files:
  created:
    - extension/content/spell-rules/nb-v2.js
    - extension/content/spell-rules/de-v2.js
    - fixtures/nb/v2.jsonl
    - fixtures/de/v2.jsonl
  modified:
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - benchmark-texts/expectations.json
    - benchmark-texts/nb.txt

key-decisions:
  - "Flag only the subject pronoun span (not subject-through-verb) to avoid deduplication conflicts with typo/capitalization rules on the verb token"
  - "Use direct knownPresens/knownPreteritum lookup instead of isFinite for verb detection to avoid false positives from multi-word stem extraction"
  - "Add separable-prefix stripping in DE rule to detect student errors like 'aufstehe' (unseparated form of 'stehe auf')"
  - "Treat 'nar' as wh-word (not subordinator) when sentence ends with '?'"

patterns-established:
  - "Adjacent subject+verb detection: find subject pronoun at position > 0 immediately followed by finite verb"
  - "Direct finite-verb check: use knownPresens/knownPreteritum directly, not isFinite (avoids stem-matching false positives from multi-word forms)"

requirements-completed: [WO-01, WO-02]

duration: 20min
completed: 2026-04-24
---

# Phase 7 Plan 02: NB V2 + DE V2 Word-Order Rules Summary

**NB and DE V2 word-order rules flagging subject-before-verb after fronted adverbials/wh-words, with 31+ positive and 60+ acceptance fixtures per language, direct finite-verb detection, and German separable-prefix stripping**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-24T20:07:53Z
- **Completed:** 2026-04-24T20:27:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- NB V2 rule detects "I gar jeg gikk" and "Hvorfor du tror" patterns (31 positive fixtures, R=1.000)
- DE V2 rule detects "Gestern ich habe" and "Dann ich aufstehe" patterns with separable-prefix stripping (31 positive fixtures, R=1.000)
- Guards prevent false positives on subordinate clauses, embedded wh-clauses, correct V2 inversions, and V1 questions
- All release gates pass: explain-contract, CSS wiring, network silence, benchmark coverage (8/8 expectations met)

## Task Commits

Each task was committed atomically:

1. **Task 1: NB V2 + DE V2 rule files with fixture suites** - `bb181e9` (feat)
2. **Task 2: Manifest, CSS, TARGETS, benchmark expectations** - `94041a5` (feat)

## Files Created/Modified
- `extension/content/spell-rules/nb-v2.js` - NB/NN V2 word-order rule (priority 65, warning)
- `extension/content/spell-rules/de-v2.js` - DE V2 word-order rule (priority 66, warning, with separable-prefix stripping)
- `fixtures/nb/v2.jsonl` - 31 positive + 64 acceptance NB fixtures
- `fixtures/de/v2.jsonl` - 31 positive + 63 acceptance DE fixtures
- `extension/manifest.json` - Added nb-v2.js and de-v2.js to content_scripts
- `extension/styles/content.css` - Added .lh-spell-nb-v2 and .lh-spell-de-v2 amber CSS bindings
- `scripts/check-explain-contract.js` - Added both rules to TARGETS
- `scripts/check-rule-css-wiring.js` - Added both rules to TARGETS
- `benchmark-texts/expectations.json` - 4 new V2 expectations (nb.42, nb.43, de.32, de.39)
- `benchmark-texts/nb.txt` - Added "I gar jeg gikk pa kino." benchmark line

## Decisions Made
- **Subject-only span**: Flag just the subject pronoun to avoid deduplication conflicts with other rules on the verb token. This was discovered during development when the typo rule on "aufstehe" masked the V2 finding.
- **Direct finite-verb check**: The `isFinite` field from `getTagged` includes stems from multi-word forms (e.g., "ga" from "ga av", "i" from "i gar"). Using direct `knownPresens`/`knownPreteritum` lookup avoids these false positives.
- **Separable-prefix stripping**: German students write unseparated forms like "aufstehe" instead of "stehe auf". The DE rule strips common separable prefixes to check the stem.
- **Nar dual role**: "nar" is both a subordinator and a wh-word in Norwegian. When at the start of a sentence ending with "?", treat as wh-word.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed false positives from multi-word stem matching**
- **Found during:** Task 1
- **Issue:** `isFinite` from `getTagged` matched words like "ga" and "i" that are stems of multi-word verb forms ("ga av", "i gar") but not actual finite verbs in context
- **Fix:** Check `knownPresens`/`knownPreteritum` directly instead of relying on `isFinite`
- **Files modified:** `extension/content/spell-rules/nb-v2.js`, `extension/content/spell-rules/de-v2.js`
- **Committed in:** bb181e9 (Task 1 commit)

**2. [Rule 1 - Bug] Changed span to subject-only to avoid deduplication masking**
- **Found during:** Task 1
- **Issue:** V2 findings spanning subject-through-verb overlapped with typo/capitalization findings on the verb, causing deduplication to drop the V2 finding
- **Fix:** Flag only the subject pronoun span (start to end of subject token)
- **Files modified:** `extension/content/spell-rules/nb-v2.js`, `extension/content/spell-rules/de-v2.js`
- **Committed in:** bb181e9 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NB and DE V2 rules ready for browser testing
- Plan 07-03 (DE verb-final + FR BAGS) already completed — Phase 07 is now fully done
- All release gates pass

---
*Phase: 07-word-order-violations-nb-de-fr*
*Completed: 2026-04-24*

## Self-Check: PASSED
