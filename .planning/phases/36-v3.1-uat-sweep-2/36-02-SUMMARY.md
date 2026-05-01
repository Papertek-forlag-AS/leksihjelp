---
phase: 36-v3.1-uat-sweep-2
plan: 02
subsystem: infra
tags: [release-gate, vocab-seam, static-analysis, infra-10]

requires:
  - phase: 35-v3.1-uat-followups
    provides: v2.9.15 seam-fix wired 5 of 8 missing pedagogy/class indexes; this plan ships the gate that catches the next instance
provides:
  - check-vocab-seam-coverage release gate (INFRA-10)
  - paired :test self-test with try/finally backup-restore guarantees
  - drive-by fix wiring 3 more FR mood-aspect indexes the v2.9.15 fix missed (frImparfaitToVerb, frPasseComposeParticiples, frAuxPresensForms)
  - Release Workflow gate #12 added to CLAUDE.md
affects: [future buildIndexes additions, release gate suite, downstream lockdown sync]

tech-stack:
  added: []
  patterns:
    - "Static-parse buildIndexes return literal incl. ...moodIndexes spread (recursive resolution into builder function's last `return {}` literal)"
    - "EXEMPT list documents intentionally non-spell-check-bound keys; GETTER_OVERRIDES handles non-default casing (NN acronym)"
    - "Self-test plants identical scratch in core / seam / consumer to belt-and-braces against silently-permissive AND over-strict gate regressions"

key-files:
  created:
    - scripts/check-vocab-seam-coverage.js
    - scripts/check-vocab-seam-coverage.test.js
  modified:
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - package.json
    - CLAUDE.md

key-decisions:
  - "EXEMPT list (vs full audit of every getter) keeps the gate's scope tight on consumer-bound keys — non-spell-check surfaces (word-prediction wordList, predictCompound, internal closures like nounLemmaGenus) are intentional by design"
  - "Static parse of source rather than runtime require() of the seam — vocab-seam-core.js's IIFE assumes browser globals; static parse avoids the bootstrap shim"
  - "Recursive spread resolution (...moodIndexes -> buildMoodIndexes return literal) — without it, the 10 mood-aspect keys would be invisible to the gate, which is exactly the bug class we're trying to catch"
  - "Drive-by fix of 3 more bug-class instances rather than separate plan — the gate would block release otherwise, and the fix is mechanical (3 lines per file)"

patterns-established:
  - "INFRA-style gate: enumerate authoritative source-of-truth literal -> assert all keys surface through downstream layers (seam + consumer)"
  - "Per-violation diagnostic with copy-paste fix line — keeps the time-to-resolve at <30s for the next contributor"

requirements-completed: []

duration: 6min
completed: 2026-05-01
---

# Phase 36 Plan 02: Vocab-Seam Coverage Release Gate Summary

**Static-parse release gate that asserts every `buildIndexes` return key has both a `get<PascalCase>` getter on the `__lexiVocab` seam AND a consumer entry in `spell-check.js`'s `runCheck()` vocab object — caught 3 more pre-existing seam gaps on first run and wired them in the same plan**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-01T09:26:48Z
- **Completed:** 2026-05-01T09:32:xxZ
- **Tasks:** 3
- **Files modified:** 4 (2 created, 4 modified — `package.json` + 3 source/docs)

## Accomplishments

