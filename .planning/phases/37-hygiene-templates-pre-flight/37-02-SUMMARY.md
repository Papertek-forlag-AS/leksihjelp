---
phase: 37-hygiene-templates-pre-flight
plan: 02
subsystem: infra
tags: [release-gate, ci, git, version-discipline, lockdown-resync, node-stdlib]

# Dependency graph
requires:
  - phase: 30-popup-modularization
    provides: synced-surfaces glob (extension/popup/views/ added to downstream-consumers list)
  - phase: 36-v3.1-uat-sweep-2
    provides: 12-gate release-suite pattern (check-popup-deps as canonical skeleton)
provides:
  - "check-version-alignment release gate (HYG-04) — manifest.json + package.json + backend/public/index.html version triple-source agreement, mechanically enforced"
  - "check-synced-surface-version release gate (HYG-05) — synced-surface diff since last tag without paired package.json bump = exit 1, prints [lockdown-resync-needed] copy-paste commit-message hint"
  - "Paired plant-restore self-tests for both gates with signal-safe cleanup harnesses"
  - "CLAUDE.md Release Workflow numbered list extended to 17 steps (was 15) with both new gates inserted adjacent to step 13 (3-place version bump)"
affects: [38-extension-uat-batch, 39-lockdown-sync, 40-deploy-runbooks]

# Tech tracking
tech-stack:
  added: []  # zero new runtime deps — both gates are Node stdlib only
  patterns:
    - "Three-source version-alignment regex parser (JSON.version × 2 + HTML Versjon X.Y.Z regex × 1)"
    - "Tag-baseline git-diff gate (git describe --tags --abbrev=0 + git diff <tag>..HEAD -- <paths>)"
    - "Non-destructive plant-restore self-test for git-state mutations (soft-reset preserves unrelated dirty files in working tree)"

key-files:
  created:
    - scripts/check-version-alignment.js
    - scripts/check-version-alignment.test.js
    - scripts/check-synced-surface-version.js
    - scripts/check-synced-surface-version.test.js
  modified:
    - package.json (4 new npm scripts registered)
    - CLAUDE.md (Release Workflow steps 14 + 15 inserted; zip + upload renumbered to 16 + 17)

key-decisions:
  - "Plant target for HYG-04 self-test: backend/public/index.html (lowest-risk source — display only, not consumed by build/test pipeline) per RESEARCH Pitfall 3"
  - "HYG-05 self-test uses non-destructive soft-reset (git reset --soft BEFORE_SHA) instead of --hard, so unrelated dirty files in user's working tree are preserved across self-test runs"
  - "extension/data/*.json no-exclusion: ANY git diff inside synced paths counts (per CONTEXT lock + RESEARCH Open Question 3); vocab-sync-paired-with-version-bump is the canonical pattern"
  - "[lockdown-resync-needed] commit-message hint coupled into HYG-05 failure surface — pulls HYG-06 nudge into gate diagnostic per CONTEXT decision"
  - "Both gates inserted as steps 14 + 15 of CLAUDE.md Release Workflow, adjacent to step 13 (3-place version-bump prose) — gate enforces, prose still instructs"

patterns-established:
  - "HTML version-extraction guarded against shape regression (raises on missing Versjon X.Y.Z line; future maintainers who restructure landing page get a loud failure pointing at the gate's regex)"
  - "Self-test pre-flight refusal when target file already exists with same scratch name (avoids clobbering)"
  - "Three-state cleanup tracking flags (testCommitMade, scratchFileWritten, cleanedUp) for fine-grained signal-safe rollback"

requirements-completed: [HYG-04, HYG-05]

# Metrics
duration: ~25min
completed: 2026-05-01
---

# Phase 37 Plan 02: Release-discipline gates HYG-04 + HYG-05 Summary

**Two new mechanically-enforced release gates close the prose-only "version drift" and "synced-surface re-sync" classes — drift cannot ship; lockdown re-sync trigger is no longer a discipline question.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-01 (concurrent wave-1 with plans 37-01, 37-03, 37-04)
- **Completed:** 2026-05-01
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `check-version-alignment` gate + paired self-test enforce the manifest.json / package.json / backend/public/index.html three-place version triple agreement (Release Workflow step 14)
- `check-synced-surface-version` gate + paired self-test enforce that any synced-surface change since the last release tag is paired with a `package.json` version bump (Release Workflow step 15), and prints the `[lockdown-resync-needed]` copy-paste commit-message hint on failure (couples HYG-06 nudge into the same surface)
- Both gates registered as `npm run check-*` + `:test` script pairs in `package.json`, mirroring the established 12-gate suite naming convention
- CLAUDE.md Release Workflow extended from 15 steps to 17 steps with both new entries adjacent to the existing 3-place version-bump prose step

## Task Commits

Each task was committed atomically:

1. **Task 1: check-version-alignment.js gate + self-test** — `33f6190` (feat)
2. **Task 2: check-synced-surface-version.js gate + self-test** — `6f5b6f2` (feat)
3. **Task 3: npm scripts + CLAUDE.md Release Workflow integration** — `10ad3f2` (feat)

(Note: parallel wave-1 commits from plans 37-01/37-03/37-04 are interleaved in the log; the 37-02 commits land in chronological order as listed.)

## Files Created/Modified

