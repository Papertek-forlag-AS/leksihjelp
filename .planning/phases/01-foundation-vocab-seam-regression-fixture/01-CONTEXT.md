# Phase 1: Foundation (Vocab Seam + Regression Fixture) - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables fused into one foundation phase:

1. **Shared vocab seam** — Extract a new `self.__lexiVocab` module that owns runtime vocabulary (wordList, frequency tables, bigrams, typo bank, pre-built lookup indexes) and replaces today's `self.__lexiPrediction` seam (`word-prediction.js:1829`). Spell-check (`spell-check.js:22`) and word-prediction both consume from it, so spell-check no longer depends on word-prediction's load order and is structurally separable (INFRA-01, INFRA-04).
2. **Regression fixture harness** — Node-script runner (`scripts/check-fixtures.js`) that executes a JSONL corpus of NB/NN cases, asserts expected flagged spans + suggestions, and reports precision/recall per error class (INFRA-02).

New capabilities, ranking improvements, rule-plugin refactor, and UX polish all belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### Vocab seam — API surface
- Expose a **rich surface**: the 6 current `__lexiPrediction` methods (`getWordList`, `getLanguage`, `isReady`, `isPaused`, `isTextInput`, `onReady`) PLUS data getters (`getFrequency`, `getBigrams`, `getTypoBank`) PLUS pre-built lookup indexes currently rebuilt inside spell-check.js: `nounGenus`, `verbInfinitive`, `validWords`, `typoFix`, `compoundNouns`.
- Spell-check.js stops rebuilding indexes; it consumes the ones from `__lexiVocab`.
- Readiness coordinated via `__lexiVocab.onReady(cb)` — mirrors today's polling pattern so spell-check's `PREDICTION.onReady(...)` calls (`spell-check.js:94,117`) become one-line renames.

### Vocab seam — Migration
- **Big-bang cutover**: single PR renames `self.__lexiPrediction` → `self.__lexiVocab` in both consumers and broadens the API.
- `self.__lexiPrediction` is **deleted outright** in the same commit — no alias, no adapter. No third-party content scripts consume the old seam; there is no internal backward-compat constraint.
- Fixture harness lands in the same phase, so regressions caught by the new fixture serve as the safety net.

