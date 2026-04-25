---
phase: 11-aspect-mood-es-fr
plan: 03
subsystem: spell-check
tags: [subjonctif, fr, mood, homophony-guard, spell-rules]

requires:
  - phase: 11-aspect-mood-es-fr
    provides: frPresensToVerb, frSubjonctifForms, frSubjonctifDiffers indexes + FR_SUBJONCTIF_TRIGGERS table + CSS binding
provides:
  - FR subjonctif trigger rule (MOOD-03) with homophony guard
  - 56 regression fixtures (35 positive + 21 acceptance)
affects: []

tech-stack:
  added: []
  patterns: [person-disambiguation via preceding subject pronoun for shared verb forms]

key-files:
  created:
    - extension/content/spell-rules/fr-subjonctif.js
    - fixtures/fr/subjonctif.jsonl
  modified: []

key-decisions:
  - "Added person disambiguation using preceding subject pronoun to fix shared-form suggestions (fais = je/tu -> detect pronoun je -> suggest fasse not fasses)"
  - "Single-word trigger support (len=1) for quoique"
  - "Fixture sentences avoid il/elle/ils pronouns after que to prevent fr-elision cross-fire, and avoid faut to prevent typo cross-fire"

patterns-established:
  - "Person disambiguation: when presensToVerb Map returns ambiguous person for shared forms, detect preceding subject pronoun for correct subjunctive suggestion"

requirements-completed: [MOOD-03]

duration: 8min
completed: 2026-04-25
---

# Phase 11 Plan 03: FR Subjonctif Trigger Rule Summary

**FR subjonctif rule flags indicative verbs after trigger phrases with homophony guard preventing false positives on regular -er forms**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-25T08:53:50Z
- **Completed:** 2026-04-25T09:02:19Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments
- Implemented fr-subjonctif.js rule detecting indicative verb forms after closed-set subjunctive triggers
- Homophony guard correctly prevents false positives on regular -er je/tu/il/ils forms (presens = subjonctif)
- Person disambiguation from preceding subject pronoun resolves shared-form ambiguity (e.g., "je fais" suggests "fasse" not "fasses")
- 35 positive + 21 acceptance fixtures at P=1.0 R=1.0 F1=1.0
- All release gates pass (fixtures, explain-contract, css-wiring, benchmark-coverage, network-silence)

## Task Commits

1. **Task 1: FR subjonctif rule + fixtures** - `caa0d78` (feat)

## Files Created/Modified
- `extension/content/spell-rules/fr-subjonctif.js` - MOOD-03 rule with homophony guard and person disambiguation
- `fixtures/fr/subjonctif.jsonl` - 56 regression fixtures (35 positive, 21 acceptance)

## Decisions Made
- Added person disambiguation via preceding subject pronoun. The presensToVerb Map stores only one person per form (last-wins), so "fais" maps to "tu" even when the student wrote "je fais". Detecting the preceding pronoun "je" allows correct subjunctive suggestion "fasse" instead of "fasses".
- Extended trigger matching to support single-word triggers (len=1) for "quoique", which is the only single-word entry in FR_SUBJONCTIF_TRIGGERS.
- Fixture design avoids cross-rule interference: uses "je veux que" / "pour que" / "avant que" instead of "il faut que" (which triggers typo on "faut"), and uses tu/je/nous/vous instead of il/elle/ils (which trigger fr-elision after "que").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Person disambiguation for shared presens forms**
- **Found during:** Task 1
- **Issue:** presensToVerb Map maps "fais" to {inf:"faire", person:"tu"} (last-wins), so "Il faut que je fais" would suggest "fasses" (tu subjonctif) instead of "fasse" (je subjonctif)
- **Fix:** Added PRONOUN_TO_PERSON mapping and detectedPerson tracking during the post-trigger scan. When a subject pronoun is seen before the verb, its person overrides the Map's person for the subjunctive lookup.
- **Files modified:** extension/content/spell-rules/fr-subjonctif.js
- **Verification:** "Je veux que je fais" correctly suggests "fasse" (not "fasses")
- **Committed in:** caa0d78

**2. [Rule 1 - Bug] Single-word trigger matching for quoique**
- **Found during:** Task 1
- **Issue:** Trigger matching loop started at len=2, missing the single-word trigger "quoique"
- **Fix:** Changed loop to start at len=1
- **Files modified:** extension/content/spell-rules/fr-subjonctif.js
- **Verification:** "Quoique tu as raison" correctly flags "as" -> "aies"
- **Committed in:** caa0d78

**3. [Rule 1 - Bug] Fixture path follows project convention**
- **Found during:** Task 1
- **Issue:** Plan specified `tests/fixtures/fr-subjonctif.jsonl` but project convention is `fixtures/fr/subjonctif.jsonl`
- **Fix:** Created fixture at correct path `fixtures/fr/subjonctif.jsonl`
- **Files modified:** fixtures/fr/subjonctif.jsonl
- **Committed in:** caa0d78

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 complete: all 3 plans (infrastructure, ES subjuntivo, FR subjonctif) delivered
- Mood/aspect rules ready for validation in benchmark

---
*Phase: 11-aspect-mood-es-fr*
*Completed: 2026-04-25*
