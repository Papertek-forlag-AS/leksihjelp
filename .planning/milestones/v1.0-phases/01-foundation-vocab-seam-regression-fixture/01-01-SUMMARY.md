---
phase: 01-foundation-vocab-seam-regression-fixture
plan: 01
subsystem: infra
tags: [content-scripts, vocab-seam, dual-export, commonjs, iife, chrome-extension]

# Dependency graph
requires: []
provides:
  - Pure buildIndexes() core consumable from Node (enables Plan 03 fixture harness)
  - Browser self.__lexiVocab seam with rich surface (15 methods)
  - Late-subscriber-safe onReady queue (handles consumer load-order flexibility)
affects:
  - 01-02 (consumer wiring — spell-check.js + word-prediction.js cutover)
  - 01-03 (Node fixture runner requires the core via CommonJS)
  - Phase 2 DATA-01 (freq Map gets populated; seam signature unchanged)
  - Phase 3 INFRA-03 (rule-plugin refactor will consume the same seam)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-export footer: module.exports + self.__lexiVocabCore"
    - "IIFE wrapper owns I/O; core is pure"
    - "Queued onReady with safe drain on flip-to-ready"

key-files:
  created:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
  modified: []

key-decisions:
  - "getBigrams() returns null (not {}) when the bigrams file is missing — matches the existing word-prediction.js bigramData null-handling that spell-check / ranking already consume"
  - "Empty-state getters return empty Map/Set (never null) for lookup-index getters (getNounGenus, getVerbInfinitive, getValidWords, getTypoFix, getCompoundNouns) — lets consumers skip null guards and keeps .has/.get usable even before ready=true"
  - "Default isFeatureEnabled when enabledGrammarFeatures storage key is missing: () => true (superset). Matches word-prediction.js:108–109 semantics and CONTEXT 'consumers filter further at the seam level'"
  - "typoBank is a Map reference-alias of typoFix (not a copy) — satisfies the rich-surface contract without doubling memory"
  - "freq is new Map() in Phase 1 — getFrequency() returns null for every word until DATA-01 lands; signature is already in place so Phase 2 only changes data, not API"
  - "LANG_PRONOUN_FEATURES constant lifted into the core (with isFeatureEnabled passed in) to keep getAllowedPronouns pure — the browser wrapper no longer needs to own pronoun-filter logic"

patterns-established:
  - "Pure-core + IIFE-wrapper pair: core file exports via module.exports+self globals, wrapper file owns I/O + messages + surface"
  - "Verbatim port over rewrite: word-emission loop and index-building loop moved byte-for-byte from word-prediction.js:440–755 and spell-check.js:136–172, preserving every field consumers implicitly depend on"

requirements-completed:
  - INFRA-01

# Metrics
duration: 4m 24s
completed: 2026-04-18
---

# Phase 01 Plan 01: Foundation — Vocab Seam Core + Browser Wrapper Summary

**Rich `self.__lexiVocab` surface backed by a pure, Node-requireable `__lexiVocabCore.buildIndexes` — the foundation that makes the Node fixture harness (Plan 03) and consumer cutover (Plan 02) possible.**

## Performance

- **Duration:** 4m 24s
- **Started:** 2026-04-18T13:05:39Z
- **Completed:** 2026-04-18T13:10:03Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- `extension/content/vocab-seam-core.js` — pure `buildIndexes({ raw, bigrams, lang, isFeatureEnabled })` returning all 9 derived structures (wordList, nounGenus, verbInfinitive, validWords, typoFix, compoundNouns, bigrams, freq, typoBank). Dual-exports to both `module.exports` (Node) and `self.__lexiVocabCore` (browser).
- `extension/content/vocab-seam.js` — browser IIFE that owns vocab I/O (IndexedDB via `__lexiVocabStore` + bundled-file fetch fallback) and exposes the 15-method `self.__lexiVocab` surface.
- Ported word-emission loop byte-for-byte from `word-prediction.js:440–755` (every emitted field preserved).
- Ported bigram normalization byte-for-byte from `word-prediction.js:763–785` (delete `_metadata`, lowercase keys, merge duplicates by `max(weight)`).
- Ported index-building loop byte-for-byte from `spell-check.js:136–172` (nounGenus / verbInfinitive / validWords / typoFix / compoundNouns).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vocab-seam-core.js (pure buildIndexes + dual-export footer)** — `9ef4cf0` (feat)
2. **Task 2: Create vocab-seam.js (browser IIFE wrapper exposing self.__lexiVocab)** — `3c6f214` (feat)

