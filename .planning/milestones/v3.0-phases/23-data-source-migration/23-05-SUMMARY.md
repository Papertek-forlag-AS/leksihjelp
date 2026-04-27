---
phase: 23-data-source-migration
plan: 05
subsystem: infra
tags: [indexeddb, migration, vocab, bundle-size, lockdown]

# Dependency graph
requires:
  - phase: 23-02
    provides: vocab-store.js IndexedDB cache adapter (getCachedBundle, putCachedBundle, fetchBundle)
  - phase: 23-03
    provides: vocab-bootstrap.js bootstrapAll orchestrator + nb-baseline.json
  - phase: 23-04
    provides: vocab-updater.js checkForUpdates for stale-data detection
provides:
  - v2-to-v3 migration trigger on chrome.runtime.onInstalled with lexiMigratedFromV2 breadcrumb
  - Bundled vocab data removed (20 files deleted); only nb-baseline.json + pitfalls-en.json remain
  - Test fixture harness migrated to tests/fixtures/vocab/ (independent of shipped data)
  - Lockdown adapter contract documenting seam surface + three implementation options
affects: [lockdown, release-gates, packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: [resolveDataFile fallback pattern across all gate scripts]

key-files:
  created:
    - tests/fixtures/vocab/*.json (15 fixture vocab files)
    - .planning/lockdown-adapter-contract.md
  modified:
    - extension/background/service-worker.js (migration-aware onInstalled)
    - scripts/check-fixtures.js (resolveDataFile fallback)
    - scripts/check-benchmark-coverage.js (resolveDataFile fallback)
    - scripts/check-governance-data.js (resolveDataFile fallback)
    - scripts/check-spellcheck-features.js (resolveDataFile fallback)
    - scripts/check-bundle-size.test.js (nb-baseline.json refs)

key-decisions:
  - "resolveDataFile() fallback pattern: tests/fixtures/vocab/ first, extension/data/ second -- applied across all 4 gate scripts for uniform vocab resolution post-deletion"
  - "pitfalls-en.json kept in extension/data/ (not on delete list; future migration to API is a separate phase)"
  - "check-bundle-size.test.js Test 6 relaxed from pretty-print check to valid-JSON check since nb-baseline.json is intentionally compact"

patterns-established:
  - "resolveDataFile(filename): canonical pattern for loading vocab data in Node.js gate scripts -- checks tests/fixtures/vocab/ then extension/data/"

requirements-completed: [MIGRATE-01]

# Metrics
duration: 8min
completed: 2026-04-27
---

# Phase 23 Plan 05: Data Flip + Lockdown Contract Summary

**Removed 20 bundled vocab files (zip 18 MiB to 7.6 MiB), added v2-to-v3 migration trigger with breadcrumb, migrated all gate scripts to fixture-based vocab path**

## Performance

- **Duration:** ~8 min (execution), checkpoint wait excluded
- **Started:** 2026-04-27T14:01:44Z
- **Completed:** 2026-04-27T18:50:00Z
- **Tasks:** 4 (3 auto + 1 human-verify)
- **Files modified:** 26 (6 modified, 20 deleted)

## Accomplishments
- Deleted all per-language vocab from extension/data/ (de/es/fr/en/nb/nn.json, freq-*, bigrams-*, grammarfeatures-*) -- only nb-baseline.json + pitfalls-en.json remain
- Extension zip dropped from ~18 MiB to 7.61 MiB (58% reduction)
- Service-worker onInstalled handler now differentiates install, v2-to-v3 update, and 3.x-to-3.x update with appropriate bootstrap/update calls
- All 9 release gates continue to pass via tests/fixtures/vocab/ fixture path
- Lockdown adapter contract written with seam surface + three implementation options

## Task Commits

Each task was committed atomically:

1. **Task 1a: Migrate fixture harness** - `5dff21f` (feat)
2. **Task 1b: Migration trigger + remove bundled data** - `ecee335` (feat)
3. **Task 2: Lockdown adapter contract** - `720ade2` (docs)
4. **Task 3: Human verification** - approved (no commit)

## Files Created/Modified

**Created:**
- `tests/fixtures/vocab/{de,es,fr,en,nb,nn}.json` - Fixture-only vocab copies
- `tests/fixtures/vocab/{freq,bigrams,pitfalls}-*.json` - Ancillary fixture data
- `.planning/lockdown-adapter-contract.md` - Downstream consumer contract

**Modified:**
- `extension/background/service-worker.js` - Migration-aware onInstalled handler
- `scripts/check-fixtures.js` - resolveDataFile fallback for vocab loading
- `scripts/check-benchmark-coverage.js` - Same resolveDataFile pattern
- `scripts/check-governance-data.js` - Same resolveDataFile pattern
- `scripts/check-spellcheck-features.js` - Same resolveDataFile pattern
- `scripts/check-bundle-size.test.js` - Updated to reference nb-baseline.json

**Deleted (20 files):**
- `extension/data/{de,es,fr,en,nb,nn}.json`
- `extension/data/freq-{nb,nn}.json`
- `extension/data/bigrams-{de,en,es,fr,nb,nn}.json`
- `extension/data/grammarfeatures-{de,en,es,fr,nb,nn}.json`

## Decisions Made

1. **resolveDataFile() fallback pattern** applied uniformly across check-fixtures, check-benchmark-coverage, check-governance-data, check-spellcheck-features. Avoids duplicating path logic; single function per script resolves fixture-first, legacy-second.
2. **pitfalls-en.json kept** in extension/data/ -- not on the explicit delete list; future migration to API is a separate concern.
3. **check-bundle-size.test.js Test 6 relaxed** from pretty-print invariant to valid-JSON check, since nb-baseline.json is intentionally minified for the 200 KB cap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 3 additional gate scripts that read from extension/data/**
- **Found during:** Task 1a (fixture harness migration)
- **Issue:** check-benchmark-coverage.js, check-governance-data.js, check-spellcheck-features.js all loaded vocab directly from extension/data/ -- would break after Task 1b deletions
- **Fix:** Applied same resolveDataFile() fallback pattern to all three scripts
- **Files modified:** scripts/check-benchmark-coverage.js, scripts/check-governance-data.js, scripts/check-spellcheck-features.js
- **Verification:** All gates exit 0 after deletion
- **Committed in:** 5dff21f (Task 1a commit)

**2. [Rule 3 - Blocking] Updated check-bundle-size.test.js referencing deleted nb.json**
- **Found during:** Task 1b (after deletion)
- **Issue:** Tests 1, 2, 6 in check-bundle-size.test.js referenced extension/data/nb.json (now deleted) and data/nb.json in the zip
- **Fix:** Updated to reference nb-baseline.json; relaxed Test 6 from pretty-print check to valid-JSON check
- **Files modified:** scripts/check-bundle-size.test.js
- **Verification:** All 7 self-test assertions pass
- **Committed in:** ecee335 (Task 1b commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were necessary to keep release gates functional after data deletion. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 23-05 was the final remaining plan in Phase 23. All 6 plans (01-06) are now complete.
- MIGRATE-01 satisfied: extension zip no longer contains per-language vocab; data fetched at runtime via IndexedDB bootstrap.
- Lockdown adapter contract delivered; lockdown team can pick implementation option independently.

---
*Phase: 23-data-source-migration*
*Completed: 2026-04-27*