- `scripts/check-version-alignment.js` — HYG-04 gate. Three-source version-alignment check; exit 0 on agreement, exit 1 with per-file diagnostic + `npm version <new>` fix line on drift. HTML parser guards Pitfall-5-class shape regression.
- `scripts/check-version-alignment.test.js` — HYG-04 paired self-test. Plants `Versjon 9.9.9` drift in `backend/public/index.html` (lowest-risk source per Pitfall 3), confirms gate fires, restores. Signal-safe cleanup via saved-bytes closure variable + `process.on('exit'/SIGINT/uncaughtException)`.
- `scripts/check-synced-surface-version.js` — HYG-05 gate. `git describe --tags --abbrev=0` baseline, `git diff --name-only <tag>..HEAD -- <synced-paths>` change set, `git show <tag>:package.json` version comparison. Prints `[lockdown-resync-needed]` copy-paste hint on failure.
- `scripts/check-synced-surface-version.test.js` — HYG-05 paired self-test. Pre-flight rejects pre-existing scratch file. Plants scratch synced-surface commit, confirms gate fires + prints hint, unwinds non-destructively via `git reset --soft BEFORE_SHA` (preserves any unrelated dirty files in working tree per design — this self-test is safe to run mid-development).
- `package.json` — 4 new npm script entries grouped with the rest of the `check-*` cluster.
- `CLAUDE.md` — Release Workflow steps 14 + 15 inserted; zip + upload renumbered 16 + 17. Each new entry follows existing format: gate command + paired `:test` reference + "Why this gate exists" paragraph.

## Decisions Made

- **Plant target for HYG-04 self-test:** `backend/public/index.html` (per RESEARCH Pitfall 3). Lowest-risk of the three sources — display only, not consumed by build/test pipeline. `package.json` and `manifest.json` are both touched by `npm version` and would be dangerous to plant against.
- **HYG-05 cleanup is non-destructive:** Originally drafted with `git reset --hard BEFORE_SHA`, but that would clobber any pre-existing dirty files (e.g. `.planning/config.json` in this very session was modified). Switched to `git reset --soft BEFORE_SHA` + targeted unstage + unlink. This preserves the contract that "running a self-test never destroys user work" — applies even when the user is mid-development with uncommitted changes.
- **`extension/data/*.json` no-exclusion:** Honored CONTEXT lock + RESEARCH Open Question 3. Yes, this means `npm run sync-vocab` produces a "noisy" gate failure unless paired with a version bump — but vocab-sync-with-version-bump is the canonical pattern, and the noise floor is the right tradeoff.
- **`[lockdown-resync-needed]` hint inside HYG-05 gate output:** Per CONTEXT, the HYG-06 nudge is mechanically pulled into the surface where developers will actually see it — at gate-failure time, with the marker in copy-pastable form, exactly when they're about to commit.
- **CLAUDE.md placement:** Steps 14 + 15 (right after the prose 3-place bump at step 13). Gate enforces; prose still instructs. The two reinforce each other rather than duplicating.

## Deviations from Plan

None - plan executed exactly as written.

The one judgment call (HYG-05 cleanup mechanism: `--soft` instead of `--hard`) was a pre-emptive correction to avoid clobbering the user's mid-development dirty files; it materially improves the self-test's safety contract without changing the planned acceptance criteria. Documented in Decisions Made above.

## Issues Encountered

- **Cleanup safety in HYG-05 self-test:** Initial draft used `git reset --hard` for cleanup robustness, but that would have clobbered pre-existing `git status` dirty files in this very session. Resolved by switching to non-destructive `--soft` reset + targeted unstage + unlink, with three-state cleanup tracking flags (`testCommitMade`, `scratchFileWritten`, `cleanedUp`) to handle every signal path correctly.

## Self-Check: PASSED

- Files exist:
  - `scripts/check-version-alignment.js` — present
  - `scripts/check-version-alignment.test.js` — present
  - `scripts/check-synced-surface-version.js` — present
  - `scripts/check-synced-surface-version.test.js` — present
- npm scripts registered in package.json: `check-version-alignment`, `check-version-alignment:test`, `check-synced-surface-version`, `check-synced-surface-version:test`
- CLAUDE.md grep matches: `check-version-alignment` ✓, `check-synced-surface-version` ✓, `lockdown-resync-needed` ✓
- All 4 commands exit 0 against current state
- Commits found in `git log`: 33f6190, 6f5b6f2, 10ad3f2
- Working tree under synced paths is clean

## User Setup Required

None — both gates are zero-runtime-dep Node stdlib scripts; no external services, no credentials.

## Next Phase Readiness

- Phase 38 (extension UAT batch) can now rely on `npm run check-version-alignment` + `npm run check-synced-surface-version` as part of pre-walk pre-flight if desired. Both gates are complementary to (not blocking on) Phase 37 plan 03 (`check-vocab-deployment`) and plan 04 (`[lockdown-resync-needed]` documentation).
- The release-gate suite is now 14 entries (was 12). Future gate additions should follow the same `scripts/check-*.js` + `.test.js` + `package.json` registration + `CLAUDE.md` Release Workflow numbered-list-step pattern these two extend.

---
*Phase: 37-hygiene-templates-pre-flight*
*Completed: 2026-05-01*