**Plan metadata:** _committed at plan completion_

## Files Created/Modified

### Created
- `extension/content/vocab-seam-core.js` (494 lines) — pure index builder. Exports `{ buildIndexes }` both as `module.exports` and on `self.__lexiVocabCore`. No `chrome.*`, `document.*`, `window.*`, or `fetch(` references in code (only in JSDoc comments documenting the constraint).
- `extension/content/vocab-seam.js` (231 lines) — browser IIFE. Owns `chrome.storage.local` access, `chrome.runtime.onMessage` listener, `__lexiVocabStore` + `fetch(chrome.runtime.getURL(...))` I/O, and the `self.__lexiVocab` surface.

### Modified
None. Consumer wiring and manifest reordering are Plan 02's cutover (CONTEXT "big-bang cutover in a single commit").

## buildIndexes Return Shape (clarifications beyond the plan's `<interfaces>` block)

```
{
  wordList:       Array<WordEntry>,
  nounGenus:      Map<string, 'm'|'f'|'n'>,
  verbInfinitive: Map<string, string>,     // lowercased conjugation → lemma (å-prefix stripped)
  validWords:     Set<string>,             // includes å-prefix stripped versions
  typoFix:        Map<string, string>,     // lowercased typo → correct display form
  compoundNouns:  Set<string>,             // lowercased nounbank base words only
  bigrams:        null | { [prev:lower]: { [next:lower]: number } },  // null when file missing
  freq:           Map<string, number>,     // always empty in Phase 1
  typoBank:       Map<string, string>,     // === typoFix (same reference, not a copy)
}
```

WordEntry field set (every field some consumer reads today — preserved byte-for-byte):
`word`, `display`, `translation`, `type`, `bank`, `baseWord`, `pronoun`, `genus`, `formKey`, `tenseKey`, `number`, `definiteness`, `caseName`.

## Source-of-Truth Citations

Each block was moved from a single, known location in the source:

