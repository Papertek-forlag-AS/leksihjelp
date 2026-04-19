# Architecture Research

**Domain:** Offline heuristic spell-check + context-aware word prediction inside a Chrome MV3 extension
**Researched:** 2026-04-17
**Confidence:** HIGH (grounded in the concrete repo shape under `extension/content/` and cross-checked against how comparable offline linters — Harper, LanguageTool, Voikko — structure their rule/scoring pipelines)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA (authored offline)                        │
│                                                                      │
│  papertek-vocabulary API  ──►  npm run sync-vocab  ──►  extension/data │
│                                                                      │
│  data/{lang}.json         : banked vocab (verbbank, nounbank, …)     │
│  data/bigrams-{lang}.json : flat object  prev → { next: weight }     │
│  data/grammarfeatures-*   : feature metadata                         │
│  data/freq-{lang}.json    : unigram freq (proposed, NEW)             │
│  data/rules-{lang}.json   : data-driven rule packs (proposed, NEW)   │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │ fetch / IndexedDB cache
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               RUNTIME INDEXES (built once per language)              │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐    │
│  │ prefixIndex   │  │ inflection-   │  │ lexicon                │    │
│  │  2-3 char →   │  │  Index        │  │  validWords Set        │    │
│  │   wordIdx[]   │  │  form → base  │  │  nounGenus  Map        │    │
│  └───────────────┘  └───────────────┘  │  verbInfinitive Map    │    │
│                                         │  compoundNouns Set     │    │
│  ┌───────────────┐  ┌───────────────┐  │  typoFix    Map        │    │
│  │ bigramIndex   │  │ freqIndex     │  │  (per-class lookups)   │    │
│  │  (nested obj) │  │  word → rank  │  └────────────────────────┘    │
│  └───────────────┘  └───────────────┘                                │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │ read-only handles via
                                       │ self.__lexiVocab (NEW, shared)
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ANALYSIS PIPELINES                             │
│                                                                      │
│  spell-check.js                         word-prediction.js           │
│  ┌───────────────────────────────┐    ┌───────────────────────────┐  │
│  │ tokenize → context →          │    │ candidates (prefix+fuzzy  │  │
│  │  rule pack loop (per lang):   │    │  +phonetic) → signals →   │  │
│  │   genderRule, modalRule,      │    │   scoring pipeline        │  │
│  │   sarskrivingRule, typoRule,  │    │     (POS, gender, number, │  │
│  │   fuzzyRule, … (pluggable)    │    │      tense, bigram, freq) │  │
│  │ → Finding[]                   │    │ → ranked Suggestion[]     │  │
│  └──────────────┬────────────────┘    └─────────────┬─────────────┘  │
└─────────────────┼──────────────────────────────────────┼─────────────┘
                  │                                      │
                  ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UI SURFACES                                       │
