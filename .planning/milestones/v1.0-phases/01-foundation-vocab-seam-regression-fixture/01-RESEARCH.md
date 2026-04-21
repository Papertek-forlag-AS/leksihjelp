# Phase 1: Foundation (Vocab Seam + Regression Fixture) - Research

**Researched:** 2026-04-18
**Domain:** Chrome MV3 content-script refactor + Node-side regression harness for heuristic spell-check
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vocab seam — API surface**
- Expose a **rich surface**: the 6 current `__lexiPrediction` methods (`getWordList`, `getLanguage`, `isReady`, `isPaused`, `isTextInput`, `onReady`) PLUS data getters (`getFrequency`, `getBigrams`, `getTypoBank`) PLUS pre-built lookup indexes currently rebuilt inside spell-check.js: `nounGenus`, `verbInfinitive`, `validWords`, `typoFix`, `compoundNouns`.
- Spell-check.js stops rebuilding indexes; it consumes the ones from `__lexiVocab`.
- Readiness coordinated via `__lexiVocab.onReady(cb)` — mirrors today's polling pattern so spell-check's `PREDICTION.onReady(...)` calls (`spell-check.js:94,117`) become one-line renames.

**Vocab seam — Migration**
- **Big-bang cutover**: single PR renames `self.__lexiPrediction` → `self.__lexiVocab` in both consumers and broadens the API.
- `self.__lexiPrediction` is **deleted outright** in the same commit — no alias, no adapter. No third-party content scripts consume the old seam; there is no internal backward-compat constraint.
- Fixture harness lands in the same phase, so regressions caught by the new fixture serve as the safety net.