- New `check-vocab-seam-coverage` gate (INFRA-10) — static-parses the `buildIndexes` return literal in `vocab-seam-core.js` (including recursive resolution of `...moodIndexes` into `buildMoodIndexes`'s last `return {…}`) and asserts each non-exempt key surfaces through both the browser seam getter object AND the spell-check consumer composition. Per-violation diagnostics print exact copy-paste fix lines for both files.
- Paired self-test with three scenarios (planted-gap fires; planted-then-closed passes; clean-HEAD passes), all guarded by try/finally with backup-restore so a crashed self-test never corrupts the source tree. Verified source tree byte-identical before/after.
- Drive-by fix of 3 more pre-existing seam gaps the v2.9.15 fix missed — `frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms` — all consumed by `fr-aspect-hint` via `ctx.vocab.X` but never surfaced through the seam. Same bug-class as Phase 35 (Node fixture-runner bypassed seam, all 11 prior gates stayed green, browser users got empty Maps/Set, fr-aspect-hint silently false-negative on canonical UAT triggers).
- CLAUDE.md release workflow updated: gate #12 inserted with full description + paired :test + why-this-gate-exists block; subsequent steps renumbered 12-14 → 13-15 (version bump, rebuild zip, upload release).

## Task Commits

1. **Task 1: Write check-vocab-seam-coverage.js (the gate)** — `16e085f` (feat)
2. **Task 2: Write check-vocab-seam-coverage.test.js (paired self-test)** — `b35abe7` (test)
3. **Task 3: Update CLAUDE.md release workflow with gate #12** — `0794734` (docs)

## Files Created/Modified

- `scripts/check-vocab-seam-coverage.js` (created) — INFRA-10 gate: static-parses core return literal incl. spread, validates seam + consumer.
- `scripts/check-vocab-seam-coverage.test.js` (created) — Three-scenario paired self-test with try/finally backup-restore.
- `extension/content/vocab-seam.js` (modified) — Added `getFrImparfaitToVerb` / `getFrPasseComposeParticiples` / `getFrAuxPresensForms` getters with the same null-guarding pattern as the v2.9.15 fix.
- `extension/content/spell-check.js` (modified) — Added matching consumer entries on `runCheck()`'s `const vocab = { … }` so `fr-aspect-hint` actually receives populated indexes in the browser.
- `package.json` (modified) — Registered `check-vocab-seam-coverage` and `check-vocab-seam-coverage:test` npm scripts.
- `CLAUDE.md` (modified) — Inserted gate #12 in Release Workflow; renumbered 12-14 → 13-15.

## Decisions Made

- **EXEMPT list approach over full-coverage assertion:** Some `buildIndexes` return keys are intentionally non-spell-check (word-prediction `wordList`, `predictCompound`; internal closure `nounLemmaGenus`; alias `typoBank`; bigrams via different surface; diagnostic `_sourceTag`; post-build-hydrated `pitfalls`). Each entry on the EXEMPT list is documented and triaged against `grep -r "ctx.vocab.<key>"`.
- **GETTER_OVERRIDES map for naming-convention exceptions:** `nnInfinitiveClasses` → `getNNInfinitiveClasses` (caps acronym) is the only override today; the map keeps the contract explicit and reviewable.
- **Static-parse source rather than runtime `require()` of seam:** `vocab-seam-core.js`'s IIFE assumes browser globals; static parse avoids needing a bootstrap shim and keeps the gate fast (<200ms).
- **Drive-by fix of 3 additional bug-class instances rather than spinning a separate plan:** The plan's premise was "gate must pass at HEAD"; the gate caught real gaps the v2.9.15 fix missed; fix was mechanical (3 lines per file) with no architectural impact. Rule 1/2 deviation territory — bug + missing critical functionality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1+2 — Bug + Missing Critical] Wired 3 more FR mood-aspect indexes the v2.9.15 fix missed**

- **Found during:** Task 1 (running the new gate against HEAD)
- **Issue:** The plan's premise — "v2.9.15 fix means all 5 previously-missing indexes are now wired; gate must exit 0 immediately" — was incomplete. The v2.9.15 fix wired 5 indexes (prepPedagogy, gustarClassVerbs, gustarPedagogy, frAspectAdverbs, frAspectPedagogy). On its first run the new gate caught 3 more in the same bug-class: `frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms` — produced by `buildMoodIndexes` and spread into the buildIndexes return literal, consumed by `fr-aspect-hint` via `ctx.vocab.X`, but never surfaced through `__lexiVocab` or composed into spell-check.js's `vocab = { … }`. Browser-side fr-aspect-hint silently fell back to empty Map/Set on every canonical trigger.
- **Fix:** Added `getFrImparfaitToVerb` / `getFrPasseComposeParticiples` / `getFrAuxPresensForms` getters in `vocab-seam.js` (same null-guarded pattern as the v2.9.15 fix) and matching consumer entries in `spell-check.js`'s `runCheck()` vocab literal.
- **Files modified:** `extension/content/vocab-seam.js`, `extension/content/spell-check.js` (committed atomically with Task 1's gate creation, since the gate would block release otherwise).
- **Verification:** `npm run check-vocab-seam-coverage` exits 0 with `36 indexes, all surfaced through seam + consumer`. Self-test confirms gate still fires on planted regressions.
- **Committed in:** `16e085f` (Task 1 commit).

---

**Total deviations:** 1 auto-fixed (Rule 1 + Rule 2 — bug class mirror of Phase 35 v2.9.15 fix)
**Impact on plan:** No scope creep. The fix is mechanical and was the only path to satisfying the plan's "gate must exit 0 at HEAD" success criterion. Same code-pattern, same justification, same comment-block as v2.9.15 — just three more keys.

## Issues Encountered

- Initial gate parser threw on `vocab-seam.js`'s method-shorthand entry `onReady(cb) { … }` (regex required `:` immediately after the identifier). Fixed by extending the identifier regex to also accept `(` (method-shorthand) as a valid continuation. Caught on first dry-run, 30-second fix.
- Triage of EXEMPT list required cross-referencing `ctx.vocab.X` usage across all spell-rules — a manual grep pass confirmed `wordList`, `bigrams`, `typoBank`, `grammarTables`, `nounLemmaGenus`, `predictCompound` are not consumer-bound today. If a future rule starts consuming any of them via `ctx.vocab`, the EXEMPT list will need a corresponding edit (and the rule's data will silently be empty in the browser until that's done — same trap class the gate is designed to surface, with the EXEMPT list as the explicit acknowledgement that they're not yet hit).

## User Setup Required

None — internal release gate, no external service configuration.

## Next Phase Readiness

- Plan 36-01 (UAT regression closures) and Plan 36-02 (this gate) both landed on the same head; v2.9.16 is the version bumped already (in `package.json`) — no version bump action needed for 36-02 alone since the plan ships gates and a sub-fix in the same release window as 36-01.
- Lockdown + skriveokt-zero downstream consumers should re-pin to leksihjelp 2.9.16 once both Phase 36 plans complete and a release is cut. Synced files affected: `extension/content/vocab-seam.js`, `extension/content/spell-check.js` (3 added lines each).
- Future buildIndexes additions are now protected: the next time a contributor adds a new index without wiring the seam getter / consumer entry, `npm run check-vocab-seam-coverage` will block the release with copy-paste-ready fix lines.

---
*Phase: 36-v3.1-uat-sweep-2*
*Completed: 2026-05-01*

## Self-Check: PASSED

- FOUND: scripts/check-vocab-seam-coverage.js
- FOUND: scripts/check-vocab-seam-coverage.test.js
- FOUND: commit 16e085f (Task 1: gate + 3 wirings)
- FOUND: commit b35abe7 (Task 2: paired self-test)
- FOUND: commit 0794734 (Task 3: CLAUDE.md gate #12)
- VERIFIED: `npm run check-vocab-seam-coverage` exits 0
- VERIFIED: `npm run check-vocab-seam-coverage:test` exits 0 (3/3 scenarios green)
- VERIFIED: `grep -n "check-vocab-seam-coverage" CLAUDE.md` returns 2 matches in Release Workflow gate #12
