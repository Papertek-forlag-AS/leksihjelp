---
phase: 04-false-positive-reduction-nb-nn
plan: 01
subsystem: infra
tags: [vocab-seam, spell-check, nb-nn, cross-dialect, sc-03, infrastructure]

# Dependency graph
requires:
  - phase: 03.1-close-sc-01-browser-wiring
    provides: "Adapter-contract regression guard pattern (static source-regex assertion in check-fixtures main() that fails loud on re-regression) — mirrored 1:1 for SC-03"
  - phase: 01-foundation-vocab-seam-regression-fixture
    provides: "vocab-seam-core.buildIndexes() pure index builder with typo-filtered validWords; empty-container-default getter pattern on self.__lexiVocab"
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: "Typo-filter precedent in buildLookupIndexes (entry.type !== 'typo' guard around validWords.add) — reused as the Pitfall-1 guard in sisterValidWords derivation"
provides:
  - "vocab-seam-core.buildIndexes accepts sisterRaw and returns a sisterValidWords Set (Pitfall-1 typo-filtered, lowercased)"
  - "vocab-seam.loadRawSister(lang) loader mirroring loadRawFrequency — parallel-fetched via Promise.all alongside bigrams + freq"
  - "self.__lexiVocab.getSisterValidWords() public getter (empty-Set default for non-NB/NN sessions)"
  - "spell-check.js:runCheck vocab literal 7th field: sisterValidWords: VOCAB.getSisterValidWords()"
  - "SC-03 adapter-contract regression guard in scripts/check-fixtures.js main() — static source-regex assertion, throws on re-regression"
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-dialect seam-derived Set: NB session → NN lemmas, NN session → NB lemmas; empty Set for de/es/fr/en"
    - "Parallel-fetch composition extension: Promise.all now carries [bigrams, freq, sisterRaw] with loadRaw* loaders in a homogeneous style"
    - "Paired adapter-contract guards pattern: one static source-regex guard per SC requirement (SC-01 freq + SC-03 sisterValidWords), all live at the top of scripts/check-fixtures.js main()"

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - scripts/check-fixtures.js

key-decisions:
  - "Pitfall-1 typo filter applied cross-dialect: sisterValidWords derivation iterates buildWordList output and skips entry.type === 'typo' rows. Pure-typo NN entries verifiably leak 0 times into the NB sisterValidWords Set (REPL probe: 14,754 pure-typo NN rows, 0 leaked)."
  - "Same-language-parity collision policy: when a word exists as BOTH a typo row AND a valid lemma row in the sister language (103 tokens in NN), it stays in sisterValidWords via the valid-lemma path. This matches how same-language validWords treats the same collision class (Phase 02-03 established policy) — the behavior is consistent with how Norwegian validWords already handles shared typo/lemma collisions."
  - "Empty-Set default for getSisterValidWords() — mirrors the getValidWords / getNounGenus / getVerbInfinitive / getCompoundNouns pattern (Pitfall 1 / 03.1). Consumers (Plans 04-02 / 04-03) can call .has() on the Set without null-guards; for de/es/fr/en the empty Set returns false for every query, which is the correct semantics ('no sister dialect to tolerate')."
  - "Zero runtime effect: 04-01 is pure infrastructure. No rule reads vocab.sisterValidWords yet (that is 04-02 / 04-03's job). 140/140 fixtures stay green because the seam addition is strictly additive; no finding output changes."
  - "Defence-in-depth probe validated the SC-03 guard is load-bearing: sisterValidWords line removed from spell-check.js → check-fixtures.js exited 1 with explicit SC-03 message → adapter restored byte-identical (wc -c matches, git diff empty). Mirror of the Phase 03.1 probe pattern."

patterns-established:
  - "Cross-dialect tolerance Set derivation: seam-core accepts sisterRaw, runs buildWordList on it with isFeatureEnabled=() => true (superset policy), filters type==='typo' rows, adds lowercased word to a fresh Set. Reusable for any future 'check token against sister-dialect vocab' rule."
  - "Paired guard pattern in fixture runner: each SC requirement that depends on a specific adapter-literal field gets its own named regex guard in scripts/check-fixtures.js main(), all sharing a single adapterSrc read. Fail-loud error messages carry the SC identifier + pointer to the originating phase directory."

