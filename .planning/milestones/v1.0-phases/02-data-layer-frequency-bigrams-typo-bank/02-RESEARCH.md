# Phase 2: Data Layer (Frequency, Bigrams, Typo Bank) — Research

**Researched:** 2026-04-18
**Domain:** Build-time data pipelines (Norwegian corpus → bundled JSON) + cross-repo vocabulary coordination
**Confidence:** HIGH (corpus + existing code paths verified at line-number precision); MEDIUM on typo-bank expansion scale (depends on papertek-vocabulary authoring cadence)

## Summary

Phase 2 is a data-engineering phase, not a code refactor. Three build-time artifacts land in `extension/data/`: (1) `freq-nb.json` and `freq-nn.json` (Zipf unigrams, <200 KB gzipped each) produced by a new `scripts/build-frequencies.js` that ingests the NB N-gram 2021 corpus (Nasjonalbiblioteket, CC-0); (2) materially-expanded `bigrams-nb.json` and `bigrams-nn.json` in the existing `{prev: {next: weight}}` schema produced by a new `scripts/build-bigrams.js` from the same corpus; (3) a visibly larger typo bank in `papertek-vocabulary` (coordinated cross-repo, additive schema only) that the existing `npm run sync-vocab` pulls into `extension/data/*.json`. The Phase 1 regression fixture (132 cases across NB/NN × 5 rule classes, `F1=1.000` baseline) is the quality gate — DATA-02 must raise typo recall without regressing any clean/gender/modal/særskriving case.

The load-bearing external resource is the **NB N-gram 2021** dataset at `https://www.nb.no/sbfil/ngram/ngram_2021/`, released under CC-0. The book-corpus files (`ngram-2021-digibok-unigram.csv.gz` 1.04 GB gz, `ngram-2021-digibok-bigram.csv.gz` 7.15 GB gz) are the authoritative source — they include a `lang` column distinguishing `nob` (Bokmål) from `nno` (Nynorsk), so one download yields both languages. The newspaper files (`digavis`, 2.56 GB + 15.06 GB gz) have no language classification and are not useful for NB/NN split. These files are too large to check into git; the build script must download → stream-process → discard.

The existing `bigrams-nb.json` has only 72 head-word entries (2.6 KB raw, 825 B gzipped) and `bigrams-nn.json` is similar — there is vast room to grow inside budget. Current packaged zip is 10.76 MB (already above the 10 MB ceiling by ~760 KB), driven overwhelmingly by `data/*.json` vocabulary (35 MB uncompressed → ~7 MB gzipped inside the zip) and `audio/de/` (9.7 MB uncompressed → ~3 MB gzipped inside the zip; all other languages still ship via Papertek CDN, not bundled). Freq + bigram additions have a budget of ~760 KB gzipped combined *plus* any overshoot; the bundle-size problem is pre-existing and Phase 2 must not make it worse.

