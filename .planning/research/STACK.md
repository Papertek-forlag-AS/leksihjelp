# Stack Research

**Domain:** Heuristic spell-check + word-prediction for Norwegian (NB/NN) in a vanilla-JS Chrome MV3 extension
**Researched:** 2026-04-17
**Confidence:** HIGH (for algorithms/libraries), MEDIUM (for Norwegian data licensing)

## TL;DR (Prescriptive)

1. **Do not bundle a Hunspell dictionary.** Every production-grade Norwegian Hunspell dictionary (`dictionary-nb`, `dictionary-nn`, Norsk ordbank, Apertium, giellalt) is **GPL-2.0**. This is incompatible with the MIT promise on the landing page. Keep the Papertek-vocabulary corpus as the single source of truth for the known-word set.
2. **Roll your own Damerau-Levenshtein.** An inlined ~50 LOC bounded DP implementation beats every npm package for this workload (<=25 k words, word-level, small k). No dependency, no bundler needed.
3. **SymSpell-style deletion index is the right data structure** for 25 k-word fuzzy lookups at k<=2. Hand-implement in <150 LOC of vanilla JS. Do **not** pull in `spellchecker-wasm` (~800 KB wasm + CSP changes + worker orchestration; overkill for 25 k words).
4. **Store word frequency as pre-computed Zipf values (floats, 1.0-7.5) at build time.** Not raw counts, not at runtime. Primary source: **NB N-gram 2021 (CC-0)** from Nasjonalbiblioteket.
5. **Store bigrams as `{prev: {next: weight}}` with integer buckets (1/2/3)**, mirroring the existing structure in `word-prediction.js:1423-1425`. Keep bigram files per-language and lazy-load.
6. **Regression tests = plain Node script, no runner.** `node --test` is available and zero-dep but still over-tool for this. Start with a single `scripts/test-spellcheck.mjs` that loads a fixture file and prints pass/fail counts. Upgrade to `node:test` later if needed.
7. **Norphone / Double-Metaphone is over-engineering.** The existing "normalize NB/NN letters + drop doubled consonants" approach in `word-prediction.js` is good enough for learner typos.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vanilla JS (ES2022+)** | — | All spell-check & prediction logic | Already the project standard; no build step; zero Chrome Web Store review surprises |
| **Inlined Damerau-Levenshtein** | rolled-locally | Edit distance with adjacent-transpose for k<=2 | Bounded DP (early-exit when `min(row) > maxDist`) runs in <0.1ms per comparison on a 25 k-word vocab, plenty for interactive use. Existing implementation at `word-prediction.js:1480` is already Levenshtein; add the transpose case and bound. A dependency buys nothing. |
| **Hand-rolled SymSpell deletion index** | rolled-locally | Fuzzy lookup against ~25 k word set | Bounded delete-lookup is the fastest known approach (per Wolf Garbe's benchmarks: 1000-1800× faster than BK-tree). For k=1, index is ~2× the vocab. For k=2, ~4-6×. On 25 k words that's 100-150 k entries — built once on load in <500ms, lookups in O(1) keyspace + O(few) distance checks. See *"What NOT to Use"* for why not the npm ports. |
| **Zipf-frequency floats** | value scheme | Unigram frequency as log10(freq/billion) + 3 | Industry standard (wordfreq uses this). One 4-byte float per entry instead of a 4-8 byte count; range 1.0 (very rare) to 7.5 (function words). Arithmetic-friendly: `score += zipf * weight` works directly. |
| **Bigram weight-bucket JSON** | existing scheme | Contextual word-prediction scoring | Already shipping: `data/bigrams-{lang}.json` with `{prev: {next: weight}}` where weight ∈ {1,2,3}. Keep it; just grow the coverage. See `word-prediction.js:762-783`. |
| **`node:test` (Node 20+ built-in)** | Node ≥20.18 | Regression-fixture runner, if/when a runner is needed | Zero-dep, stable since Node 20. But start without it (see *Dev Tools* below). |

### Supporting Libraries

**None. Explicitly none.** The only npm dependency this milestone should add is `undici` or nothing. Every candidate below was evaluated and rejected:

| Rejected Library | Latest | Why Rejected |
|------------------|--------|-------------|
| `fastest-levenshtein@1.0.16` | 4-year stale | Last published 2021. Solid code but adds a dep for a ~30 LOC algorithm. Doesn't do transpositions (plain Levenshtein only). No bounded variant — burns cycles on obvious non-matches. |
| `damerau-levenshtein@1.0.8` | 4-year stale | Correct but slow; computes full matrix. No early-exit. |
| `nspell@2.1.5` | maintained | Needs a Hunspell `.dic`/`.aff` pair — and the only good NB/NN ones are GPL-2.0. Deal-breaker for an MIT extension. |
| `spellchecker-wasm@0.2.5` | maintained | ~800 KB wasm, requires `wasm-unsafe-eval` CSP, worker orchestration. Designed for English documents with 100k+ word lists. Massive over-engineering for 25k-word learner vocab. |
| `n-gram@2.0.2` (wooorm) | maintained | Generates character n-grams from a string. That's not what we need — we need stored word-bigram frequency tables. Three lines of code replace this. |
| `trigram-utils@2` (wooorm) | maintained | Language detection use-case, not spell-check. Wrong tool. |
| `natural`, `compromise`, `franc` | varied | Full NLP toolkits, MB-sized, mostly English-biased. Violates the "no heavy NLP" scope. |
| `zod@3.x` | actively dev | Already excluded at backend layer; no place for it in a vanilla-JS content script. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Plain Node script** (`scripts/test-spellcheck.mjs`) | Regression fixture runner | Start here. Load `tests/fixtures/spellcheck.txt`, parse `input ⟶ expected` pairs, run through a Node-importable wrapper around `spell-check.js` logic, print `N passed / M failed, X false positives, Y false negatives`. Zero deps, runnable as `node scripts/test-spellcheck.mjs`. |
| **`node --test`** (built-in) | Upgrade path for regression runner | Only introduce once the plain script stops being enough (multiple fixtures, filtering, TAP output for CI). Still zero-dep. |
| **`scripts/build-frequencies.mjs`** | Build-time Zipf table generator | Reads raw NB N-gram 2021 CSV (downloaded once, git-ignored), outputs `extension/data/frequency-{nb,nn}.json` as `{word: zipf}`. Run during vocab sync, not at runtime. |
| **`scripts/build-bigrams.mjs`** | Build-time bigram table generator | Same data source; outputs `data/bigrams-{nb,nn}.json` matching the existing schema. Keeps top-N bigrams per-prev-word to control size. |
| **`scripts/sync-vocab.js`** (existing) | Vocab sync | No change needed; frequency + bigram generation is separate because the data source is separate (NB) from the lemma source (Papertek). |

## Data Sources for Norwegian

Licensing is the hardest constraint for this milestone. Summary:

| Source | Content | License | Can Bundle? |
|--------|---------|---------|-------------|
| **Papertek-vocabulary** (own repo) | Lemmas, translations, typos, grammar features | Controlled by us | **YES — primary source** |
| **NB N-gram 2021** ([Nasjonalbiblioteket](https://www.nb.no/sprakbanken/en/resource-catalogue/oai-nb-no-sbr-70/)) | Unigrams, bigrams, trigrams from 580k books + 3.4M newspapers | **CC-0** (public domain) | **YES — recommended for frequency + bigrams** |
| `dictionary-nb` / `dictionary-nn` (npm, wooorm) | Hunspell `.dic` + `.aff` | **GPL-2.0** | **NO** — violates MIT promise |
| Norsk ordbank | Lemmas + full inflection | **GPL-2.0** | **NO** — violates MIT promise |
| giellalt `lang-nob` / `lang-nno` | FST-based morphological analyser | **GPL-3.0** | **NO** — violates MIT promise, and FST runtime is heavy |
| Apertium `apertium-nob`, `apertium-nno` | Rule-based MT data | **GPL-2.0** | **NO** — wrong license, wrong tool anyway |
| `wordfreq` (rspeer, Python) | Pre-computed Zipf tables | **MIT** | Data generation-only; not runnable from JS. But: supports NB (`'nb'`), **does not support NN**. |

**Implication:** For NB, we have options (NB N-gram + wordfreq as cross-check). For NN, we have only NB N-gram (sufficient; Nynorsk has its own n-gram stream in the 2021 dataset).

**Implication (critical):** Treat the Papertek-vocabulary lemma set as the "valid word" signal and the NB-N-gram set as the "frequency / rank" signal. If a word is in NB N-gram at Zipf ≥ 3.0 but not in Papertek, mark it a **candidate addition to the typo bank or lemma bank**, not a false-positive suppression — this is where the regression-fixture feedback loop pays off.

## Algorithm Choices, Justified

### Edit-distance: Bounded Damerau-Levenshtein (roll own, ~60 LOC)

**What:** Two-string DP distance with a 4th case for adjacent transposition; early-exit when the row minimum exceeds `maxDist`.

**Why:**
- Learner typos include transpositions (`leksikon` → `lekiskon`). Plain Levenshtein counts that as 2 ops; Damerau counts it as 1. Better suggestion ranking.
- `fastest-levenshtein` doesn't do transpositions; `damerau-levenshtein` does but is unbounded.
- Bounded early-exit is a ~5-line addition that gives 5-20× speedup on the fuzzy path.
- The existing project code at `word-prediction.js:1480` is a plain Levenshtein with no early-exit. This is the specific change.

**Confidence:** HIGH. Algorithm is textbook; implementation trivially unit-testable with existing regression fixtures.

### Fuzzy lookup: SymSpell-style deletion index (roll own, ~120 LOC)

**What:** At dictionary-load time, for each word `w`, generate all strings obtainable by deleting `k` characters (for k ≤ `maxDist`), map each deletion → `[canonical words that produce it]`. At lookup time, do the same for the query and intersect.

**Why:**
- 1000-1870× faster than BK-tree per [SeekStorm benchmarks](https://seekstorm.com/blog/symspell-vs-bk-tree/).
- For 25k-word vocab and k=2, expected index is ~120-150k entries (~3-4 MB JSON if persisted; built on-load from current JSON is preferred).
- Scales with k exponentially in character count, but with `maxDist=2` this is finite and small.

**Why not the npm ports:**
- `spellchecker-wasm` ships 800 KB of wasm to solve a problem we can solve in 120 LOC of JS, and requires CSP relaxation in manifest (`wasm-unsafe-eval`) that the Chrome Web Store flags.
- `dongyuwei/SymSpell` and `IceCreamYou/SymSpell` are old, unmaintained JS ports; pulling a dep for this is pure risk.

**Alternative considered:** Keep only a trigram overlap index (cheaper to build, coarser results). Rejected because the existing prediction already does prefix + Levenshtein scoring; replacing with trigram overlap alone would be a downgrade.

**Confidence:** HIGH. Algorithm proven; project already has the vocab in the right shape.

### Frequency scoring: Zipf values from NB N-gram 2021

**What:** Pre-compute `zipf = log10(freq / 1e9) + 9 ≈ log10(freq_per_billion) + 3`. Store as `{word: float}` per language. Use at runtime to break ties and rank candidates.

**Why:**
- Raw counts explode in size (integer widths) and have no meaningful "small difference" — is 4,728 really more common than 4,521? Zipf bins compress that noise: words with the same Zipf-to-hundredth are treated identically (wordfreq's approach — and they're right).
- Math is symmetric across frequency ranges: `score += zipf * 10` works whether the word is rare or common.
- Ranges are predictable: 1.0 = "very rare", 3.0 = "one per million", 5.0 = "common function word", 7.0 = "the/og/er". Tuning stays intuitive.
- One float per word × 25k words ≈ 200 KB uncompressed, ~60 KB gzipped. Well within the 20 MiB internal bundle budget.

**Confidence:** HIGH.

### Bigrams: keep the existing schema, grow the coverage

**What:** `{prev_word_lowercase: {next_word: weight}}` where weight ∈ {1, 2, 3} buckets. Already implemented in `word-prediction.js:762-783`.

**Why:**
- The scoring code at `word-prediction.js:1423` already expects this shape.
- Bucketed weights keep file size bounded — only keep top-N bigrams per predecessor (e.g., top 15). On 25k predecessors × 15 next-words × ~15 bytes per entry ≈ 5-6 MB raw, 1-2 MB gzipped. At the edge of the budget — build script should enforce a byte cap per language.
- Two-word lookback already supported (`word-prediction.js:1415`). Don't redesign; extend.

**Confidence:** HIGH (based on direct code inspection).

### Phonetic / normalized matching: existing approach is fine

**What:** The project already does NB/NN-aware lowercase + letter-class normalization inside fuzzy matching.

**Why not Norphone or Double-Metaphone-Scandinavian:**
- Norphone is research code, no maintained JS port found.
- Double-Metaphone (scandi-extended) trades precision for recall, which **hurts** a spell-check where false positives are the named failure mode.
- The only case where a real phonetic algorithm would help is homophone confusion (`hjem/jeg`, `og/å`). That's the å/og case, which the user-memory notes already flag as a sentence-context problem belonging in grammar check, not spell check.
- Cheap wins first: normalize `æ/ä`, `ø/ö`, `å/aa`, doubled consonants — all already present in `word-prediction.js`.

**Confidence:** MEDIUM (recommendation against; revisit if fixture shows specific phonetic class of error getting missed).

## Installation

This milestone introduces **zero** new runtime dependencies.

```bash
# Runtime (extension): no changes. Vanilla JS only.

# Build-time (optional, for frequency/bigram builders):
# Nothing from npm either — the NB N-gram files are CSV,
# readable with node:fs + a ~20-line CSV parser (no dep).

# Regression test script: vanilla Node, no runner.
node scripts/test-spellcheck.mjs
```

If the fixture grows past ~200 cases or CI integration is wanted:

```bash
# Optional future upgrade:
# Use Node 20+ built-in test runner. No install needed.
node --test scripts/test-spellcheck.mjs
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Roll own Damerau-Levenshtein | `fastest-levenshtein` | Never, for this codebase. Dep buys nothing. |
| Hand-rolled SymSpell deletion index | `spellchecker-wasm` | Only if vocab grows past 100k words AND performance becomes an issue. Neither is likely. |
| NB N-gram 2021 (CC-0) for Norwegian frequency | Wordfreq snapshot (MIT), NB only | If NB N-gram CSV proves too large to process; use wordfreq pre-built data for NB only. NN still needs NB N-gram. |
| Plain Node script for regression | `node:test` built-in runner | Once fixtures exceed ~200 cases or need named-subset filtering. |
| Normalize + bounded DL for fuzzy | Norphone / Scandinavian Double-Metaphone | Only if regression fixture shows a specific phonetic-confusion error class leaking. Measure first. |
| Keep `spell-check.js` as vanilla JS | TypeScript migration | Not this milestone. Orthogonal and risks churn. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any GPL Hunspell dictionary** (`dictionary-nb`, `dictionary-nn`, Norsk ordbank, giellalt, Apertium) | Contaminates an MIT extension. Violates the publicly-promised free/open-source guarantee on the landing page. | Papertek-vocabulary (own) as valid-word set; NB N-gram 2021 (CC-0) as frequency/bigram source |
| **`nspell`** | Needs a Hunspell dictionary — see above. | Custom spell-check on top of Papertek lemmas, using bounded DL + SymSpell index |
| **`spellchecker-wasm`** | 800 KB wasm, CSP relaxation (`wasm-unsafe-eval`) needed, Chrome Web Store scrutiny, worker thread glue. Solves a 100 k+ word problem we don't have. | Hand-rolled SymSpell-style deletion index, ~120 LOC |
| **ML models on-device** (transformers.js, tflite.wasm) | Multi-MB models, slow first-run, Chrome Web Store policy headaches, violates PROJECT.md "no ML" constraint | Heuristics + data |
| **ML correction APIs** (LanguageTool cloud, Grammarly SDK, OpenAI) | Network cost, privacy, conflicts with the "extension-side features stay free" promise | Local heuristics |
| **`natural` / `compromise` / `nlp.js`** | MB-sized NLP toolkits, English-biased, unused features bloat bundle | Hand-roll the 2-3 needed primitives |
| **Full Hunspell compiled to wasm** (`hunspell-asm`) | ~800 KB, still needs a GPL dictionary | Same as spellchecker-wasm rejection |
| **Raw n-gram counts at runtime** | Integer sizes + "is 4728 more than 4521" noise | Pre-compute Zipf floats at build time |
| **`tap`, `ava`, `jest`, `vitest`, `mocha`** | Pulls in a test runner and its deps for a project that's deliberately vanilla + no build step | Plain Node script; upgrade to built-in `node --test` later if needed |
| **BK-tree** | 1000× slower than SymSpell on this kind of workload per Wolf Garbe's published benchmarks | SymSpell deletion index |
| **Trigram Jaccard as primary matcher** | Recall-first; spell-check here is precision-first (false positives are the cardinal sin) | Bounded DL is precision-first |
| **Norphone / Scandinavian Double-Metaphone** | Unmaintained JS ports; recall-first in a precision-first task | Existing normalize-then-DL. Revisit only if fixture data shows a gap. |

## Stack Patterns by Variant

**If** the vocab grows past ~50k words (e.g., NN gets full Norsk ordbank-style inflections added to Papertek):
- Switch SymSpell index build from "eager on load" to "deferred in a Web Worker" to avoid blocking the content script startup
- Consider persisting the built index in IndexedDB (same pattern as `extension/content/vocab-store.js`) so it's not rebuilt every page-load
- Still no wasm/external dep needed

**If** the regression fixture grows past ~500 cases and needs named-subset filtering:
- Migrate from `scripts/test-spellcheck.mjs` to `node --test scripts/test-spellcheck.mjs`
- Keep the fixture file format unchanged (the runner reads it either way)
- Add a `--lang nb|nn|all` flag if needed

**If** a specific error class (e.g., homophone confusion, verb-tense-after-modal) starts dominating false negatives:
- Do NOT reach for a phonetic algorithm or ML. Add a targeted rule in `spell-check.js`, extend the fixture, measure.
- This matches the already-working four-class scheme in the existing `spell-check.js:16-21`.

**If** bundle size grows beyond the 20 MiB internal ceiling because of bigrams:
- First: cap bigrams per predecessor (e.g., top-10 instead of top-15)
- Second: drop bigrams for words below Zipf 3.0 (rare predecessors rarely help prediction)
- Third (only if needed): move bigrams to IndexedDB-backed vocab store (already built)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Chrome MV3 | JS ES2022+, `chrome.storage.local`, content scripts | All existing usage; no change |
| Node 20+ | `node --test`, ESM, `node:fs/promises` | Project already uses ESM in backend; no version bump needed for build scripts |
| NB N-gram 2021 CSV | UTF-8, tab-separated, `word \t freq \t year_json` | Build-time parser only; ~8 GB uncompressed for full dataset — use top-N extraction in builder |
| Existing `word-prediction.js` | This stack | Extending, not replacing. All recommendations here layer on top of the interfaces already exposed via `self.__lexiPrediction` |
| Existing `spell-check.js` (898 LOC) | This stack | Adds bounded DL + SymSpell index to the indexes it already builds (see file:23-30); four error classes stay |

## License Summary (Extension-Side Impact)

- **Can bundle:** Papertek-vocabulary output (ours), NB N-gram 2021 (CC-0), any code written in-project (MIT).
- **Cannot bundle:** Any GPL/LGPL Hunspell dictionary, Norsk ordbank, Apertium data, giellalt data.
- **Safe to reference for comparison / cross-check during development:** wordfreq (MIT, Python) for NB frequency sanity checks; publicly served ordbokene.no for manual word verification during fixture authoring.

## Sources

- [NB N-gram 2021 — Nasjonalbiblioteket Språkbanken](https://www.nb.no/sprakbanken/en/resource-catalogue/oai-nb-no-sbr-70/) — CC-0 status verified; 580k books + 3.4M newspapers; CSV + SQLite. **HIGH** confidence.
- [NB N-gram 2021 PDF documentation](https://www.nb.no/sbfil/ngram/ngram_2021/2021_NBngram.pdf) — dataset coverage, formats. **MEDIUM** (PDF fetch returned partial content).
- [wordfreq (rspeer/wordfreq, GitHub)](https://github.com/rspeer/wordfreq) — Zipf scheme reference; NB support; NN gap. **HIGH**.
- [SymSpell — wolfgarbe/SymSpell, GitHub](https://github.com/wolfgarbe/SymSpell) — algorithm reference; 6.7.3 current (2025). **HIGH**.
- [SymSpell vs BK-tree benchmark — SeekStorm blog](https://seekstorm.com/blog/symspell-vs-bk-tree/) — 1870× perf gap claim, sources cited. **HIGH**.
- [nspell — wooorm/nspell, GitHub](https://github.com/wooorm/nspell) — JS Hunspell-compatible spell-checker. **HIGH**; verified Hunspell-format dependency.
- [dictionary-nb — wooorm/dictionaries, GitHub](https://github.com/wooorm/dictionaries/tree/main/dictionaries/nb) — **GPL-2.0 dict + aff** confirmed. **HIGH**.
- [dictionary-nn — wooorm/dictionaries, GitHub](https://github.com/wooorm/dictionaries/tree/main/dictionaries/nn) — **GPL-2.0 dict + aff** confirmed. **HIGH**.
- [Norsk ordbank — Apertium wiki](https://wiki.apertium.org/wiki/Norsk_ordbank) — GPL license; 117,445 lemmas (v2022). **HIGH**.
- [spellchecker-wasm — justinwilaby/spellchecker-wasm, GitHub](https://github.com/justinwilaby/spellchecker-wasm) — Rust+wasm SymSpell port; ~800 KB. **HIGH**.
- [Chrome Extensions — CSP reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) — `wasm-unsafe-eval` CSP directive needed for wasm in MV3. **HIGH**.
- [fastest-levenshtein — npm](https://www.npmjs.com/package/fastest-levenshtein) — last published 2021; no Damerau variant. **HIGH**.
- [Node.js Test Runner — official docs](https://nodejs.org/api/test.html) — stable since Node 20. **HIGH**.
- Existing code: `extension/content/spell-check.js` (898 LOC, 4 error classes), `extension/content/word-prediction.js` (1845 LOC, `levenshtein` at :1480, `bigramData` at :762). **HIGH** (direct inspection).

---
*Stack research for: heuristic spell-check + word-prediction for Norwegian in a vanilla-JS Chrome MV3 extension*
*Researched: 2026-04-17*