### Vocab seam — Location & ownership
- New file: `extension/content/vocab-seam.js`. Declared in `manifest.json` content_scripts array **before** `word-prediction.js` and `spell-check.js`.
- **vocab-seam.js owns vocabulary loading end-to-end**: reads from `window.__lexiVocabStore` (IndexedDB cache) with fallback to `fetch(chrome.runtime.getURL('data/{lang}.json'))` for bundled data. Neither word-prediction nor spell-check fetches vocab JSON themselves anymore.
- On `LANGUAGE_CHANGED`, vocab-seam drops old indexes and rebuilds for the new language (single active-language set in memory, matches today's memory profile).
- Bigrams live in the seam (matches INFRA-01's "bigrams are part of the shared surface" wording; sets up Phase 3 ranking work cleanly).

### Fixture harness — Case schema
- **Rich case shape** (per line in JSONL):
  ```json
  {
    "id": "nb-gender-hus-001",
    "text": "en hus",
    "expected": [
      { "rule_id": "gender", "word": "hus", "start": 3, "end": 6, "suggestion": "et hus" }
    ],
    "must_not_flag": []
  }
  ```
  - `expected` carries per-flag span + rule_id + suggestion → enables precision AND recall per class.
  - `must_not_flag` used only when a positive case has an adjacent trap word.
- **Clean cases** (zero-flag assertions on known-correct Norwegian text) live in dedicated `fixtures/{lang}/clean.jsonl`.

### Fixture harness — Organization
- Directory layout:
  ```
  fixtures/
    nb/
      gender.jsonl
      modal.jsonl
      saerskriving.jsonl
      typo.jsonl
      clean.jsonl
    nn/
      gender.jsonl
      modal.jsonl
      saerskriving.jsonl
      typo.jsonl
      clean.jsonl
  ```
- One file per rule class per language — scales naturally as Phase 4 adds proper-noun, dialect, code-switching classes.

### Fixture harness — Seed corpus
- Seed ~10–20 cases per (language × rule class) for Phase 1.
- Sources for seed cases: bugs the developer already knows about, the four v1 rules in `spell-check.js` (gender, modal-verb, særskriving, typo), and PROJECT.md examples (e.g., `berde → bedre`, though `berde` itself is a Phase-3 ranking case).
- Språkbanken-derived real-sentence cases are **deferred** to Phase 2/4 when data is richer.

### Fixture harness — Runner architecture
- **Split spell-check into pure core + DOM adapter:**
  - New `extension/content/spell-check-core.js` — pure rule logic: takes vocab + text, returns `findings` array. No DOM, no `chrome.*`, no timers.
  - Existing `extension/content/spell-check.js` keeps marker UI, popover, overlay, listeners; delegates rule evaluation to the core.
  - This split also prepares the rule-plugin refactor in Phase 3 (INFRA-03).
- **Node-compatible `vocab-seam-core.js`:**
  - Extract vocab-seam's pure index-building from the IIFE wrapper into `extension/content/vocab-seam-core.js` (or similar).
  - Runner reads `extension/data/{lang}.json` + bigrams + typo bank from disk, passes them into the core, receives the same indexes the browser would build.
- **Dual export footer** on both core modules: IIFE export for browser (`self.__lexiVocab = ...`) AND `module.exports` for Node — minimal footer conditional.
- Runner (`scripts/check-fixtures.js`) imports the cores via `require()`.

### Fixture harness — CLI
- Entry point: `node scripts/check-fixtures.js <lang> [--rule=<id>] [--verbose] [--json]`
  - `lang` positional: `nb`, `nn`, or `all`.
  - `--rule=<id>` filters to one rule class.
  - `--verbose` prints per-case detail.
  - `--json` emits structured report.
- **CommonJS** (`require()`) — matches the precedent in `scripts/sync-vocab.js`; no `package.json` type change.
- Node 18+ (already required by backend).
- Also wire up an npm-script convenience: `npm run check-fixtures` forwarding args, so both invocations work.

### Fixture harness — Exit codes & reporting
- **Hard-mismatch = non-zero exit** (matches success criterion #3):
  - Missing expected flag → fail.
  - Unexpected flag on a `clean.jsonl` case → fail.
  - Wrong rule_id, wrong span, or wrong suggestion string → fail.
- **Threshold numbers are reported but do not gate in Phase 1.** Precision/recall/F1 per rule class print as a console table. Numeric thresholds are set later in Phase 4 once the data layer and fixture have matured. (SC-05's "thresholds set during INFRA-02" is interpreted as "threshold *mechanism* in Phase 1, *values* fixed in Phase 4.")
- Default output: human-readable console table (rule class × P/R/F1 + pass/fail counts); failures listed under a `FAILURES:` section with mismatch reason.
- `--json` flag emits the same data as structured JSON for future CI tooling.

### Fixture harness — CI integration
- **Manual execution only in Phase 1.** No GitHub Action, no prepublish hook.
- Document the "run before release" workflow in `CLAUDE.md` under the existing Release Workflow section.
- A proper CI hook is a separate, small ask after Phase 1 lands.

### Claude's Discretion
- Exact signature/return shape of `getFrequency(word)`, `getBigrams()`, `getTypoBank()` (e.g., return `number | null` vs. `number | 0`; `Map` vs. plain object for bigrams).
- Exact contents of the dual-export footer shim.
- Directory placement of `spell-check-core.js` and `vocab-seam-core.js` within `extension/content/` vs. a new subfolder.
- Internal rule-id naming conventions in the fixture (as long as they match what `spell-check-core.js` emits).
- Whether the runner exits on the first hard mismatch or collects all failures and reports at the end (recommend: collect all, then exit non-zero).
- Specific seed-case text content — hand-author to cover the four v1 rules × NB/NN.

</decisions>

<specifics>
## Specific Ideas

- **Data-first policy (cross-cutting, reinforced by the user for this phase):** Vocab data issues belong in `papertek-vocabulary` (sibling repo consumed by `papertek-webapps` and `papertek-nativeapps` too), not as patches in Leksihjelp. If this phase surfaces data-shape issues (missing typos, wrong gender labels, structural gaps for frequency integration), the fix goes at the API source. Structural/schema changes in `papertek-vocabulary` are acceptable only when the data-side fix isn't achievable; when making such changes, consider impact on `papertek-webapps` and `papertek-nativeapps` consumers.
- The `__lexiPrediction` seam is an internal implementation detail with no third-party consumers, so the big-bang cutover carries no external-compatibility risk.
- The rule-class set in Phase 1 fixtures matches today's four v1 rules in `spell-check.js`: gender article, modal-verb form, særskriving, typo.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `self.__lexiPrediction` at `extension/content/word-prediction.js:1829` — the seam being replaced. Exposes `getWordList`, `getLanguage`, `isReady`, `isPaused`, `isTextInput`, `onReady`. Consumed by spell-check at `extension/content/spell-check.js:22-23`.
- `window.__lexiVocabStore` at `extension/content/vocab-store.js:542` — IndexedDB cache layer. Methods: `getCachedLanguage`, `getCachedGrammarFeatures`, `listCachedLanguages`, `getCachedVersion`, `downloadLanguage`, `hasAudioCached`, `getAudioFile`, `API_BASE`. Used by popup, floating-widget, word-prediction today. vocab-seam.js will be an additional consumer (not a replacement).
- `scripts/sync-vocab.js` — existing CommonJS script; precedent for `scripts/check-fixtures.js` style (require-based, Node 18+).
- `extension/data/{lang}.json`, `extension/data/bigrams-{lang}.json`, `extension/data/grammarfeatures-{lang}.json` — bundled offline data, readable from Node directly via `fs.readFileSync`.

### Established Patterns
- **IIFE content-script modules with `self.__lexi*` or `window.__lexi*` seams** — the project convention. vocab-seam.js follows this for the browser side; cores use a dual-export footer to also work under CommonJS `require()`.
- **Message-driven state updates** via `chrome.runtime.onMessage` for `LANGUAGE_CHANGED`, `PREDICTION_TOGGLED`, `SPELL_CHECK_TOGGLED`, `LEXI_PAUSED` (see `spell-check.js:113-128`). vocab-seam listens on `LANGUAGE_CHANGED` to trigger index rebuild.
- **No automated test framework in the repo today** (per `.planning/codebase/TESTING.md`). `scripts/check-fixtures.js` sets the precedent for extension-side testing; it is intentionally framework-free (plain Node) to keep dependencies minimal and match project style.
- **Manifest content_scripts ordering is meaningful** — spell-check.js today relies on word-prediction.js loading first. The new ordering: `vocab-store.js` → `vocab-seam.js` → `word-prediction.js` → `spell-check.js` → `floating-widget.js` (exact order to be confirmed when touching `manifest.json`).

### Integration Points
- `extension/manifest.json` content_scripts array — add `vocab-seam.js` and reorder so it precedes both consumers.
- `extension/content/spell-check.js:22` and `extension/content/word-prediction.js:1829` — the two call sites of the old seam.
- `spell-check.js` rebuild-indexes block (`nounGenus`, `verbInfinitive`, `validWords`, `typoFix`, `compoundNouns` at lines 33–37 + their rebuild logic) — moved into vocab-seam-core.
- `CLAUDE.md` Release Workflow section — add a "run `node scripts/check-fixtures.js all` before cutting a release" step.
- `scripts/` directory — new `check-fixtures.js` sits alongside `sync-vocab.js`.
- `fixtures/` directory at repo root (or `scripts/fixtures/` — planner's call) — new directory with `nb/` and `nn/` subdirectories, committed to git.

</code_context>

<deferred>
## Deferred Ideas

- **Språkbanken-derived real-sentence fixture cases** — labeled samples from NB N-gram 2021 or published Norwegian corpora. Defer to Phase 2 (data layer) / Phase 4 (where false-positive work needs larger negative-case coverage).
- **Numeric precision/recall thresholds** that gate CI — defer to Phase 4 once seed corpus and data layer mature enough to produce meaningful baselines.
- **GitHub Action or npm prepublish hook** wiring `check-fixtures.js` into automated CI — separate small ask after Phase 1 lands; project currently has no test CI at all.
- **Extending check-fixtures to non-Norwegian languages** (DE/ES/FR/EN) — out of scope for this milestone (SC-06 restricts spell-check to NB/NN in v1).
- **Fixture `--fix` mode** that writes suggested corrections back for diff review — not needed for Phase 1's goal; revisit if iterating on many cases becomes painful.
- **Migrating the fixture harness to `node --test`** — tracked as v2 INFRA-05; outgrow trigger is ~200 cases.
- **Routing `extension/popup/popup.js` and `extension/content/floating-widget.js` through `__lexiVocab`** for consistency — not required by INFRA-01 / INFRA-04 (they concern spell-check ↔ word-prediction coupling); revisit if convenient during Phase 3 ranking work.
- **Pilot / opt-in telemetry feeding back into the typo bank** — tracked as v2 INFRA-06 in REQUIREMENTS.md.

</deferred>

---

*Phase: 01-foundation-vocab-seam-regression-fixture*
*Context gathered: 2026-04-18*