│  spell-check overlay  │  prediction dropdown  │  floating widget     │
│  (dots + popovers)    │  (selectable list)    │  (TTS + lookup)      │
└─────────────────────────────────────────────────────────────────────┘
```

The key architectural move the roadmap should make: the boxes above exist implicitly today, but **only the "Analysis Pipelines" layer has a seam**. The shared vocab/indexes sit inside `word-prediction.js` and leak out through `self.__lexiPrediction`. Formalising the **Runtime Indexes** layer as its own module (`self.__lexiVocab`) is the single highest-leverage change; everything else — rule packs, per-language separability, freq tables — becomes easier once that seam exists.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|---------------|------------------------|
| **Data authoring** (papertek-vocabulary) | Ground truth for words, conjugations, typos, bigrams, frequencies, (future) rules | Vercel serverless + JSON, consumed via `sync-vocab.js` |
| **Vocab store** (`vocab-store.js`) | Cache bundled + downloaded packs in IndexedDB; cache audio blobs | Existing `window.__lexiVocabStore` IIFE |
| **Index builder** (NEW: `vocab-index.js` or grow of word-prediction's init) | Build all runtime indexes once per language; expose read-only handles | `self.__lexiVocab = { lexicon, bigrams, freq, grammar, onReady }` |
| **Scoring kernel** (NEW: `scoring.js` shared helper) | Signal definitions + combiner used by prediction and (where useful) spell-check fuzzy fallback | Small pure-function module; no DOM |
| **Rule pack** (per-language, per-error-class) | One rule = `{ id, appliesTo, check(context) → Finding \| null }` | Array of rule objects loaded by `spell-check.js`; NB/NN pack first, DE pack later without touching loop |
| **Spell-check runtime** (`spell-check.js`) | Tokenize, build per-sentence context, run rule pack, dedupe/rank findings, render overlay | Narrow `__lexiPrediction` dependency replaced by `__lexiVocab` |
| **Prediction runtime** (`word-prediction.js`) | Candidate generation, scoring, UI dropdown, recent-words learning | Existing; progressively moves scoring into `scoring.js` |
| **Regression fixture runner** (NEW: `scripts/check-fixtures.js`) | Replay a growing corpus of sentences → expected findings; diff against current output | Node script that `require()`s a pure-function version of the analysis pipeline |
| **UI markers/popover** | Render findings with dot + click-to-fix, explanation ("why was this flagged?") | DOM layer isolated from rule logic; takes `Finding` objects only |

The boxes that **do not yet exist** in the repo are marked NEW above. Those are the roadmap's architectural deliverables; everything else already ships.

---

## Recommended Project Structure

The structure below is an *extension*, not a rewrite, of what's already in `extension/content/`. Names preserve the existing kebab-case convention and IIFE-on-`self.` exposure pattern (see `CONVENTIONS.md`), so contributors don't need to learn new idioms.

```
extension/
├── content/
│   ├── vocab-store.js          # UNCHANGED — IndexedDB cache (existing)
│   ├── vocab-index.js          # NEW — builds & exposes self.__lexiVocab
│   │                           #     (lexicon, bigramIndex, freqIndex, grammar)
│   ├── scoring.js              # NEW — pure scoring signals + combiner
│   │                           #       self.__lexiScoring = { signals, score }
│   ├── spell-check.js          # Slimmed — becomes a rule-pack runner
│   ├── spell-rules/            # NEW — one file per rule or small group
│   │   ├── nb-gender.js        #   exports { id, appliesTo:'nb'|'nn', check }
│   │   ├── nb-modal-verb.js
│   │   ├── nb-sarskriving.js
│   │   ├── nb-typo-curated.js
│   │   ├── nb-typo-fuzzy.js
│   │   ├── nn-e-infinitiv.js   # future (MEMORY note — NN infinitive mix)
│   │   └── nb-aa-og.js         # future (MEMORY note — å/og full-sentence)
│   ├── word-prediction.js      # Slimmed — uses __lexiVocab + __lexiScoring
│   ├── floating-widget.js      # UNCHANGED
│   └── spell-ui.js             # Optional split — overlay/popover rendering
├── data/
│   ├── {lang}.json                # Existing vocab
│   ├── bigrams-{lang}.json        # Existing
│   ├── grammarfeatures-{lang}.json # Existing
│   ├── freq-{lang}.json           # NEW — unigram frequency rank
│   └── rules-{lang}.json          # OPTIONAL future — data-driven simple rules
├── fixtures/                     # NEW — regression corpus (see Pattern 5)
│   ├── nb/
│   │   ├── gender.jsonl
│   │   ├── sarskriving.jsonl
│   │   ├── modal-verb.jsonl
│   │   ├── typo.jsonl
│   │   └── no-false-positive.jsonl
│   ├── nn/
│   └── _runner-entry.js          # Node entry that wires analysis without DOM
└── manifest.json
```

### Structure Rationale

- **`content/vocab-index.js`:** The single biggest architectural win is **having one owner for runtime indexes**. Today, `word-prediction.js` owns them and spell-check borrows via a narrow interface. Making the vocab index layer a first-class module decouples every downstream signal (prediction, spell-check, future grammar features, a future `skriv.papertek.app` consumer) from the consumer that happened to load first. It also makes it obvious where a new index belongs when a new signal arrives.
- **`content/scoring.js`:** Signals (POS match, gender, bigram, frequency, phonetic, etc.) need a single definition. Right now `applyBoosts()` in `word-prediction.js` is 150+ lines of interleaved `if`-branches — readable, but impossible to test in isolation and invisible to spell-check's fuzzy branch. A small signals table + a single `combine()` function fixes this without changing observable behaviour on day one.
- **`content/spell-rules/`:** A folder per error class moves us from a 120-line check loop to a **plugin registry**. Each rule is a tiny pure function; the loop becomes `for (const rule of rulesForLang(lang)) collect(rule.check(ctx))`. This is how Harper (Rust) and LanguageTool (Java/XML) organise their rule surface — one rule per file, declarative metadata, runner agnostic to rule count.
- **`data/freq-{lang}.json`:** Frequency lives **beside** bigrams as its own small table rather than inside `{lang}.json`. Embedding frequency in the vocab entries would bloat every entry (and every consumer downstream, including `papertek-webapps` and `papertek-nativeapps`). Keeping it as a sidecar file keeps schema changes contained to Leksihjelp.
- **`fixtures/`:** JSONL (one test case per line) scales better than a single JSON array — diffs are readable, merges are conflict-resistant, and partitioning by error class lets us run subsets while iterating on a rule.

---

## Architectural Patterns

### Pattern 1: Shared Runtime Vocab Layer (`__lexiVocab`)

**What:** One module owns every runtime index built from the vocab JSON. It exposes read-only getters plus an `onReady` gate. Consumers (prediction, spell-check, future modules) never build indexes themselves.

**When to use:** From milestone start. This is prerequisite refactor #1.

**Trade-offs:**
- ✓ Kills the "load order" coupling (spell-check must be injected after word-prediction).
- ✓ A new index (e.g. `freqIndex`, phonemic hash) adds in one place instead of re-derived per consumer.
- ✓ Tests for rules can stub `__lexiVocab` directly.
- ✗ One more content script in the manifest; negligible.

**Example:**
```javascript
// content/vocab-index.js
(function () {
  'use strict';
  const indexes = {
    lexicon: {
      validWords: new Set(),
      nounGenus: new Map(),
      verbInfinitive: new Map(),
      compoundNouns: new Set(),
      typoFix: new Map(),
    },
    bigrams: null,              // { prev: { next: weight } }
    freq: null,                 // Map<word, rank>  (rank 1 = most common)
    prefix: new Map(),          // '2-3-char' → wordIdx[]
    wordList: [],               // source of truth for iteration
    grammar: null,              // grammar-feature metadata
    lang: null,
  };
  const readyCbs = [];
  let ready = false;

  async function buildForLanguage(lang) {
    ready = false;
    // load {lang}.json, bigrams-{lang}.json, freq-{lang}.json,
    // grammarfeatures-{lang}.json — then populate indexes
    // (extracted verbatim from word-prediction.js)
    ready = true;
    readyCbs.splice(0).forEach(cb => cb());
  }

  self.__lexiVocab = {
    getLexicon: () => indexes.lexicon,
    getBigrams: () => indexes.bigrams,
    getFreq:    () => indexes.freq,
    getWordList:() => indexes.wordList,
    getLanguage:() => indexes.lang,
    isReady:    () => ready,
    onReady(cb) { ready ? cb() : readyCbs.push(cb); },
    rebuild:    buildForLanguage,
  };
})();
```

Consumers shrink dramatically:
```javascript
// spell-check.js (after refactor)
const VOCAB = self.__lexiVocab;
VOCAB.onReady(() => { /* rule pack is ready */ });
function check(text, cursorPos) {
  const ctx = buildContext(text, cursorPos, VOCAB);
  const findings = [];
  for (const rule of rulePackFor(VOCAB.getLanguage())) {
    const out = rule.check(ctx);
    if (out) findings.push(...(Array.isArray(out) ? out : [out]));
  }
  return dedupeOverlapping(findings);
}
```

---

### Pattern 2: Rule-Pack Plugin Registry (error classes as data)

**What:** Each error class is a small module exporting `{ id, languages, priority, check(ctx) }`. A manifest file (or a folder convention) loads them. The check loop is generic.

**When to use:** Before adding the next error class (å/og, reflexives, particles). If you're about to add rule #5 by editing the same function where rule #4 lives, stop — extract first.

**Trade-offs:**
- ✓ "Add a rule" = new file + one manifest line. No git conflicts between two contributors adding different rules.
- ✓ Disable-by-ID becomes trivial (user setting: "skip sarskriving suggestions").
- ✓ Tests are per-rule: each rule has its own fixture slice.
- ✗ Slightly more ceremony for genuinely tiny rules; mitigated by keeping the rule module itself ≤30 lines.
- ✗ MV3 content scripts can't `import`, so the "registry" is either a literal array in `spell-check.js` listing each global, or each rule IIFE pushes itself into `self.__lexiSpellRules.push(rule)`. Both work; the array-in-runner is simpler.

**Example (rule):**
```javascript
// content/spell-rules/nb-modal-verb.js
(function () {
  'use strict';
  self.__lexiSpellRules = self.__lexiSpellRules || [];
  const MODALS = new Set(['kan','kunne','må','måtte','vil','ville','skal','skulle','bør','burde','får','fikk']);

  self.__lexiSpellRules.push({
    id: 'nb-modal-verb-form',
    languages: ['nb', 'nn'],
    priority: 20,
    explain: 'Etter modalverb skal hovedverbet stå i infinitiv.',
    check(ctx) {
      const findings = [];
      const { tokens, vocab } = ctx;
      for (let i = 1; i < tokens.length; i++) {
        const prev = tokens[i-1], t = tokens[i];
        if (!MODALS.has(prev.word)) continue;
        const inf = vocab.getLexicon().verbInfinitive.get(t.word);
        if (!inf || inf === t.word) continue;
        findings.push({
          ruleId: 'nb-modal-verb-form',
          type: 'modal_form',
          start: t.start, end: t.end,
          original: t.display,
          fix: matchCase(t.display, inf),
          message: `Etter "${prev.display}" skal verbet stå i infinitiv: "${inf}"`,
        });
      }
      return findings;
    },
  });
})();
```

**Example (runner):**
```javascript
// content/spell-check.js (core ≤ 200 lines after refactor)
function rulePackFor(lang) {
  return (self.__lexiSpellRules || [])
    .filter(r => r.languages.includes(lang))
    .sort((a,b) => a.priority - b.priority);
}
```

This is essentially how Harper (`harper-core` linters) and LanguageTool (`Rule` subclasses registered by language) structure their surface, boiled down to what MV3 content scripts can actually do without a bundler.

---

### Pattern 3: Signal Pipeline with Explicit Weights (not a stack of if-branches)

**What:** Replace the long `applyBoosts()` chain with a declared list of **signal functions**. Each signal returns a number (0 if not applicable). The combiner sums them — but the list of signals and their weights is data, not control flow.

**When to use:** Before the next scoring tweak. Adding a new signal (freq boost, case-agreement refinement) shouldn't require reading 150 lines of context to know if you're breaking something.

**Trade-offs:**
- ✓ Every signal is one function + one weight → trivial to A/B test by toggling weights.
- ✓ Same signals reusable in spell-check's fuzzy scorer (today it reimplements prefix/suffix bonuses).
- ✓ Debugging a bad rank = log each signal's contribution, pinpoint the culprit.
- ✗ Pure weighted-sum is dumber than a decorator pipeline where one signal can *veto* another. Solution: allow signals to return `{ weight, veto: true }` in the rare case you need hard suppression (POS mismatch after determiner today).
- ✗ Tuning weights becomes a meta-activity. Mitigated by the fixture (Pattern 5) — weight changes must not regress the corpus.

**Recommendation: weighted sum + veto, not a chain-of-responsibility.**
LanguageTool and Harper both accumulate scores (they don't short-circuit between rules). Chain-of-responsibility makes sense when exactly one handler wins — spell-check's *finding selection* is like that (dedupeOverlapping) — but scoring candidates is additive.

**Example:**
```javascript
// content/scoring.js
const SIGNALS = [
  { id: 'prefix-match',   weight: 1,  fn: s => s.target.startsWith(s.query) ? 100 + (s.query.length / s.target.length) * 50 : 0 },
  { id: 'recency',        weight: 1,  fn: s => s.recent.has(s.entry.word) ? 300 : 0 },
  { id: 'pronoun-match',  weight: 1,  fn: s => s.pronounContext && s.entry.pronoun === s.pronounContext ? 250 : 0 },
  { id: 'gender-match',   weight: 1,  fn: genderSignal },
  { id: 'bigram',         weight: 40, fn: bigramSignal },   // weight = multiplier
  { id: 'freq-rank',      weight: 1,  fn: freqSignal },      // NEW
  { id: 'pos-veto',       weight: 1,  fn: posVetoSignal },   // can return { veto:true }
  // …
];