**Vocab seam — Location & ownership**
- New file: `extension/content/vocab-seam.js`. Declared in `manifest.json` content_scripts array **before** `word-prediction.js` and `spell-check.js`.
- **vocab-seam.js owns vocabulary loading end-to-end**: reads from `window.__lexiVocabStore` (IndexedDB cache) with fallback to `fetch(chrome.runtime.getURL('data/{lang}.json'))` for bundled data. Neither word-prediction nor spell-check fetches vocab JSON themselves anymore.
- On `LANGUAGE_CHANGED`, vocab-seam drops old indexes and rebuilds for the new language (single active-language set in memory, matches today's memory profile).
- Bigrams live in the seam (matches INFRA-01's "bigrams are part of the shared surface" wording; sets up Phase 3 ranking work cleanly).

**Fixture harness — Case schema**
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

**Fixture harness — Organization**
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

**Fixture harness — Seed corpus**
- Seed ~10–20 cases per (language × rule class) for Phase 1.
- Sources for seed cases: bugs the developer already knows about, the four v1 rules in `spell-check.js` (gender, modal-verb, særskriving, typo), and PROJECT.md examples (e.g., `berde → bedre`, though `berde` itself is a Phase-3 ranking case).
- Språkbanken-derived real-sentence cases are **deferred** to Phase 2/4 when data is richer.

**Fixture harness — Runner architecture**
- **Split spell-check into pure core + DOM adapter:**
  - New `extension/content/spell-check-core.js` — pure rule logic: takes vocab + text, returns `findings` array. No DOM, no `chrome.*`, no timers.
  - Existing `extension/content/spell-check.js` keeps marker UI, popover, overlay, listeners; delegates rule evaluation to the core.
  - This split also prepares the rule-plugin refactor in Phase 3 (INFRA-03).
- **Node-compatible `vocab-seam-core.js`:**
  - Extract vocab-seam's pure index-building from the IIFE wrapper into `extension/content/vocab-seam-core.js` (or similar).
  - Runner reads `extension/data/{lang}.json` + bigrams + typo bank from disk, passes them into the core, receives the same indexes the browser would build.
- **Dual export footer** on both core modules: IIFE export for browser (`self.__lexiVocab = ...`) AND `module.exports` for Node — minimal footer conditional.
- Runner (`scripts/check-fixtures.js`) imports the cores via `require()`.

**Fixture harness — CLI**
- Entry point: `node scripts/check-fixtures.js <lang> [--rule=<id>] [--verbose] [--json]`
  - `lang` positional: `nb`, `nn`, or `all`.
  - `--rule=<id>` filters to one rule class.
  - `--verbose` prints per-case detail.
  - `--json` emits structured report.
- **CommonJS** (`require()`) — matches the precedent in `scripts/sync-vocab.js`; no `package.json` type change.
- Node 18+ (already required by backend).
- Also wire up an npm-script convenience: `npm run check-fixtures` forwarding args, so both invocations work.

**Fixture harness — Exit codes & reporting**
- **Hard-mismatch = non-zero exit** (matches success criterion #3):
  - Missing expected flag → fail.
  - Unexpected flag on a `clean.jsonl` case → fail.
  - Wrong rule_id, wrong span, or wrong suggestion string → fail.
- **Threshold numbers are reported but do not gate in Phase 1.** Precision/recall/F1 per rule class print as a console table. Numeric thresholds are set later in Phase 4 once the data layer and fixture have matured. (SC-05's "thresholds set during INFRA-02" is interpreted as "threshold *mechanism* in Phase 1, *values* fixed in Phase 4.")
- Default output: human-readable console table (rule class × P/R/F1 + pass/fail counts); failures listed under a `FAILURES:` section with mismatch reason.
- `--json` flag emits the same data as structured JSON for future CI tooling.

**Fixture harness — CI integration**
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

### Deferred Ideas (OUT OF SCOPE)

- **Språkbanken-derived real-sentence fixture cases** — labeled samples from NB N-gram 2021 or published Norwegian corpora. Defer to Phase 2 (data layer) / Phase 4.
- **Numeric precision/recall thresholds** that gate CI — defer to Phase 4 once seed corpus and data layer mature enough to produce meaningful baselines.
- **GitHub Action or npm prepublish hook** wiring `check-fixtures.js` into automated CI — separate small ask after Phase 1 lands.
- **Extending check-fixtures to non-Norwegian languages** (DE/ES/FR/EN) — out of scope for this milestone (SC-06 restricts spell-check to NB/NN in v1).
- **Fixture `--fix` mode** that writes suggested corrections back for diff review — not needed for Phase 1's goal.
- **Migrating the fixture harness to `node --test`** — tracked as v2 INFRA-05; outgrow trigger is ~200 cases.
- **Routing `extension/popup/popup.js` and `extension/content/floating-widget.js` through `__lexiVocab`** for consistency — not required by INFRA-01 / INFRA-04.
- **Pilot / opt-in telemetry feeding back into the typo bank** — tracked as v2 INFRA-06 in REQUIREMENTS.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Shared `window.__lexiVocab` module exposes wordList, frequency tables, bigrams, and lookup helpers, replacing the narrow `__lexiPrediction` seam so spell-check no longer depends on word-prediction's load order | Standard Stack (vocab-seam.js architecture), Architecture Patterns (owner module pattern), Code Examples (dual-export footer, seam API shape) |
| INFRA-02 | Node-script regression fixture harness under `scripts/` runs a JSONL corpus of NB/NN sentences, asserts expected flagged spans + suggested fixes, and reports precision/recall per error class | Standard Stack (zero-dep Node runner, JSONL), Architecture Patterns (pure-core + adapter split, CLI shape), Code Examples (JSONL parser, P/R computation), Don't Hand-Roll (JSON.parse per line — don't pull in ndjson) |
| INFRA-04 | Spell-check remains structurally separable — no imports from word-prediction internals, no premium/policy coupling; the module could later be extracted to `skriv.papertek.app` without touching prediction code | Architecture Patterns (grep-verifiable decoupling, no `__lexiPrediction` references), Common Pitfalls (load-order drift, implicit coupling through indexes) |
</phase_requirements>

## Summary

Phase 1 is a pure refactor + tooling phase: no new user-visible behavior, no new runtime dependencies, no ML, no external APIs. Two deliverables are fused: (1) extract a `self.__lexiVocab` content-script module that owns vocab loading and all derived indexes end-to-end, so spell-check stops reaching into word-prediction's internals; (2) land `scripts/check-fixtures.js` — a plain-Node JSONL regression harness that locks current NB/NN behavior and reports per-rule-class precision/recall.

The refactor is non-trivial because the spell-check module today is tightly coupled to word-prediction in three ways: (a) it polls `self.__lexiPrediction` for readiness, (b) it rebuilds its own indexes from `getWordList()` on every language change, and (c) manifest load order is meaningful — spell-check returns early if `__lexiPrediction` is undefined. All three couplings disappear once `vocab-seam.js` loads first and exposes the richer surface. The rule-evaluation logic must be split into a pure core (`spell-check-core.js` — no DOM, no `chrome.*`, no timers) to make the same code runnable under Node for the fixture harness; the DOM adapter stays in `spell-check.js`.

The fixture harness is framework-free. Node 18+ already reads JSON/JSONL trivially (`fs.readFileSync` + `split('\n').map(JSON.parse)`); precision/recall is 15 lines of math. The discipline is authoring honest ground-truth cases (`expected: [...]` per line with spans + rule_id + suggestion) rather than snapshots of v1 output. Dual-export footers (`if (typeof module !== 'undefined') module.exports = ...`) make the cores runnable in both the browser IIFE environment and CommonJS `require()` — a well-established universal-module pattern.

**Primary recommendation:** Build vocab-seam.js + spell-check-core.js + vocab-seam-core.js as three sibling files in `extension/content/`, wire the dual-export footer on the two `-core.js` files, then author `scripts/check-fixtures.js` as a single CommonJS file that `require()`s the cores, loads vocab from disk directly, and computes P/R per rule class from ground-truth JSONL. Cut the `__lexiPrediction` seam in the same PR — the fresh fixture is its safety net.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js runtime | ≥18 | Script runner for `check-fixtures.js` | Already required by backend; has native `fetch`, `structuredClone`, `--test`, `fs/promises`; no install step |
| CommonJS (`require`) | built-in | Module system for `scripts/check-fixtures.js` and core exports | Precedent: `scripts/sync-vocab.js` uses `require()`; no `"type": "module"` in package.json, so adding CJS adds zero config |
| Vanilla IIFE | built-in | Content-script module pattern for `vocab-seam.js` | Chrome MV3 content scripts do not load ES modules; IIFE + `self.__lexi*` is the existing project convention |
| `fs.readFileSync` + `JSON.parse` + `String.prototype.split('\n')` | built-in | JSONL parsing in the fixture runner | One-file fixture means ~100 lines total; no need for ndjson/fast-json-parse |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `path` (built-in) | — | Resolve `extension/data/*.json` paths relative to repo root | Always in Node script |
| `process.exit(code)` | built-in | Non-zero exit on hard mismatch (success criterion #3) | In the CLI entry point after aggregating results |
| `process.argv.slice(2)` | built-in | Parse `<lang> [--rule=<id>] [--verbose] [--json]` | Keep argv parsing ~15 lines; no `commander`/`yargs` dep |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain Node script | `node --test` built-in runner | Nicer output, stricter structure — but triggers INFRA-05 explicitly ("migrate once fixture exceeds ~200 cases"). Premature for Phase 1 seed (~80–160 cases total). |
| Plain Node script | Vitest / Jest | Adds dev deps, config file, setup overhead. Project has zero test infra today; CONTEXT explicitly says keep dependencies minimal and match project style. |
| CommonJS `require()` | ES modules (`.mjs`) | Would require `"type": "module"` in `package.json` or `.mjs` extensions, diverging from `sync-vocab.js`. Zero benefit for this single-file script. |
| Dual-export footer (`module.exports`) | `globalThis.__lexiVocab` only | Would force the fixture runner to run under a browser-like shim (jsdom, etc.) to access the seam. Pure-core + dual-footer keeps Node runner to zero deps. |
| `commander` / `yargs` for CLI args | Hand-rolled `argv.slice(2)` loop | For 3 flags and 1 positional arg, a custom parser is ~15 lines; external dep adds `node_modules` weight to dev-only code. |

**Installation:** No runtime or dev dependencies added. `package.json` only gets new npm scripts:
```bash
# package.json scripts additions only — no `npm install` needed
"check-fixtures": "node scripts/check-fixtures.js",
"check-fixtures:nb": "node scripts/check-fixtures.js nb",
"check-fixtures:nn": "node scripts/check-fixtures.js nn"
```

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── content/
│   ├── vocab-store.js           # (unchanged) IndexedDB cache; provides __lexiVocabStore
│   ├── vocab-seam-core.js       # NEW: pure index builder; dual-export (browser IIFE + CJS)
│   ├── vocab-seam.js            # NEW: browser IIFE wrapper; owns loading, msg handling, onReady
│   ├── floating-widget.js       # (unchanged for this phase; see Deferred)
│   ├── word-prediction.js       # REFACTORED: drops own loadWordList+loadBigrams; reads __lexiVocab
│   ├── spell-check-core.js      # NEW: pure check(text, vocab, cursor) → findings[]; dual-export
│   └── spell-check.js           # REFACTORED: UI + adapter; delegates rule eval to core
├── manifest.json                # REORDERED content_scripts (see below)
└── data/
    ├── {lang}.json              # (unchanged) bundled vocab
    └── bigrams-{lang}.json      # (unchanged) bundled bigrams

scripts/
├── sync-vocab.js                # (unchanged) precedent for style
└── check-fixtures.js            # NEW: CJS runner; require()s the two -core.js modules

fixtures/
├── nb/
│   ├── gender.jsonl
│   ├── modal.jsonl
│   ├── saerskriving.jsonl       # filename ASCII; content UTF-8 ("særskriving")
│   ├── typo.jsonl
│   └── clean.jsonl
└── nn/
    ├── gender.jsonl
    ├── modal.jsonl
    ├── saerskriving.jsonl
    ├── typo.jsonl
    └── clean.jsonl
```

**manifest.json `content_scripts` order after Phase 1:**
```
i18n/strings.js
content/vocab-store.js       ← already first; provides __lexiVocabStore
content/vocab-seam.js        ← NEW: must precede word-prediction and spell-check
content/floating-widget.js   ← current position preserved
content/word-prediction.js   ← now consumes __lexiVocab (not the reverse)
content/spell-check.js       ← last; consumes __lexiVocab; no dependency on word-prediction
```

**Note on the current manifest:** `floating-widget.js` currently loads between `vocab-store.js` and `word-prediction.js`. This phase does not change that relative position — `vocab-seam.js` is inserted before `word-prediction.js` but after `vocab-store.js`. Whether `vocab-seam.js` goes before or after `floating-widget.js` is Claude's Discretion; recommendation: put `vocab-seam.js` *immediately after* `vocab-store.js` (so both vocab-layer scripts are adjacent) and leave `floating-widget.js` in its current slot.

### Pattern 1: Owner Module (Single Source of Truth)

**What:** One module (`vocab-seam.js`) exclusively owns vocab loading, derived-index construction, language-change reloads, and readiness signaling. Consumers (`word-prediction.js`, `spell-check.js`) subscribe to its readiness and read via getter methods. No consumer ever calls `fetch(...)` for vocab JSON or `__lexiVocabStore.getCachedLanguage(...)` directly.

**When to use:** Whenever multiple content scripts need the same derived data and today each rebuilds it from scratch. The current repo has exactly this smell: spell-check.js lines 136–172 rebuild `nounGenus`, `verbInfinitive`, `validWords`, `typoFix`, `compoundNouns` by walking `PREDICTION.getWordList()` — while word-prediction.js lines 466–754 already walked the same raw data to build `wordList`.

**Example (browser IIFE wrapper, seam shape):**
```javascript
// extension/content/vocab-seam.js — browser IIFE wrapper
// Source: project convention (see vocab-store.js:542, word-prediction.js:1829)
(function () {
  'use strict';

  // The pure core does all the index building. It lives in vocab-seam-core.js
  // and also exports under CommonJS for the Node fixture runner.
  const core = self.__lexiVocabCore; // set by vocab-seam-core.js IIFE footer
  if (!core) { console.error('[lexi-vocab] core not loaded'); return; }

  let currentLang = 'en';
  let state = null;          // { wordList, nounGenus, verbInfinitive, validWords,
                             //   typoFix, compoundNouns, bigrams, freq, typoBank }
  let ready = false;
  let paused = false;
  const readyCallbacks = [];

  init();

  async function init() {
    const stored = await new Promise(r =>
      chrome.storage.local.get(['language', 'lexiPaused'], r));
    currentLang = stored.language || 'en';
    paused = !!stored.lexiPaused;
    await loadForLanguage(currentLang);
    chrome.runtime.onMessage.addListener(onMessage);
  }

  async function loadForLanguage(lang) {
    ready = false;
    const raw = await loadRaw(lang);          // vocab JSON
    const bigrams = await loadBigrams(lang);  // bigram JSON
    state = core.buildIndexes({ raw, bigrams, lang });
    ready = true;
    const callbacks = readyCallbacks.splice(0);
    for (const cb of callbacks) try { cb(); } catch (_) {}
  }

  async function loadRaw(lang) {
    if (window.__lexiVocabStore) {
      const cached = await window.__lexiVocabStore.getCachedLanguage(lang);
      if (cached) return cached;
    }
    const bundled = ['nb', 'nn', 'en'];
    if (!bundled.includes(lang)) return null;
    const url = chrome.runtime.getURL(`data/${lang}.json`);
    const res = await fetch(url);
    return res.json();
  }

  async function loadBigrams(lang) {
    try {
      const url = chrome.runtime.getURL(`data/bigrams-${lang}.json`);
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    } catch (_) { return null; }
  }

  function onMessage(msg) {
    if (msg.type === 'LANGUAGE_CHANGED') {
      currentLang = msg.language;
      loadForLanguage(currentLang);
    } else if (msg.type === 'LEXI_PAUSED') {
      paused = !!msg.paused;
    }
    // Note: PREDICTION_TOGGLED / SPELL_CHECK_TOGGLED remain consumer-local
    // because they are policy flags, not vocab state.
  }

  self.__lexiVocab = {
    // Legacy surface (from __lexiPrediction)
    getWordList: () => state ? state.wordList : [],
    getLanguage: () => currentLang,
    isReady: () => ready,
    isPaused: () => paused,
    isTextInput,
    onReady(cb) {
      if (ready) { try { cb(); } catch (_) {} return; }
      readyCallbacks.push(cb);
    },
    // New data getters
    getFrequency: (word) => (state?.freq?.get(word.toLowerCase()) ?? null),
    getBigrams: () => (state?.bigrams || null),
    getTypoBank: () => (state?.typoBank || null),
    // Pre-built indexes (previously rebuilt inside spell-check.js)
    getNounGenus: () => (state?.nounGenus || new Map()),
    getVerbInfinitive: () => (state?.verbInfinitive || new Map()),
    getValidWords: () => (state?.validWords || new Set()),
    getTypoFix: () => (state?.typoFix || new Map()),
    getCompoundNouns: () => (state?.compoundNouns || new Set()),
  };

  function isTextInput(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email'].includes(type);
    }
    return false;
  }
})();
```

### Pattern 2: Pure-Core + DOM-Adapter Split

**What:** Split a content-script module into two files: a pure core (no DOM, no `chrome.*`, no timers, no `window`/`document`) that takes its inputs as arguments and returns findings/data, plus a thin adapter that wires the core to the live page (DOM events, marker rendering, popover UI). The core is re-usable under Node via a `module.exports` footer.

**When to use:** Whenever the same logic must run in-browser for real users AND in-Node for tests/fixtures. This is exactly the spell-check case: rule evaluation is a pure function of `(text, vocabIndexes, cursorPos) → findings[]`, but today it lives inside the same file as marker rendering, popover UI, and `chrome.storage` lookups.

**Example (pure core skeleton):**
```javascript
// extension/content/spell-check-core.js
// Source: derived from existing spell-check.js:196–317 (check function + helpers).
// Strip DOM, chrome.*, timers, dismissed set — those remain in the adapter.
(function () {
  'use strict';

  function check(text, vocab, opts = {}) {
    const { cursorPos = null, lang = 'nb' } = opts;
    const { nounGenus, verbInfinitive, validWords, typoFix, compoundNouns } = vocab;
    // ...copy logic from spell-check.js lines 196–317 (check body),
    //    with `PREDICTION`/`this` references replaced by vocab arg.
    return findings;
  }

  // Helpers (editDistance, findFuzzyNeighbor, matchCase, etc.) go here.

  const api = { check /* , exposeHelpersIfNeeded */ };

  // Dual export: browser IIFE seam + Node CommonJS.
  // Source for pattern: 2ality.com/2011/08/universal-modules.html
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') self.__lexiSpellCore = api;
})();
```

**Adapter (in the browser):**
```javascript
// extension/content/spell-check.js — adapter
(function () {
  'use strict';
  const VOCAB = self.__lexiVocab;
  const CORE  = self.__lexiSpellCore;
  if (!VOCAB || !CORE) return; // manifest ordering guarantees both are ready

  // ...existing UI state, listeners, markers, popover.

  function runCheck() {
    if (!activeEl || !enabled || paused) { hideOverlay(); return; }
    const { text, cursor } = readInput(activeEl);
    if (!text || text.length < 3) { hideOverlay(); return; }
    const lang = VOCAB.getLanguage();
    const findings = CORE.check(text, {
      nounGenus: VOCAB.getNounGenus(),
      verbInfinitive: VOCAB.getVerbInfinitive(),
      validWords: VOCAB.getValidWords(),
      typoFix: VOCAB.getTypoFix(),
      compoundNouns: VOCAB.getCompoundNouns(),
    }, { cursorPos: cursor, lang });
    // ...filter dismissed, render markers.
  }
})();
```

### Pattern 3: Dual-Export (Universal Module) Footer

**What:** A minimal footer that makes a file usable both as a browser IIFE (writes to `self.__lexiFoo`) and as a Node CommonJS module (writes to `module.exports`). The same source code runs in both environments unchanged.

**When to use:** On the `-core.js` files (`vocab-seam-core.js`, `spell-check-core.js`) — anywhere Phase 1 needs the same logic runnable under both the content-script IIFE and the Node fixture runner.

**Example:**
```javascript
// End of file — inside the IIFE:
const api = { buildIndexes, /* ... */ };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof self !== 'undefined') self.__lexiVocabCore = api;
// Note: `self` is defined in content scripts AND in Node 20+ (global alias);
// guard with `typeof self` to stay safe under older Node or web-worker contexts.
```

### Pattern 4: Ground-Truth JSONL Fixtures (Not Snapshots)

**What:** Each line is a JSON object authored by a human recording the *correct* answer — not a capture of current code output. The runner diffs model output against ground truth. When a rule is fixed, the fixture is unchanged; when a rule regresses, the fixture catches it.

**When to use:** Every spell-check fixture for the rest of this milestone. The temptation to run the current spell-check over a corpus and write the output into `expected` must be resisted — it locks in v1 bugs and turns every real improvement into a red test.

**Example (one line from `fixtures/nb/gender.jsonl`):**
```json
{"id":"nb-gender-hus-001","text":"en hus","expected":[{"rule_id":"gender","word":"en","start":0,"end":2,"suggestion":"et"}],"must_not_flag":[]}
```

Note: the `start`/`end` are over *the article token* in the current spell-check implementation (see `spell-check.js:235-244` — the gender finding is emitted for the article, not the noun). Fixture authors must match what `spell-check-core.js` actually emits; document this in fixture authoring notes so reviewers don't "correct" good fixtures.

### Anti-Patterns to Avoid

- **Keeping `__lexiPrediction` as an alias.** CONTEXT explicitly rejects this. An alias creates two ways to do the same thing; new code will call whichever shows up first in autocomplete. Delete outright.
- **Reading vocab from disk *inside* the pure core.** The core takes the already-loaded JSON as an argument. The *runner* reads disk; the *browser wrapper* reads `fetch`/IndexedDB. Keep the core I/O-free.
- **Mocking `chrome.*` in the Node runner.** The pure cores never touch `chrome.*`. If the runner is ever tempted to stub `chrome.storage`, that means something leaked from the adapter into the core — fix at the source.
- **Snapshot fixtures.** "Run current spell-check and capture output" locks in bugs. Author ground truth by hand, even if it means a smaller seed corpus.
- **Mixed ASCII/UTF-8 fixture filenames.** Use ASCII filename (`saerskriving.jsonl`) but UTF-8 content. Filesystem and git semantics for non-ASCII filenames vary across macOS/Linux/Windows and across CI runners.
- **Testing the DOM adapter end-to-end in Node.** jsdom + chrome-api shim is the INFRA-05 escalation path, not Phase 1. Pure core tests hit the logic that matters.
- **Bundling frequency tables (`getFrequency`) into vocab-seam in Phase 1.** CONTEXT exposes the *getter* now so callers compile. The *data* for `freq-{lang}.json` lands in Phase 2. Have the getter return `null` until Phase 2; don't block Phase 1 on Phase 2 data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing JSONL | Streaming ndjson parser | `fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)` | Fixture files are small (~20 lines each × 5 files × 2 langs = ~200 lines). Streaming is overkill; a 3-line parser is maintenance-free. |
| CLI arg parsing | `commander`/`yargs` | Hand-rolled `argv.slice(2)` loop | Three flags + one positional. External dep adds 30+ transitive deps for dev-only code. |
| Precision/recall math | `ml-metrics` / `sklearn`-style npm pkg | Inline `tp / (tp + fp)` and `tp / (tp + fn)` | Three formulas (P, R, F1). A library hides them behind bad documentation. |
| Diff output | `deep-diff` | Inline `JSON.stringify` comparison + specific mismatch message | Findings are small objects (4–5 keys). A generic differ's output is less readable than a custom "expected rule_id `gender`, got `typo`" message. |
| Chrome extension bundler | `crxjs` / `vite-plugin-chrome-extension` / esbuild | Keep vanilla IIFEs | Project has zero build step today. Introducing a bundler is a far bigger change than extracting a file and adding a dual-export footer. CONTEXT explicitly keeps the project style. |
| ES-module→CommonJS bridging | `esm` loader / `.mjs` shim | Dual-export footer (one conditional line) | Universal module pattern is a 2-line footer. Any build tool is extra complexity. |
| Re-implement the Damerau-Levenshtein | npm `fast-levenshtein`, `leven` | Move the existing 30-line `editDistance` (spell-check.js:337) into the core | The existing code handles adjacent transposition (critical for `berde→bedre`); off-the-shelf Levenshtein does not, and the code is already battle-tested. |
| IndexedDB mock for Node | `fake-indexeddb` | Read `extension/data/{lang}.json` from disk directly in the runner | The runner bypasses IndexedDB entirely. `vocab-seam-core.js` accepts raw JSON; disk-reading is one `JSON.parse(fs.readFileSync(...))`. |

**Key insight:** This phase is a refactor + tooling phase. Every "library" that looks tempting here either hides a trivial problem (3-line JSONL parser), adds a build step (bundler), or maps to a feature the adapter handles (chrome shim). Zero new runtime or dev deps is achievable and desirable — and it aligns with the SC-06 constraint that prohibits new external dependencies.

## Common Pitfalls

### Pitfall 1: Load-order re-entrancy (spell-check runs before vocab-seam is ready)
**What goes wrong:** Content scripts in the same `content_scripts` entry load in array order but execute synchronously; their async init (`chrome.storage.local.get`, `fetch`) resolves out of order. Spell-check can see `self.__lexiVocab` defined but `isReady()` returning false forever if the callback plumbing is wrong.
**Why it happens:** The existing code polls `__lexiPrediction.onReady(cb)` with a 15-second timeout (word-prediction.js:1836–1843). A naïve port that only fires callbacks added *before* `ready` flips silently drops late subscribers.
**How to avoid:** `onReady(cb)` must check `if (ready) cb()` immediately *and* push to a pending list otherwise; the flip-to-ready code drains the list. Keep the 15-second polling fallback for pathological cases. Test by injecting a 200ms delay in `loadForLanguage` and confirming spell-check still initializes.
**Warning signs:** Spell-check logs "vocab ready" on some pages but not others; `__lexiSpell.validWordsSize()` returns 0 on first load but non-zero on reload.

### Pitfall 2: Silent data-shape drift between loaders
**What goes wrong:** word-prediction.js's `loadWordList` emits entries shaped like `{word, display, translation, type, bank, baseWord, pronoun, ...}`. If vocab-seam-core's `buildIndexes` follows a slightly different shape (e.g., drops `bank`), spell-check.js's rebuildIndexes stops finding `entry.bank === 'nounbank'` and every noun silently vanishes.
**Why it happens:** During refactor it's tempting to "clean up" entry shapes. The shape is an implicit contract.
**How to avoid:** Move the *existing* `loadWordList` logic from word-prediction.js into vocab-seam-core.js byte-for-byte first, THEN add the new index builders in a second commit. Diff the emitted `wordList` before/after to confirm identity. Write a small fixture case per bank type (verb, noun, adj, phrase) and run it through the new seam before cutting `__lexiPrediction`.
**Warning signs:** After cutover, `validWords.size` differs from pre-cutover (check via `window.__lexiSpell.validWordsSize()` in devtools).

### Pitfall 3: Case-sensitivity inconsistency across indexes
**What goes wrong:** `wordList` entries use lowercased `word` but display-cased `display` (word-prediction.js:482–485). `nounGenus`/`verbInfinitive`/`validWords` rebuilt in spell-check.js also lowercase via the same source. Fixture cases author display-cased text (`"Skolesekk"`); the tokenizer lowercases before lookup. If any of the new seam's indexes diverges on case handling, you get invisible misses.
**Why it happens:** Different code paths historically lowercased at different points. The unification risk during refactor is real.
**How to avoid:** Document in `vocab-seam-core.js` that every Map/Set key is lowercase. Add an assertion in debug mode. Fixture cases carry the display string (`text: "en hus"`) and the tokenizer lowercases before index lookup — the fixture doesn't need to know about lowercasing.
**Warning signs:** Fixture fails with "expected flag on 'Hus' at [3,6]", got no flag; but typing "en hus" in a live textarea works.

### Pitfall 4: Bigram normalization asymmetry
**What goes wrong:** word-prediction.js:769–781 loads bigrams and normalizes: `delete raw._metadata`, lowercase keys and value keys, merge duplicates taking `max(weight)`. A naïve move into vocab-seam that *forgets* the `_metadata` deletion exposes `_metadata` as a bigram key; a forget of the lowercasing makes case-mismatched pairs invisible.
**Why it happens:** This is a small but meaningful normalization step hidden at the end of a function.
**How to avoid:** Preserve the normalization exactly when moving into `vocab-seam-core.js`. Unit-check with one fixture line that the bigram map exposes `{'guten': {'morgen': 42}}` not `{'Guten': ..., '_metadata': ...}`.
**Warning signs:** Phase 3 ranking work starts returning weird suggestions because bigram keys stop matching normalized input tokens.

### Pitfall 5: Fixture span arithmetic off-by-one
**What goes wrong:** Spell-check-core emits `{start, end}` for each finding. The existing code uses `end = m.index + m[0].length` (spell-check.js:188) — i.e., `end` is exclusive (past-the-end). Fixture authors who think `end` is inclusive write `"en hus" → word "hus", start:3, end:5` instead of `end:6`, and every expected fixture fails.
**Why it happens:** Some APIs use inclusive end, some exclusive. JSON fixtures don't self-document.
**How to avoid:** Document the convention ("end is exclusive, Python-style") at the top of each fixture file in a `// first-line-comment ignored by parser` — except JSON doesn't allow comments. Alternative: put the convention in `fixtures/README.md` and validate on load (runner rejects `end <= start`). Provide a helper `assertSpan(text, start, end, word)` in the runner that fails fast with "expected 'hus', got 'hu'" if the fixture's span is off.
**Warning signs:** Entire rule class of fixtures fails on first run with identical off-by-one mismatches.

### Pitfall 6: `dedupeOverlapping` non-determinism
**What goes wrong:** spell-check.js:452–459 keeps the earlier-listed finding in overlapping pairs. If rule order changes during refactor (say, typo is evaluated before gender), overlapping findings flip — and fixture assertions silently fail because the "winner" changed.
**Why it happens:** The check() loop ordering is load-bearing; comments (spell-check.js:450) acknowledge this.
**How to avoid:** Preserve the exact rule-evaluation order from spell-check.js into spell-check-core.js. Add a test fixture that exercises a deliberate overlap (a word that's both a known typo AND forms a compound with its neighbor) to pin down the tie-breaker.
**Warning signs:** Fixture case that used to pass now reports a different `rule_id` than expected.

### Pitfall 7: Running the Node runner from the wrong CWD
**What goes wrong:** `scripts/check-fixtures.js` does `fs.readFileSync('extension/data/nb.json')`. Running from inside `scripts/` instead of the repo root blows up with ENOENT.
**Why it happens:** Developers naturally `cd scripts && node check-fixtures.js nb`.
**How to avoid:** Resolve paths against `__dirname` (`path.join(__dirname, '..', 'extension', 'data', ...)`) as `sync-vocab.js` already does (scripts/sync-vocab.js:31). Never rely on CWD.
**Warning signs:** "ENOENT: no such file or directory, open 'extension/data/nb.json'".

### Pitfall 8: Encoding issues in fixture filenames and content
**What goes wrong:** A `særskriving.jsonl` filename or a fixture line containing `æøå` without explicit UTF-8 encoding on read breaks on Windows or on CI runners with different default encodings.
**Why it happens:** `fs.readFileSync(path)` returns a Buffer by default; `.toString()` uses UTF-8 on most platforms but Node's behavior around filesystem names depends on OS normalization (HFS+ NFD vs. ext4 NFC).
**How to avoid:** ASCII-only filenames (`saerskriving.jsonl`). Always `fs.readFileSync(path, 'utf8')`. Use `\u00e6` etc. in-line only if needed to debug; fixture content itself is UTF-8 unchanged.
**Warning signs:** Fixture works on dev macOS, fails on Linux CI with mojibake or `ENOENT`.

### Pitfall 9: Test cases for the *adapter* sneaking into core tests
**What goes wrong:** The fixture runner tests `check()`. A developer adds a "cursor skip" fixture case that depends on `activeEl` or `window.getSelection()`. The runner breaks in Node because it has no DOM.
**How to avoid:** Fixture cases express only what the pure core handles: text, expected findings, an optional cursorPos number. Marker rendering, popover clicks, and storage-based dismissals are NOT in scope for Phase 1 fixtures.
**Warning signs:** Runner starts needing `global.document = ...` stubs.

### Pitfall 10: Fixture drift between rule_id emission and fixture expectation
**What goes wrong:** spell-check.js emits `type: 'gender' | 'modal_form' | 'sarskriving' | 'typo'` (spell-check.js:236, 252, 271, 283). Fixtures author `rule_id`. A mismatch (fixture says `rule_id: "gender_article"` but code emits `type: "gender"`) turns every case into a failure.
**How to avoid:** The core's output field name is `rule_id` from Phase 1 forward. When moving spell-check.js:235–293 into the core, rename `type:` to `rule_id:` at the same time. Keep the rule-id strings **exactly** as currently emitted (`gender`, `modal_form`, `sarskriving`, `typo`) so downstream UI code that reads `type` doesn't silently break — adapter shim: `findings.forEach(f => f.type = f.rule_id)` if UI still reads `type`. (Recommend a one-commit rename across adapter + core to avoid shim rot.)
**Warning signs:** All fixtures fail with `expected rule_id "gender", got undefined`.

## Code Examples

Verified patterns from reading the existing repo and the universal-module pattern source.

### Example 1: CLI entry in `scripts/check-fixtures.js` (CommonJS, zero deps)

```javascript
#!/usr/bin/env node
// scripts/check-fixtures.js — zero-dep JSONL regression harness
// Precedent: scripts/sync-vocab.js (CommonJS, Node 18+, path-relative IO)

const fs = require('fs');
const path = require('path');

const vocabCore = require('../extension/content/vocab-seam-core.js');
const spellCore = require('../extension/content/spell-check-core.js');

const DATA_DIR    = path.join(__dirname, '..', 'extension', 'data');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

function parseArgs(argv) {
  const out = { lang: null, rule: null, verbose: false, json: false };
  for (const arg of argv) {
    if (arg.startsWith('--rule=')) out.rule = arg.slice('--rule='.length);
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--json') out.json = true;
    else if (!out.lang && !arg.startsWith('--')) out.lang = arg;
  }
  return out;
}

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.startsWith('//'))
    .map((line, idx) => {
      try { return JSON.parse(line); }
      catch (e) { throw new Error(`${file}:${idx + 1}: ${e.message}`); }
    });
}

function loadVocab(lang) {
  const raw     = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${lang}.json`), 'utf8'));
  const bigrams = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `bigrams-${lang}.json`), 'utf8'));
  return vocabCore.buildIndexes({ raw, bigrams, lang });
}