requirements-completed: [SC-03]

# Metrics
duration: 4min
completed: 2026-04-20
---

# Phase 04 Plan 01: SC-03 Cross-Dialect Vocab Seam Rail Summary

**Seam-level cross-dialect tolerance: vocab.sisterValidWords Set plumbed NB↔NN through vocab-seam-core → vocab-seam → spell-check.js adapter, with an SC-03 adapter-contract regression guard in check-fixtures.**

## Performance

- **Duration:** ~4 min wall-clock (1 execution wave, 2 atomic tasks)
- **Started:** 2026-04-20T12:57:00Z
- **Completed:** 2026-04-20T13:00:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Cross-dialect validWords Set derivation shipped end-to-end: NB sessions see a populated sisterValidWords Set of 14,866 NN lemmas; NN sessions see 14,773 NB lemmas; de/es/fr/en sessions see an empty Set (not null). Pitfall-1 typo filter proven zero-leakage (14,754 pure-typo NN entries, 0 in NB sisterValidWords).
- Public getter VOCAB.getSisterValidWords() added to self.__lexiVocab with empty-Set default (matches getValidWords / getNounGenus / getVerbInfinitive / getCompoundNouns precedent). Browser-runtime adapter literal in spell-check.js:runCheck extended to pass the new Set through to rule.check.
- SC-03 adapter-contract regression guard installed in scripts/check-fixtures.js — static source-regex assertion at the top of main(), throws with explicit "SC-03 browser-wiring regression" message if spell-check.js ever drops the sisterValidWords field from the runCheck vocab literal. Defence-in-depth probe confirmed the guard is load-bearing.
- Plans 04-02 and 04-03 are now unblocked — they can consume vocab.sisterValidWords in their rule files without touching the seam.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire vocab.sisterValidWords through seam into spell-check adapter** — `ffdb5eb` (feat)
2. **Task 2: Add SC-03 adapter-contract regression guard in check-fixtures** — `c2e7165` (feat)

_Plan metadata commit (SUMMARY + STATE + ROADMAP): added after this file._

## Files Created/Modified

- `extension/content/vocab-seam-core.js` — buildIndexes signature now accepts sisterRaw; new sisterValidWords derivation block (Pitfall-1 typo-filtered); return object gains sisterValidWords alongside freq
- `extension/content/vocab-seam.js` — new loadRawSister(lang) loader (NB↔NN only); Promise.all parallel-fetched with bigrams + freq; loadForLanguage passes sisterRaw into core.buildIndexes; self.__lexiVocab gains getSisterValidWords() with empty-Set default
- `extension/content/spell-check.js` — runCheck vocab literal gains `sisterValidWords: VOCAB.getSisterValidWords()` as a 7th field (alongside Phase 03.1 freq); field alignment/indentation adjusted so the longest key (sisterValidWords) sets the column for readability
- `scripts/check-fixtures.js` — new static source-regex guard below the SC-01 freq guard; re-uses the adapterSrc variable already read once; throws with explicit "SC-03 browser-wiring regression" message on miss

## Decisions Made

- **Pitfall-1 typo filter applied cross-dialect.** The sister language's `type==='typo'` rows are intentionally excluded from sisterValidWords. If a word is wrong in both dialects AND exists in the sister's typo bank, we WANT it flagged — silently accepting it via the sister's typo bank would produce a subtle false-negative that the fixture suite would not catch on a cross-dialect input. REPL probe: 14,754 pure-typo NN entries exist; 0 leaked into NB sisterValidWords. Guard verified zero-regression.

- **Same-language-parity collision policy preserved.** When a word exists as BOTH a typo row AND a valid lemma row in the sister language (happens for 103 tokens between NB and NN — words like `hvile`, `bred`, `smale`), it stays in sisterValidWords via the valid-lemma path. This matches how same-language `validWords` treats the same collision class (Phase 02-03 established this policy in buildLookupIndexes — the typo filter is per-row, not per-word). Rejecting them cross-dialect would introduce an asymmetry versus same-language behavior with no SC-03 benefit.