| Logic | Source file:lines | New location |
| ----- | ----------------- | ------------ |
| Word-emission loop (all banks, all form types, feature gating) | `word-prediction.js:465–755` | `vocab-seam-core.js` → `buildWordList(data, lang, isFeatureEnabled)` |
| Bigram normalization (delete `_metadata`, lowercase, max-merge) | `word-prediction.js:769–781` | `vocab-seam-core.js` → `normalizeBigrams(raw)` |
| Index rebuild (genus, verb-infinitive, valid-words, typo-fix, compound-nouns) | `spell-check.js:136–172` | `vocab-seam-core.js` → `buildLookupIndexes(wordList, lang)` |
| `getAllowedPronouns` filtering | `word-prediction.js:128–157` | `vocab-seam-core.js` → `getAllowedPronouns(lang, isFeatureEnabled)` |
| `isTextInput` | `word-prediction.js:1805–1815` | `vocab-seam.js` → `isTextInput(el)` |
| `isFeatureEnabled` (generic → language-variant lookup) | `word-prediction.js:108–126` | `vocab-seam.js` → `buildFeaturePredicate(lang)` |
| Bundled-language list + fetch fallback | `word-prediction.js:449–456` | `vocab-seam.js` → `loadRawVocab(lang)` + `BUNDLED_LANGS` constant |
| `onReady` semantics (immediate-if-ready, otherwise queue) | `word-prediction.js:1835–1843` (polling variant) | `vocab-seam.js` → queued drain (pitfall #1 upgrade: handles late subscribers deterministically) |

## Decisions Made

_See `key-decisions` in frontmatter above._ The plan left several "claude's discretion" choices to this step; each is documented there with rationale.

The main non-obvious decision: I kept the `LANG_PRONOUN_FEATURES` table inside the core rather than passing it in from the wrapper. Rationale: the table is static per language, and keeping it in the core lets Node tests exercise pronoun filtering without stubbing a separate table. `isFeatureEnabled` remains the only per-caller input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripped `__lexiPrediction` reference from a JSDoc comment**

- **Found during:** Task 2 verification
- **Issue:** The plan's own automated verification step disallows _any_ occurrence of the string `__lexiPrediction` in `vocab-seam.js` (`grep -c "__lexiPrediction" ... === 0`). My initial comment `// Legacy surface (ported from __lexiPrediction at word-prediction.js:1829)` tripped the grep.
- **Fix:** Rephrased the comment to "ported from the old prediction seam at word-prediction.js:1829" — same information, no grep trip.
- **Files modified:** `extension/content/vocab-seam.js` (1-line comment change)
- **Verification:** Re-ran the plan's verify command → OK.
- **Committed in:** `3c6f214` (rolled into the Task 2 commit — the fix was applied before staging)

---

**Total deviations:** 1 auto-fixed (Rule 1 — comment tripping an automated check)
**Impact on plan:** Zero functional impact. The plan explicitly requires 0 `__lexiPrediction` references in the new file so Plan 02's cutover can confidently delete the old seam without dangling references.

## Issues Encountered

None. Both tasks executed as written. The source-file line ranges in the plan (`word-prediction.js:440–760`, `word-prediction.js:763–785`, `spell-check.js:136–172`) matched reality, which let the port be a mechanical copy with minimal interpretation.

## User Setup Required

None — no external service configuration. These files are dormant until Plan 02 adds them to `manifest.json` content_scripts.

## Next Phase Readiness

**Ready for Plan 02 (consumer wiring + manifest cutover):**

- `self.__lexiVocab` surface stable and complete (15 methods).
- `onReady` handles late subscribers — spell-check.js can call it whenever it loads, regardless of whether vocab finished building first.
- `isTextInput` already ported — word-prediction.js can drop its local copy in the cutover commit.
- Core's `isFeatureEnabled` parameter shape matches what the browser wrapper will feed in, and what Node tests will feed `() => true` for.

**Ready for Plan 03 (Node fixture harness):**

- `require('extension/content/vocab-seam-core.js').buildIndexes({...})` verified working against `extension/data/nb.json` (29,817 wordList entries) and `es.json` + `bigrams-es.json` (26,056 entries, 52 bigram-outer-keys).
- No shims needed — Node 18+ has `self` defined, so the footer works without a polyfill.

**Confirmed no-regressions for existing code:**

- This plan modifies zero existing files. `word-prediction.js:1829` still creates `self.__lexiPrediction`; `spell-check.js:22` still reads it. The app behavior is identical to before the plan ran. Plan 02 is where the actual cutover happens in a single atomic commit.

## Self-Check

Verifying claims made in this SUMMARY before the final metadata commit:

**Files created:**
- FOUND: extension/content/vocab-seam-core.js
- FOUND: extension/content/vocab-seam.js

**Commits:**
- FOUND: 9ef4cf0 (Task 1)
- FOUND: 3c6f214 (Task 2)

**Verification commands from plan (all passed):**
- V1: `node -e "require('./extension/content/vocab-seam-core.js')"` — OK
- V2: `buildIndexes({raw: nb.json, bigrams: null, lang: 'nb'})` — returns all 9 keys, wordList=29817, typoBank === typoFix
- V3: `grep -c "self\.__lexiVocab\b" vocab-seam.js` — 3 (≥1)
- V4: `grep -c "__lexiPrediction" vocab-seam.js` — 0
- V5: All 14 getter names + isTextInput present in vocab-seam.js
- V6: vocab-seam-core.js has no `chrome.` / `document.` / `window.` / `fetch(` references in code (only JSDoc comments documenting the constraint)

## Self-Check: PASSED

---
*Phase: 01-foundation-vocab-seam-regression-fixture*
*Completed: 2026-04-18*