function score(entry, ctx) {
  let total = ctx.baseScore;
  for (const s of SIGNALS) {
    const v = s.fn({ ...ctx, entry });
    if (v && typeof v === 'object' && v.veto) return -Infinity;
    total += (v || 0) * s.weight;
  }
  return total;
}
```

---

### Pattern 4: Language Separability via Rule Tags, not a Gate at the Top

**What:** Today `spell-check.js` has `if (lang !== 'nb' && lang !== 'nn') return findings`. That's fine for v1, but it hides language-specific assumptions inside each rule. Tag each rule with its `languages: ['nb','nn']`; the runner filters. When German spell-check arrives, you add `de-*.js` rules tagged `languages: ['de']` — no edits to the runner, no second check loop.

**When to use:** As soon as rules are extracted (Pattern 2). Do both in the same refactor.

**Trade-offs:**
- ✓ "Add DE rules" = add files + enable pack. No architecture change.
- ✓ Cross-language rules (e.g. a generic "known typo" rule that uses `typoFix` regardless of language) get `languages: ['nb','nn','de','es','fr','en']` and Just Work.
- ✗ Rule authors must remember to tag. Mitigated by ESLint-free convention: enforce via the fixture runner refusing rules with empty `languages`.

**Example:** `nb-gender.js` tags `['nb','nn']`; a future `de-article-case.js` tags `['de']`; a shared `typo-curated.js` tags `['nb','nn','de','es','fr','en']`. The runner does:
```javascript
const lang = VOCAB.getLanguage();
const pack = (self.__lexiSpellRules || []).filter(r => r.languages.includes(lang));
```

---

### Pattern 5: Fixture-Driven Regression Loop

**What:** A JSONL corpus per language + error class. Each line:
```json
{"text":"jeg kan spiser","expect":[{"ruleId":"nb-modal-verb-form","start":8,"end":14,"fix":"spise"}]}
```
A Node script loads vocab directly (bypassing Chrome APIs), runs the pipeline, diffs results. Committed alongside changes.

**When to use:** From day one of the milestone. The roadmap already lists this as an Active requirement — the architecture decision is **where to put it and how to make rule/scoring logic callable outside a browser**.

**Trade-offs:**
- ✓ JSONL grows without merge conflicts; partitioning by rule keeps files small.
- ✓ Makes weight tuning (Pattern 3) safe — a lower weight that regresses fixtures fails CI.
- ✓ Dual-purpose: "false positive" fixtures (sentences that must produce zero findings) are just expect:[].
- ✗ Analysis code must be callable from Node. Work required: extract tokenization + rule check into pure functions that don't touch `chrome.*` or `document.*`. This is the one piece of refactor discipline the fixture forces — but it aligns exactly with Pattern 1/2 anyway.
- ✗ Contents can't include subjective-ranking expectations ("should appear top-5"). Keep the fixture about *presence/absence/span*, not ranking. Ranking quality is a separate (manual) check or a coarse "is expected word in top-3" assertion.

**Directory shape:**
```
fixtures/
├── nb/
│   ├── gender.jsonl            # positive cases
│   ├── modal.jsonl
│   ├── sarskriving.jsonl
│   ├── typo.jsonl
│   ├── fuzzy.jsonl
│   └── no-false-positive.jsonl # negative corpus (must stay silent)
├── nn/…
├── _predict/                   # future — prediction-rank fixtures
│   └── nb-bigram-ranking.jsonl
└── README.md                   # how to add cases, naming conventions
```

---

### Pattern 6: Frequency Lives in a Sidecar Table, Not Inside Vocab Entries

**What:** Ship `data/freq-{lang}.json` as a flat `{ "er": 1, "og": 2, "å": 3, … }` (rank) or `{ "er": 12480, … }` (count). Load into a `Map<word, rank>`. Scoring reads `freqIndex.get(word)` as another signal.

**When to use:** When you actually need unigram frequency (prediction ordering when no bigram matches, "is this a rare word?" as an anti-signal for fuzzy typo). Don't add it preemptively.

**Trade-offs:**
- ✓ Schema-free: single file, one load, no churn to `papertek-vocabulary` schema.
- ✓ Size: top-10k NB words at 4-byte ranks ≈ 100–150 KB gzipped. Well inside the 20 MiB internal budget.
- ✓ Can be regenerated from any corpus without touching other data.
- ✗ Two sources of truth (vocab entry + freq table) for the same word → enforce "freq table is authoritative for frequency; vocab has no freq field."
- ✗ Must handle words-in-freq-not-in-vocab and vice versa gracefully.

**Alternatives evaluated:**
- **Freq as a field in `{lang}.json` entries.** Rejected: bloats every entry, ripples through `papertek-webapps` and `papertek-nativeapps`, couples schema evolution. Data changes belong in `papertek-vocabulary` only when all consumers need them.
- **Derived at runtime from corpus.** Rejected: no corpus ships in the extension; frequency is input, not output.

---

### Pattern 7: Bigram Storage — Nested Object Stays, but Document the Ceiling

**What:** Current `bigrams-nb.json` is ≈2.6 KB (~dozens of head words). Structure: flat object `{ prev: { next: weight } }`. At runtime it's the same shape — just lowercased. Lookup is O(1). Memory overhead is a plain JS object per head word.

**Recommendation: keep this shape up to ~20–50k head words.** Only consider compression / compressed trie when:
1. The file exceeds ~500 KB gzipped, OR
2. Build time (the loop in `loadBigrams`) is >50 ms on a mid-range device.

**Why not a trie now:**
- A PATRICIA trie saves ~2–3× memory on large keysets, but for bigrams where each head-word has a small, bounded fan-out (top-N continuations), the win is small.
- Hash maps are ~3× faster on exact lookup — and **every bigram query is an exact lookup**, never a prefix or range query.
- JS engines heavily optimise plain objects with string keys.
- Sources: hash-vs-trie comparisons consistently show hash wins for exact lookup; trie wins for prefix/range (see Sources below).

**When the corpus grows:**
- **Tier 1 (2.6 KB → ~200 KB):** Current format, no change.
- **Tier 2 (~200 KB → ~2 MB):** Switch the JSON to a `.jsonl` form (one line per head word) → allows streaming parse and per-language lazy load. Still plain-object at runtime.
- **Tier 3 (>2 MB):** Keep the head-word index as an object; move continuations to a pre-sorted `Uint16Array` of (nextWordId, weight). IDs come from a single `wordList`. Shrinks memory ~4× vs `{string: number}`. Only do this when measured size demands it.

Do **not** implement a custom binary format (CDB, FST, compressed trie) until Tier 3 is justified by profiling. Premature binary formats kill contributor velocity in a no-build-step codebase.

---

## Data Flow

### Per-keystroke analysis flow

```
  user types → input event
       │
       ▼
  word-prediction.js  ──────────────────────────────┐
       │ debounce (150ms)                           │
       │ extract query + context (prev word, POS…)  │
       ▼                                            │
  vocab-index.js                                    │
  prefixIndex.get(query.slice(0,3)) → candidates[]  │
       │                                            │
       ▼                                            │
  scoring.js                                        │
  for each candidate: sum weighted signals          │
  (match, recency, bigram, freq, pronoun, gender…)  │
       │                                            │
       ▼                                            │
  sort, take top-N → dropdown UI                    │
                                                    │
  spell-check.js (parallel, debounced 200ms) ◄──────┘
       │
       ▼
  tokenize full text → build ctx { tokens, vocab, lang, cursorPos }
       │
       ▼
  for rule in rulePackFor(lang):
      findings.push(...rule.check(ctx))
       │
       ▼
  dedupeOverlapping → overlay dots
       │
       ▼
  click → popover with fix + "why was this flagged?" (rule.explain)
