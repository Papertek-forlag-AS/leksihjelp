---
phase: 01-foundation-vocab-seam-regression-fixture
verified: 2026-04-18T14:05:11Z
status: human_needed
score: 4/4 must-haves verified (1 deferred human check)
human_verification:
  - test: "Live Chrome smoke test — load extension/ unpacked, type 'en hus' in a textarea, confirm red dot + 'et hus' popover, DevTools console shows no __lexiPrediction / vocab-seam / spell-check-core errors"
    expected: "Spell-check marker appears under 'en' within ~1s; popover offers 'et hus'; Developer Tools console is clean of errors referencing __lexiPrediction, vocab-seam, or spell-check-core"
    why_human: "Requires loading unpacked extension into Chrome, browsing to a page with a textarea, typing live input, and visually observing the popover and console. Deferred by user on 2026-04-18 ('I can't test now, we'll make tests later')."
---

# Phase 01: Foundation (Vocab Seam + Regression Fixture) Verification Report

**Phase Goal:** Runtime vocab indexes move into a shared module that both spell-check and word-prediction consume, and a node-script regression harness locks current NB/NN behavior so every subsequent rule or weight change is measurable.

**Verified:** 2026-04-18T14:05:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Spell-check no longer depends on word-prediction's load order — a developer can disable word-prediction and spell-check still initializes and flags errors correctly on a sample NB page | ? UNCERTAIN | Static evidence is strong: `spell-check.js` now binds `VOCAB = self.__lexiVocab` + `CORE = self.__lexiSpellCore` (spell-check.js:26–27), no references to `__lexiPrediction` remain anywhere in `extension/` (grep: 0 matches), and manifest load order is `vocab-seam-core → vocab-seam → word-prediction → spell-check-core → spell-check`. The seam `__lexiVocab` loads vocab itself via `__lexiVocabStore` + `chrome.runtime.getURL` fallback, so spell-check is structurally independent of word-prediction. LIVE demonstration with word-prediction disabled deferred to the human smoke test (see below). |
| 2 | A developer can run `node scripts/check-fixtures.js nb` and see pass/fail output plus precision/recall per error class for at least 4 rule classes (gender, modal-verb, særskriving, typo) | ✓ VERIFIED | `npm run check-fixtures:nb` executed this session: per-rule P/R/F1 printed for all 5 classes (gender, modal, saerskriving, typo, clean). Output verified against the 4 required rule classes + clean corpus. |
| 3 | Adding a known-failing test case to `fixtures/nb/*.jsonl` causes the script to exit non-zero; fixing the rule causes it to exit zero — verified by the developer in one commit cycle | ✓ VERIFIED | Live demo this session: appended `{"id":"nb-clean-fail-test","text":"en hus","expected":[],"must_not_flag":[]}` to `fixtures/nb/clean.jsonl` → `node scripts/check-fixtures.js nb` exited **1** with `[nb/clean] F1=0.000 8/9 pass`. Restoring the file → exit **0**. Regression loop works end-to-end. |
| 4 | Grepping spell-check source confirms zero imports from `word-prediction.js` internals and zero references to premium/subscription state — the module is extractable to `skriv.papertek.app` in principle | ✓ VERIFIED | `grep -r "__lexiPrediction" extension/` → 0 matches. `grep -iE "subscription\|premium\|vipps\|stripe\|JWT\|word-prediction" extension/content/spell-check.js` → 2 matches, both inside the top-of-file JSDoc block (lines 11, 12) documenting the decoupling itself. Zero non-comment references. |

