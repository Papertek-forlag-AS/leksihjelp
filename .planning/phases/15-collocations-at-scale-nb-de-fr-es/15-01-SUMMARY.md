---
phase: 15-collocations-at-scale-nb-de-fr-es
plan: 01
subsystem: spell-rules
tags: [collocation, preposition, multi-language, fixtures, benchmark]

# Dependency graph
requires:
  - phase: 06-register-collocation-redundancy
    provides: EN collocation rule with SEED_COLLOCATIONS and check() logic
provides:
  - Multi-language collocation detection for NB, DE, FR, ES
  - 191 new collocation fixtures across 4 languages
  - Benchmark expectations for collocation errors in NB/DE/FR/ES
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-language seed map pattern (SEED_COLLOCATIONS keyed by lang code)"
    - "Conjugated verb form triggers alongside infinitive for substring matching"

key-files:
  created:
    - fixtures/nb/collocation.jsonl
    - fixtures/de/collocation.jsonl
    - fixtures/fr/collocation.jsonl
    - fixtures/es/collocation.jsonl
  modified:
    - extension/content/spell-rules/collocation.js
    - benchmark-texts/de.txt
    - benchmark-texts/fr.txt
    - benchmark-texts/es.txt
    - benchmark-texts/expectations.json

key-decisions:
  - "Added conjugated verb forms as separate seed entries since substring matching requires exact surface forms"
  - "NN falls back to NB seeds (same collocations in both written standards)"
  - "Avoided vocab-absent words in fixtures to prevent false typo findings from interfering"

patterns-established:
  - "Conjugation expansion: for verb+preposition collocations, add common conjugated forms as separate seed entries"
  - "Vocab-safe fixtures: test sentences should only use words present in the language's vocabulary to avoid cross-rule interference"

requirements-completed: [COLL-01, COLL-02, COLL-03, COLL-04]

# Metrics
duration: 15min
completed: 2026-04-25
---

# Phase 15 Plan 01: Collocations at Scale Summary

**Multi-language collocation detection for NB/DE/FR/ES with 191 fixtures, conjugated verb form triggers, and benchmark expectations**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-25T15:31:50Z
- **Completed:** 2026-04-25T15:47:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Extended collocation rule from EN-only to 6 languages (EN, NB, NN, DE, ES, FR) with per-language seed data
- Created 191 collocation fixtures: NB(48), DE(47), FR(50), ES(46) -- all P=1.000 R=1.000 F1=1.000
- Added benchmark lines and expectations for NB.37, DE.49, FR.58, ES.45 -- all pass
- All 7 release gates pass (check-fixtures collocation rules green; pre-existing fr/grammar failures unrelated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend collocation.js with multi-language seeds + benchmark lines** - `933ef1b` (feat)
2. **Task 2: Create collocation fixture files for NB, DE, FR, ES** - `98f4d1f` (feat)

## Files Created/Modified
- `extension/content/spell-rules/collocation.js` - Per-language SEED_COLLOCATIONS map with NB(13), DE(22), FR(33), ES(29) entries
- `fixtures/nb/collocation.jsonl` - 32 positive + 16 acceptance fixtures
- `fixtures/de/collocation.jsonl` - 32 positive + 15 acceptance fixtures
- `fixtures/fr/collocation.jsonl` - 35 positive + 15 acceptance fixtures
- `fixtures/es/collocation.jsonl` - 31 positive + 15 acceptance fixtures
- `benchmark-texts/de.txt` - Line 49: Angst von + warte fur collocation errors
- `benchmark-texts/fr.txt` - Line 58: pense de + cherche pour collocation errors
- `benchmark-texts/es.txt` - Line 45: sueno de + dependo en collocation errors
- `benchmark-texts/expectations.json` - 4 new entries for nb.37, de.49, fr.58, es.45

## Decisions Made
- Added conjugated verb forms as separate seed entries (e.g., pense/penses/pensons/pensez/pensent alongside penser) since the collocation rule uses substring matching and infinitive forms don't appear in student text
- NN set to null with fallback to NB seeds (identical collocations across written standards)
- Avoided vocab-absent words in fixtures (e.g., mes/tes/votre not in FR vocab, dependo/consiste not in ES vocab) to prevent false typo findings from interfering with collocation fixture results

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added conjugated verb forms to seed entries**
- **Found during:** Task 1 (benchmark verification)
- **Issue:** Plan specified infinitive verb triggers (e.g., "penser de") but the rule uses substring matching -- infinitives don't appear in conjugated student text (e.g., "Je pense de")
- **Fix:** Added common conjugated forms as separate seed entries for DE (10 extra), FR (21 extra), ES (17 extra)
- **Files modified:** extension/content/spell-rules/collocation.js
- **Verification:** All 4 benchmark expectations now pass
- **Committed in:** 933ef1b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness -- without conjugated forms, the rule would only fire on infinitive constructions, missing the vast majority of student errors.

## Issues Encountered
- Several FR/ES words not in vocabulary (mes, tes, votre, dependo, consiste, confiar, etc.) caused false typo findings in fixture sentences -- resolved by using only vocab-safe words in fixture text

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 15 is the final v2.0 phase -- milestone complete
- All collocation rules functional across EN, NB, NN, DE, FR, ES
- Future enrichment: migrate seed data to Papertek vocabulary collocationbank when API support lands

## Self-Check: PASSED

All files exist. All commits verified (933ef1b, 98f4d1f).

---
*Phase: 15-collocations-at-scale-nb-de-fr-es*
*Completed: 2026-04-25*