- **Empty-Set default for getSisterValidWords().** Mirrors the getValidWords / getNounGenus / getVerbInfinitive / getCompoundNouns pattern (Pitfall 1 from 03.1). Consumers can call `.has()` without null-guards; for de/es/fr/en the empty Set returns false for every query, which is the correct "no sister dialect to tolerate" semantics. Rejected the null-default style (getBigrams) because Plans 04-02 / 04-03's rule.check() call sites will treat a null vocab.sisterValidWords as a regression signal — empty-Set is the straight-through contract.

- **Zero runtime effect confirmed.** 04-01 is pure infrastructure: no rule reads vocab.sisterValidWords yet (Plans 04-02 and 04-03 will). 140/140 fixtures stay green because the seam addition is strictly additive — buildIndexes' return shape grows but no existing consumer reads the new field. This was a success criterion of the plan.

- **Defence-in-depth probe validated the SC-03 guard is load-bearing.** Removed the sisterValidWords line from spell-check.js → check-fixtures.js exited 1 with the explicit SC-03 message → adapter restored from pre-probe backup byte-identical (wc -c matches 20,684 / 20,684; `git diff` on spell-check.js is empty after restore). Mirror of the Phase 03.1 probe pattern, documented in the Task 2 commit body. Without this guard, an adapter regression would silently drop NB↔NN tolerance in the browser runtime while the fixture suite stays green (because the fixture path bypasses the adapter and constructs the vocab directly from buildIndexes).

## Deviations from Plan

None — plan executed exactly as written.

All verification probes from the plan's `<verification>` block ran successfully:
- `npm run check-fixtures` exits 0 (140/140 — both SC-01 and SC-03 guards silently pass)
- `npm run check-network-silence` exits 0 (SC-06 — no new fetch patterns; `chrome.runtime.getURL` whitelisted)
- `npm run check-bundle-size` exits 0 (10.12 MiB / 20 MiB cap, 9.88 MiB headroom — zip size essentially unchanged ~4 KB noise vs pre-plan baseline)
- Node REPL probe: NB sisterValidWords.size = 14,866 (> 10,000 ✓); NN sisterValidWords.size = 14,773; EN sisterValidWords.size = 0 AND instanceof Set = true (empty-Set default confirmed)
- Typo-leakage probe: 14,754 pure-typo NN entries, 0 leaked into NB sisterValidWords
- Defence-in-depth probe: guard fires with SC-03 message on regression, restores byte-identical

## Issues Encountered

None during planned work. The only "noise" was an initial probe showing 103 overlaps between NN typoFix keys and NB sisterValidWords; on investigation this was confirmed to be the same-language-parity collision class (words that are simultaneously typos and valid lemmas in NN), matching existing Phase 02-03 semantics — not a bug. A second probe iterating only pure-typo NN rows (not also in nnValidWords) confirmed zero leakage, which is the load-bearing contract.

## User Setup Required

None — no external service configuration, no environment variables, no dashboard changes. This is a pure code-level seam-rail.

## Next Phase Readiness

- **Plans 04-02 + 04-03 unblocked.** They can consume `ctx.vocab.sisterValidWords` in their respective rule files without touching the seam. `.has(token.toLowerCase())` returns true when the NB session sees a valid NN word (and vice versa); returns false for de/es/fr/en sessions (empty Set) and for pure-typo sister rows (Pitfall-1 filtered).
- **SC-03 restored from open → satisfied end-to-end at the infrastructure layer.** No rule consumes the Set yet; Plans 04-02 and 04-03 will close SC-03 at the rule-behavior layer. The rail is in place, the guard protects against re-regression, and the fixture runner exercises the populated Set on every NB/NN vocab load.
- **No blockers.** No deferred items from this plan.

---
*Phase: 04-false-positive-reduction-nb-nn*
*Completed: 2026-04-20*

## Self-Check: PASSED

- All four claimed modified files exist (extension/content/vocab-seam-core.js, vocab-seam.js, spell-check.js, scripts/check-fixtures.js)
- Both atomic task commits exist in the git log (ffdb5eb, c2e7165)
- All source-level field assertions match: `sisterValidWords: VOCAB.getSisterValidWords()` in spell-check.js; `getSisterValidWords:` getter in vocab-seam.js; `loadRawSister` loader in vocab-seam.js; `sisterValidWords` in vocab-seam-core.js; `SC-03 browser-wiring regression` message in check-fixtures.js
- SUMMARY.md exists at the canonical phase directory path
