---
phase: 03-rule-architecture-ranking-quality
plan: 05
subsystem: data + tooling
tags: [bigrams, word-prediction, release-gate, sc-06, wp-02, network-silence, offline]

# Dependency graph
requires:
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: existing bigrams-{de,es,fr,nb,nn}.json schema (prev: {next: weight}); word-prediction.js bigram consumer at line 1007
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: release-gate pattern (check-fixtures.js, check-bundle-size.js) — exit 0/1 + PASS/FAIL diagnostic + must-exit-0 in CLAUDE.md Release Workflow
provides:
  - bigrams-en.json (51 head-words, 202 pairs, weights 1-3) closing WP-02 for English
  - check-network-silence.js release gate enforcing SC-06 (offline surface stays offline)
  - check-network-silence.test.js self-test guarding against gate regex rot
  - CLAUDE.md Release Workflow updated to four must-exit-0 gates (was three)
affects:
  - All future plans touching extension/content/spell-check*.js, spell-rules/*, word-prediction.js — they now must keep the network-silence gate green
  - Phase 4-5 quality work — WP-02 is closed for all 6 languages (NB/NN bigrams shipped Phase 02-02; DE/ES/FR + EN now complete)

# Tech tracking
tech-stack:
  added: []  # zero deps; new scripts use only Node stdlib (fs, path, child_process)
  patterns:
    - "Release-gate pattern (third gate): scripts/check-*.js with zero args, PASS/FAIL diagnostic, exit 0/1, registered in CLAUDE.md Release Workflow as must-exit-0 step. Now: check-fixtures, check-network-silence, check-bundle-size."
    - "Self-tested release gate: check-network-silence has a paired check-network-silence.test.js that plants a forbidden pattern, asserts the gate fires, removes it, asserts the gate passes — guards against regex rot silently making the gate permissive."
    - "Whitelist pattern for legitimate local-resource access: chrome.runtime.getURL + chrome-extension:// URLs are exempt from the forbidden-pattern scan. Codifies that 'offline' means 'no outbound network' — NOT 'no string contains http'."

key-files:
  created:
    - extension/data/bigrams-en.json
    - scripts/check-network-silence.js
    - scripts/check-network-silence.test.js
    - .planning/phases/03-rule-architecture-ranking-quality/03-05-SUMMARY.md
  modified:
    - CLAUDE.md
    - package.json

key-decisions:
  - "EN bigrams hand-authored to ~50 A1/A2 pairs covering greetings, pronoun+be, articles, question words, courtesy responses, and common verb frames. Researcher's open question 4 closed in favour of hand-authored over noisy-foreign-corpus-derived pairs (research decision in 03-RESEARCH.md confirmed by execution)."
  - "Bigram next-word coverage gap (29 of 202 next-words missing from extension/data/en.json wordList — short copulas like is/am/can/was/has/were) is BY DESIGN — en.json is content-vocab focused; bigram signal still ships, applies whenever a matching candidate exists. 86% coverage (173/202) suffices."
  - "_metadata key kept in bigrams-en.json (matches all peer bigrams files de/es/fr/nb/nn). Plan's verify command had a blindspot for _metadata that affects ALL existing bigrams files identically — not a real schema problem, an over-strict verify regex. Treated as Rule-3 deviation: corrected the verify command (skip keys starting with _) rather than diverging from peer-file convention."
  - "Network-silence gate placed as Release Workflow step 2 (between check-fixtures and check-bundle-size). Order reflects cost-of-running: check-fixtures is fastest (~5s), check-network-silence is instant (regex sweep), check-bundle-size is slowest (~30s minify+package). Earlier-cheaper gates fail fast on cheap signals."
  - "Self-test scratch file lives inside extension/content/spell-rules/_test-scratch.js (creating the directory if missing, removing it on cleanup if WE created it). Robust to whether spell-rules/ has been created yet by other Phase 3 plans (it hadn't at execution time — Plans 01-04 are running in parallel in Wave 1). The self-test plants and cleans up its own artifact without disturbing peer plans."

patterns-established:
  - "Self-tested release gate — every gate that uses regex/heuristic detection should have a paired .test.js that proves the gate actually fires on a planted positive. Mirrors the bundle-size gate's check-bundle-size.test.js pattern."
  - "Whitelist-with-rationale-comment — when a regex gate has whitelisted patterns (chrome.runtime.getURL, chrome-extension://), the WHITELIST array carries an inline comment explaining WHY each pattern is allowed. Future maintainers can audit the whitelist without re-deriving the rationale."
  - "Optional-target collectFiles — gate scans both fixed SCAN_TARGETS (must exist) and SCAN_DIRS (walked if present, silently skipped if absent). Lets the gate ship before all the directories it scans exist — Plans 01-04 will create extension/content/spell-rules/ later in Wave 1, and this gate will pick up new rule files automatically without re-edit."

requirements-completed: [SC-06, WP-02]

# Metrics
duration: 4 min
completed: 2026-04-19
---

# Phase 3 Plan 05: WP-02 EN bigrams + SC-06 network-silence gate Summary

**Hand-authored bigrams-en.json (51 head-words / 202 A1-A2 pairs) closing WP-02 for English, plus check-network-silence.js release gate + paired self-test enforcing SC-06 (offline surface stays offline) as a fourth must-exit-0 step in CLAUDE.md Release Workflow.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-19T09:24:48Z
- **Completed:** 2026-04-19T09:29:07Z
- **Tasks:** 2
- **Files created:** 3 (bigrams-en.json, check-network-silence.js, check-network-silence.test.js)
- **Files modified:** 2 (CLAUDE.md, package.json)

## Accomplishments

- **WP-02 closed for EN:** 51 head-words / 202 (prev,next) pairs covering A1/A2 learner-core categories — greetings, pronoun+be, articles, question words, courtesy responses, common verb frames. Word-prediction.js:1007 multiplies weight × 40 → boost 40/80/120 for matched candidates. Typing "thank" now boosts "you" via bigram signal.
- **SC-06 enforced:** check-network-silence.js scans spell-check-core.js, spell-check.js, word-prediction.js, and extension/content/spell-rules/*.js for `fetch(`, `XMLHttpRequest`, `sendBeacon`, and `http(s)://` URL literals. Exits 1 with file:line on any forbidden hit. Whitelisted: `chrome.runtime.getURL`, `chrome-extension://`, JSDoc/// comment lines.
- **Gate is itself tested:** check-network-silence.test.js plants a `fetch('https://example.com/api')` in a scratch rule file, asserts the gate fires (exit 1), removes the scratch, asserts the gate passes (exit 0). Self-test creates and removes the spell-rules/ directory if it doesn't exist, so it co-exists cleanly with Plans 01-04 running in parallel.
- **CLAUDE.md Release Workflow updated:** four must-exit-0 gates now (was three). Order: check-fixtures → check-network-silence → check-bundle-size → manual version bump → package → release. Cheap gates fail-fast first.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-author bigrams-en.json (~50 A1/A2 pairs)** - `a03dbd0` (feat)
2. **Task 2: Create check-network-silence.js release gate + self-test + CLAUDE.md step** - `2975c74` (feat)

**Plan metadata:** *(this commit, after SUMMARY + STATE + ROADMAP + REQUIREMENTS updates)*

## Files Created/Modified

### Created

- `extension/data/bigrams-en.json` (1,915 bytes pretty-printed) — 51 head-words, 202 (prev,next) pairs, weights 1-3, schema mirrors bigrams-de.json including `_metadata` header.
- `scripts/check-network-silence.js` (3,517 bytes) — SC-06 release gate. Zero deps, Node 18+, CommonJS. Greps SCAN_TARGETS (3 fixed files) and SCAN_DIRS (spell-rules/ if present) for forbidden patterns, whitelists local-resource patterns and comment lines, prints PASS/FAIL diagnostic, exits 0/1.
- `scripts/check-network-silence.test.js` (3,138 bytes) — Self-test. Plants forbidden pattern in extension/content/spell-rules/_test-scratch.js, asserts gate fires, cleans up (removes scratch + removes spell-rules/ if WE created it), asserts gate passes again.

### Modified

- `CLAUDE.md` — Release Workflow gained step 2 (check-network-silence) between existing step 1 (check-fixtures) and step 2-now-3 (check-bundle-size). Subsequent steps renumbered 2→3, 3→4, 4→5, 5→6 with their content unchanged.
- `package.json` — Added two npm scripts: `check-network-silence` and `check-network-silence:test`. Existing scripts untouched and not reordered.

## Decisions Made

See frontmatter `key-decisions` for the five execution-time decisions logged. Highlights:

- **EN bigrams hand-authored, not corpus-derived** — confirms researcher's open question close.
- **86% next-word coverage in en.json is by design** — content-vocab focus excludes short copulas (is/am/can/was), bigram signal still ships and applies when matching candidate exists.
- **`_metadata` kept in bigrams-en.json** — peer-file convention wins over plan's over-strict verify regex (which would also fail against the existing bigrams-{de,es,fr,nb,nn}.json files).
- **Gate placed as Release Workflow step 2** — cheap-fast-fail ordering (check-fixtures ~5s → check-network-silence instant → check-bundle-size ~30s minify+package).
- **Self-test plants in spell-rules/, creates dir if absent** — robust to Phase 3 wave-1 parallelism where Plans 01-04 may or may not have created spell-rules/ before this plan runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's Task 1 verify command treats `_metadata` as a head-word, would fail against any bigrams file**

- **Found during:** Task 1 — running the plan's quoted Node verify command
- **Issue:** Plan's verify iterates `Object.keys(b)` without filtering `_metadata`, then asserts every value is a `{next: int1-3}` object. The `_metadata` key in bigrams-de/es/fr/nb/nn.json (and the new bigrams-en.json which mirrors them) holds `{language: "...", description: "..."}` — strings, not integer weights. The plan's verify exits 1 against ALL existing bigrams files, not just our new one. The plan author appears to have written the verify without checking peer-file structure.
- **Fix:** Added `.filter(k => !k.startsWith('_'))` to the head-word iteration in the verify run. The actual artifact (bigrams-en.json) keeps `_metadata` for peer-file consistency (the `<interfaces>` block explicitly says "must match exactly. Peek at bigrams-de.json to mirror"). The verify-command shape was the bug, not the data.
- **Files modified:** None — only the verification approach was adjusted; the canonical artifact matches the documented schema.
- **Verification:** Adjusted-verify run reports `OK — heads: 51 total pairs: 202`; same shape applied to bigrams-de.json passes (`peer file check: passed`); same shape applied without the filter fails on bigrams-de.json too (`bad weight for _metadata -> language = de`), confirming the issue was in the verify regex, not our data.
- **Committed in:** N/A (no source change — only verify-command interpretation)

**2. [Rule 3 - Blocking] Self-test had to handle missing extension/content/spell-rules/ directory**

- **Found during:** Task 2 — plan's quoted self-test plants scratch into `extension/content/spell-rules/_test-scratch.js`, but spell-rules/ doesn't exist yet (Plans 01-04 are creating it in wave 1, hadn't completed at the time this plan ran).
- **Issue:** `fs.writeFileSync(SCRATCH, ...)` fails with ENOENT if the parent directory doesn't exist. Plan didn't account for execution-order with peer plans.
- **Fix:** Self-test now creates spell-rules/ if missing, sets `createdDir=true` flag, and removes the directory in cleanup ONLY if we created it AND it's empty. Doesn't disturb a real spell-rules/ from another plan if one materialized between baseline and cleanup.
- **Files modified:** scripts/check-network-silence.test.js (only — this is the file being authored, so it's a design adaptation, not a fix to existing code)
- **Verification:** Self-test exits 0; `ls extension/content/spell-rules/` after self-test completes returns "No such file or directory" (clean, no leaked artifacts).
- **Committed in:** 2975c74 (Task 2 commit; design baked in from the start)

---

**Total deviations:** 2 auto-fixed (2 Rule-3 blocking)
**Impact on plan:** Both are interpretation/adaptation around peer-file conventions and parallel-execution timing. Neither changed plan scope. The artifacts shipped are exactly what the `<must_haves>` block specified.

## Issues Encountered

None — both tasks executed cleanly. Plan-level `<verification>` block all green:

- `npm run check-network-silence` → PASS (exit 0)
- `npm run check-network-silence:test` → PASS (exit 0)
- `npm run check-fixtures` → PASS (138/138 fixtures green across 10 NB+NN suites)
- `npm run check-bundle-size` → PASS (10.11 MiB / 10,600,860 bytes; +5KB delta from bigrams-en.json invisible at this scale; 9.89 MiB headroom under 20 MiB cap)
- `grep "check-network-silence" CLAUDE.md` → match found
- `extension/data/bigrams-en.json` loads as valid JSON with 51 head-words (≥25 required)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This plan is independent of Plans 01-04 (no file overlap; runs in Wave 1 parallel with Plan 01). Closes the two Phase-3 requirements not covered by the rule-architecture / ranking plans:

- **WP-02 for EN:** all 6 languages now have bigrams files (NB/NN from Phase 02-02; DE/ES/FR pre-existing; EN new).
- **SC-06 enforcement:** automated, can't silently regress, gate is itself tested.

Future Phase-3 ranking plans (01-04) ship rule files into `extension/content/spell-rules/` — the gate auto-discovers them via SCAN_DIRS walk. No re-edit needed when those plans land. Their PRs will need to keep the gate green; CI now enforces what was previously a cultural constraint.

## Self-Check: PASSED

- All 6 expected files present on disk (3 created + 2 modified + SUMMARY.md)
- Both task commits found in `git log` (a03dbd0, 2975c74)
- Commits are sequential, recent, and ahead of sibling Plan 03-01's parallel work

---
*Phase: 03-rule-architecture-ranking-quality*
*Completed: 2026-04-19*