**Primary recommendation:** Build `scripts/build-frequencies.js` and `scripts/build-bigrams.js` as streaming Node scripts that (a) download NB N-gram 2021 book-corpus files into a gitignored `corpus/` directory, (b) stream-parse the gzipped CSVs filtering by `lang=nob` / `lang=nno`, (c) intersect word list against `validWords` from the existing `buildIndexes()` seam (only keep frequency entries for words we actually ship), (d) write Zipf-valued JSON for freq and integer-bucketed bigrams constrained to top-N-per-predecessor within a byte budget. Typo-bank expansion lives in `papertek-vocabulary` via the already-present `expand-nb-nn-typos.js` (re-run with relaxed `--mode`) plus a manual audit of the three known data-quality issues flagged in Plan 01-03's SUMMARY. Bundle-size headroom is tight: enforce per-file gzip caps in the build scripts and verify total zip size during the release checklist.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Build-time script ingests the NB N-gram 2021 corpus (Språkbanken, CC-0) and emits sidecar `extension/data/freq-{lang}.json` with Zipf-scored unigram frequencies for NB and NN, under 200 KB gzipped each | Authoritative source URLs for NB N-gram 2021 in "Standard Stack > Data Sources"; Zipf formula and schema in "Architecture Patterns > Pattern 1 (Frequency Table)"; word-list intersection strategy in "Pattern 4 (Budget-Bounded Frequency)"; the seam already exposes `getFrequency(word)` at `vocab-seam.js:209` reading from `state.freq` Map (currently empty — Phase 1 locked the contract). |
| DATA-02 | Typo-bank expansion in `papertek-vocabulary` — coordinated cross-app review, additive schema only, synced into the extension via existing `npm run sync-vocab` | `papertek-vocabulary` repo structure mapped in "Standard Stack > Cross-Repo Coordination"; existing `scripts/expand-nb-nn-typos.js` script in sibling repo already implements collision-free typo generation against the global valid-word set; current NB typo count is 11,385 strings across 3,424 entries (NN: 7,417 strings / 2,948 entries) — the existing `sync-vocab.js` already copies `entry.typos` arrays, no schema change needed. Plan 01-03's SUMMARY documents three data-quality defects to fix as part of this work. |
| DATA-03 | Extend bundled bigram data for NB and NN with high-frequency pairs derived from NB N-gram 2021; same schema as the existing `bigrams-{lang}.json` files; respect the bundle-size budget (~10 MB ceiling) | Existing schema `{prev: {next: weight}}` with weight ∈ {1, 2, 3} verified at `extension/data/bigrams-nb.json` (72 head-words, 2.6 KB) and `bigrams-nn.json` (similar); bigram normalization code already in place at `vocab-seam-core.js` `normalizeBigrams()`; NB N-gram 2021 digibok-bigram.csv.gz is the source; budget strategy (top-N per predecessor + byte cap) in "Pattern 5 (Bigram Expansion)". |
</phase_requirements>

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| **Node.js built-ins** (`fs`, `path`, `zlib`, `readline`, `https`) | Node ≥18 (Node 20+ recommended) | Download, stream-decompress, CSV parse NB N-gram files | Already the project's runtime; `scripts/sync-vocab.js` precedent uses CommonJS + `fetch` + `fs`; zero npm dependencies matches CLAUDE.md "no runtime dep growth" philosophy |
| **Streaming CSV parse** (hand-rolled, `readline` + `split('\t')`) | — | Parse tab-separated NB N-gram CSVs line-by-line | Files are too large for `JSON.parse`-style loads; NB N-gram uses literal tab separators; a 15-line parser beats any npm dep (see `scripts/check-fixtures.js` precedent for zero-dep Node-CJS style) |
| **Existing `buildIndexes()` seam** | Phase 1 locked | Word-list intersection (only keep freq/bigram entries for shipped words) | `vocab-seam-core.js::buildIndexes({raw, bigrams, lang, isFeatureEnabled})` exposes `validWords` Set containing all canonical + inflected + typo forms; the build scripts require this module to filter the corpus down to relevant words |
| **NB N-gram 2021** (Nasjonalbiblioteket Språkbanken, CC-0) | 2021-10-28 | Source dataset for Zipf unigrams and expanded bigrams (NB + NN) | Only CC-0 Norwegian n-gram corpus that distinguishes NB and NN in a single dataset; supersedes older NB N-gram resources (`sbr-12`, `sbr-8`, `sbr-42`) which are smaller/legacy; 580k books + 3.4M newspapers, 122 B tokens |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| **`gzip` streaming via `zlib.createGunzip()`** | Decompress `.csv.gz` on the fly | Every NB N-gram file is `.csv.gz` (source is gzipped, not `.tar.gz`); always stream, never buffer whole file |
| **`https.get` or `fetch` with streaming** | Download corpus files (1-7 GB each) once to a gitignored `corpus/` cache | Re-use downloads on re-runs; delete after build if needed; CLAUDE.md-style `.gitignore` entry mandatory (see "Common Pitfalls > Pitfall 1") |
| **`JSON.stringify(obj, null, 0)`** (minified) | Emit final `freq-{lang}.json` and `bigrams-{lang}.json` as compact JSON (no whitespace) | Gzip benefits marginally from minification; matches Phase 1 bigram precedent (`data/bigrams-nb.json` is loosely-formatted but only 2.6 KB — at 50-200 KB scale minification saves measurable bytes) |
| **`cross-env` / env variables (`PAPERTEK_VOCAB_API`)** | Point sync-vocab at a local vocabulary dev server | Only needed if Phase 2 DATA-02 requires local iteration before `papertek-vocabulary` is deployed (sibling repo already supports this pattern: `scripts/sync-vocab.js:29` honors `PAPERTEK_VOCAB_API`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **NB N-gram 2021 (CC-0)** | `wordfreq` Python package (CC-BY-SA 4.0) | Viral license — CC-BY-SA 4.0 is share-alike, contaminates the MIT extension. Also: `wordfreq` **does not support NN** (rspeer/wordfreq README: "We would use 'nn' for Nynorsk, but there isn't enough data"). Reject. |
| **NB N-gram 2021 (CC-0)** | `hermitdave/FrequencyWords` no_50k.txt (MIT code, OpenSubtitles CC-BY-SA-licensed data) | `papertek-vocabulary` already uses `no_50k.txt` internally as a *rank* source inside `scripts/enrich-frequency.js`, but (a) OpenSubtitles data license terms are ambiguous/CC-BY-SA depending on source year, (b) no NB/NN distinction — `no_50k.txt` is a single merged file with 50k words, (c) subtitle register skews toward spoken-style vocab (no academic/news coverage). Acceptable as a cross-check for NB; not sufficient alone for NN. |
| **NB N-gram 2021 (digibok)** | NB N-gram 2021 digavis (newspapers) | Newspaper files have no `lang` classification column (per 2021 README). Cannot split NB from NN → reject for this milestone. |
| **NB N-gram 2021 `sbr-70` (current)** | NB N-gram 2015 `sbr-12` or Nynorsk `sbr-8` | Older resources are smaller and legacy. The 2021 resource supersedes them. Stick with sbr-70. |
| **Freq as a sidecar file (`freq-{lang}.json`)** | Freq as a new field on each vocab entry in `{lang}.json` | Would bloat `papertek-vocabulary`'s schema and ripple through `papertek-webapps` + `papertek-nativeapps` consumers (CLAUDE.md's cross-app concern). Freq lives in Leksihjelp only → sidecar is correct. `papertek-vocabulary`'s own `enrich-frequency.js` already writes ranks into the vocab as metadata for *other* apps' needs; we don't remove that, we just don't rely on it for the extension's Zipf layer. |
| **Zipf floats (log-scale)** | Raw counts (integer) | Raw counts blow up JSON size (variable-width integers for 500M+ tokens), and "is 4,521 more common than 4,728?" is noise not signal (see `.planning/research/STACK.md:107-113`). Zipf floats bucket the noise, 1-2 decimal precision is enough. 4-byte scheme: `-?\d\.\d+` → ~4 chars per value. |
| **Rank integers (1-50000)** | Zipf floats | `papertek-vocabulary`'s existing `frequency` field IS a rank (see `scripts/enrich-frequency.js`). Zipf is still preferable for Phase 3 scoring because it's symmetric across the range and combines with weights directly, but rank-backed fallback is acceptable if Zipf computation fails. |

**Installation:** Zero new npm dependencies. Build scripts are self-contained Node CommonJS (matches `scripts/sync-vocab.js` and `scripts/check-fixtures.js` precedents).

```bash
# No install step. Just:
npm run build-frequencies    # Phase 2 P01 output
npm run build-bigrams        # Phase 2 P02 output
npm run sync-vocab           # Phase 2 P03 output (typo-bank expansion)
npm run check-fixtures       # regression gate (exits 0 or refuses release)
```

### Cross-Repo Coordination (DATA-02 Specific)

**sibling repo:** `/Users/geirforbord/Papertek/papertek-vocabulary` (local checkout confirmed)

Relevant existing artifacts:

| Path | Purpose | Status for Phase 2 |
|------|---------|---------------------|
| `vocabulary/lexicon/nb/{nounbank,verbbank,adjectivebank,generalbank}.json` | Canonical NB lexicon with `entry.typos[]` arrays | Input for DATA-02 expansion; 1918 entries in nounbank have `typos:` field (of which some are empty arrays to fill) |
| `vocabulary/lexicon/nn/{…bank}.json` | Canonical NN lexicon | Same, 1536 entries in nounbank |
| `scripts/expand-nb-nn-typos.js` | Additive typo generator (double-consonant drop, silent H/D/T, QWERTY transpositions, NN e/a-infinitiv); **enforces global no-collision invariant** | **Direct DATA-02 tool.** Re-run with appropriate `--mode` — `zero` only fills empties, `topup` also tops up entries below CEFR target |
| `scripts/add-saerskrivingstypos.js` | Bulk-add særskriving typos | Secondary: complements expand-nb-nn-typos |
| `scripts/enrich-typos.js`, `scripts/generate-typos.js` | Earlier typo-bank enrichment | Historical reference only |
| `vocabulary/dictionary/frequency/no_50k.txt` (OpenSubtitles NO, 50k ranks) | Existing rank source used by `enrich-frequency.js` | Not our source — we use NB N-gram 2021 directly. Kept because other apps depend on it. |
| `CLAUDE.md` | Repo-level permissions: "You may edit any file / commit to main without asking when instructed" | Phase 2 plan-level authorisation to land typo-bank changes upstream |
| `npm run validate:lexicon`, `npm run build:lexicon-search-index` | Post-change validations | Must run after every typo-bank edit before committing |

