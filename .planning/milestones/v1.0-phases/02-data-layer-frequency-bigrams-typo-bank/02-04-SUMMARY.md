---
phase: 02-data-layer-frequency-bigrams-typo-bank
plan: 04
subsystem: infra
tags: [release-gate, bundle-size, minification, json, zip, tooling, ci-gate]

# Dependency graph
requires:
  - phase: 02-01
    provides: extension/data/freq-{nb,nn}.json (frequency sidecars measured in zip)
  - phase: 02-02
    provides: extension/data/bigrams-{nb,nn}.json (regrown bigrams measured in zip)
  - phase: 02-03
    provides: extension/data/{nb,nn}.json (+62.7% expanded typo bank measured in zip)
provides:
  - scripts/check-bundle-size.js (permanent 10 MiB release gate)
  - scripts/package-extension.js (minifying package helper; staging-dir pattern)
  - Release Workflow step 2 wired into CLAUDE.md (check-bundle-size)
  - Authoritative post-minification byte breakdown for Phase 2.1 product decision
affects: [phase-02.1, phase-03, phase-04, all future release cuts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staging-dir pattern: .package-staging/ gitignored copy of extension/ where destructive transforms (minification) run without touching the source tree"
    - "Release-gate pattern: npm script that runs the build, measures the output, prints a diagnostic breakdown, and exits 0/1 against a hard numeric ceiling"
    - "TDD for release tooling: scripts/check-bundle-size.test.js as an executable behavior-test harness (10 tests) alongside the scripts it exercises — matches the project's check-fixtures.js convention"

key-files:
  created:
    - scripts/package-extension.js
    - scripts/check-bundle-size.js
    - scripts/check-bundle-size.test.js
  modified:
    - package.json
    - .gitignore
    - CLAUDE.md
    - .planning/STATE.md

key-decisions:
  - "Outcome B triggered — post-minification zip is 10,599,772 bytes (10.11 MiB), 114,012 bytes over the 10 MiB cap. The gate ships and correctly exits 1; Phase 2 SC-4 closes as a documented Blocker; Phase 2.1 queued for the product decision."
  - "Staging-dir pattern (.package-staging/) chosen over in-tree minify-then-revert — cleaner, no transient source-tree damage if the process is killed mid-run, and zero risk of a contributor ever committing a minified extension/data/*.json."
  - "execFileSync('zip', ...) over execSync with shell — argv-style invocation is safer (no shell metacharacter escaping bugs) and matches the project's existing Node-tool convention."
  - "Per-directory breakdown reports UNCOMPRESSED bytes inside the zip (via unzip -l) rather than compressed — diagnostic value is higher (tells you where the raw bytes live, which is what you remediate)."
  - "unzip -l date regex accepts BOTH MM-DD-YYYY (macOS) and YYYY-MM-DD (common Linux) — cross-platform-safe for dev + CI."
  - "Bundle-size gate runs npm run package itself (self-sufficient) rather than requiring the caller to package first — matches the principle of a release check being trivially invokable from a clean state."

patterns-established:
  - "Release-ritual gates live in scripts/check-*.js and are wired into CLAUDE.md's Release Workflow as numbered steps with must-exit-0 semantics."
  - "Destructive build-time transforms run in .package-staging/ (gitignored), never in extension/."
  - "Outcome-B-is-valid pattern: when a plan ships infrastructure that MEASURES a criterion, the infrastructure itself is the deliverable — reporting FAIL is a valid plan outcome, not a plan failure, as long as the failure is authoritatively recorded in STATE.md for the follow-up phase to work from."

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 5 min
completed: 2026-04-18
---

# Phase 2 Plan 4: Release Gate (Bundle Size + Minification) Summary

**10 MiB bundle-size release gate with JSON minification pipeline — ships the permanent infrastructure; current post-minification zip is 10.11 MiB (114 KB over cap), Outcome B triggered, Phase 2 SC-4 closes as a documented Blocker with authoritative per-directory breakdown for Phase 2.1.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-18T19:34:56Z
- **Completed:** 2026-04-18T19:40:25Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2 docs)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `scripts/check-bundle-size.js` — permanent release gate enforcing the 10 MiB (10,485,760 byte) cap from ROADMAP success criterion #4. Runs `npm run package`, measures the zip with `fs.statSync`, parses `unzip -l` for a per-directory uncompressed-byte breakdown, prints sorted top-to-bottom, exits 0 (PASS, reports headroom) or 1 (FAIL, reports overage + remediation hint).
- `scripts/package-extension.js` — replacement package helper. Uses `.package-staging/` (gitignored) as a scratch copy of `extension/`, minifies every `data/*.json` file there via `JSON.stringify(JSON.parse(raw))`, then shells out to `zip -r -X -q` to produce `backend/public/lexi-extension.zip`. Try/finally always cleans staging. Source tree `extension/data/*.json` stays pretty-printed (verified: nb.json still 249,030 lines).
- `scripts/check-bundle-size.test.js` — TDD harness, 10 behavior tests covering script existence, `package.json` wiring, `.gitignore` entry, minification in zip, source-tree invariant, end-to-end `check-bundle-size` run, exit-code-matches-bytes, per-directory breakdown printed. All 10 pass.
- `CLAUDE.md` Release Workflow expanded from 4 numbered steps to 5 — new step 2 wires `npm run check-bundle-size` between `check-fixtures` (step 1) and the version bump (step 3). Trailing sentence reminds contributors never to minify `extension/data/*.json` in-tree.
- `.planning/STATE.md` bundle-size contingency entry updated with observed 10,599,772 bytes (10.11 MiB), 114,012-byte overage, full per-directory breakdown, and five remediation candidates for the Phase 2.1 product decision.
- Fixture regression suite still green (132/132 pass, all classes F1=1.000) — this plan ships only release tooling, no runtime changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bundle-size gate + JSON minification at package time (TDD)** — two commits:
   - `f2bf1f2` (test) — RED: 10 failing behavior tests
   - `522f159` (feat) — GREEN: scripts/package-extension.js, scripts/check-bundle-size.js, wired package.json + .gitignore + STATE.md; outcome B triggered (10.11 MiB)
