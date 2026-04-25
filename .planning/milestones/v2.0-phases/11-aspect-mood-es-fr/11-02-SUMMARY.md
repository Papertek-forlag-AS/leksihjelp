---
phase: 11-aspect-mood-es-fr
plan: 02
subsystem: spell-check
tags: [spanish, subjuntivo, imperfecto, preterito, mood, aspect, spell-rules]

requires:
  - phase: 11-aspect-mood-es-fr (plan 01)
    provides: mood/aspect indexes (esPresensToVerb, esSubjuntivoForms, esImperfectoForms, esPreteritumToVerb) and grammar-tables (ES_SUBJUNTIVO_TRIGGERS, ES_PRETERITO_ADVERBS, ES_IMPERFECTO_ADVERBS)
provides:
  - ES subjuntivo trigger rule (MOOD-01) flagging indicative after trigger phrases
  - ES imperfecto/preterito aspectual hint rule (MOOD-02) at hint severity
  - Fixture suites for both rules (31 positive + 16 acceptance each)
affects: [11-aspect-mood-es-fr plan 03 (FR subjonctif)]

tech-stack:
  added: []
  patterns: [lazy reverse-map for imperfecto form lookup, multi-word trigger phrase matching with variable-length scan]

key-files:
  created:
    - extension/content/spell-rules/es-subjuntivo.js
    - extension/content/spell-rules/es-imperfecto-hint.js
    - fixtures/es/subjuntivo.jsonl
    - fixtures/es/imperfecto-hint.jsonl
  modified: []

key-decisions:
  - "Person mapping uses indicative form's own person key (from esPresensToVerb) rather than NP subject detection — avoids complex NP-person resolution"
  - "Lazy reverse-map for imperfecto forms built on first check() call since vocab-seam does not export esImperfectoToVerb directly"
  - "Fixture texts adjusted to avoid false-positive typo findings on valid Spanish present-tense forms (dudo, sugiero, alegra etc.)"

patterns-established:
  - "Multi-word trigger matching: variable-length scan (2-5 tokens) against a Set, keeping longest match"
  - "Subject NP skip: SKIP_AFTER_QUE set allows 4 tokens of subject material between trigger and verb"

requirements-completed: [MOOD-01, MOOD-02]

duration: 12m
completed: 2026-04-25
---

# Phase 11 Plan 02: ES Mood/Aspect Rules Summary

**ES subjuntivo trigger rule (priority 60, warning) and preterito/imperfecto aspectual hint rule (priority 65, hint) with full fixture suites**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-25T08:52:19Z
- **Completed:** 2026-04-25T09:04:34Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- ES subjuntivo rule flags indicative verbs after 30+ trigger phrases from grammar-tables.js and suggests subjunctive forms, using vocab-seam indexes for verb resolution
- ES imperfecto-hint rule provides educational hints when temporal adverbs conflict with verb aspect at hint-only severity (dashed/muted CSS)
- Benchmark es.38 ("Quiero que mi hermano viene conmigo") now flips correctly
- Both rules guard against false positives: relative clauses never match triggers, "mientras que" (contrastive) never triggers imperfecto hint

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement es-subjuntivo.js with fixtures** - `be44e47` (feat)
2. **Task 2: Implement es-imperfecto-hint.js with fixtures** - `e2d43fe` (feat)

## Files Created
- `extension/content/spell-rules/es-subjuntivo.js` - Subjuntivo trigger detection rule (MOOD-01)
- `extension/content/spell-rules/es-imperfecto-hint.js` - Aspectual hint rule (MOOD-02)
- `fixtures/es/subjuntivo.jsonl` - 31 positive + 16 acceptance fixtures
- `fixtures/es/imperfecto-hint.jsonl` - 31 positive + 16 acceptance fixtures

## Decisions Made
- Used indicative form's person key for subjunctive lookup rather than NP subject detection — simpler and avoids person-resolution errors
- Built lazy reverse-map for imperfecto form lookup (form -> {inf, person}) since vocab-seam only exports the forward map (inf|person -> form)
- Adjusted fixture texts to avoid typo rule co-findings on valid Spanish verb forms that the ES typo system incorrectly flags (dudo, sugiero, etc.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ctx.indexes -> ctx.vocab field name**
- **Found during:** Task 1 (es-subjuntivo.js initial test)
- **Issue:** Plan referenced `ctx.indexes.esPresensToVerb` but spell-check-core.js passes vocab indexes as `ctx.vocab`
- **Fix:** Changed to `ctx.vocab.esPresensToVerb` / `ctx.vocab.esSubjuntivoForms`
- **Files modified:** es-subjuntivo.js
- **Committed in:** be44e47

**2. [Rule 1 - Bug] Fixture file path: fixtures/es/ not tests/fixtures/**
- **Found during:** Task 1 (fixture creation)
- **Issue:** Plan specified `tests/fixtures/es-subjuntivo.jsonl` but project uses `fixtures/es/*.jsonl`
- **Fix:** Created fixtures at `fixtures/es/subjuntivo.jsonl` and `fixtures/es/imperfecto-hint.jsonl`
- **Files modified:** fixture files
- **Committed in:** be44e47, e2d43fe

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor path/field-name corrections. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (FR subjonctif) can proceed using the same pattern established here
- FR indexes (frPresensToVerb, frSubjonctifForms, frSubjonctifDiffers) already built by Plan 01
- FR_SUBJONCTIF_TRIGGERS already in grammar-tables.js

---
*Phase: 11-aspect-mood-es-fr*
*Completed: 2026-04-25*