Cross-consumer impact: typo-bank growth is additive; the `entry.typos: string[]` schema is pre-existing; `papertek-webapps` and `papertek-nativeapps` both already consume `entry.typos` arrays (growth is a non-breaking improvement for them). **No schema changes are proposed.**

## Architecture Patterns

### Recommended Project Structure

```
leksihjelp/
├── scripts/
│   ├── sync-vocab.js              # EXISTING — pulls papertek-vocabulary (typos included)
│   ├── check-fixtures.js          # EXISTING — regression gate
│   ├── build-frequencies.js       # NEW (Phase 2 plan-01) — NB/NN Zipf unigrams
│   └── build-bigrams.js           # NEW (Phase 2 plan-02) — NB/NN expanded bigrams
├── corpus/                        # NEW — gitignored download cache
│   ├── .gitignore                 # '*' inside this dir
│   ├── ngram-2021-digibok-unigram.csv.gz   # ~1.04 GB, downloaded once
│   └── ngram-2021-digibok-bigram.csv.gz    # ~7.15 GB, downloaded once
├── extension/data/
│   ├── nb.json / nn.json          # EXISTING — typos grown via sync-vocab (DATA-02)
│   ├── bigrams-nb.json            # REGROWN by build-bigrams.js (DATA-03)
│   ├── bigrams-nn.json            # REGROWN by build-bigrams.js (DATA-03)
│   ├── freq-nb.json               # NEW (DATA-01)
│   └── freq-nn.json               # NEW (DATA-01)
└── .gitignore                     # Add `corpus/` entry
```