2. **Task 2: CLAUDE.md Release Workflow update** — `34f7f52` (docs) — new step 2 (check-bundle-size) + renumbered 3..5 + trailing minification-ownership sentence

## Files Created/Modified

- `scripts/package-extension.js` — CREATED. Staging-dir pattern package helper. 130 lines.
- `scripts/check-bundle-size.js` — CREATED. Bundle-size release gate. 140 lines.
- `scripts/check-bundle-size.test.js` — CREATED. TDD behavior-test harness. 150 lines.
- `package.json` — MODIFIED. `"package"` now delegates to helper; new `"check-bundle-size"` npm script registered.
- `.gitignore` — MODIFIED. `.package-staging/` entry added (under the existing `corpus/` block).
- `CLAUDE.md` — MODIFIED. Release Workflow: 4 → 5 steps, new step 2 (check-bundle-size), trailing sentence on minification ownership. Papertek Vocabulary section untouched (Plan 02-03 still reads the same way).
- `.planning/STATE.md` — MODIFIED. Phase-2.1 bundle-size contingency entry updated with authoritative post-minification numbers.

## Outcome

**Outcome B — minification-alone is insufficient. Gate SHIPS, Phase 2 SC-4 is a documented Blocker, Phase 2.1 is queued.**

- **Final zip size:** 10,599,772 bytes = **10.11 MiB** (cap: 10,485,760 bytes = 10.00 MiB)
- **Overage:** 114,012 bytes (0.11 MiB)
- **`npm run check-bundle-size` exit:** 1 (intended signal; gate is working as designed)
- **`npm run check-fixtures` exit:** 0 (132/132 pass — no runtime regression from this plan)

### Per-directory byte breakdown (uncompressed bytes inside zip)

| Directory     | Bytes       | MiB      |
|---------------|------------:|---------:|
| `data/`       |  21,856,696 |  20.84   |
| `audio/`      |   8,039,582 |   7.67   |
| `content/`    |     179,644 |   0.17   |
| `popup/`      |      98,763 |   0.09   |
| `styles/`     |      45,712 |   0.04   |
| `i18n/`       |      27,290 |   0.03   |
| `background/` |      12,073 |   0.01   |
| `(root)`      |       1,937 |   0.00   |
| `assets/`     |       1,340 |   0.00   |
| **TOTAL**     |**30,263,037**|**28.86** |

The zip compresses roughly 2.9× end-to-end (28.86 MiB uncompressed → 10.11 MiB zipped).

### Minification savings

The minification step saved **13,891,114 bytes (13.25 MiB) of whitespace pre-zip**, stripped from 15 `data/*.json` files in the staging dir before zipping. This is what allowed the zip to compress from the pre-Phase-2 baseline of 10.26 MiB down to only 10.11 MiB despite the new data additions (freq-{nb,nn}.json ~370 KB, bigrams-{nb,nn}.json ~300 KB, +62.7% larger typo arrays). Without minification the zip would be materially larger. The 114 KB gap over cap is SMALL — inside the noise of one Phase 2.1 product decision.

### STATE.md contingency delta

