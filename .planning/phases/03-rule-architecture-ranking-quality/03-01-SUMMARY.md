---
phase: 03-rule-architecture-ranking-quality
plan: 01
subsystem: vocab-seam
tags: [frequency, zipf, vocab-seam, ranking, indexes]

# Dependency graph
requires:
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: extension/data/freq-{nb,nn}.json sidecars (DATA-01)
provides:
  - VOCAB.getFrequency(word) returns real Zipf values for NB/NN
  - state.freq Map populated (13,132 NB / 11,013 NN entries; empty Map elsewhere)
  - check-fixtures fail-loud guard against silent freq-data loss for NB/NN
affects: [03-02-fuzzy-zipf-tiebreaker, 03-04-word-prediction-frequency-signal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional sidecar fetch pattern extended (bigrams + freq fetched in parallel via Promise.all)"
    - "Fail-loud guard pattern: throw if a language we expect to have data lost it"

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - scripts/check-fixtures.js

key-decisions:
  - "Phase 3-01: freq sidecar wired via additive Promise.all parallel fetch (bigrams + freq) to match the existing optional-sidecar pattern; zero schema changes, zero new npm deps, no public API change (getFrequency null-return contract preserved)"
  - "Phase 3-01: fail-loud guard in check-fixtures.js throws Error if NB or NN freq Map is empty post-buildIndexes — defends against future freq-data loss that would otherwise be silent (Pitfall 2 from 03-RESEARCH.md)"
  - "Phase 3-01: freq Map keys lowercased on hydration (Object.entries → freqMap.set(k.toLowerCase(), v)); matches the lowercase contract already used by getFrequency's lookup path"

patterns-established:
  - "Optional sidecar wiring: helper function (loadRaw{Thing}) returns null on 404/exception; parallel-loaded with Promise.all; passed through buildIndexes destructure; core hydrates a Map (empty if null)"
  - "Fixture-runner data assertion: when a language is contractually guaranteed to ship a sidecar, the test runner validates non-emptiness post-build and throws a labeled Error on failure"

requirements-completed: [SC-01, WP-01]

# Metrics
duration: 3 min
completed: 2026-04-19
---

# Phase 03 Plan 01: Wire frequency sidecar through vocab seam Summary

**Phase 2 freq-{nb,nn}.json sidecars now hydrate state.freq end-to-end — VOCAB.getFrequency('bedre') returns 5.58 instead of null, unblocking SC-01 (fuzzy Zipf tiebreaker) and WP-01 (word-prediction frequency signal)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-19T09:24:30Z
- **Completed:** 2026-04-19T09:27:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `buildIndexes` in vocab-seam-core.js now accepts an optional `freq` param and hydrates a Map with lowercase keys; null freq still yields an empty Map (backward-compatible for languages without a sidecar — de/es/fr/en).
- vocab-seam.js fetches `data/freq-{lang}.json` in parallel with `data/bigrams-{lang}.json` via `Promise.all`; missing sidecar silently yields null, mirroring the existing bigrams pattern.
- scripts/check-fixtures.js now passes the freq sidecar into the Node-side fixture runner and throws fail-loud on empty NB/NN freq Maps; 138/138 fixtures still pass with zero scoring changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Teach buildIndexes to accept and hydrate freq** — `146c7a0` (feat)
2. **Task 2: Fetch freq-{lang}.json in seam, parallel with bigrams** — `8311501` (feat)
3. **Task 3: Inject freq into fixture runner with fail-loud guard** — `95bc910` (feat)

**Plan metadata:** committed at end of plan (docs).

## Files Created/Modified

- `extension/content/vocab-seam-core.js` — `buildIndexes({ raw, bigrams, freq, lang, isFeatureEnabled })` now hydrates `freq: Map` from the raw freq object; comment refreshed from "Phase 1: freq table is always empty" → "Phase 3-01: hydrated from freq-{lang}.json sidecar".
- `extension/content/vocab-seam.js` — Added `loadRawFrequency(lang)` helper; replaced sequential bigrams fetch with `Promise.all([loadRawBigrams, loadRawFrequency])`; passes `freq` through to `core.buildIndexes`.
- `scripts/check-fixtures.js` — `loadVocab()` now reads optional `data/freq-{lang}.json` sidecar; throws `Error` if NB/NN freq Map is empty post-build (catches silent freq-data loss for languages we know shipped a sidecar in Phase 2).

## Decisions Made

- **Additive wiring only.** No schema changes, no new npm deps, no public-API change. `getFrequency(word)` already returned `null` when no value was present (contract locked in Phase 1) — populating the underlying Map is a pure data wiring upgrade.
- **Promise.all parallel fetch for bigrams + freq.** Both are independent optional sidecars; sequential `await loadRawBigrams; await loadRawFrequency` would add an unnecessary RTT to the seam load path. Parallel fetch matches the spirit of the original single-fetch design.
- **Fail-loud guard in check-fixtures only, not in the seam.** The seam silently yielding null (and an empty Map) is correct production behavior for languages without sidecars (de/es/fr/en). The fixture runner is the right place to assert "NB/NN MUST have freq data" because it knows the contract that Phase 2 shipped those sidecars.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three tasks ran clean on first attempt; all verification commands passed including the must_haves smoke test (`bedre` → 5.58, `og` → 7.59, `hallo` → null, NB size 13,132, NN size 11,013) and the 138/138 fixture green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 03-02 (SC-01: fuzzy Zipf tiebreaker)** is now unblocked — the fuzzy candidate ranker can call `VOCAB.getFrequency(candidate)` and get real Zipf scores for NB and NN. Prior to this plan that call would always return null and the ranker would silently lose its tiebreaker signal.
- **Plan 03-04 (WP-01: word-prediction frequency signal)** is also unblocked for the same reason.
- The check-fixtures release gate continues to exit 0 (138/138 cases pass); no scoring regression. The next plan that adds Zipf-based ranking should expect some fixture deltas — those are Plan 03-02's responsibility, not this plan's.
- A passing parallel commit (`a03dbd0 feat(03-05): hand-author bigrams-en.json`) appeared on `main` during this plan's execution — Plan 03-05 is in another wave and is unrelated to my files. No conflict, no impact.

## Self-Check: PASSED

- File exists: extension/content/vocab-seam-core.js
- File exists: extension/content/vocab-seam.js
- File exists: scripts/check-fixtures.js
- File exists: .planning/phases/03-rule-architecture-ranking-quality/03-01-SUMMARY.md
- Commit exists: 146c7a0 (Task 1)
- Commit exists: 8311501 (Task 2)
- Commit exists: 95bc910 (Task 3)

---
*Phase: 03-rule-architecture-ranking-quality*
*Completed: 2026-04-19*
