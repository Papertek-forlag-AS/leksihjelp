---
phase: 19-nb-nn-passiv-s-detection
plan: 02
subsystem: spell-check
tags: [s-passive, nynorsk, bokmal, vocab-seam, spell-rules, document-drift]

requires:
  - phase: 19-nb-nn-passiv-s-detection/01
    provides: s_passiv_infinitiv, s_passiv_presens, isDeponent fields in NB/NN verbbank
provides:
  - sPassivForms vocab-seam index (Map of s-passive forms to baseVerb + deponent flag)
  - nn_passiv_s rule (NN finite s-passive without modal = error)
  - doc-drift-nb-passiv-overuse rule (NB document-level overuse hint)
  - Fixture suite for NN s-passive detection
affects: [nb-modal-verb, spell-check, vocab-seam]

tech-stack:
  added: []
  patterns: [document-drift rule pattern, vocab-seam index for linguistic features]

key-files:
  created:
    - extension/content/spell-rules/nb-nn-passiv-s.js
    - extension/content/spell-rules/doc-drift-nb-passiv-overuse.js
    - fixtures/nn/passiv-s.jsonl
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - extension/content/spell-rules/nb-modal-verb.js
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js

key-decisions:
  - "severity 'hint' (not 'info') for NB overuse rule to pass explain-contract gate"
  - "Modal-verb rule updated to skip s-passive forms (prevents false 'wrong form' flags on valid NN s-passive after modal)"

patterns-established:
  - "sPassivForms Map pattern: buildSPassivIndex -> vocab-seam getter -> spell-check.js ctx.vocab wiring"
  - "Deponent verb exclusion: isDeponent flag prevents false-flagging lexicalised st-verbs"

requirements-completed: [DEBT-04]

duration: 23min
completed: 2026-04-26
---

# Phase 19 Plan 02: NB/NN S-Passive Detection Summary

**NN finite s-passive detection rule with modal-verb acceptance, NB document-level overuse hint, deponent/st-verb exclusion, and vocab-seam sPassivForms index**

## Performance

- **Duration:** 23 min
- **Started:** 2026-04-26T14:53:07Z
- **Completed:** 2026-04-26T15:16:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- sPassivForms vocab-seam index: NB 644 entries, NN 442 entries mapping s-passive forms to base verb and deponent flag
- NN rule (nn_passiv_s, priority 25) flags finite s-passive without modal, accepts modal + s-passive infinitive and deponent st-verbs
- NB rule (doc-drift-nb-passiv-overuse, priority 205) gives document-level hint when >3 non-deponent s-passives
- All 8 release gates pass green with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: buildSPassivIndex + vocab-seam wiring** - `a71f84e` (feat)
2. **Task 2: Rules, fixtures, manifest, CSS, release gates** - `4f8be0a` (feat)

## Files Created/Modified
- `extension/content/vocab-seam-core.js` - buildSPassivIndex function, sPassivForms in return object
- `extension/content/vocab-seam.js` - getSPassivForms getter
- `extension/content/spell-check.js` - sPassivForms wired into ctx.vocab
- `extension/content/spell-rules/nb-nn-passiv-s.js` - NN finite s-passive detection (priority 25, error)
- `extension/content/spell-rules/doc-drift-nb-passiv-overuse.js` - NB overuse hint (priority 205, hint)
- `extension/content/spell-rules/nb-modal-verb.js` - Skip s-passive forms to prevent false flags
- `extension/manifest.json` - Both new rule files added to content_scripts
- `extension/styles/content.css` - Dot-colour bindings for both rules
- `scripts/check-explain-contract.js` - Both rules added to TARGETS
- `scripts/check-rule-css-wiring.js` - Both rules added to TARGETS
- `fixtures/nn/passiv-s.jsonl` - 8 fixture cases (3 positive, 5 acceptance)

## Decisions Made
- Used severity `hint` instead of plan's `info` for NB overuse rule because the explain-contract gate only accepts error/warning/hint
- Updated nb-modal-verb.js to skip s-passive forms after modals (Rule 1 auto-fix: modal_form was incorrectly flagging valid NN s-passive infinitives like "kan lesast" as wrong verb form)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Modal-verb rule false-flagging valid NN s-passive after modal**
- **Found during:** Task 2 (fixture testing)
- **Issue:** nb-modal-verb.js flagged "lesast" in "kan lesast" as wrong form (suggesting "lese"), because verbInfinitive maps s-passive forms back to plain infinitive
- **Fix:** Added sPassivForms check in modal-verb rule: skip if token is a known s-passive form
- **Files modified:** extension/content/spell-rules/nb-modal-verb.js
- **Verification:** Fixture "kan lesast" acceptance case passes, all existing modal fixtures still pass
- **Committed in:** 4f8be0a (Task 2 commit)

**2. [Rule 1 - Bug] severity 'info' rejected by explain-contract gate**
- **Found during:** Task 2 (release gate verification)
- **Issue:** Plan specified severity `info` but explain-contract gate only accepts error/warning/hint
- **Fix:** Changed to severity `hint` (semantically equivalent for informational document-level hints)
- **Files modified:** extension/content/spell-rules/doc-drift-nb-passiv-overuse.js
- **Committed in:** 4f8be0a (Task 2 commit)

**3. Plan referenced `tests/fixtures/nb-nn-passiv-s.fixture.json` but actual fixture format is JSONL in `fixtures/nn/`**
- **Found during:** Task 2 (fixture creation)
- **Issue:** Plan's artifact path didn't match project fixture convention
- **Fix:** Created `fixtures/nn/passiv-s.jsonl` following existing JSONL format
- **Committed in:** 4f8be0a (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 path correction)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 complete: NB/NN s-passive detection fully operational
- Deferred: full NN participle gender/number agreement (skriven/skrive/skrivne) for bli/verte-passive
- Ready for Phase 20 (Browser Verification) or milestone completion

---
*Phase: 19-nb-nn-passiv-s-detection*
*Completed: 2026-04-26*