function matchesExpected(finding, exp) {
  return finding.rule_id === exp.rule_id &&
         finding.start   === exp.start   &&
         finding.end     === exp.end     &&
         finding.fix     === exp.suggestion;
}

function runCase(kase, vocab, lang) {
  const found = spellCore.check(kase.text, vocab, { lang });
  const matched = new Set();
  const missing = [];
  for (const exp of (kase.expected || [])) {
    const hitIdx = found.findIndex((f, i) => !matched.has(i) && matchesExpected(f, exp));
    if (hitIdx === -1) missing.push(exp);
    else matched.add(hitIdx);
  }
  const extra = found.filter((_, i) => !matched.has(i));
  return { id: kase.id, tp: matched.size, fn: missing.length, fp: extra.length,
           ok: missing.length === 0 && extra.length === 0, missing, extra };
}

function summarize(results, perRule) {
  // Compute P, R, F1 per rule class and totals.
  const tp = perRule.tp, fp = perRule.fp, fn = perRule.fn;
  const P  = tp + fp ? tp / (tp + fp) : 1;
  const R  = tp + fn ? tp / (tp + fn) : 1;
  const F1 = P + R ? 2 * P * R / (P + R) : 0;
  return { P, R, F1, tp, fp, fn };
}

async function main() {
  const { lang, rule, verbose, json } = parseArgs(process.argv.slice(2));
  const langs = (lang === 'all' || !lang) ? ['nb', 'nn'] : [lang];
  let hardFail = false;
  const report = {};
  for (const l of langs) {
    const vocab = loadVocab(l);
    const rules = rule ? [`${rule}.jsonl`] : fs.readdirSync(path.join(FIXTURE_DIR, l));
    report[l] = {};
    for (const file of rules) {
      const ruleId = file.replace('.jsonl', '');
      const cases = loadJsonl(path.join(FIXTURE_DIR, l, file));
      const results = cases.map(c => runCase(c, vocab, l));
      const perRule = results.reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }),
                                    { tp: 0, fp: 0, fn: 0 });
      const stats = summarize(results, perRule);
      report[l][ruleId] = { ...stats, results: verbose ? results : undefined };
      const failures = results.filter(r => !r.ok);
      if (failures.length > 0) hardFail = true;
      if (!json) {
        console.log(`[${l}/${ruleId}] P=${stats.P.toFixed(3)} R=${stats.R.toFixed(3)} F1=${stats.F1.toFixed(3)}  (${results.length - failures.length}/${results.length} pass)`);
        if (verbose) for (const f of failures) console.log(`  FAIL ${f.id}: missing=${JSON.stringify(f.missing)} extra=${JSON.stringify(f.extra)}`);
      }
    }
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  process.exit(hardFail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(2); });
```

### Example 2: Fixture line (NB gender)

```jsonl
{"id":"nb-gender-hus-001","text":"en hus","expected":[{"rule_id":"gender","start":0,"end":2,"suggestion":"et"}],"must_not_flag":[]}
{"id":"nb-gender-hus-002","text":"Jeg har en hus","expected":[{"rule_id":"gender","start":8,"end":10,"suggestion":"et"}],"must_not_flag":[]}
{"id":"nb-gender-bok-ok-001","text":"en bok","expected":[],"must_not_flag":[]}
```
*Note: "en bok" is deliberately NOT flagged (`acceptable = (lang === 'nb' && actual === 'f' && articleTok.word === 'en')` per spell-check.js:231). This is an anti-regression case for the tolerance branch.*

### Example 3: Fixture line (NB clean.jsonl)

```jsonl
{"id":"nb-clean-news-001","text":"Statsministeren holdt en tale i Oslo i dag.","expected":[],"must_not_flag":[]}
{"id":"nb-clean-simple-001","text":"Jeg liker å lese bøker.","expected":[],"must_not_flag":[]}
```

### Example 4: Dual-export footer (universal module)

```javascript
// end of extension/content/spell-check-core.js
  const api = { check, editDistance, /* other pure helpers */ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') self.__lexiSpellCore = api;
})();
// Source: https://2ality.com/2011/08/universal-modules.html (canonical UMD pattern)
```

### Example 5: Preserving `wordList` entry shape during the move

```javascript
// vocab-seam-core.js buildIndexes({ raw, bigrams, lang })
// MUST produce wordList entries with the exact fields word-prediction.js currently produces
// (see word-prediction.js:482–750 — preserve all of: word, display, translation, type, bank,
//  baseWord, pronoun, genus, formKey, tenseKey, number, definiteness, caseName).
// Copy the entire emission loop verbatim in commit 1. Refactor for style in a later commit.
```

## State of the Art

| Old Approach (pre-Phase-1) | Current Approach (post-Phase-1) | When Changed | Impact |
|----------------------------|---------------------------------|--------------|--------|
| Spell-check polls `self.__lexiPrediction` for readiness | Spell-check subscribes to `self.__lexiVocab.onReady` with richer data getters | Phase 1 cutover | Spell-check no longer depends on word-prediction's load order (INFRA-01, INFRA-04). |
| Spell-check rebuilds its own `nounGenus`, `verbInfinitive`, `validWords`, `typoFix`, `compoundNouns` by walking `getWordList()` | Seam owns these indexes once, exposes them via `getNounGenus()` etc. | Phase 1 cutover | Each consumer does less work; indexes are built once per language-change, not per consumer. |
| No regression harness; manual-only testing per `.planning/codebase/TESTING.md` | `scripts/check-fixtures.js` with ground-truth JSONL corpus, per-rule-class P/R/F1 | Phase 1 | Every Phase 2+ change is safety-netted (INFRA-02). |
| All spell-check logic in one file (898 LOC including DOM+rules+UI) | Pure `spell-check-core.js` + thin DOM adapter `spell-check.js` | Phase 1 | Core is Node-runnable; same split later enables Phase 3 rule-plugin refactor (INFRA-03). |
| word-prediction.js owns vocab loading end-to-end; spell-check borrows | vocab-seam.js owns vocab loading end-to-end; both spell-check AND word-prediction are consumers | Phase 1 | Symmetric consumers; no master/slave lifecycle. |

**Deprecated / outdated after Phase 1:**
- `self.__lexiPrediction` — deleted; no alias, no adapter (per CONTEXT "big-bang cutover"). Any external content-script that references it breaks; no such scripts exist in the project.
- The `rebuildIndexes()` function in spell-check.js (lines 136–172) — moves into vocab-seam-core.js's `buildIndexes`.
- word-prediction.js's `loadWordList` and `loadBigrams` (lines 440–785) — move into vocab-seam-core.js; word-prediction becomes a consumer via `__lexiVocab.getWordList()` / `getBigrams()`.

## Open Questions

1. **Does word-prediction.js need any data *not* currently exposed by the rich seam surface?**
   - What we know: word-prediction.js uses grammar-feature filtering while building its own `wordList` (lines 472–752). It filters entries by `isFeatureEnabled(...)` during emission.
   - What's unclear: If vocab-seam builds indexes once per language change, what happens on `GRAMMAR_FEATURES_CHANGED` (word-prediction.js:66–69) — must the seam also rebuild on this event, or does word-prediction filter at consumption time?
   - Recommendation: The seam rebuilds on `GRAMMAR_FEATURES_CHANGED` — grammar features affect which forms are emitted. Add it to the seam's message listener alongside `LANGUAGE_CHANGED`. Alternative (if emission becomes slow): Seam emits a canonical superset; consumers filter. Decide during planning; for Phase 1 seed, rebuild-on-change is simpler and faster to implement.

2. **Where does the `typoBank` come from in-browser when vocab-seam is the sole loader?**
   - What we know: Today, word-prediction.js derives typos from `entry.typos` arrays (word-prediction.js:501–514) — there is no separate `typoBank` data file. `spell-check.js`'s `typoFix` Map is built from `entry.type === 'typo'` entries in `wordList` (spell-check.js:169–171).
   - What's unclear: Is CONTEXT's `getTypoBank()` just a conveniently-named alias for the `typoFix` Map, or does it expect a different structure?
   - Recommendation: `getTypoBank()` returns the same `Map<typo, correct>` as `getTypoFix()` — consolidate by documenting that `getTypoBank` is the data-oriented name, `getTypoFix` the lookup-oriented name. Alternative: drop one of the two. Flag in planning.

3. **Should `vocab-seam.js` listen to `PREDICTION_TOGGLED` / `SPELL_CHECK_TOGGLED`?**
   - What we know: These are policy flags (prediction disabled = don't show dropdown; spell-check disabled = don't show dots). They do not affect vocab state.
   - What's unclear: Nothing — these should stay on the consumers, not the seam.
   - Recommendation: Seam listens to `LANGUAGE_CHANGED` + `LEXI_PAUSED` + `GRAMMAR_FEATURES_CHANGED` only. Consumers handle their own toggles. Document explicitly.

4. **What's the right `rule_id` naming convention in fixtures?**
   - What we know: spell-check.js today emits `type: 'gender' | 'modal_form' | 'sarskriving' | 'typo'`.
   - What's unclear: Should fixtures use `"gender"` (match current) or prefix with language / scope (`"nb.gender"`)? Phase 3 rule-plugin refactor will need stable IDs.
   - Recommendation: Phase 1 uses the exact current strings (`"gender"`, `"modal_form"`, `"sarskriving"`, `"typo"`) to minimize refactor distance. Phase 3 can introduce namespacing when rules move into `spell-rules/`. Flag in planning as "Claude's Discretion but do not diverge from emitted strings."

5. **Node `self` availability for the dual-export footer.**
   - What we know: Node 16+ exposes `globalThis`. Node 18+ exposes `self` as an alias (in some contexts). The existing project runs Node 18+.
   - What's unclear: Is `typeof self !== 'undefined'` reliably truthy in Node 18 when running a plain script (no worker, no jsdom)?
   - Recommendation: Use `if (typeof self !== 'undefined') self.__lexiVocabCore = api;` — the guard means it silently no-ops if `self` is undefined in Node. The CJS branch (`module.exports`) is the one that matters for the fixture runner; the `self` branch matters only in the browser. Test on the developer's Node version before committing.

## Sources

### Primary (HIGH confidence)
- Existing codebase — direct line-number inspection:
  - `extension/content/spell-check.js` (lines 22, 94, 117 for PREDICTION usage; 136–172 for rebuildIndexes; 196–317 for check(); 452–459 for dedupe; 337–367 for editDistance)
  - `extension/content/word-prediction.js` (lines 14 for `__lexiI18n`; 440–760 for loadWordList; 763–785 for loadBigrams; 1829–1844 for `__lexiPrediction` seam)
  - `extension/content/vocab-store.js` (lines 542–556 for `__lexiVocabStore` surface)
  - `extension/manifest.json` (content_scripts array order)
  - `scripts/sync-vocab.js` (CommonJS precedent, path-relative IO)
  - `package.json` (no build step, no test scripts)
  - `.planning/codebase/TESTING.md` (confirms zero automated test infra today)
- `.planning/research/SUMMARY.md` — milestone research with verified pattern references (LanguageTool, Harper, Voikko) and exact line-number citations
- `.planning/phases/01-foundation-vocab-seam-regression-fixture/01-CONTEXT.md` — user-locked decisions for this phase
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-04 definitions
- `.planning/ROADMAP.md` — Phase 1 goal + success criteria
- [Universal Modules pattern (2ality.com)](https://2ality.com/2011/08/universal-modules.html) — canonical source for dual-export IIFE/CommonJS footer

### Secondary (MEDIUM confidence)
- [Chrome MV3 content scripts cannot be ES modules (crxjs discussion)](https://github.com/crxjs/chrome-extension-tools/discussions/643) — confirms IIFE + globals is the standard pattern
- [evaluating spell-checkers (translatehouse localization guide)](http://docs.translatehouse.org/projects/localization-guide/en/latest/guide/evaluating_spellcheckers.html) — confirms precision/recall as the standard IR metrics for spell-checker evaluation
- [cspell npm package](https://www.npmjs.com/package/cspell) — reference for prior-art Node.js spell-check CLIs (not adopted; evaluated-and-rejected per milestone SUMMARY.md)

### Tertiary (LOW confidence)
- [JSONL training-data trend article (superjson.ai)](https://superjson.ai/blog/2025-09-07-jsonl-machine-learning-training-data/) — industry context only; JSONL choice already locked in CONTEXT. LOW because vendor blog.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero-new-dependency decision is directly argued from SC-06 ("no new external API dependencies") and verified against existing `scripts/sync-vocab.js` precedent; `node --test` escalation path tracked explicitly as INFRA-05.
- Architecture: HIGH — patterns derived from direct line-number inspection of `spell-check.js`, `word-prediction.js`, `vocab-store.js`, and `manifest.json`; universal-module dual-export footer is a well-documented pattern from 2ality.
- Pitfalls: HIGH — every pitfall traces to a specific existing behavior (load-order poll, case normalization, bigram `_metadata` deletion, dedupeOverlapping ordering, span-end exclusivity) in concrete line numbers; warning signs are concrete (verifiable in devtools).

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable refactor-and-tooling phase; no fast-moving external ecosystem)