**Score:** 3/4 fully verified via automation; truth #1 automated-evidence-strong but awaits live Chrome smoke test.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | Pure `buildIndexes({raw, bigrams, lang, isFeatureEnabled})` with dual-export footer | ✓ VERIFIED | 494 lines. `module.exports = api` present. No `document.`, `chrome.`, `window.`, `fetch(` outside JSDoc comments. `require()` from Node returns `{ buildIndexes }`. Tested: `buildIndexes({raw: nb.json, bigrams: null, lang: 'nb'})` returns wordList (29,817), validWords (25,897), nounGenus (8,264), verbInfinitive (2,678), typoFix (11,088), compoundNouns (8,588). `typoBank === typoFix` (same Map reference). `freq` is empty Map (Phase-1 contract). |
| `extension/content/vocab-seam.js` | Browser IIFE writing `self.__lexiVocab` with 15 getters | ✓ VERIFIED | 231 lines. `self.__lexiVocab` present. All 14 getter names + `isTextInput` present. Loads via `window.__lexiVocabStore.getCachedLanguage(lang)` with `fetch(chrome.runtime.getURL(...))` fallback. Listens for `LANGUAGE_CHANGED`, `GRAMMAR_FEATURES_CHANGED`, `LEXI_PAUSED`. No `__lexiPrediction` references. |
| `extension/content/spell-check-core.js` | Pure `check(text, vocab, opts) → Finding[]` with `rule_id` field, dual-export | ✓ VERIFIED | 383 lines. `module.exports = api` present. Zero references to `document.`, `chrome.`, `window.`, `setTimeout`, `fetch`, `__lexiPrediction`. Integration test: `check('en hus', idx, {lang:'nb'})` returns `[{rule_id:'gender', start:0, end:2, original:'en', fix:'et', message:'...'}]`. Field is `rule_id` (not `type`). |
| `extension/content/spell-check.js` | DOM adapter delegating to `__lexiSpellCore`, reading from `__lexiVocab` | ✓ VERIFIED | 568 lines (down from 898). Binds `VOCAB = self.__lexiVocab` + `CORE = self.__lexiSpellCore`. Calls `CORE.check()` in `runCheck`. Reads 5 index getters via `VOCAB.get*` (12 call sites). No `rebuildIndexes` function. No `__lexiPrediction`. No non-comment subscription/premium/vipps/stripe/JWT/word-prediction mentions. |
| `extension/content/word-prediction.js` | Consumes `__lexiVocab` for wordList + bigrams | ✓ VERIFIED | 1401 lines (down from 1845). Binds `VOCAB = self.__lexiVocab` at top. `VOCAB.getWordList()` read per-call inside ranker (3 sites). `VOCAB.getBigrams()` used (1 site). `self.__lexiPrediction` export deleted. |
| `extension/manifest.json` | Content_scripts load vocab-seam first, version 2.3.0 | ✓ VERIFIED | Version 2.3.0. Order: `i18n/strings.js → vocab-store.js → vocab-seam-core.js → vocab-seam.js → floating-widget.js → word-prediction.js → spell-check-core.js → spell-check.js`. All ordering constraints satisfied. |
| `scripts/check-fixtures.js` | Node CJS JSONL runner with P/R/F1 reporting | ✓ VERIFIED | 199 lines. Requires `vocab-seam-core.js` + `spell-check-core.js` via `path.join(__dirname, '..', ...)`. Contains `parseArgs`, `loadJsonl`, `loadVocab`, `runCase`, `summarize`, `process.exit`. Supports `--rule=`, `--verbose`, `--json` flags; positional `nb` / `nn` / `all`. Runs cleanly from repo root. |
| `fixtures/nb/gender.jsonl` | ≥10 NB gender cases | ✓ VERIFIED | 17 cases |
| `fixtures/nb/modal.jsonl` | ≥10 NB modal cases | ✓ VERIFIED | 14 cases |
| `fixtures/nb/saerskriving.jsonl` | ≥10 NB særskriving cases | ✓ VERIFIED | 16 cases |
| `fixtures/nb/typo.jsonl` | ≥10 NB typo cases | ✓ VERIFIED | 11 cases |
| `fixtures/nb/clean.jsonl` | ≥5 NB clean cases | ✓ VERIFIED | 8 cases |
| `fixtures/nn/gender.jsonl` | ≥10 NN gender cases | ✓ VERIFIED | 17 cases |
| `fixtures/nn/modal.jsonl` | ≥10 NN modal cases | ✓ VERIFIED | 15 cases |
| `fixtures/nn/saerskriving.jsonl` | ≥10 NN særskriving cases | ✓ VERIFIED | 16 cases |
| `fixtures/nn/typo.jsonl` | ≥10 NN typo cases | ✓ VERIFIED | 10 cases |
| `fixtures/nn/clean.jsonl` | ≥5 NN clean cases | ✓ VERIFIED | 8 cases |
| `fixtures/README.md` | Case schema + span convention (end exclusive) + authoring workflow | ✓ VERIFIED | 152 lines. Documents `start` inclusive, `end` EXCLUSIVE explicitly; canonical rule_id values; add-a-case workflow; comment support. |
| `package.json` | npm scripts `check-fixtures`, `check-fixtures:nb`, `check-fixtures:nn` | ✓ VERIFIED | All three scripts present (lines 12–14). No `type` field added. |
| `CLAUDE.md` | Release Workflow includes `check-fixtures` step | ✓ VERIFIED | Line 346: `npm run check-fixtures — must exit 0` is now step 1 in Release Workflow, before the version bump. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `vocab-seam.js` | `vocab-seam-core.js` | `self.__lexiVocabCore.buildIndexes(...)` | WIRED | `self.__lexiVocabCore` referenced + called in vocab-seam.js; manifest ensures core loads first |
| `vocab-seam.js` | `vocab-store.js` | `window.__lexiVocabStore.getCachedLanguage(lang)` with fetch fallback | WIRED | `__lexiVocabStore.getCachedLanguage` and `chrome.runtime.getURL` fallback present in vocab-seam.js |
| `vocab-seam-core.js` | Node CommonJS consumers | `module.exports = api` | WIRED | `require()` from Node returns `{ buildIndexes }`; verified by actual `require()` + integration test producing 29,817 wordList entries |
| `spell-check.js` | `spell-check-core.js` | `self.__lexiSpellCore.check(text, vocab, opts)` | WIRED | `CORE = self.__lexiSpellCore`; `CORE.check(...)` called in `runCheck` at spell-check.js:207+ |
| `spell-check.js` | `vocab-seam.js` | `VOCAB.getNounGenus / getVerbInfinitive / getValidWords / getTypoFix / getCompoundNouns / onReady` | WIRED | 12 `VOCAB.get*` call sites in spell-check.js; all 5 index getters + `onReady` + `getLanguage` used |
| `word-prediction.js` | `vocab-seam.js` | `VOCAB.getWordList()` + `VOCAB.getBigrams()` | WIRED | Both getters called per-invocation inside ranker (getWordList at 340/360/811; getBigrams at 993) |
| `manifest.json` | content-script load order | vocab-seam scripts before consumers | WIRED | Order in manifest.content_scripts[0].js satisfies all ordering constraints |
| `scripts/check-fixtures.js` | `vocab-seam-core.js` | `require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'))` | WIRED | Import succeeds; `buildIndexes` called per language in `loadVocab(lang)` |
| `scripts/check-fixtures.js` | `spell-check-core.js` | `require(...'spell-check-core.js')` | WIRED | Import succeeds; `check()` called per case in `runCase` |
| `scripts/check-fixtures.js` | `extension/data/nb.json` + `nn.json` | `fs.readFileSync + JSON.parse` with `path.join(__dirname, '..', 'extension', 'data', ...)` | WIRED | `npm run check-fixtures` loads both languages and produces a complete report |
| `package.json scripts` | `scripts/check-fixtures.js` | `npm run check-fixtures` | WIRED | `npm run check-fixtures` produces the full report with exit 0; verified this session |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 01-01 + 01-02 | Shared `window.__lexiVocab` module exposes wordList, frequency tables, bigrams, and lookup helpers, replacing the narrow `__lexiPrediction` seam so spell-check no longer depends on word-prediction's load order | ✓ SATISFIED | `vocab-seam.js` creates `self.__lexiVocab` with 15 getters (wordList, freq, bigrams, typoBank, nounGenus, verbInfinitive, validWords, typoFix, compoundNouns, + lifecycle). Both `spell-check.js` and `word-prediction.js` read from it. `__lexiPrediction` deleted entirely from extension/ (grep: 0). Manifest loads vocab-seam before consumers. |
| INFRA-02 | 01-03 | Node-script regression fixture harness under `scripts/` runs a JSONL corpus of NB/NN sentences, asserts expected flagged spans + suggested fixes, and reports precision/recall per error class | ✓ SATISFIED | `scripts/check-fixtures.js` + 132 seeded cases across `fixtures/{nb,nn}/{gender,modal,saerskriving,typo,clean}.jsonl`. `npm run check-fixtures` prints P/R/F1 per rule class; exits 1 on any mismatch, 0 otherwise. Both behaviors demonstrated this session. |
| INFRA-04 | 01-02 | Spell-check remains structurally separable — no imports from word-prediction internals, no premium/policy coupling; the module could later be extracted to `skriv.papertek.app` without touching prediction code | ✓ SATISFIED | `grep -r "__lexiPrediction" extension/` → 0. `grep -iE "subscription\|premium\|vipps\|stripe\|JWT\|word-prediction" extension/content/spell-check.js` → 2 matches both inside JSDoc header (lines 11, 12) documenting the decoupling itself. spell-check.js reads everything from the vendor-agnostic `__lexiVocab` surface. |