```

### Build-once flow (language change)

```
  LANGUAGE_CHANGED message  (or popup load)
       │
       ▼
  vocab-store.js:  getCachedLanguage(lang)  ──► {lang}.json
       │
       ▼
  vocab-index.js:  rebuild(lang)
       ├─► flatten banks → wordList[]
       ├─► build prefixIndex
       ├─► build lexicon (validWords, nounGenus, verbInfinitive, compoundNouns, typoFix)
       ├─► fetch bigrams-{lang}.json  → bigramIndex
       ├─► fetch freq-{lang}.json     → freqIndex     (NEW)
       ├─► fetch grammarfeatures-{lang}.json
       └─► signal onReady to listeners
       │
       ▼
  prediction + spell-check re-read handles on next invocation.
  (No need to explicitly wake either — they call getters lazily.)
```

### Fixture run (offline, CI-friendly)

```
  node scripts/check-fixtures.js nb
       │
       ▼
  load extension/data/nb.json, bigrams-nb.json, freq-nb.json directly
       │
       ▼
  vocab-index (Node shim — same module, no DOM access)
       │
       ▼
  for each case in fixtures/nb/*.jsonl:
      findings = analyze(case.text, ctx)
      diff vs case.expect
       │
       ▼
  report failures; exit non-zero if any
```

---

## Scaling Considerations

Different axis than user-count scaling; this product's scale dimensions are **#error classes**, **#languages**, and **#signals**.

| Growth axis | At milestone start (today) | Mid-milestone (6 rules, freq added) | Milestone exit (DE pack added) |
|-------------|----------------------------|-------------------------------------|-------------------------------|
| Error classes | 4 rules, all inline in one file | 6–8 rules, one-per-file with runner; add in ≤1 h each | 10+ rules across 2 languages; same runner; new rule untouched by DE addition |
| Languages | NB/NN only, gated at top of file | NB + NN still; `languages` tag baked in | NB + NN + DE spell-check rules coexist; prediction already supports 6 |
| Signals (prediction) | ~12 inline in `applyBoosts()` | All in `scoring.js` as a table | New signal = add row, rerun fixtures |
| Vocab entries | ~15–25 k per lang | Same — content grows from `papertek-vocabulary`, not architecture | Architecture unaffected |
| Bigram size | 2.6 KB (NB) | 50–200 KB (expanded corpus) | Still plain-object; no binary format |
| Fixture corpus | 0 cases | 200–500 cases across NB/NN | 1 000+ cases; runner < 5 s on laptop |

### Scaling priorities

1. **First bottleneck: adding rule #5.** Today that means editing `check()` in a 900-line file. If left alone, it quickly becomes the dominant cost of every PR. Fix: Pattern 2 (rule-pack extraction) — do this in week 1.
2. **Second bottleneck: weight-tuning side effects.** A small boost change to help Case X silently regresses Case Y. Fix: Pattern 5 (fixture) + Pattern 3 (signal table) in weeks 1–2. These two together unlock safe iteration.
3. **Third bottleneck: DE spell-check.** Without Pattern 4, adding DE duplicates the gate-at-top logic and forks the runner. With Patterns 2+4, it's strictly additive.
4. **Fourth (not in this milestone, monitor only): memory.** Bundle currently ~10.1 MiB; internal engineering ceiling 20 MiB enforced by `scripts/check-bundle-size.js`. Bigram/freq/rule additions must stay inside the budget. The `npm run check-bundle-size` gate (Plan 02-04) prints per-directory sizes — early warning beats reactive trimming.

---

## Anti-Patterns

### Anti-Pattern 1: Piling new error classes into one big check loop

**What people do:** Add rule #5 as another `if (…) findings.push({…})` block inside `check()`. It's fast — until it isn't.
**Why it's wrong:** Rules end up sharing local variables (`prev`, `prevPrev`, `articleTok`), making refactoring risky. Two contributors touching different rules conflict on every merge. You can't disable one rule at runtime without adding a flag to the loop.
**Do this instead:** Extract to `spell-rules/{lang}-{class}.js` with the shape from Pattern 2. Make the loop in `spell-check.js` generic.

### Anti-Pattern 2: Coupling spell-check lifecycle to word-prediction

**What people do:** "spell-check reads vocab via `__lexiPrediction`, that's fine, leave it." Over time, spell-check starts peeking at scoring internals, prediction state leaks into spell rules, and the "narrow interface" has 15 methods.
**Why it's wrong:** The Core Value in `PROJECT.md` explicitly calls for `spell-check.js` to remain separable so it can ship to `skriv.papertek.app` independently. Every new leak across the `__lexiPrediction` seam raises the cost of that extraction.
**Do this instead:** Introduce `__lexiVocab` as the shared dependency (Pattern 1). Spell-check reads from it. Prediction reads from it. Neither knows about the other.

### Anti-Pattern 3: Embedding frequency/bigrams inside the vocab schema

**What people do:** "Let's just add `freq: 0.0012` to every word in `{lang}.json`."
**Why it's wrong:** `{lang}.json` ships to three consumers (Leksihjelp, `papertek-webapps`, `papertek-nativeapps`). Schema changes have cross-app blast radius (see `PROJECT.md` constraints). And frequency is a derived numerical signal, not a property of a word's identity — it wants to be a table lookup, not a per-entry field.
**Do this instead:** `freq-{lang}.json` sidecar table, Leksihjelp-private. Same for any future signal (phonetic hashes, dialect tags). Vocab entries stay authoritative for linguistic facts only.

### Anti-Pattern 4: Chain-of-responsibility for signal scoring

**What people do:** Build a pipeline where each signal can "handle" a candidate and short-circuit the rest.
**Why it's wrong:** Prediction scoring is fundamentally additive — bigram match *plus* pronoun match is better than either alone. Short-circuiting loses that. Harper and LanguageTool both accumulate; they don't short-circuit.
**Do this instead:** Weighted sum (Pattern 3), with an escape hatch for hard vetoes (POS mismatch). Keep it simple; reach for more sophistication only if fixtures show you need it.

### Anti-Pattern 5: Custom binary bigram format before it's profiled

**What people do:** Read about FSTs or CDBs, decide the JSON object is "wasteful," build a custom binary.
**Why it's wrong:** Binary formats need a build step (decode). This codebase has no build step by design (contributors can edit and reload). You pay a big velocity cost to save memory you haven't measured.
**Do this instead:** JSON object → JSONL streaming → ID-based `Uint16Array` (Pattern 7 tiers). Only advance tier when profile demands it.

### Anti-Pattern 6: Fixture cases that assert exact ranking positions

**What people do:** `expect: { rank: 3 }` — "the correct word must be the 3rd suggestion."
**Why it's wrong:** Scoring tweaks legitimately shuffle ranks. Every improvement becomes a test break.
**Do this instead:** Fixture asserts **presence/absence/span** (for spell-check) or **top-N membership** (for prediction). "Word appears in top-5" is stable; "word is exactly 3rd" is not.

---

## Integration Points

### External Services (no change from today)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `papertek-vocabulary` API | `sync-vocab.js` at release time; writes to `extension/data/` | Authoritative for all linguistic data. Never hand-edit output files. |
| ElevenLabs / browser TTS | Unrelated to this milestone's architecture | — |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| vocab-index.js ↔ spell-check.js | read-only via `self.__lexiVocab` getters; `onReady` for lifecycle | New seam; replaces `__lexiPrediction` as spell-check's data source |
| vocab-index.js ↔ word-prediction.js | same as above | Prediction migrates gradually — can keep internal copies during transition |
| scoring.js ↔ word-prediction.js | pure function call per candidate: `score(entry, ctx)` | No state; safe to call from Node fixture runner |
| scoring.js ↔ spell-check.js (fuzzy) | optional — fuzzy rule can borrow `sharedPrefixLen`, `editDistance` from scoring | Only if duplication is non-trivial; keep small helpers inline if cleaner |
| spell-rules/* ↔ spell-check.js | rules register via `self.__lexiSpellRules.push({…})` at load time | Rule order in manifest is build order; priority field handles runtime order |
| fixtures runner ↔ everything | Node require of a pure-function build of analyze pipeline | Forces a clean chrome-free subset; that's a feature |
| Content script load order | manifest.json declares: vocab-store → vocab-index → scoring → spell-rules/* → spell-check → word-prediction → floating-widget | Ordering matters because IIFEs populate globals; document this explicitly in `manifest.json` comment |

---

## Suggested Build Order (dependencies between architecture pieces)

The right first cut unlocks everything else. Recommended ordering:

1. **Extract `__lexiVocab` (Pattern 1).** Moves indexes out of `word-prediction.js` into `vocab-index.js`. Spell-check switches its lookup to `__lexiVocab` but keeps its rule logic intact. *Observable behaviour unchanged; makes all later steps cheaper.*
2. **Build fixture runner + initial NB corpus (Pattern 5).** Lock current behaviour in place. Every subsequent change is now safety-netted. Start with 30–50 cases per existing rule + 20 false-positive cases.
3. **Extract rule packs (Pattern 2) + language tags (Pattern 4).** Refactor the four existing NB rules into `spell-rules/nb-*.js`. Runner becomes generic. Fixtures catch regressions.
4. **Extract scoring signal table (Pattern 3).** Move `applyBoosts()` into `scoring.js`. Fixtures protect ranking outcomes.
5. **Add `freq-{lang}.json` (Pattern 6) as a new signal.** Small, targeted; uses the now-clean scoring pipeline.
6. **Add "why was this flagged?" surface to the popover.** Requires only the `rule.explain` field added in Step 3. Zero architecture change.
7. **Add new error classes (å/og, reflexives, particles).** Each is a new file in `spell-rules/`. No core edits.
8. **(Future, not this milestone)** DE spell-check pack — `de-*.js` files in `spell-rules/`. Runner unchanged.

Steps 1–3 are the architecturally load-bearing ones; once those land, Steps 4–7 become ordinary feature work.

### What *not* to reorder

- **Don't add new rules before Step 3.** The cost of adding rule #5 to the current monolithic loop then extracting later is higher than extracting first.
- **Don't tune scoring weights before Step 2.** Without fixtures, you have no baseline; every improvement is a gut feeling that may regress something else.
- **Don't build a data-driven rule format (`data/rules-nb.json`) yet.** Some LanguageTool rules *are* pure data (XML pattern match), but most interesting NB rules need real code (gender inference, case analysis). Reach for declarative rule data only if 3+ new rules turn out to be pattern-shaped.

---

## Module Separability Guarantees for `spell-check.js`

The `PROJECT.md` Core Value flags that spell-check may be extracted later (to `skriv.papertek.app`). After the refactors above, the extraction story is:

- `spell-check.js` depends on: `self.__lexiVocab` (data), `self.__lexiSpellRules` (rules), DOM (UI).
- To extract: replace `self.__lexiVocab` with a platform-appropriate vocab loader (HTTP fetch in a web app instead of IndexedDB); replace the DOM overlay with the target platform's annotation surface; rules come along unchanged.
- What stays put in the extension: `vocab-store.js` (IndexedDB-specific), the overlay/popover UI layer, MV3 manifest wiring.

Keeping the rule packs and `scoring.js` as pure-function, chrome-free modules is the main discipline. The fixture runner enforces this mechanically (it fails if a rule touches `chrome.*` or `document.*`).

---

## Sources

Offline grammar/spell-checker architectures (verification for rule-pack and linter interface patterns):
- [Harper — Privacy-First Offline Grammar Checker (docs: linting / Linter interface)](https://writewithharper.com/docs/harperjs/linting) — confirms one-linter-interface + Weirpack rule-pack pattern. MEDIUM confidence (high-level docs; deeper source read would raise to HIGH).
- [Automattic/Harper GitHub repo](https://github.com/Automattic/harper) — confirms per-language crate structure (`harper-*` modules), stats module for frequency-like signals. MEDIUM.
- [LanguageTool — Development Overview](https://dev.languagetool.org/development-overview.html) — confirms rule = pattern + ID + message + examples, with XML pattern rules and Java `Rule` subclasses as the two extension points. MEDIUM.
- [LanguageTool JLanguageTool.java (source)](https://github.com/languagetool-org/languagetool/blob/master/languagetool-core/src/main/java/org/languagetool/JLanguageTool.java) — rule loading + enabled/disabled management as a list. MEDIUM.
- [LanguageTool rules XSD schema](https://github.com/languagetool-org/languagetool/blob/master/languagetool-core/src/main/resources/org/languagetool/rules/rules.xsd) — shows what declarative rule data looks like in practice. MEDIUM.
- [Voikko — General Architecture](https://voikko.puimula.org/architecture.html) — comparable Nordic spell-checker architecture (Finnish, but architecturally relevant for Norwegian). LOW (scanned, not deep-read).

Data structure trade-offs (bigram storage):
- [Trie vs Hash Table Deathmatch (Loup Vaillant)](https://loup-vaillant.fr/projects/string-interning/benchmark) — hash maps win for exact lookup. LOW.
- [DSA Tradeoffs: When a Trie Beats a Hash Map](https://medium.com/@connect.hashblock/dsa-tradeoffs-when-a-trie-beats-a-hash-map-f998b8d22f92) — trie wins for prefix/range; hashes for exact. LOW.
- [Hash array mapped trie — Wikipedia](https://en.wikipedia.org/wiki/Hash_array_mapped_trie) — background on HAMT trade-offs. MEDIUM.

Finite-state / weighted spell-checking (surveyed to confirm we don't need it yet):
- [Finite-State Spell-Checking with Weighted Language and Error Models (ACL W12-6201)](https://aclanthology.org/W12-6201.pdf) — shows FSTs pay off for full-corpus weighted models; overkill for our heuristic-rule scope. MEDIUM.
- [Building and Using Existing Hunspell Dictionaries as Finite-State Automata](https://flammie.github.io/purplemonkeydishwasher/2010-cla/Pirinen-2010-cla.html) — confirms Hunspell-style dictionaries can be ported to FSTs; we're not using either. MEDIUM.

Scoring architecture (weighted sum vs chain-of-responsibility):
- [Chain of Responsibility — Refactoring.Guru](https://refactoring.guru/design-patterns/chain-of-responsibility) — "exactly one handler wins" semantics; wrong fit for additive scoring. HIGH.
- [Signal Scoring Pipeline: Deterministic Knowledge Triage](https://blakecrosley.com/blog/signal-scoring-pipeline) — argues weighted composite scores expose priorities explicitly. LOW (blog, single source).

Regression fixtures & golden tests:
- [pytest-regressions documentation](https://pytest-regressions.readthedocs.io/en/latest/overview.html) — fixture directory conventions; flat vs nested. MEDIUM.
- [Golden Tests — Widgetbook glossary](https://docs.widgetbook.io/glossary/golden-tests) — snapshot regression pattern. MEDIUM.
- [Apertium regression test framework](https://wiki.apertium.org/wiki/Apertium-regtest) — closest analogue (NLP rule-based system with language-per-directory regression corpus). MEDIUM.

Existing Leksihjelp code (primary source for every claim about current shape):
- `/Users/geirforbord/Papertek/leksihjelp/extension/content/spell-check.js` (898 lines) — current rule layout
- `/Users/geirforbord/Papertek/leksihjelp/extension/content/word-prediction.js` (1845 lines) — current scoring + `__lexiPrediction` interface
- `/Users/geirforbord/Papertek/leksihjelp/extension/content/vocab-store.js` (557 lines) — IndexedDB cache layer
- `/Users/geirforbord/Papertek/leksihjelp/extension/data/bigrams-*.json` — current bigram format
- `/Users/geirforbord/Papertek/leksihjelp/.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS}.md` — architecture constraints & conventions

---

*Architecture research for: offline heuristic spell-check + prediction inside Leksihjelp MV3 extension*
*Researched: 2026-04-17*
