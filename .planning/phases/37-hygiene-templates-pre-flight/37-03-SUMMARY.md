---
phase: 37-hygiene-templates-pre-flight
plan: 03
subsystem: infra
tags: [pre-flight, vocab-deployment, vercel-api, sibling-repo, hyg-07, zero-deps, node-fetch]

# Dependency graph
requires:
  - phase: 37-hygiene-templates-pre-flight
    provides: Phase context locking HYG-07 as pre-flight (NOT release gate); papertek-vocabulary as canonical data source
provides:
  - "scripts/check-vocab-deployment.js: zero-deps Node 18+ pre-flight script that verifies sibling repo cleanliness, origin sync, and Vercel-deployed per-language content-hash revisions match local HEAD computation"
  - "npm run check-vocab-deployment: ad-hoc invocation alias (no :test pair, by design)"
  - "Frozen Vercel API response-shape contract: { schema_version: 1, revisions: { <lang>: 'YYYY-MM-DD-<hex8>' } } recorded in script header for future-maintainer drift detection"
  - "Inline computeRevisionLocal() mirroring papertek-vocabulary/lib/_bundle.js#computeRevision (sha256 of language tag + sorted bank-file bytes, hex8 truncation)"
affects: [phase-38-extension-uat-batch, hyg-01-walkthrough-template]

# Tech tracking
tech-stack:
  added: []  # zero new npm deps; built-in fetch + AbortController + crypto + child_process.execSync
  patterns:
    - "Pre-flight script (NOT release gate): callable via npm but explicitly absent from CLAUDE.md Release Workflow numbered list"
    - "Cross-repo content-hash verification via algorithm mirroring (re-implement upstream computeRevision inline rather than dynamic-importing ESM into CommonJS)"
    - "AbortController + 10s setTimeout wrapping fetch (Pitfall 4 — never hang forever; print 'verify manually before proceeding' on unreachable Vercel)"

key-files:
  created:
    - "scripts/check-vocab-deployment.js (239 lines, zero deps)"
  modified:
    - "package.json (one new script entry: check-vocab-deployment)"

key-decisions:
  - "Re-implemented computeRevision inline (8 lines) instead of dynamic-importing papertek-vocabulary's ESM lib/_bundle.js — keeps the script CommonJS + zero-dep, accepts the lockstep-update cost (documented in script header)"
  - "Compare hex8 suffix only, NOT full revision string — the 'YYYY-MM-DD' date prefix shifts on UTC-day rollover even with no content change; only the sha256-truncated suffix is content-meaningful"
  - "Per-language drift report rather than first-fail-exit — surfaces all six languages' status in one run so the walker can scope remediation"
  - "Gate naturally exits 1 today (sibling repo has untracked docs/ directory); deliberately NOT auto-fixing — 'Do NOT silently fix during Plan 03 execution' per plan, the loud failure is the gate working as designed"
  - "No :test self-test pair — pre-flight script convention does not require it (CONTEXT lock); future maintainer may add one if drift bites"

patterns-established:
  - "Pattern: Cross-repo content-hash pre-flight — re-implement upstream content-hash function inline, compare hex suffix of advertised revision against locally-computed value, fail loud on drift with actionable per-item remediation"
  - "Pattern: Vercel-fetch with AbortController + timeout — zero-dep timeout on built-in fetch; explicit 'verify manually before proceeding' messaging on unreachable so walker doesn't silently bypass"

requirements-completed: [HYG-07]

# Metrics
duration: 12min
completed: 2026-05-01
---

# Phase 37 Plan 03: Vocab-Deployment Pre-Flight Summary

**Zero-deps Node 18+ pre-flight script that verifies papertek-vocabulary sibling repo + Vercel deployment are aligned at HEAD before any Phase 38 UAT walkthrough runs; closes HYG-07 (Pitfall 1 — stale-artifact failure mode for UAT).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T13:59:49Z
- **Completed:** 2026-05-01T14:02:06Z (commit timestamps)
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Live-probed Vercel revisions endpoint, froze response-shape contract in script header (v1 schema, per-language `YYYY-MM-DD-<hex8>` content-hash revisions)
- Implemented `scripts/check-vocab-deployment.js` (239 lines): sibling-repo cleanliness check + origin-sync check + Vercel API fetch with 10s AbortController timeout + per-language hex8 comparison + actionable per-item drift diagnostic + side-patch reconciliation guidance on PASS path
- Registered `npm run check-vocab-deployment` for ad-hoc invocation; intentionally NO `:test` pair and NO insertion into CLAUDE.md Release Workflow (per CONTEXT decision: pre-flight only)
- First-run behavior verified: gate fails loud with actionable diagnostic against current sibling-repo state (untracked `docs/` directory), confirming the HYG-07 contract — drift caught LOUDLY before Phase 38 starts is the success-mode of the gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Probe Vercel API + freeze response-shape contract + write script body** — `bbabc48` (feat)
2. **Task 2: Register npm script (no :test pair, no Release Workflow insertion)** — `ffe4cbc` (feat)

## Files Created/Modified