All three requirements declared in plan frontmatter are covered. No ORPHANED requirements: REQUIREMENTS.md traceability table maps exactly INFRA-01, INFRA-02, INFRA-04 to Phase 1, and all three are claimed + satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension/content/word-prediction.js` | 1204, 1206 | Dead-call bug: `loadGrammarFeatures(lang)` and `loadWordList(lang)` called but **neither is defined** anywhere in the file | ⚠️ Warning | Only reachable via the inline language-picker (click a flag in the prediction-dropdown footer → `switchPredictionLang(lang)`). Would throw `ReferenceError` at runtime. The dispatch via `chrome.runtime.sendMessage({type:'LANGUAGE_CHANGED'})` on line 1207 would never fire because execution halts at 1204. Not in Phase 1's must-haves or ROADMAP success criteria; it is a side-effect of Plan 02's cutover that removed those functions (documented as removed in 01-02-SUMMARY.md). Recommend: either delete the three `await` lines (seam reloads vocab on `LANGUAGE_CHANGED` anyway) or re-implement the two missing calls as no-ops. Either fix is ~5 minutes and can be picked up in Phase 2 or as a hotfix. |
| `extension/content/word-prediction.js` | 353 | Comment references `old loadWordList` — informational, not a bug | ℹ️ Info | Just a historical citation in a JSDoc comment, mirroring the byte-for-byte move from word-prediction.js:559–599. No impact. |

No TODO / FIXME / placeholder / HACK / XXX markers in any of the six phase-modified source files. No empty-function stubs. No `return null`-only implementations. All cores pass syntax check (`node -c`) and integration test.

---

### Human Verification Required

**1. Live Chrome smoke test — DEFERRED by user on 2026-04-18**

- **Test:** Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `extension/`. Open any page with a `<textarea>` (e.g., a Reddit comment box). Ensure NB is selected in the popup. Type `en hus` into the textarea.
- **Expected:** Within ~1s a dot appears under `en`; clicking opens a popover that suggests `et hus`. DevTools console shows no errors referencing `__lexiPrediction`, `vocab-seam`, or `spell-check-core`.
- **Why human:** Requires loading the unpacked extension into Chrome, browsing to a page with a textarea, typing real keystrokes, and visually confirming the popover + console. The automated integration test (`check('en hus', buildIndexes(nb.json), {lang:'nb'})` → gender finding) is the programmatic equivalent and passes, but does not exercise the live message-bus round-trip from `__lexiVocab.onReady` → `spell-check.js` renderer.
- **Deferred quote:** user on 2026-04-18 — "I can't test now, we'll make tests later."
- **Action for release:** Fold this into the standard pre-release ritual alongside the new `npm run check-fixtures` step in CLAUDE.md. One-person, five-minute manual test.

---

### Gaps Summary

**No blocking gaps.** All automated must-haves pass: the shared `__lexiVocab` seam exists and is consumed by both `spell-check.js` and `word-prediction.js`; `__lexiPrediction` has been deleted outright (grep confirms zero matches in `extension/`); the pure cores (`vocab-seam-core.js` + `spell-check-core.js`) are Node-requireable and produce correct output against real NB data (29,817 wordList entries, `en hus → et hus` gender finding); the regression harness runs end-to-end with 132/132 passing cases and flips to exit 1 when a deliberately-failing case is added. INFRA-04 decoupling is clean — the only subscription/premium/etc. mentions in `spell-check.js` are in the JSDoc block that documents the decoupling.

**One known issue noted, NOT blocking:** `word-prediction.js:1204–1206` calls two functions (`loadGrammarFeatures`, `loadWordList`) that were deleted in Plan 02. Reachable only via the inline language-picker click path; would throw `ReferenceError` in that narrow flow. Outside Phase 1's success-criteria scope; recommended as a quick hotfix for Phase 2 or independently.

**One deferred human check:** Live Chrome smoke test ("en hus" → "et hus" popover) — explicitly deferred by the user. Phase completion is not gated on it; re-pick-up at release time.

---

*Verified: 2026-04-18T14:05:11Z*
*Verifier: Claude (gsd-verifier)*