The existing Phase-2.1 contingency entry in `.planning/STATE.md` Blockers/Concerns was rewritten as follows (now records authoritative observed numbers rather than speculative "may not be enough"):

> **Phase 2 bundle-size 10 MiB ceiling contingency — OUTCOME B TRIGGERED 2026-04-18:** Plan 02-04 shipped the `check-bundle-size` gate + JSON minification pipeline (minified 15 data/*.json files, saved 13,891,114 bytes of whitespace pre-zip). **Post-minification observation 2026-04-18:** packaged zip = 10,599,772 bytes = 10.11 MiB; over the 10,485,760 byte cap by 114,012 bytes (0.11 MiB). Per-directory breakdown ...

Full entry in STATE.md captures all five Phase-2.1 remediation candidates (audio stripping, `en.json` audit, audio deduplication, vocab trimming, explicit ceiling bump with user sign-off).

### Remediation candidates for Phase 2.1 (product decision, OUT OF SCOPE for 02-04)

Listed smallest-impact → largest-impact:

1. **Audit `extension/data/en.json`** (4.65 MB source). CLAUDE.md lists supported languages as `de`, `es`, `fr` for foreign-language learning — English is not on that list. If `en.json` is dead weight not consumed by any runtime code path, removing it alone would clear the cap by ~30×. Needs a quick grep of `extension/content/*.js` and `extension/popup/*.js` to confirm.
2. **Drop a subset of `audio/de/*`**. `audio/` is 7.67 MiB uncompressed; each German sample that has an ElevenLabs voice equivalent is redundant when the user has a Vipps subscription. Could trim to only the offline-fallback subset.
3. **Strip bundled `audio/de/` entirely and fetch on first play, caching in IndexedDB.** Saves ~8 MiB uncompressed. Breaks the offline German TTS pledge for users who never played the word before going offline; acceptable if the first-play download is backgrounded.
4. **Trim rarely-used noun/verb conjugation branches from `data/de.json`** (8.5 MB source, largest single file). Requires calibration: how many lookups actually hit the trimmed branches in production?
5. **Explicit ceiling bump** (e.g., 10 MB → 12 MB) with user sign-off AND a landing-page copy update. The publicly-stated promise becomes the new number.

### Release Workflow step number for future reference

`npm run check-bundle-size` is **Release Workflow step 2** (between step 1 `check-fixtures` and step 3 version bump). Future plans that want to cross-reference the gate in CLAUDE.md can link to this step number.

## Decisions Made

- **Outcome B accepted over silent-bypass** — the 114 KB overage could in principle be hidden by bumping `CEILING_BYTES` in the script, but that would violate the plan's explicit instruction (and the publicly-stated 10 MB promise on the landing page). Gate ships and correctly fails; Phase 2.1 does the product work.
- **Staging-dir pattern over in-tree minify-then-revert** — lower risk of transient corruption, zero risk of a minified JSON being committed by accident.
- **`execFileSync('zip', ...)` over `execSync('zip ...')`** — argv-style invocation is safer (no shell metacharacter escaping), matches Node-tool conventions in the rest of the codebase.
- **Per-directory breakdown reports UNCOMPRESSED bytes** — tells reviewers where the raw data lives, which is what you actually remediate.
- **unzip -l date regex accepts both US and ISO formats** — defensive for macOS dev + Linux CI.
- **Bundle-size gate self-packages** — the script invokes `npm run package` itself rather than requiring the caller to package first. Matches the release-check principle of trivial invocation from a clean state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `unzip -l` date regex too strict for macOS date format**
- **Found during:** Task 1 GREEN iteration (initial 10-test run; 9/10 passed, breakdown test failed)
- **Issue:** Initial regex hard-coded `YYYY-MM-DD` ISO date format for `unzip -l` output parsing. macOS's `unzip` emits `MM-DD-YYYY`, so zero directory lines matched → breakdown printed empty with `TOTAL 0 bytes`.
- **Fix:** Broadened regex from `^\s*(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+?)\s*$` to `^\s*(\d+)\s+\d{2,4}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}\s+(.+?)\s*$` — accepts both MM-DD-YYYY (macOS) and YYYY-MM-DD (Linux), tolerates both `-` and `/` separators.
- **Files modified:** scripts/check-bundle-size.js
- **Verification:** 10/10 behavior tests pass after fix; per-directory breakdown prints 9 directories sorted by size.
- **Committed in:** 522f159 (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] `spawnSync /bin/sh ENOBUFS` in Test 2 probe**
- **Found during:** Task 1 RED-to-GREEN iteration
- **Issue:** Initial test harness used `execSync` with default `maxBuffer` (1 MB) to pipe `unzip -p data/nb.json` (~6 MB) into a Node JSON.parse validator. Pipe blew the 1 MB buffer with `ENOBUFS`.
- **Fix:** Bumped `maxBuffer` to 64 MiB in the harness's `run()` helper AND in all `spawnSync` calls that capture `check-bundle-size.js` stdout (which prints the full breakdown + itself invokes a large `unzip -l`).
- **Files modified:** scripts/check-bundle-size.test.js
- **Verification:** All 10 behavior tests pass; Test 2 validates minified JSON parses correctly without buffer issues.
- **Committed in:** 522f159 (Task 1 GREEN commit, alongside the regex fix)

---

**Total deviations:** 2 auto-fixed (2 × Rule 3 Blocking — both were platform/buffer portability issues, not design flaws)
**Impact on plan:** Zero scope creep. Both fixes are necessary for the script to work reliably on macOS and on large data files. Both are generally-applicable portability improvements, not workarounds.

## Issues Encountered

- **Plan's verify.automated awk range is self-collapsing.** The plan's Task 2 verify used `awk '/^## Release Workflow/,/^## /'` which matches zero lines because the first line (`## Release Workflow`) itself also matches `^## `, closing the range immediately. Worked around with `sed -n '/^## Release Workflow/,/^## Papertek/p'` (anchors at known-next-section) which correctly returned 5 numbered steps — matching the plan's expected `>=5 && <=8` range. Minor plan-authoring glitch, not an implementation issue.
- **Outcome B triggered (not an "issue" in the failure sense — the plan explicitly anticipated this as a valid outcome).** Current zip is 114 KB over cap after minification. Plan 02-04 ships the permanent gate regardless; Phase 2 SC-4 closes as a documented Blocker with full post-minification numbers in STATE.md; Phase 2.1 queued for the product decision (audio stripping / `en.json` audit / vocab trimming / ceiling bump with user sign-off).

## User Setup Required

None — no external service configuration required. Release workflow uses existing local tooling (`npm`, system `zip`, system `unzip`).

## Next Phase Readiness

- **Ready for Phase 3 (autocomplete + prediction):** The bundle-size gate is permanent infrastructure and does NOT block Phase 3 work — Phase 3 adds runtime code paths (word prediction using freq + bigrams sidecars), not new data, so it won't push the zip further over cap. Phase 3 can proceed in parallel with Phase 2.1 if needed.
- **Ready for Phase 2.1 (bundle-size remediation — triggered by outcome B):** Phase 2.1 has authoritative numbers to work from (10,599,772 bytes observed, 114,012 bytes over cap, `data/` 20.84 MiB + `audio/` 7.67 MiB uncompressed inside zip). The five remediation candidates are listed above in order of impact.
- **Blockers:**
  - **SC-4 (10 MB bundle ceiling) is a documented Blocker** until Phase 2.1 lands. Do NOT cut a GitHub Release until the zip is back under cap — `check-bundle-size` will correctly exit 1 and the Release Workflow step 2 will block the release.
- **Concerns (carried forward from 02-03):**
  - NN phrase-infinitive triage (~214 entries) — out of scope for Phase 2, candidate for a standalone sibling-repo PR.
  - Missing `fin_adj` entry in NB + NN adjective banks — small sibling-repo PR needed to unblock the `nn-clean-003` fixture reverting to its original `fint` text.

## Self-Check: PASSED

Verified all claims in this summary against disk state:

- `scripts/package-extension.js` exists: FOUND
- `scripts/check-bundle-size.js` exists: FOUND
- `scripts/check-bundle-size.test.js` exists: FOUND
- `package.json` has `"check-bundle-size"`: FOUND
- `package.json` has `"package": "node scripts/package-extension.js"`: FOUND
- `.gitignore` has `.package-staging/`: FOUND
- `CLAUDE.md` Release Workflow has `check-bundle-size`: FOUND (2 occurrences)
- `.planning/STATE.md` has `OUTCOME B TRIGGERED`: FOUND
- Commit `f2bf1f2` exists: FOUND (Task 1 RED)
- Commit `522f159` exists: FOUND (Task 1 GREEN)
- Commit `34f7f52` exists: FOUND (Task 2)
- `npm run check-fixtures` exits 0: VERIFIED (132/132 pass)
- `npm run check-bundle-size` exits 1 with FAIL 10.11 MiB: VERIFIED (consistent with outcome B)
- Source-tree `extension/data/nb.json` still pretty-printed: VERIFIED (249,029 lines)

---
*Phase: 02-data-layer-frequency-bigrams-typo-bank*
*Completed: 2026-04-18*
