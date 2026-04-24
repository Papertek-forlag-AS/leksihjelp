---
phase: 06-structural-infrastructure-register-stylistic-polish
plan: 02
subsystem: infra
tags: [release-gates, benchmark, governance-data, self-tests]

requires:
  - phase: 05-ux-polish-popover-nynorsk-css
    provides: "Existing release gate patterns (check-explain-contract, check-network-silence, check-spellcheck-features)"
provides:
  - "INFRA-08: check-benchmark-coverage release gate with expectations manifest"
  - "INFRA-09: check-governance-data release gate for governance bank shape validation"
  - "Both gates pass in pre-data state, ready to enforce as data lands"
affects: [06-03, benchmark-texts, papertek-vocabulary-sync]

tech-stack:
  added: []
  patterns: ["Expectations manifest (JSON) for benchmark flip-rate tracking", "Pre-data-sync pass-through gate pattern"]

key-files:
  created:
    - scripts/check-benchmark-coverage.js
    - scripts/check-benchmark-coverage.test.js
    - scripts/check-governance-data.js
    - scripts/check-governance-data.test.js
    - benchmark-texts/expectations.json
  modified:
    - package.json
    - CLAUDE.md

key-decisions:
  - "Empty expectations.json passes gate (ship-before-populate strategy)"
  - "Governance gate uses pass-through when no banks exist (pre-data-sync tolerance)"
  - "Per-priority-band (P1/P2/P3) flip-rate reporting is informational, gate fails on ANY miss"

patterns-established:
  - "Benchmark expectations manifest: entries keyed by lang.line_number, gate validates rule firings"
  - "Governance shape validation: bank-specific required-fields schema (registerbank=word+formal, collocationbank=trigger+fix, phrasebank=trigger+suggestion)"

requirements-completed: [INFRA-08, INFRA-09]

duration: 4min
completed: 2026-04-24
---

# Phase 06 Plan 02: Release Gates Summary

**Two new release gates (benchmark-coverage + governance-data) with paired self-tests and expectations manifest, registered in package.json and CLAUDE.md Release Workflow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-24T19:02:54Z
- **Completed:** 2026-04-24T19:06:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- check-benchmark-coverage gate reads expectations.json, runs spell-check per benchmark line, validates expected rule flips with per-band reporting
- check-governance-data gate validates registerbank/collocationbank/phrasebank shape when present, passes in pre-data-sync state
- Both gates have paired self-tests proving they fire on broken input and pass on valid input
- Both registered in package.json (4 new scripts) and CLAUDE.md Release Workflow (steps 7-8)

## Task Commits

Each task was committed atomically:

1. **Task 1: check-benchmark-coverage gate + self-test + expectations manifest** - `2cedc89` (feat)
2. **Task 2: check-governance-data gate + self-test + package.json + CLAUDE.md registration** - `8cddf14` (feat)

## Files Created/Modified
- `benchmark-texts/expectations.json` - Machine-checkable manifest of expected benchmark flips (empty, ready for Plan 03)
- `scripts/check-benchmark-coverage.js` - INFRA-08 gate: validates rule flips per benchmark line with priority-band reporting
- `scripts/check-benchmark-coverage.test.js` - Paired self-test: broken expectation exits 1, empty exits 0
- `scripts/check-governance-data.js` - INFRA-09 gate: validates governance bank presence and shape
- `scripts/check-governance-data.test.js` - Paired self-test: broken shape exits 1, valid shape exits 0, no-data baseline exits 0
- `package.json` - Added 4 new npm scripts
- `CLAUDE.md` - Added steps 7-8 to Release Workflow, renumbered subsequent steps

## Decisions Made
- Empty expectations.json passes the gate, allowing it to ship before Plan 03 populates expectations
- Governance gate uses pass-through when no governance banks exist in any language data file
- Per-priority-band flip-rate percentages are printed for phase-close decisions but the gate fails on ANY missed expectation regardless of band

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both gates ready to enforce constraints as Plan 03 lands rules and populates expectations
- Governance gate ready for when papertek-vocabulary syncs governance banks
- Release Workflow steps correctly ordered and numbered

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (2cedc89, 8cddf14) verified in git log.
