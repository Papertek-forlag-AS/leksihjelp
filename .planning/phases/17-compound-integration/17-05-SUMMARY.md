---
phase: 17-compound-integration
plan: 05
subsystem: spell-check
tags: [compound-decomposition, sarskriving, false-positive, nounGenus, lemma]

# Dependency graph
requires:
  - phase: 16-decomposition-engine
    provides: decomposeCompound function and nounGenus map
  - phase: 17-compound-integration (plans 01-04)
    provides: sarskriving decomposition fallback wiring
provides:
  - nounLemmaGenus map (base-form nouns only, no inflected forms)
  - decomposeCompoundStrict bound function using lemma-only map
  - Sarskriving rule prefers strict decomposition to avoid inflected-form FPs
affects: [19-sarskriving-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns: [lemma-only-index-for-strict-decomposition]

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - extension/content/spell-rules/nb-sarskriving.js

key-decisions:
  - "nounLemmaGenus excludes nounform, plural, and typo entries -- only base-form nouns with genus"
  - "Sarskriving rule uses decomposeCompoundStrict with fallback to decomposeCompound for backward compatibility"

patterns-established:
  - "Strict vs loose decomposition: use nounLemmaGenus for rules that need high precision, nounGenus for broader coverage"

requirements-completed: [COMP-07]

# Metrics
duration: 7min
completed: 2026-04-26
---

# Phase 17 Plan 05: Sarskriving Decomposition FP Fix Summary

**Lemma-only nounGenus map (2124 vs 9484 entries) eliminates inflected-form false positives in sarskriving compound decomposition**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-26T08:51:13Z
- **Completed:** 2026-04-26T08:59:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added nounLemmaGenus map with 2124 base-form noun entries (vs 9484 in full nounGenus) that excludes inflected definite forms (boken, skolen), plurals, and typos
- decomposeCompoundStrict("skolenboken") correctly returns null where the loose version returned high confidence -- the root cause of 12 suite regressions
- Sarskriving suite preserved at P=1.000 R=1.000 87/87 (NB) and 78/78 (NN)
- Recovered passing cases in nb/modal (17/17), nb/typo (30/30), nb/v2 (96/96), nn/modal (16/16)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add nounLemmaGenus map and decomposeCompoundStrict to vocab-seam-core.js** - `9f27eee` (feat)
2. **Task 2: Wire decomposeCompoundStrict through vocab-seam.js, spell-check.js, and nb-sarskriving.js** - `bd22210` (fix)

## Files Created/Modified
- `extension/content/vocab-seam-core.js` - Added nounLemmaGenus map and decomposeCompoundStrict bound function
- `extension/content/vocab-seam.js` - Added getDecomposeCompoundStrict getter
- `extension/content/spell-check.js` - Passed decomposeCompoundStrict in vocab object to rules
- `extension/content/spell-rules/nb-sarskriving.js` - Sarskriving prefers strict decomposition with fallback

## Decisions Made
- nounLemmaGenus filters to `entry.bank === 'nounbank' && entry.type !== 'typo' && entry.type !== 'nounform' && entry.type !== 'plural'` -- this excludes all inflected forms that caused false positives while retaining all base-form nouns needed for valid compound detection
- Fallback `|| vocab.decomposeCompound` in sarskriving ensures backward compatibility during partial updates

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Failures (Out of Scope)

check-fixtures exits 1 both before and after this plan due to pre-existing sarskriving false positives from base-form noun pairs (e.g., "Far arbeider", "glass vann", "lage mat"). These are NOT caused by this plan's changes (they fire on base-form nouns present in nounLemmaGenus). This plan strictly improved results: nb/clean 17/19 -> 18/19, nb/v2 91/96 -> 96/96, etc. The remaining FPs are deferred to Phase 19 (sarskriving expansion) per Pitfall 4.

## Release Gate Results

| Gate | Result |
|------|--------|
| check-fixtures | exit 1 (pre-existing, not regressed) |
| check-network-silence | PASS |
| check-explain-contract | PASS |
| check-rule-css-wiring | PASS |
| check-spellcheck-features | PASS |
| check-bundle-size | PASS (12.48 MiB) |
| check-benchmark-coverage | PASS (40/40) |
| check-governance-data | PASS |

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Strict decomposition infrastructure ready for Phase 19 sarskriving expansion
- Base-form FPs ("Far arbeider", "glass vann") will need contextual disambiguation (verb/noun POS) in Phase 19

## Self-Check: PASSED

All 4 modified files exist. Both task commits (9f27eee, bd22210) verified in git log.

---
*Phase: 17-compound-integration*
*Completed: 2026-04-26*