**Why a separate `corpus/` directory, not `.cache/` or `/tmp/`:**
- Durable across `npm install` wipes.
- Devs can `rm -rf corpus/` to free 8 GB disk without re-running scripts.
- Matches precedent patterns in `papertek-vocabulary` (`vocabulary/dictionary/frequency/` holds pre-downloaded freq inputs; frequency corpus is part of the tracked repo there, but Leksihjelp can't follow suit — too big).

### Pattern 1: Streaming CSV Parse of Gzipped NB N-gram Files

**What:** Node stream: `https.get → zlib.createGunzip → readline → line → split('\t') → filter by lang column → accumulate in a Map`.

**When to use:** Every ingestion of NB N-gram 2021 files. The files are >1 GB gzipped; materializing them in memory is not an option.

**Example:**
```javascript
// scripts/build-frequencies.js (sketch)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const https = require('https');

const CORPUS_DIR = path.join(__dirname, '..', 'corpus');
const URL = 'https://www.nb.no/sbfil/ngram/ngram_2021/ngram-2021-digibok-unigram.csv.gz';
const LOCAL = path.join(CORPUS_DIR, 'ngram-2021-digibok-unigram.csv.gz');

async function ensureDownloaded() {
  if (fs.existsSync(LOCAL)) return;
  fs.mkdirSync(CORPUS_DIR, { recursive: true });
  await new Promise((resolve, reject) => {
    https.get(URL, res => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      res.pipe(fs.createWriteStream(LOCAL)).on('close', resolve).on('error', reject);
    }).on('error', reject);
  });
}

async function streamNbUnigrams(targetLang /* 'nob' | 'nno' */) {
  const rl = readline.createInterface({
    input: fs.createReadStream(LOCAL).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  const counts = new Map();
  let totalTokens = 0;
  for await (const line of rl) {
    // 2021 format columns: first TAB lang TAB freq TAB json
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [word, lang, freqStr] = parts;
    if (lang !== targetLang) continue;
    const freq = +freqStr;
    if (!Number.isFinite(freq)) continue;
    counts.set(word.toLowerCase(), (counts.get(word.toLowerCase()) || 0) + freq);
    totalTokens += freq;
  }
  return { counts, totalTokens };
}
```

**Source:** `https://www.nb.no/sbfil/ngram/ngram_2021/` (columns verified from official README: `first`, `second`, `third`, `lang` (books only), `freq`, `json`).

### Pattern 2: Zipf Computation

**What:** For each word, `zipf = log10(freq / totalTokens * 1e9)` → number in range 0.0 (very rare) to ~7.5 (top function words). Store rounded to 2 decimal places to minimize JSON size without losing tie-breaking resolution.

**When to use:** Any time frequency is emitted as a ranking signal. Zipf is symmetric across the range (a delta of 0.5 means "5× more frequent" whether the word is common or rare), so scoring code can do `score += zipf * weight` directly.

**Example:**
```javascript
function toZipf(freq, totalTokens) {
  // zipf = log10(frequency_per_billion)
  // log10(freq/totalTokens * 1e9) = log10(freq) - log10(totalTokens) + 9
  return +(Math.log10(freq / totalTokens) + 9).toFixed(2);
}
```

For NB digibok ≈ 11 B tokens (from totals.json), `zipf = 3.0` ≈ "one per million" — that's the floor below which words rarely matter for ranking. Entries with `zipf < 3.0` SHOULD be dropped from `freq-nb.json` to stay inside the 200 KB gzipped budget.

### Pattern 3: Word-List Intersection (shrink freq table to what we ship)

**What:** Only emit freq entries for words the extension actually needs: `validWords` from Phase 1's seam (canonical + inflected + typo forms already registered in `papertek-vocabulary`). Everything else is noise.

**Why:** NB N-gram 2021 digibok-unigram contains ~10M+ distinct NB words (many OCR artefacts, long-tail proper nouns, hapaxes). The extension ships a vocabulary of ~25-30k words. A raw freq dump is orders of magnitude too big. Intersection with `validWords` is the correct scope: everything not shipped has no use for freq lookup.

**Example:**
```javascript
const vocabCore = require('../extension/content/vocab-seam-core.js');
const nbRaw = JSON.parse(fs.readFileSync('../extension/data/nb.json', 'utf8'));
const { validWords } = vocabCore.buildIndexes({ raw: nbRaw, bigrams: null, lang: 'nb' });
// validWords is a Set containing every lowercased form.

const filteredFreq = {};
for (const [word, count] of counts) {
  if (!validWords.has(word)) continue;   // drop words we don't ship
  const z = toZipf(count, totalTokens);
  if (z < 3.0) continue;                  // drop rare tail
  filteredFreq[word] = z;
}
```

This pattern reuses the Phase 1 seam exactly as Plan 01-03 reuses it for fixtures — `require('../extension/content/vocab-seam-core.js')` returns `{ buildIndexes }`, and the freq build runs the same `buildIndexes()` the runtime uses.

### Pattern 4: Budget-Bounded Frequency Table (<200 KB gzipped)

**What:** After Pattern 3 intersection + Pattern 2 Zipf, measure gzipped output and back off threshold if over 200 KB.

**Why:** Success criterion #1 caps `freq-nb.json` and `freq-nn.json` at 200 KB gzipped each. For ~25k words at `{"ord": 4.23}` ≈ 14 bytes each = 350 KB raw, compressing to ~80-120 KB gzipped (mostly ASCII letters; gzip dict compression favours shared suffixes). Well inside budget — but enforce it anyway as a regression guard.

**Example:**
```javascript
async function writeWithBudget(outPath, obj, maxGzipBytes = 200_000) {
  let current = obj;
  let cutZipf = 3.0;
  while (true) {
    const json = JSON.stringify(current);
    const gz = zlib.gzipSync(json).length;
    if (gz <= maxGzipBytes) break;
    cutZipf += 0.1;
    current = Object.fromEntries(Object.entries(current).filter(([_, z]) => z >= cutZipf));
    if (Object.keys(current).length === 0) throw new Error('budget impossible');
  }
  fs.writeFileSync(outPath, JSON.stringify(current));
  console.log(`${outPath}: ${Object.keys(current).length} entries, ${zlib.gzipSync(JSON.stringify(current)).length} gzipped bytes, cutoff zipf=${cutZipf.toFixed(1)}`);
}
```

### Pattern 5: Bigram Expansion (keep schema, grow coverage, cap budget)

**What:** Existing schema is `{prev: {next: weight}}` with `weight ∈ {1, 2, 3}` — a coarse 3-bucket quantization of bigram frequency. Phase 1's current `bigrams-nb.json` has only 72 head-words, all function words like `det`, `jeg`, `hun`. DATA-03 grows this to cover the top N NB/NN content-word predecessors, with per-predecessor top-K continuations.

**Schema invariant:** `vocab-seam-core.js::normalizeBigrams()` already handles the existing shape — new entries MUST match. Specifically:
- Keys are lowercased prev-word (multi-word keys like `"i stedet"` are allowed; see existing file).
- Values are objects `{next: weight}` where next is lowercased and weight is an integer (current values 1, 2, 3).

**Bucketing strategy:**
```javascript
function bucketize(freq, totalCounts) {
  // Quantize to 1 / 2 / 3 based on log-ratio vs. predecessor's unigram frequency
  const expected = totalCounts.get(prev) / totalCounts.all;  // baseline
  const ratio = freq / expected;
  if (ratio > 10) return 3;   // strongly associated
  if (ratio > 3)  return 2;   // moderately associated
  return 1;                   // common enough to be useful
}
```

Alternative: preserve the existing hand-authored weights where they exist and only add new ones. Start-of-milestone entries in `bigrams-nb.json` have some `3`s for idiomatic pairs (e.g., `{"i løpet": {"av": 3}}` — a fixed collocation). Corpus-derived weights should not downgrade hand-authored idioms. Union-merge with `max(existing, derived)`.

**Budget:** Current extension zip is 10.76 MB (762 KB over the 10 MB ceiling already — see "Common Pitfalls > Pitfall 8"). DATA-03 has NO spare budget from the zip ceiling; must fit within unused JSON-gzip headroom from reducing other waste OR keep bigram growth to the order of +200 KB gzipped per language. Enforce via per-file cap (e.g., max 50 KB gzipped per bigram file as a first iteration — plenty of room to cover ~2-5k predecessors × ~5-8 continuations).

Budget discipline:
1. Start with the top 2000 NB content-word unigrams (sorted by Zipf desc).
2. For each predecessor, take top 10 bigram continuations (by ratio-to-baseline).
3. Merge with existing hand-authored entries (max weight wins).
4. Cap output at 50 KB gzipped; if over, reduce to top 1000 predecessors or top 5 continuations, re-run.

### Pattern 6: Typo-Bank Expansion via Sibling Script

**What:** DATA-02's work is `cd /Users/geirforbord/Papertek/papertek-vocabulary && node scripts/expand-nb-nn-typos.js --mode=topup` plus `node scripts/add-saerskrivingstypos.js`, with collision checks enforced by the script's global valid-word set.

**Why use the existing script:** `expand-nb-nn-typos.js` already implements:
- Double-consonant drop (`kommer → komer`).
- Silent H/D/T artifacts (`hvor → vor`).
- Vowel confusions (`sjelden → sjeldan` for NN).
- QWERTY neighbor-key transpositions.
- NN e-infinitiv → a-infinitiv corrections.
- Collision prevention: global `globalWords` Set (all canonical + inflected forms across all languages and banks) prevents typo strings from shadowing real words in any dialect (Pitfall 3 mitigation from `.planning/research/PITFALLS.md`).
- First-hit-wins typo ownership when two canonical words share a near-typo.

**What Phase 2 adds:**
1. Re-run with `--mode=topup` (default is `zero`, only fills empty arrays).
2. Fix the three known data defects from Plan 01-03's SUMMARY:
   - NN verb-infinitive pollution (`lese høyt` → `lese`).
   - NB noun `brev` wrongly tagged `genus: 'm'` (should be `'n'`).
   - Typos-in-validWords causing curated-branch bypass (dedupe `entry.typos` against `validWords` at sync time).
3. Run `papertek-vocabulary`'s `npm run validate:lexicon` before commit.
4. Re-run `npm run sync-vocab` in Leksihjelp to pull the expanded bank into `extension/data/nb.json` and `nn.json`.

### Anti-Patterns to Avoid

- **Check corpus files into git.** `ngram-2021-digibok-unigram.csv.gz` is 1.04 GB and `digibok-bigram.csv.gz` is 7.15 GB. Git (and GitHub) will refuse. `.gitignore` MUST exclude `corpus/`.
- **Materialize full CSV in memory.** Decompressed NB N-gram bigram CSV is ~50 GB. Always stream line-by-line (see Pattern 1).
- **Embed frequency as a field in `{lang}.json` vocab entries.** Violates the "sidecar, not schema change" architecture (ARCHITECTURE.md Anti-Pattern 3); would force a schema update across `papertek-webapps` and `papertek-nativeapps`.
- **Snapshot existing bigram entries into the fixture.** Phase 1 already authored ground-truth-not-snapshot fixtures (PITFALLS.md pitfall #6); Phase 2's fixture additions should follow the same rule.
- **Add new fields to `entry.typos` schema.** Stays `string[]`. Plan 01-03's SUMMARY confirms the current contract survives Phase 1 untouched; adding dialect tags or confidence scores is Phase 3+ work, not Phase 2.
- **Run `expand-nb-nn-typos.js` without `--dry-run` first.** It modifies every bank file in place; a dry-run verification catches unexpected collisions before they hit main.
- **Regenerate bigrams in a way that loses hand-authored idioms.** Current `bigrams-nb.json` has curated pairs like `"først og" → {"fremst": 3}`. The merge strategy must preserve these (max-merge, never replace).
- **Download corpus files on every `npm run build-frequencies` invocation.** Cache in `corpus/`; the script should `fs.existsSync(LOCAL)` before downloading. Re-download only if the file is missing or explicitly asked (`--refresh-corpus` flag).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collision-free typo generation across NB/NN/DE/ES/FR/EN | A new `scripts/generate-typos.js` in Leksihjelp | `papertek-vocabulary/scripts/expand-nb-nn-typos.js` | Already exists, already tested (globalWords + globalTypos collision maps); duplicating in Leksihjelp would fork logic and bypass the cross-app no-collision invariant |
| Frequency-rank assignment from corpus | A raw-count → rank converter | `papertek-vocabulary/scripts/enrich-frequency.js` | Already exists for OpenSubtitles ranks. BUT: our target is Zipf not rank, and our source is NB N-gram not OpenSubtitles — so the `build-frequencies.js` script is genuinely new. Read `enrich-frequency.js` for CSV-parsing style conventions; do not re-implement rank logic. |
| Word-list intersection (validWords Set) | A new flattener/filter | `extension/content/vocab-seam-core.js::buildIndexes()` | Phase 1's seam already emits the canonical `validWords` Set; call `buildIndexes()` in the build scripts and intersect. |
| JSON line writer | A new streaming writer | `JSON.stringify + fs.writeFileSync` | Build artifacts are static snapshots — at <200 KB each, single-shot write is fine; streaming only matters for corpus input, not build output. |
| CSV parser | An npm CSV parser (`csv-parse`, `papaparse`) | `line.split('\t')` | NB N-gram 2021 CSVs are tab-separated with no quoting surprises (official README confirms simple TSV); hand-roll in 3 lines; matches Phase 1's zero-dep philosophy. |
| Gzip decompression | A userland decompressor | `zlib.createGunzip()` | Built into Node; streams. |
| HTTP download with progress | An npm helper (`axios`, `got`) | `https.get` → `res.pipe(fs.createWriteStream)` | Node built-in; no deps; precedent in `scripts/sync-vocab.js` (uses `fetch` for JSON, can use same for corpus). |

**Key insight:** Phase 2 is at its cheapest when it leans on the `papertek-vocabulary`'s existing typo-expansion tooling (DATA-02) and on Phase 1's vocab-seam (DATA-01 / DATA-03). The only genuinely new code is two Node scripts (`build-frequencies.js`, `build-bigrams.js`) that stream NB N-gram files through the validWords filter and emit sidecar JSON.

## Common Pitfalls

### Pitfall 1: Corpus files in git (8 GB repo blowup)
**What goes wrong:** Developer runs `npm run build-frequencies`, downloads 1 GB unigram + 7 GB bigram to `corpus/`, forgets to `.gitignore`, commits, pushes, hits GitHub's 100 MB file limit.
**Why it happens:** Default git behavior stages new directories.
**How to avoid:**
- Add `corpus/` to root `.gitignore` **before** running any build script.
- Also add `corpus/.gitignore` with `*` inside it — double safety.
- The build script's first action should be `fs.mkdirSync('corpus', { recursive: true })` and verify git ignores it (bail with an error if not).
**Warning signs:** `git status` shows multi-GB files staged; `npm run build-frequencies` completes but `git add -A` adds the wrong thing.

### Pitfall 2: NB N-gram lang column ambiguity (nob / nno / NULL)
**What goes wrong:** Developer filters on `lang === 'nb'` and gets zero rows, because the NB N-gram 2021 schema uses `nob` (ISO 639-3) not `nb` (ISO 639-1).
**Why it happens:** The extension internally uses `nb`/`nn` codes; NB N-gram uses `nob`/`nno`. Different standards.
**How to avoid:** Map internally at the build-script boundary:
```javascript
const CORPUS_LANG = { nb: 'nob', nn: 'nno' };
// filter rows where lang === CORPUS_LANG[targetLang]
```
Also: newspaper files have NO `lang` classification at all — per official README, "aviser har ingen språkklassifikasjon per nå." Use only `digibok-*` files for NB/NN split.
**Warning signs:** Freq table has 0 NN entries; freq table is 10× expected size (all languages mixed).

### Pitfall 3: Bundle-size ceiling already exceeded
**What goes wrong:** Current `backend/public/lexi-extension.zip` is 10,759,931 bytes (10.26 MB) — already 262 KB over the publicly-stated 10 MB ceiling from PROJECT.md + ROADMAP success criterion #4. Phase 2 adds more data.
**Why it happens:** `data/*.json` files grew during unrelated vocabulary enrichment; no one caught it because there's no automated bundle-size gate.
**How to avoid:**
- Phase 2 must NOT add net bytes. Ways out:
  1. Strip whitespace from all `data/*.json` files during build (they're currently pretty-printed; `JSON.stringify` minification saves ~15-25%).
  2. Enforce strict byte caps: freq files ≤50 KB gzipped each; bigram files ≤50 KB gzipped each.
  3. Add a `npm run bundle-size-check` that runs `npm run package` and refuses release if zip > 10 MB.
- Make bundle-size-check a step in CLAUDE.md's Release Workflow section (currently only `npm run check-fixtures` is gated).
**Warning signs:** `ls -la backend/public/lexi-extension.zip` > 10,485,760 bytes (10 MB in SI).

### Pitfall 4: Collision between new typo entry and valid NN/NB word (the `berre` class)
**What goes wrong:** DATA-02 expands NB typos, adds `berre → bedre`, but `berre` is a valid NN word meaning "only/just." NN users writing standard NN see their language flagged.
**Why it happens:** Authoring typos without checking the OTHER dialect's `validWords` set.
**How to avoid:**
- Trust `expand-nb-nn-typos.js` — it already builds a `globalWords` Set that unions ALL canonical + inflected forms across every language and bank, and refuses to emit a typo string that matches any real word anywhere. **Do not bypass this guard** with `--force` or manual edits.
- After every typo-bank expansion, run `npm run check-fixtures` (Leksihjelp) — the `nn/clean.jsonl` and `nb/clean.jsonl` fixtures will catch any new false positives on dialect words.
- Plan 01-03's SUMMARY flagged "Typos-in-validWords causing curated branch bypass" as known-baseline issue #3 — fix during DATA-02 so the guard is rebuilt cleanly.
**Warning signs:** `check-fixtures` fails after typo-bank sync; a previously-clean NN fixture case now produces an unexpected flag; user reports "flags my Nynorsk."

### Pitfall 5: Corpus OCR noise polluting freq table
**What goes wrong:** NB N-gram 2021 is from OCRed books. `hus` is in there, but so is `hus,` and `hus.` and `HUS` and `hu§` (OCR scanno). The build script's `counts` Map accumulates all of them as separate entries.
**Why it happens:** NB digitization isn't perfect; raw tokenization was whitespace-only.
**How to avoid:**
- Validate each candidate word against `/^[a-zæøåöü']+$/i` before counting.
- Lowercase on read (`word.toLowerCase()`).
- Rely on Pattern 3 (word-list intersection with `validWords`): OCR artifacts that aren't in the shipped vocabulary drop automatically.
- Bonus: compare top-50 NB freq entries against wordfreq's reference list (for NB only, since wordfreq doesn't do NN) as a sanity check.
**Warning signs:** `freq-nb.json` contains entries like `"-hus"`, `"1hus"`, `"HUS"` (pre-lowercase bug); top entries don't match Norwegian expectation (`er`, `og`, `det`, `i`, `på`).

### Pitfall 6: NN coverage gap despite same corpus
**What goes wrong:** NN has ~10% as many words as NB in the NB N-gram 2021 digibok corpus (estimated ~50M NN tokens vs ~500M NB tokens, based on Norwegian publishing volume). Frequency ranks for less-common NN words are unreliable.
**Why it happens:** Nynorsk publishing is a minority; even in 580k books, NN is far fewer.
**How to avoid:**
- Accept the asymmetry: NN `freq-nn.json` will have fewer entries (perhaps 15-20k vs NB's 25-30k) and a higher reasonable Zipf floor (3.5 vs NB's 3.0).
- Set the gzip budget per file independently; don't force NN to match NB size.
- Document the asymmetry in the build script's output. The fixture will notice if NN typo recall doesn't improve proportionally.
- Phase 3 ranking work (SC-01 Zipf tiebreaker) must handle "freq absent" gracefully; NN words not in `freq-nn.json` should get a neutral (null or 0) score, not be penalized.
**Warning signs:** `freq-nn.json` has only 5k entries; NN typo fixture recall doesn't move; Phase 3 shows large NB-vs-NN ranking asymmetry.

### Pitfall 7: Overwriting hand-authored bigram idioms with corpus-derived weights
**What goes wrong:** `scripts/build-bigrams.js` runs, emits `{"først og": {"fremst": 2}}` — but the existing `bigrams-nb.json` had this as a `3` because the author knew it's a fixed collocation.
**Why it happens:** Corpus bigram frequency for "først og fremst" is high enough to be weight 2 but not 3 by the ratio rule (it's not unexpectedly high vs baseline — both words are common).
**How to avoid:**
- Build script must merge, not replace: `new = max(existing[prev][next] ?? 0, derived[prev][next])`.
- Load existing `bigrams-{lang}.json`, parse, preserve keys, union-merge.
- Idiomatic multi-word prev-keys like `"i stedet"`, `"på grunn"` are hand-authored — never overwrite a multi-word key with a derived single-word key.
**Warning signs:** Diff on `bigrams-nb.json` shows weights going DOWN for existing entries; hand-authored idiomatic pairs disappear.

### Pitfall 8: Release ships with partial freq data silently
**What goes wrong:** NN corpus download fails silently (network timeout), `freq-nn.json` ends up empty or truncated, release goes out, NN spell-check ranking regresses invisibly until a user reports it.
**Why it happens:** Script doesn't fail-loud on partial reads; pretty-print of truncated JSON is still valid JSON.
**How to avoid:**
- Post-build sanity check: `Object.keys(freq).length` must exceed a floor (NB: ≥20k; NN: ≥12k). Throw if under.
- `totals.json` from NB N-gram should be cross-referenced: total NB-digibok tokens ≈ 11 B per 2021 README (approximate; confirm by sum during build).
- Add the sanity check as a step in `build-frequencies.js` itself, not as a separate validator.
**Warning signs:** `freq-nn.json` < 50 KB raw; fixture shows NN typo recall regression despite bank growth.

### Pitfall 9: Re-running `sync-vocab.js` blows away other consumers' custom typos
**What goes wrong:** Some `papertek-vocabulary` entries have `entry.typos` arrays that include entries specific to `papertek-webapps` or `papertek-nativeapps`. Re-running `expand-nb-nn-typos.js` with `--mode=topup` might not preserve those.
**Why it happens:** The expansion script assumes it owns the typos field.
**How to avoid:**
- Read `expand-nb-nn-typos.js` carefully before re-running — confirm its preservation policy (the current implementation is "only touches entries where `typos` is absent or empty").
- `--mode=topup` ONLY touches entries under a CEFR-count target; it does NOT remove existing entries.
- Always run `--dry-run` first and diff against main before pushing.
- Validate with `npm run validate:lexicon` (papertek-vocabulary's own check).
- After sync-vocab pulls into Leksihjelp, verify `npm run check-fixtures` still exits 0 on every case that was passing.
**Warning signs:** `papertek-webapps` CI fails after Leksihjelp's vocabulary commit; typo entries from unrelated apps disappear.

### Pitfall 10: Phase 1's freq Map contract drifts
**What goes wrong:** DATA-01 populates `state.freq` via a change in `vocab-seam-core.js::buildIndexes()`; but the value-type changes (e.g., from `Map<string, number>` → `Map<string, {zipf, rank, source}>` as a "richer" signal). Breaks Phase 3 consumers that assume plain number values.
**Why it happens:** Over-engineering during implementation.
**How to avoid:**
- Freeze the contract: `state.freq` is `Map<string, number>` where number is Zipf (1.0-7.5). That's what `vocab-seam.js:209` `getFrequency(word)` returns (a number or null).
- Any richer metadata belongs in a sidecar object / second Map, not woven into the freq value.
- Phase 2's only change to `vocab-seam-core.js` is populating the Map — no signature changes anywhere.
**Warning signs:** `getFrequency()` returning objects not numbers; Phase 1 fixture suite breaks without touching spell-check logic.

## Code Examples

Verified patterns to reuse — all reference real files in this repo.

### Example 1: Streaming NB N-gram CSV through the validWords filter
```javascript
// scripts/build-frequencies.js (shape)
// Source: NB N-gram 2021 README https://www.nb.no/sbfil/ngram/ngram_2021/ngram-2021-README-eng.md
//         (CC-0 license — safe to bundle derived data)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const vocabCore = require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'));

const LANG_MAP = { nb: 'nob', nn: 'nno' };     // internal → NB N-gram ISO 639-3
const ZIPF_FLOOR = 3.0;                         // ≈ 1 per million
const OUT_DIR = path.join(__dirname, '..', 'extension', 'data');

async function buildFreq(lang) {
  const raw = JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${lang}.json`), 'utf8'));
  const { validWords } = vocabCore.buildIndexes({ raw, bigrams: null, lang });

  const corpusLang = LANG_MAP[lang];
  const corpusFile = path.join(__dirname, '..', 'corpus', 'ngram-2021-digibok-unigram.csv.gz');

  const counts = new Map();
  let totalTokens = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(corpusFile).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [wordRaw, rowLang, freqStr] = parts;
    if (rowLang !== corpusLang) continue;
    const word = wordRaw.toLowerCase();
    if (!/^[a-zæøåöü'-]+$/.test(word)) continue;        // OCR-noise filter
    if (!validWords.has(word)) continue;                  // intersection
    const freq = +freqStr;
    if (!Number.isFinite(freq)) continue;
    counts.set(word, (counts.get(word) || 0) + freq);
    totalTokens += freq;
  }

  const out = {};
  for (const [w, c] of counts) {
    const zipf = +(Math.log10(c / totalTokens) + 9).toFixed(2);
    if (zipf >= ZIPF_FLOOR) out[w] = zipf;
  }
  return out;
}
```

### Example 2: Seam contract — no signature changes
```javascript
// Already in extension/content/vocab-seam-core.js:460-485 (Phase 1 locked contract)
function buildIndexes({ raw, bigrams, lang, isFeatureEnabled } = {}) {
  // ... existing word-list + lookup-index building ...
  return {
    wordList,
    nounGenus, verbInfinitive, validWords, typoFix, compoundNouns,
    bigrams: normBigrams,
    freq: new Map(),   // ← Phase 2: populate this from a separate file load, keep return shape
    typoBank: typoFix,
  };
}
```

Phase 2 DATA-01 adds freq loading **above** `buildIndexes()` (at the Node script boundary and in `vocab-seam.js`'s browser-side wrapper) — the pure core remains unaware of where frequency comes from. This keeps the contract fixtures consume unchanged.

### Example 3: Reading `entry.typos` — already in place
```javascript
// extension/content/vocab-seam-core.js (existing) — typoFix Map is the consumer-visible surface
// sync-vocab.js already copies entry.typos arrays into data/*.json; no code changes needed.
// DATA-02 work is upstream (in papertek-vocabulary), then re-run npm run sync-vocab.
```

### Example 4: Bigram merge preserving hand-authored idioms
```javascript
// scripts/build-bigrams.js (sketch)
function mergeBigrams(existing, derived) {
  const out = { ...existing };  // start with hand-authored
  for (const [prev, nextMap] of Object.entries(derived)) {
    if (!out[prev]) out[prev] = {};
    for (const [next, w] of Object.entries(nextMap)) {
      out[prev][next] = Math.max(out[prev][next] ?? 0, w);
    }
  }
  return out;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-authored `bigrams-{lang}.json` with ~72 head-words | Corpus-derived + hand-authored merge via `build-bigrams.js` | Phase 2 (this phase) | Enables Phase 3 WP-02 (bigram ranking) to work on non-pronoun content words |
| No unigram frequency signal at all (`freq: new Map()`) | Zipf floats from NB N-gram 2021, loaded via seam | Phase 2 DATA-01 | Unlocks Phase 3 SC-01 (the `berde→bedre` vs `berre` ranking fix) |
| Typo bank populated entry-by-entry by multiple historical scripts | Unified `expand-nb-nn-typos.js` with global collision guard | Already landed in papertek-vocabulary; Phase 2 extends coverage | Additive only — existing typos preserved; new typos added for entries below the CEFR target |
| Bundle was under 10 MB ceiling | Currently 10.26 MB — over the ceiling | Unknown pre-Phase-2 date | Phase 2 must not make it worse; ideally claws back some bytes via minification |

**Deprecated/outdated:**
- **OpenSubtitles `no_50k.txt` as Leksihjelp's frequency signal:** `papertek-vocabulary` still uses it internally for rank enrichment, but Leksihjelp should consume NB N-gram 2021 directly. OpenSubtitles has license ambiguity (OPUS project terms), no NB/NN split, and subtitle-register bias (casual speech, no news / academic text).
- **wordfreq Python package for Leksihjelp:** Does not support NN; data under CC-BY-SA 4.0 (incompatible with MIT). Acceptable only as a dev-time sanity check for NB values (print both and compare top-50 entries).

## Open Questions

1. **Exact bundle-size strategy to stay under 10 MB.**
   - What we know: zip is currently 10.26 MB; adding freq (100-200 KB gzipped each × 2) + bigrams (similar) is another ~400-800 KB gzipped. Net: could push to 11 MB easily.
   - What's unclear: where can we reclaim bytes? Candidates — minify `data/*.json` (already known to be pretty-printed; ~15-25% savings on the 35 MB uncompressed → ~1-2 MB savings inside zip); drop `data/*.json` `_metadata` blocks (small); move rarely-used vocab entries out of bundle into CDN (breaks offline constraint — reject); strip `audio/de/` from the bundled zip and fetch on first use (9.7 MB uncompressed → ~3 MB gzipped inside zip; saves ~3 MB but breaks offline TTS for German).
   - Recommendation: Start with JSON minification during `npm run package` (invisible to consumers, saves ~1 MB). If still over budget, the `audio/de/` question escalates to a product decision not a research question.

2. **Typo-bank expansion scale — how many new entries?**
   - What we know: current NB typo bank has 11,385 strings across 3,424 entries (avg 3.3 typos/entry). NN has 7,417 / 2,948 (avg 2.5). Success criterion #2 says "visibly larger" without quantifying.
   - What's unclear: target CEFR count in `expand-nb-nn-typos.js --mode=topup`; the script's CEFR-tier table defaults aren't documented in the script's header.
   - Recommendation: Planner should specify "aim for +50% typo strings" as a measurable goal (NB: 11.4k → 17k+; NN: 7.4k → 11k+), verified via a diff stat after the sync. Final threshold is researcher's discretion; 50% is a reasonable "visible" delta that fits budget.

3. **Bigram weight calibration — ratio-to-baseline threshold.**
   - What we know: existing weights are integers 1/2/3; hand-authored pairs use 3 for strong idioms (`"for eksempel" → 3`), 2 for common-but-not-idiomatic, 1 for "useful context" only.
   - What's unclear: precise ratio thresholds that would reproduce the hand-authored weights from corpus data.
   - Recommendation: Don't optimize this empirically; use the thresholds in Pattern 5 (>10× baseline = 3, >3× = 2, else 1) and union-merge with hand-authored via `max()`. Phase 3 WP-02 will tune weights if scoring regresses.

4. **Should `build-frequencies.js` and `build-bigrams.js` share a download step?**
   - What we know: both scripts need the NB N-gram 2021 digibok files; bigrams additionally need `digibok-bigram.csv.gz` (7.15 GB).
   - What's unclear: whether to factor out a shared `scripts/lib/corpus.js` helper or keep them independent.
   - Recommendation: Keep independent in Phase 2 (two plan-sized tasks); extract a shared helper only if Phase 3 adds a third consumer (e.g., trigrams). Premature abstraction otherwise.

5. **Does the NB N-gram book corpus have a `lang` value for foreign-language Norwegian OCRs?**
   - What we know: Per official README, "lang" exists only for books (newspapers have no classification). The README confirms NB and NN are both in the dataset but doesn't enumerate all lang codes present.
   - What's unclear: whether words from English-language books inside the corpus also have a `lang` field (presumably `eng`), and whether they could leak into our filter if we mis-match.
   - Recommendation: Strict `===` match on `nob`/`nno`; log and count distinct lang values during first run as a sanity check.

## Sources

### Primary (HIGH confidence)
- [NB N-gram 2021 — Nasjonalbiblioteket Språkbanken (resource catalogue)](https://www.nb.no/sprakbanken/en/resource-catalogue/oai-nb-no-sbr-70/) — verified CC-0 license, NB/NN classification on book corpus, CSV format, size
- [NB N-gram 2021 README (English)](https://www.nb.no/sbfil/ngram/ngram_2021/ngram-2021-README-eng.md) — authoritative column spec (`first`, `second`, `third`, `lang`, `freq`, `json`), filter rules, license
- [NB N-gram 2021 PDF documentation (bilingual)](https://www.nb.no/sbfil/ngram/ngram_2021/2021_NBngram.pdf) — Norwegian + English descriptions, 122 B tokens figure, filter thresholds
- [OAI-PMH CMDI record for sbr-70](https://www.nb.no/sprakbanken/oai?verb=GetRecord&identifier=oai:nb.no:sbr-70&metadataPrefix=cmdi) — canonical list of all 12 download URLs (unigram/bigram/trigram × digibok/digavis × csv.gz plus metadata + totals)
- Direct HEAD probes of `https://www.nb.no/sbfil/ngram/ngram_2021/*.csv.gz` — HTTP 200, content-lengths verified: digibok-unigram 1.04 GB, digibok-bigram 7.15 GB, digavis-unigram 2.56 GB, digavis-bigram 15.06 GB
- `.planning/research/STACK.md` — project-level research on Zipf formula, bigram schema constraints, licensing alternatives (confirms `dictionary-nb`/`dictionary-nn` Hunspell are GPL-2.0, unsafe for MIT bundling)
- `.planning/research/PITFALLS.md` — multi-source typo-collision pitfall (Pitfall 3, Pitfall 17 — bundle-size creep)
- `.planning/research/ARCHITECTURE.md` — Anti-Pattern 3 (don't embed freq in vocab schema); Pattern 6 (sidecar table)
- Existing code inspection:
  - `extension/content/vocab-seam-core.js:460-485` — locked `buildIndexes()` return shape with `freq: new Map()`
  - `extension/content/vocab-seam.js:209-213` — `getFrequency(word)` reads from `state.freq` Map
  - `extension/data/bigrams-nb.json` — existing schema (72 head-words, 2.6 KB raw, 825 B gzipped)
  - `extension/data/bigrams-nn.json` — existing schema (similar)
  - `scripts/sync-vocab.js` — CommonJS + `fetch` precedent, copies `entry.typos` arrays verbatim
  - `scripts/check-fixtures.js` — CommonJS + `path.join(__dirname, ...)` style precedent
  - `/Users/geirforbord/Papertek/papertek-vocabulary/scripts/expand-nb-nn-typos.js` — existing typo-expansion tool with globalWords + globalTypos collision invariant
  - `/Users/geirforbord/Papertek/papertek-vocabulary/scripts/enrich-frequency.js` — existing rank-enrichment tool using OpenSubtitles no_50k
  - `.planning/phases/01-foundation-vocab-seam-regression-fixture/01-03-SUMMARY.md` — three known data-quality issues to fix in DATA-02 (NN infinitive pollution, brev-genus, typos-in-validWords)
  - `.planning/STATE.md` — Phase 2 DATA-02 cross-app blast radius flagged as a Blocker/Concern

### Secondary (MEDIUM confidence)
- [National Data Portal entry for NBdigital 2021](https://data.norge.no/en/datasets/8c2f8595-cd11-304e-81d4-12078548d177/n-grams-from-nbdigital) — cross-reference for license and distribution channels
- [rspeer/wordfreq README](https://github.com/rspeer/wordfreq/blob/master/README.md) — confirms NB supported, NN not; data under CC-BY-SA 4.0 (disqualifies bundling, permits dev-only sanity check)
- [CLARIN VLO entry for NB N-gram 2021](https://vlo.clarin.eu/record/https_58__47__47_www.nb.no_47_sprakbanken_47_oai_63_verb_61_GetRecord_38_identifier_61_oai_58_nb.no_58_sbr-70_38_metadataPrefix_61_cmdi) — metadata cross-reference
- `npm run package` output on 2026-04-18 (this session): zip is 10,759,931 bytes = 10.26 MB (verifies bundle-size pitfall #3)

### Tertiary (LOW confidence)
- [hermitdave/FrequencyWords README](https://github.com/hermitdave/FrequencyWords/blob/master/README.md) — repo LICENSE file states MIT; README mentions CC-BY-SA for source data; license story is ambiguous enough that `papertek-vocabulary`'s use should be reviewed during Phase 2 (not blocking Leksihjelp since we're switching to NB N-gram 2021)
- Estimated NB-vs-NN token ratio in NB N-gram 2021 (~10:1, inferred from Norwegian publishing volume; not directly sourced) — validate during first run by summing per-lang totals

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — NB N-gram 2021 URLs and format are authoritatively verified; zero-dep Node CJS precedent well-established
- Architecture: HIGH — seam contract locked by Phase 1; build scripts follow `check-fixtures.js` and `sync-vocab.js` patterns exactly; sidecar-vs-schema decision is backed by ARCHITECTURE.md and cross-repo constraint
- Pitfalls: MEDIUM-HIGH — corpus-size, OCR-noise, bundle-size pitfalls are concrete and measurable; typo-bank collision is mitigated by sibling repo's existing tooling; bundle-size pitfall currently TRIGGERED (zip > 10 MB), so Phase 2 has less slack than the ceiling suggests

**Research date:** 2026-04-18
**Valid until:** 30 days (NB N-gram 2021 is a stable frozen dataset; `papertek-vocabulary` cadence and bundle contents are more mobile — revisit sizes before cutting Phase 2 release)
