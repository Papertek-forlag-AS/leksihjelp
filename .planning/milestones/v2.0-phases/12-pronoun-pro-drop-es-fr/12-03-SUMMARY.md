---
phase: 12-pronoun-pro-drop-es-fr
plan: 03
subsystem: spell-rules
tags: [french, clitics, pronoun-ordering, spell-check]

# Dependency graph
requires:
  - phase: 12-pronoun-pro-drop-es-fr
    plan: 01
    provides: "CSS binding .lh-spell-fr-clitic-order, manifest entry, release gate TARGETS, benchmark line fr.55"
provides:
  - "FR double-pronoun clitic-order rule (fr-clitic-order.js)"
  - "96 fixtures (32 positive + 64 acceptance) at P=1.000 R=1.000 F1=1.000"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Backward walk from finite verb to collect pre-verbal clitic cluster with rank-order validation"]

key-files:
  created:
    - extension/content/spell-rules/fr-clitic-order.js
    - fixtures/fr/clitic-order.jsonl
  modified: []

key-decisions:
  - "Inline FR_CLITIC_RANKS table in rule file per data-logic-separation philosophy (closed class, stable for centuries)"
  - "Article disambiguation via next-token check: le/la/les only treated as clitic if followed by another clitic or the verb"
  - "Used only verbs with known present forms in FR vocab for fixtures to avoid false typo hits from other rules"

patterns-established:
  - "Pre-verbal clitic cluster detection via backward walk from isFinite token"
  - "Imperative-affirmative detection via raw-text hyphen check (hyphens are not tokens)"

requirements-completed: [PRON-03]

# Metrics
duration: 9min
completed: 2026-04-25
---

# Phase 12 Plan 03: FR Clitic-Order Rule Summary

**FR double-pronoun clitic-ordering rule enforcing me/te/se < le/la/les < lui/leur < y < en rank order with article/imperative guards**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-25T10:07:39Z
- **Completed:** 2026-04-25T10:16:27Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments
- Implemented fr-clitic-order rule flagging wrong double-pronoun clitic ordering at warn severity
- Three disambiguation guards: le/la/les article vs clitic, nous/vous subject vs clitic, imperative-affirmative skip
- 32 positive fixtures covering lui+le, leur+les, en+y, and other rank-pair violations
- 64 acceptance fixtures covering correct order, single clitics, articles before nouns, imperatives, negation, non-FR text
- Perfect fixture score: P=1.000 R=1.000 F1=1.000

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement PRON-03 fr-clitic-order rule with fixtures** - `ec4ebea` (feat)

## Files Created/Modified
- `extension/content/spell-rules/fr-clitic-order.js` - FR clitic-order rule with rank table, backward walk algorithm, and three disambiguation guards
- `fixtures/fr/clitic-order.jsonl` - 96 fixtures (32 positive + 64 acceptance)

## Decisions Made
- Used inline FR_CLITIC_RANKS table rather than grammar-tables.js since FR clitics are a stable closed class used only by this rule
- Article disambiguation checks if next token toward verb is another clitic or the verb itself; if not, treats le/la/les as article and stops collecting
- Imperative detection via raw text hyphen check since the tokenizer strips hyphens (donne-le-moi tokenizes as three separate words)
- Restricted fixture verb forms to those with known present tense data in fr.json to avoid interference from the typo rule

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial fixture offsets were incorrect for several cases; recalculated using the tokenizer regex
- Some fixture verbs (envoyer, apporter, revenir) lack present tense conjugation data in fr.json, causing the typo rule to fire on those forms; replaced with verbs that have full conjugation data (donner, montrer, prendre, etc.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FR clitic-order rule complete; Plan 02 (ES pro-drop + gustar) is the remaining plan in Phase 12
- Release gates check-explain-contract, check-rule-css-wiring, and check-benchmark-coverage will pass once Plan 02 ships es-pro-drop.js and es-gustar.js

---
*Phase: 12-pronoun-pro-drop-es-fr*
*Completed: 2026-04-25*