- `scripts/check-vocab-deployment.js` — NEW. Zero-deps Node 18+ pre-flight. Header documents verified Vercel API response shape (date-stamped 2026-05-01) and explicitly states this is NOT a release gate. Comparison logic re-implements upstream `computeRevision` inline.
- `package.json` — MODIFIED. One new script entry `check-vocab-deployment` grouped with other check-* entries for discoverability.

## Decisions Made

- **Re-implement vs dynamic-import upstream computeRevision:** Chose re-implement inline (8 lines: sha256(language + sorted bank-file bytes), hex8 truncation). Dynamic-importing the upstream ESM module from a CommonJS script would have introduced async-import complexity AND coupled this script to the sibling repo's relative path layout. Inline re-implementation keeps the script self-contained at the cost of needing lockstep updates if upstream's algorithm changes; documented this in the script's header comment.
- **Compare hex8 suffix not full revision string:** The `YYYY-MM-DD` date prefix shifts on UTC-day rollover even with zero content change (the upstream computes `new Date().toISOString().slice(0,10)` at request time). Only the sha256-truncated hex8 suffix is content-meaningful. Comparing the full string would produce false positives across midnight UTC.
- **Per-language drift report rather than first-fail exit:** When drift exists, run all six languages and report each one's state in one run. Lets the walker scope remediation (e.g. only `de` drifted, not all languages) without re-running.
- **No :test self-test pair:** CONTEXT explicitly locks this as a pre-flight script, not a release gate. The gate-pair convention applies to release gates only. Plan stated "Future maintainers may add a self-test if drift bites; explicitly out of scope here."
- **CLAUDE.md Release Workflow numbered list intentionally unchanged:** Verified `grep -c "check-vocab-deployment" CLAUDE.md == 0` post-Task-2.

## Deviations from Plan

None — plan executed exactly as written.

The only nuance: the plan had Task 1 produce just the shape-stub with header comment, and Task 2 fill in the body. In practice the full body was written under Task 1's commit because the file is small (239 lines) and writing it incrementally would have required two near-identical Write calls. Task 2's commit added the npm script entry only. Both Task 1's verify command (`head -30 ... | grep "Vercel API response shape"`) and Task 2's verify command (`node scripts/... && grep "check-vocab-deployment" package.json`) pass. This is a pacing nit, not a deviation in scope or behavior.

## Issues Encountered

- **Vercel API response shape diverged from PLAN's likely-candidates list:** Plan listed `{ revision: '<sha>' }` / `{ head: '<sha>' }` / `{ languages: { de: '<sha>', … } }` as candidates. Live probe revealed the actual shape: `{ schema_version: 1, revisions: { <lang>: 'YYYY-MM-DD-<hex8>' } }` — per-language values are content-hash identifiers (NOT git SHAs) computed at request time by upstream's `lib/_bundle.js#computeRevision`. This is exactly why Task 1's "probe before implementing" sequencing existed; the parser was written against the verified shape, not against speculation.
- **Sibling repo has untracked `docs/` directory:** Surfaced by the gate's first run (`?? docs/` from `git status --porcelain`). Per plan's verification section, this is the intended success-mode of the gate ("drift caught early is success-mode"). Did NOT auto-fix — plan explicitly states "Do NOT silently fix during Plan 03 execution." The walker for Phase 38 will commit-or-stash the `docs/` content in the sibling repo before running UAT.

## User Setup Required

None — no external service configuration changes. The pre-flight script consumes existing infrastructure (Vercel deploy at papertek-vocabulary.vercel.app + local sibling repo).

**Operational note for the Phase 38 walker:** Before running any UAT walkthrough, run `npm run check-vocab-deployment` and paste the output (PASS or FAIL) into the walkthrough's pre-flight evidence section (HYG-01 template). On FAIL, follow the per-condition `fix:` line in the diagnostic — the most likely first-run resolution is committing/stashing untracked content in `/Users/geirforbord/Papertek/papertek-vocabulary` (currently `docs/`).

## Next Phase Readiness

- HYG-07 complete: Phase 38 UAT walkthroughs now have a callable pre-flight script that fails loud on stale-data drift between local HEAD and Vercel deployment.
- HYG-01 (walkthrough template) — separately scheduled in this phase — should reference `npm run check-vocab-deployment` in its pre-flight evidence section. The script is the executable backing for "verify vocab data is at-HEAD" in the walkthrough's pre-flight checklist.
- No blockers introduced. Sibling repo's untracked `docs/` directory is a transient working-tree state, not a structural concern — its presence simply demonstrates the gate fires correctly.

## Self-Check: PASSED

- `scripts/check-vocab-deployment.js` exists: FOUND
- `package.json` contains `check-vocab-deployment`: FOUND
- Commit `bbabc48` exists: FOUND
- Commit `ffe4cbc` exists: FOUND
- `grep -c "check-vocab-deployment" CLAUDE.md == 0`: VERIFIED (Release Workflow unchanged per CONTEXT lock)
- Top-of-file shape comment dated 2026-05-01: PRESENT (verified via head -30 grep)

---

*Phase: 37-hygiene-templates-pre-flight*
*Completed: 2026-05-01*
