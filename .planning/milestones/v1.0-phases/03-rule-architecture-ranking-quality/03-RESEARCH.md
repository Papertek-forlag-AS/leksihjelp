# Phase 3: Rule Architecture & Ranking Quality - Research

**Researched:** 2026-04-19
**Domain:** Chrome MV3 content-script rule-plugin architecture + offline heuristic ranking (spell-check fuzzy matching + 6-language word-prediction)
**Confidence:** HIGH

## Summary

Phase 3 is the "turn the Phase-2 data into visible ranking wins" phase plus a structural refactor of the spell-check rule surface into a plugin registry under `extension/content/spell-rules/`. All seven requirements (INFRA-03, SC-01, SC-06, WP-01, WP-02, WP-03, WP-04) are addressable with the existing stack: zero new runtime dependencies, zero new npm packages, all work inside the already-established vocab-seam + spell-check-core pattern. The work is high-leverage because Phase 1 put the seam in place, Phase 2 shipped the Zipf sidecars (`freq-nb.json`, `freq-nn.json`) and enlarged bigrams — but `state.freq` is still an empty `Map` (vocab-seam-core.js:492) and the prediction ranker has no frequency signal. Phase 3 wires them through.

Two important grounding facts:

1. **`bedre` already wins over `berre` for `berde`** today (verified in-repo at the start of this research; fixture case `nb-typo-berde-001` is green at F1=1.000). The current win path is the `isAdjacentTransposition` +40 score bonus in `spell-check-core.js:304`, not frequency. SC-01's criterion #2 therefore needs a **new** regression case that targets the Zipf tiebreaker specifically (e.g., a typo pair where both candidates are equidistant and neither is an adjacent transposition), otherwise we risk adding frequency code that is not actually being exercised by the test.

2. **Phase 2 shipped freq data for NB/NN only, not for DE/ES/FR/EN.** However, each per-entry record in `extension/data/{de,es,fr,en,nb,nn}.json` already carries a `frequency` integer field (verified by grep count: 3398/3127/2918/2864/4252/4245 entries respectively). The vocab-seam core already stores this as part of wordList entries (though not yet read by the ranker). For WP-01 across all 6 languages, the entry-level frequency is the pragmatic path; building CC-0 Zipf sidecars for DE/ES/FR/EN is out of scope in this milestone per STACK.md and wordfreq-NN gap notes.

**Primary recommendation:** Land five parallel-ready plans. (A) Wire `freq-{lang}.json` sidecar loading into the seam so `VOCAB.getFrequency(word)` returns real Zipf values for NB/NN. (B) Extract spell-check rules to `extension/content/spell-rules/*.js` as an array-push registry on `self.__lexiSpellRules` — keep the check loop in `spell-check-core.js` generic, preserve the dual-export footer, keep rule eval order via `priority`. (C) Add Zipf + length/suffix tiebreaker to `findFuzzyNeighbor` and author regression fixture cases that demand the frequency signal (SC-01). (D) Consolidate word-prediction ranking: centralize `applyBoosts` into a signal table, add a `freq` signal (entry-level for DE/ES/FR/EN, Zipf for NB/NN), add stricter tiebreaking + demotion rules (WP-01..WP-04). (E) Verify SC-06 — zero outbound requests from any spell-check / spell-rules / word-prediction code path during a 30-second typing session (automatable as a CI grep + manual DevTools Network check in Release Workflow).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-03 | Rule-plugin architecture under `extension/content/spell-rules/` — each error class a self-contained file tagged with supported languages, registered via a global array; adding a new class does not require edits to `spell-check.js` | Pattern 2 (Rule-Pack Plugin Registry) in `.planning/research/ARCHITECTURE.md:215-262`; existing four rules already live in `spell-check-core.js:83-212` as one `check()` function — straight lift-and-shift into `self.__lexiSpellRules.push({ id, languages, priority, check, explain })` per rule. MV3 content scripts cannot `import`, so the registry is a global array populated by IIFE load order declared in `manifest.json`. |
| SC-01 | Fuzzy-match scoring ranks candidates using frequency (Zipf) as a tiebreaker after shared-prefix/suffix, so `berde` suggests `bedre` over `berre` in NB | Current scoreCandidate (spell-check-core.js:304-311) already has prefix/suffix/length/transposition weights. Add `+ zipf * N` term reading `vocab.freq.get(cand)`. Zipf floats already on disk at `extension/data/freq-nb.json` / `freq-nn.json` (13,132 / 11,013 entries). Verified: `bedre=5.58, berre=4.61` — 0.97-Zipf gap is enough signal to tune against. |
| SC-06 | Spell-check honors existing PROJECT.md constraints — stays free, offline, NB/NN only in v1, no new external API dependencies | Pitfall 8 (Privacy regression) in `.planning/research/PITFALLS.md:251-281`. Enforce via (a) CI grep for `fetch\|XMLHttpRequest\|http` in `spell-check*.js` and `spell-rules/*.js`, (b) manifest permissions unchanged, (c) DevTools Network tab check in Release Workflow. |
| WP-01 | Ranking integrates Zipf-style unigram frequency alongside existing POS, gender, case, tense, and bigram signals; uses the same `freq-{lang}.json` sidecars from DATA-01, extended to DE/ES/FR/EN where CC-0 data exists | NB/NN: read from `freq-{lang}.json` sidecars (load via same fetch as bigrams). DE/ES/FR/EN: fall back to per-entry `frequency` integer already in `{lang}.json` (normalize to Zipf-ish 0-7 range via log10(f/max) * 7). Documented as a decision, not a promise that all six languages have CC-0 external corpora. |
| WP-02 | Expanded bigram coverage (from DATA-03 for NB/NN; researcher decides source for DE/ES/FR/EN) | NB/NN bigrams already regrown in Phase 2 Plan 02-02 (57→2019 / 55→2022 head-words). DE/ES/FR bigrams-*.json files are tiny (3-4 KB, ~30 hand-authored idioms); recommendation: keep DE/ES/FR bigrams **as-is** this phase (no CC-0 corpus at comparable quality, and hand-authored-only has higher signal-per-byte than noisy foreign-corpus-derived bigrams). EN has no bigram file — optional: hand-author ~40 high-value pairs (e.g., "I am", "very good", "thank you") since it ships bundled and is a learner target. |
| WP-03 | Improved tiebreaking — when multiple candidates share the same edit distance or score, the ranker prefers same-length matches, shared-suffix matches, and higher-frequency words over arbitrary iteration order | Currently `findSuggestions` (word-prediction.js:802-877) uses insertion order (`scored.push` then sort-by-score). The sort is unstable for equal scores → iteration-order artifacts. Fix by appending deterministic tiebreakers: `.sort((a,b) => b.score-a.score || freqGap || lenMatch || suffixMatch || alpha)`. |
| WP-04 | Stricter filtering — irrelevant suggestions demoted so top-3 feel useful in at least 80% of sampled scenarios | Demote very-low-frequency words (Zipf < 2.0 / entry frequency below a per-lang percentile); demote POS-mismatched candidates harder after determiners (already partially done via `posStrength >= 2` → -100); demote typo-type entries when input-length/target-length < 0.6 (already done at applyBoosts line 882). New work: tuned frequency floor + proper-noun demote. |
</phase_requirements>

---

## User Constraints

**No CONTEXT.md exists for Phase 3 yet** (`/gsd:discuss-phase 3` has not been run). The planner may need to gather user decisions on a few points (listed under Open Questions below). In the absence of explicit locks, default to these **roadmap-level constraints** carried forward from PROJECT.md / STATE.md:

### Carried-forward constraints (already locked at milestone level)

- **Heuristics only, no ML, no paid APIs.** (`PROJECT.md` Out of Scope; all six languages.)
- **Extension-side features stay free forever.** Spell-check + prediction must not become subscription-gated.
- **Offline by default.** Zero outbound network calls from spell-check / spell-rules / word-prediction code paths (SC-06).
- **No new runtime npm dependencies.** STACK.md Prescriptive §1-§2: the needed algorithms (~60 LOC Damerau-Levenshtein, lookups, array sort tiebreakers) roll locally; no `fastest-levenshtein`, no `nspell`, no `spellchecker-wasm`.
- **Bundle-size ceiling 20 MiB internal engineering ceiling** (Phase 02.1 resolution). Additional bundle impact from any new data: NB/NN freq already shipped at 113 KB gz; no new data files planned in Phase 3 unless hand-authored EN bigrams land (< 5 KB).
- **NB first, NN second for spell-check; all 6 languages for word-prediction.** Phase 3 must address both pipelines but their surfaces stay disjoint (spell-rules are NB/NN only for now; prediction ranker affects all 6).
- **Data-quality fixes at the `papertek-vocabulary` source, not client-side** (CLAUDE.md policy). If a ranking bug is really a vocab-data bug, the fix goes in the sibling repo.
- **Spell-check stays structurally separable** (INFRA-04). `spell-rules/*.js` files must not import from word-prediction globals; they are pure rule modules callable from Node via the dual-export pattern already in use on `spell-check-core.js`.

### Areas where planner should gather user input before starting (Claude's discretion if not locked)

- **Plan decomposition** — five distinct plans or fewer? The work is parallelizable but the ordering matters (INFRA-03 refactor ideally lands before SC-01's new fuzzy tiebreaker so the tiebreaker ships in the new registry shape, not the old monolith).
- **WP-02 source for EN bigrams** — hand-author ~40 pairs this phase, skip entirely, or defer? Low-risk either way; researcher's suggestion is "hand-author 40 pairs" because it's a small delta with measurable top-3 improvement for a bundled learner language.
- **"Flik → flink" deferred case** (`fixtures/nb/typo.jsonl:34-38`) — pick up in Phase 3 now that ranking is being reworked, or keep deferred? Research: **address in Phase 3** because the root cause is the fuzzy matcher's `len <= 6 → k = 1` threshold at `spell-check-core.js:272` and the length-growing-edits penalty — both within scope.

### Deferred Ideas (OUT OF SCOPE for Phase 3)

- **å/og detector.** Requires sentence-level parsing; deferred per user MEMORY and PITFALLS.md:312-324.
- **Proper-noun guard improvements.** Assigned to Phase 4 (SC-02).
- **Code-switching detection.** Assigned to Phase 4 (SC-04) with a research flag on empirical calibration (STATE.md Blockers).
- **UX copy for "why was this flagged?"** Assigned to Phase 5 (UX-01).
- **Top-3 cap + "vis flere" UI.** Assigned to Phase 5 (UX-02). Phase 3's SC #5 says the developer sampling checks top-3 usefulness, but the UI cap is a Phase 5 change.
- **DE/ES/FR/EN spell-check.** STACK.md §"What NOT to Use"; explicit Out-of-Scope in REQUIREMENTS.md:52-55 (SC-10 is a v2 requirement).
- **SymSpell deletion index.** STACK.md recommended the algorithm, but existing `findFuzzyNeighbor` uses O(N) linear scan with first-char pruning + bounded Damerau-Levenshtein and is fast enough on current validWords sizes (~26K NB, ~22K NN). Only switch to SymSpell if measurement shows >100ms per check.

---

## Standard Stack

Phase 3 adds **zero** npm packages. All work is in vanilla JS / Node built-ins.

### Core (unchanged, already in place)

| Technology | Version | Purpose | Why Standard |
|---|---|---|---|
| Vanilla JS (ES2022+) | — | All content-script logic | Project standard; no build step; no Chrome Web Store review friction |
| Inlined bounded Damerau-Levenshtein | local (`spell-check-core.js:236-266`) | Edit-distance with early abort | Already shipping; handles transpositions natively (`berde→bedre` distance 1) |
| JSON sidecars | `freq-{lang}.json`, `bigrams-{lang}.json` | Ranking signals | Shipping in `extension/data/`; loaded by the seam |
| Dual-export IIFE pattern | `self.__lexi*` + `module.exports` | Browser + Node reuse | Already applied to `vocab-seam-core.js`, `spell-check-core.js`; proven across Phase 1+2 |
| Chrome MV3 content scripts | — | Load order via `manifest.json` `content_scripts.js` array | Already the registration mechanism; extend by adding `content/spell-rules/*.js` lines |
| Node 18+ | — | `scripts/check-fixtures.js` + build scripts | Already assumed by Phase 1/2 infra |

### Additions (this phase)

| Component | Purpose | Integration |
|---|---|---|
| `extension/content/spell-rules/` directory | Plugin registry for spell-check rules | Each file IIFE `self.__lexiSpellRules.push({id, languages, priority, check, explain})` + Node-side `module.exports` for fixture harness |
| Frequency loader | Populate `state.freq` in the seam from `freq-{lang}.json` | Parallel fetch next to existing bigrams fetch in `vocab-seam.js` |
| Signal table (word-prediction) | Replace interleaved `applyBoosts` if-branches with a declared signal array | Inside `word-prediction.js` only; no new file needed; pattern is internal cleanup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Array-push registry on `self.__lexiSpellRules` | A literal array in `spell-check-core.js` listing each rule | ARCHITECTURE.md:226 says both work; "array in runner is simpler" but array-push scales better when rules grow beyond ~6-7. Prefer array-push for INFRA-03 so new rule = new file + manifest line, zero edits to the runner. |
| Zipf-from-sidecar for all 6 languages | CC-0 corpora for DE/ES/FR/EN (wordfreq MIT has DE/ES/FR but no NN; no CC-0 NN outside NB N-gram 2021) | Building 4 more Zipf sidecars is out of scope this milestone. Use per-entry `frequency` field in `{lang}.json` (already present) as a ranking signal for DE/ES/FR/EN; keep Zipf sidecars NB/NN only. |
| SymSpell deletion index | Current linear scan in `findFuzzyNeighbor` | Current is ~O(N) with first-char short-circuit → fast enough on 25K words. Switch only if profiling shows a bottleneck. |
| Multi-candidate return from `findFuzzyNeighbor` | Single `best` string | Deferred to Phase 5 (top-3 popover). Phase 3 still returns one best candidate for spell-check; prediction already returns multiple. |

**Installation:** none required. Verify with `npm run check-fixtures` (132/138 pass today; must stay green post-refactor).

---

## Architecture Patterns

### Recommended Project Structure (post-Phase 3)

```
extension/
├── content/
│   ├── vocab-store.js            # UNCHANGED (IndexedDB cache)
│   ├── vocab-seam-core.js        # UNCHANGED shape; getFrequency now backed by real data
│   ├── vocab-seam.js             # MODIFIED — loads freq-{lang}.json alongside bigrams
│   ├── spell-rules/              # NEW — plugin registry
│   │   ├── nb-gender.js          #   IIFE that pushes { id:'gender', languages:['nb','nn'], … }
│   │   ├── nb-modal-verb.js
│   │   ├── nb-sarskriving.js
│   │   ├── nb-typo-curated.js    #   uses typoFix Map, returns rule_id:'typo'
│   │   └── nb-typo-fuzzy.js      #   uses findFuzzyNeighbor (Zipf-aware now)
│   ├── spell-check-core.js       # SLIMMED — loses rule bodies; becomes tokenize + runner + dedup
│   ├── spell-check.js            # MINIMAL CHANGE — adapter still reads `f.type = f.rule_id`
│   ├── word-prediction.js        # MODIFIED — applyBoosts → signal-table, new freq signal, better tiebreaks
│   └── floating-widget.js        # UNCHANGED
├── data/
│   ├── freq-{nb,nn}.json         # unchanged from Phase 2
│   ├── bigrams-{nb,nn}.json      # unchanged from Phase 2
│   └── bigrams-en.json           # OPTIONAL new — ~40 hand-authored pairs if user approves
└── manifest.json                 # MODIFIED — adds spell-rules/*.js entries in content_scripts.js
```

### Pattern 1: Rule-Pack Plugin Registry (INFRA-03)

**What:** Each error class becomes its own IIFE file that pushes a rule object onto `self.__lexiSpellRules`. The runner (extracted from the current `check()` body in `spell-check-core.js`) iterates the array filtered by language and priority.

**When to use:** Now. The research-recommended trigger is "before adding rule #5"; we're at rule #5 (new å/og is deferred, but new Zipf-fuzzy counts as a material rewrite of the existing fuzzy rule).

**Structure of a rule module** (example lifted from `spell-check-core.js:143-155` for `modal_form`):

```javascript
// extension/content/spell-rules/nb-modal-verb.js
(function () {
  'use strict';
  // Dual-load guard: MV3 content script OR Node require.
  const registry = (typeof self !== 'undefined') ? (self.__lexiSpellRules = self.__lexiSpellRules || []) : null;

  const MODAL_VERBS = new Set([
    'kan','kunne','kunna','må','måtte','vil','ville','skal','skulle','bør','burde','får','fikk','fekk',
  ]);

  const rule = {
    id: 'modal_form',
    languages: ['nb', 'nn'],
    priority: 20,
    explain: 'Etter modalverb skal hovedverbet stå i infinitiv.',
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const out = [];
      for (let i = 1; i < tokens.length; i++) {
        const prev = tokens[i - 1], t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (!MODAL_VERBS.has(prev.word)) continue;
        const inf = vocab.verbInfinitive.get(t.word);
        if (!inf || inf === t.word) continue;
        out.push({
          rule_id: 'modal_form',
          start: t.start, end: t.end,
          original: t.display,
          fix: matchCase(t.display, inf),
          message: `Etter "${prev.display}" skal verbet stå i infinitiv: "${inf}"`,
        });
      }
      return out;
    },
  };

  if (registry) registry.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;

  // matchCase() helper: duplicate inline (3 lines), or require it from a
  // shared `_utils.js`. The current core exposes matchCase on __lexiSpellCore
  // already — prefer that: `const { matchCase } = self.__lexiSpellCore;`
})();
```

**Runner (slimmed `spell-check-core.js`):**

```javascript
// Replaces the monolithic check() body. Tokenize, collect from rules, dedupe.
function check(text, vocab, opts = {}) {
  const { cursorPos = null, lang = 'nb' } = opts;
  if (!text || text.length < 3) return [];
  const tokens = tokenize(text);
  if (tokens.length < 2) return [];

  const ctx = { text, tokens, vocab, cursorPos, lang };

  const rules = (self.__lexiSpellRules || [])
    .filter(r => r.languages.includes(lang))
    .sort((a, b) => a.priority - b.priority);

  const findings = [];
  for (const rule of rules) {
    try {
      const out = rule.check(ctx);
      if (Array.isArray(out) && out.length) findings.push(...out);
    } catch (e) {
      // One broken rule must not break the rest. Swallow + log once.
      if (!rule._warned) { console.warn('[lexi-spell] rule', rule.id, 'threw', e); rule._warned = true; }
    }
  }
  return dedupeOverlapping(findings);
}
```

**Registration in `manifest.json`** (content_scripts.js array — insertion order = load order):

```jsonc
"content_scripts": [{
  "js": [
    "i18n/strings.js",
    "content/vocab-store.js",
    "content/vocab-seam-core.js",
    "content/vocab-seam.js",
    "content/floating-widget.js",
    "content/word-prediction.js",
    "content/spell-check-core.js",          // registers the runner + shared helpers
    "content/spell-rules/nb-gender.js",     // NEW — each rule IIFE pushes itself
    "content/spell-rules/nb-modal-verb.js",
    "content/spell-rules/nb-sarskriving.js",
    "content/spell-rules/nb-typo-curated.js",
    "content/spell-rules/nb-typo-fuzzy.js",
    "content/spell-check.js"                 // adapter loads LAST so registry is populated
  ],
  // …
}]
```

**Node fixture harness update** (`scripts/check-fixtures.js`): require each rule file after `spell-check-core.js`. Each rule's `if (registry) registry.push(rule)` needs a Node-equivalent branch that runs regardless — simplest is to have a Node entry point that explicitly does `global.self = global; require('…/nb-gender.js'); require('…/nb-typo-curated.js'); …` to populate `self.__lexiSpellRules` before running `spellCore.check`. See Pitfall 1.

**Per-rule fixture slicing already works** — the runner already groups by rule_id and reports P/R/F1 per file (`[nb/typo]`, `[nb/gender]`, …) so extracted rules can be iterated individually without changing the harness.

### Pattern 2: Frequency Signal Wiring (SC-01 + WP-01)

**Seam side** (`vocab-seam.js`) — load `freq-{lang}.json` in parallel with `bigrams-{lang}.json`:

```javascript
async function loadRawFrequency(lang) {
  try {
    const url = chrome.runtime.getURL(`data/freq-${lang}.json`);
    const res = await fetch(url);
    if (!res.ok) return null; // DE/ES/FR/EN: file absent, return null
    return await res.json();
  } catch (_) { return null; }
}

// inside loadForLanguage(lang):
const [bigrams, freqRaw] = await Promise.all([
  loadRawBigrams(lang),
  loadRawFrequency(lang),
]);

// inside vocab-seam-core.js buildIndexes():
// Replace `freq: new Map()` with:
const freq = freqRaw ? new Map(Object.entries(freqRaw)) : new Map();
// … then getFrequency(word) works as previously specified.
```

**Consumer side (spell-check fuzzy)** — add a Zipf term to `scoreCandidate`:

```javascript
function scoreCandidate(query, cand, d, vocab) {
  const pref = sharedPrefixLen(query, cand);
  const suff = sharedSuffixLen(query, cand);
  let s = pref * 15 + suff * 10 - d * 100;
  if (cand.length < query.length) s -= 50;
  if (isAdjacentTransposition(query, cand)) s += 40;

  // NEW: Zipf boost — 30 × log10 multiplier. Range 0-7 → adds 0..210.
  // Calibrated against berde→bedre (5.58) vs berre (4.61): gap ≈ 29 points,
  // not enough to override d=0 vs d=1 (-100) but decisive for equal-distance
  // pairs. Tune against the fixture.
  if (vocab.freq) {
    const z = vocab.freq.get(cand);
    if (typeof z === 'number') s += z * 30;
  }
  return s;
}
```

**Consumer side (word-prediction)** — new signal inside the table (see Pattern 3 below). Use Zipf if `VOCAB.getFrequency(word)` non-null (NB/NN); otherwise use `entry.frequency` from wordList (all 6 languages). Normalize entry-level frequency log-style so scales are compatible.

### Pattern 3: Signal Table Refactor (WP-01/03/04)

**What:** Convert the 12-branch `applyBoosts` chain (word-prediction.js:879-1012) into a declared signal list. Keep it internal to `word-prediction.js` (no new file); the structural win is readability + per-signal unit-testability, not cross-module reuse.

**Recommended shape:**

```javascript
const SIGNALS = [
  { id: 'typo-threshold',    weight: 1, fn: (ctx, e, score) => typoThresholdSignal(e, ctx.query, score) },
  { id: 'recency',           weight: 1, fn: (ctx, e) => ctx.recent.has(e.word) ? 50 : 0 },
  { id: 'modal-infinitive',  weight: 1, fn: (ctx, e) => modalInfinitiveSignal(e, ctx) },
  { id: 'pronoun-match',     weight: 1, fn: (ctx, e) => pronounSignal(e, ctx) },
  { id: 'tense-consistency', weight: 1, fn: (ctx, e) => tenseSignal(e, ctx.detectedTense) },
  { id: 'pos-expectation',   weight: 1, fn: (ctx, e) => posSignal(e, ctx.expectedPOS, ctx.posStrength) },
  { id: 'gender-agreement',  weight: 1, fn: (ctx, e) => (e.genus && e.genus === ctx.genderContext) ? 120 : 0 },
  { id: 'nb-nn-agreement',   weight: 1, fn: (ctx, e) => nbnnAgreementSignal(e, ctx) },
  { id: 'de-case',           weight: 1, fn: (ctx, e) => deCaseSignal(e, ctx.caseContext) },
  { id: 'bigram',            weight: 1, fn: (ctx, e) => bigramSignal(e, ctx) },
  { id: 'frequency',         weight: 1, fn: (ctx, e) => freqSignal(e, ctx) },   // NEW
  // WP-04: low-frequency demote + stricter POS-mismatch demote can be
  // veto-style (return { veto:true } or { weight: -Infinity }).
];

function applyBoosts(entry, baseScore, ctx) {
  let total = baseScore;
  for (const s of SIGNALS) {
    const v = s.fn(ctx, entry, baseScore);
    if (v && typeof v === 'object' && v.veto) return -Infinity;
    total += (typeof v === 'number' ? v : 0) * s.weight;
  }
  return total;
}
```

Each sub-signal function (e.g., `bigramSignal`, `freqSignal`) encapsulates one cohesive block lifted from today's code. The ctx shape matches `runPrediction`'s current `getTextContext` output plus `query`, `recent`, `vocab`.

### Pattern 4: Deterministic Tiebreaking (WP-03)

**What:** The current sort `scored.sort((a, b) => b.score - a.score)` is stable in V8 since Node 12 / Chrome 70, but for equal scores the order is insertion-order — which in turn depends on prefix-index iteration order. This is the "arbitrary iteration order" the success criterion calls out.

**Fix:**

```javascript
scored.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  // Tiebreaker 1: higher frequency wins (Zipf if available, entry.frequency otherwise)
  const fa = getEffectiveFreq(a), fb = getEffectiveFreq(b);
  if (fa !== fb) return fb - fa;
  // Tiebreaker 2: exact length match to query
  const la = Math.abs(a.word.length - ctx.query.length);
  const lb = Math.abs(b.word.length - ctx.query.length);
  if (la !== lb) return la - lb;
  // Tiebreaker 3: longer shared suffix
  const sa = sharedSuffixLen(ctx.query, a.word);
  const sb = sharedSuffixLen(ctx.query, b.word);
  if (sa !== sb) return sb - sa;
  // Tiebreaker 4: alphabetical (deterministic, dev-readable)
  return a.word.localeCompare(b.word);
});
```

This removes all observable "insertion-order randomness" without requiring any input-side changes. `getEffectiveFreq` returns Zipf (NB/NN) or normalized entry.frequency (others).

### Pattern 5: Fixture-Driven Tuning (applies throughout Phase 3)

- **Add Zipf-tiebreaker fixture case(s) to `fixtures/nb/typo.jsonl`.** Pick a typo where both candidates are at distance 1, neither is an adjacent transposition, and Zipf decides. Candidate pair: find via one-shot script (`node -e "…iterate validWords, emit pairs within edit-distance 1 of a plausible typo, pick one with Zipf gap > 1.0 and not-transposition…"`).
- **Keep ranking assertions at presence/span level, not top-k position.** ARCHITECTURE.md Anti-Pattern 6. The SC-01 criterion asserts "top suggestion is `bedre`" — that's OK because `findFuzzyNeighbor` returns one suggestion, but a future multi-candidate API would force this to change.
- **Do NOT add fixture cases whose expected outcome depends on subjective "would a learner find this useful?"** SC #5 is a manual sampling review, not a fixture assertion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Character n-gram frequency | A runtime corpus derivation | Pre-computed Zipf in `freq-{lang}.json` (Phase 2 output) | Phase 2 already did the offline derivation via `scripts/build-frequencies.js`. Never recompute frequency in the content script. |
| Plural / noun-form rebuilding | Ad-hoc flattening per module | `VOCAB.getWordList()` from vocab-seam (single source of truth) | Phase 1 locked this in; word-prediction already consumes it. |
| Edit-distance library | `fast-levenshtein` / `damerau-levenshtein` | Keep current inlined bounded Damerau-Levenshtein at `spell-check-core.js:236-266` | STACK.md §"What NOT to Use": the inlined version is smaller than the dep, handles transpositions, has early-exit. Dep buys nothing. |
| JSON-schema validation | `ajv` | Runtime type-guard via `typeof` / `Array.isArray` | One more dep for a content-script surface we fully control; zero upside. |
| Module bundling for `spell-rules/` | webpack/rollup/esbuild | MV3 `content_scripts.js` array literal order | Project is explicitly "no build step" (PROJECT.md:63). One manifest line per rule is the build system. |
| Rule-metadata registry | YAML/TOML/JSON rules file | Per-rule IIFE file with inline object literal | ARCHITECTURE.md:605: "Don't build a data-driven rule format yet" — most rules need real code (gender inference, case analysis), not pattern matching. |
| Runtime language detection for WP-02 (EN bigrams via remote corpus) | Fetching an EN n-gram file at runtime | If we add EN bigrams, hand-author ~40 pairs (<5 KB) | No CC-0 EN bigram table that's comparably tuned for learner-level content. Hand-authoring is cheaper than tuning a noisy download. |

**Key insight:** The Phase 1+2 foundation did the unglamorous work (vocab seam, fixture runner, Zipf sidecars). Phase 3 is almost entirely **wiring existing pieces together** — don't rebuild them.

---

## Common Pitfalls

### Pitfall 1: Rule-registry dual-load regression (MV3 vs Node)

**What goes wrong:** A rule module uses `self.__lexiSpellRules = self.__lexiSpellRules || []; self.__lexiSpellRules.push(rule);` — works in the browser. Then `scripts/check-fixtures.js` imports it via `require()`, but in Node there's no `self` by default → `ReferenceError: self is not defined` OR the rule silently fails to register and the fixture harness exits 0 with every rule missing (because the filter finds zero matching rules).

**Why it happens:** The current dual-export pattern in `vocab-seam-core.js` and `spell-check-core.js` uses `typeof self !== 'undefined'` guards — Node 18+ DOES define `self` (equals `globalThis`) in modules loaded via `require`, but the initialization order differs. A rule module loaded before its runner's globals are established pushes into a local undefined variable and disappears.

**How to avoid:**
- Rule module preamble always uses `(typeof self !== 'undefined' ? self : globalThis)` to get the host object.
- The Node fixture runner explicitly `require`s every rule file in a deterministic order AFTER requiring `spell-check-core.js`.
- Add a `__lexiSpellRulesLoaded` counter assertion in `spell-check-core.js` at `check()` time: if zero rules match language, console.warn once (then the fixture harness can check stderr or a hook).

**Warning signs:** Fixture harness exits 0 but also reports 0 expected findings across the board (P=1.000 vacuously); `check()` output is empty in Chrome.

### Pitfall 2: `state.freq` stays an empty Map after the wiring plan

**What goes wrong:** The wiring edits touch `vocab-seam.js` but miss the `vocab-seam-core.js:492` hard-coded `freq: new Map()`. The getFrequency API lights up but always returns null.

**Why it happens:** The getter is in the browser seam, the initialization is in core; plans that treat them as independent miss the coupling.

**How to avoid:**
- Seam core's `buildIndexes` accepts a `freq` parameter; wire it through as `{ raw, bigrams, freq, lang, isFeatureEnabled }`.
- Add a sanity line to `check-fixtures.js`: after `loadVocab(l)`, assert `vocab.freq instanceof Map && vocab.freq.size > 0` for NB/NN. Fail-loud before any rule runs.

**Warning signs:** Fixture passes but `node -e "…vocab.freq.size"` prints 0; Chrome `window.__lexiVocab.getFrequency('og')` returns null.

### Pitfall 3: Stale prefixIndex after rule-registry ordering change

**What goes wrong:** Adding `spell-rules/*.js` between `word-prediction.js` and `spell-check-core.js` in the manifest could cause word-prediction.js to fail if its `onReady(refreshFromVocab)` runs before vocab-seam has loaded — but this was already solved in Phase 1 Plan 02 (re-register onReady pattern). New risk: if the refactor moves `buildPrefixIndex` code, re-check that it still uses VOCAB lazily and doesn't cache the wordList reference.

**Why it happens:** Refactoring window for introducing stale-capture bugs.

**How to avoid:**
- Do not touch `refreshFromVocab` plumbing in word-prediction.js beyond what's needed for the signal-table refactor.
- Manifest content_scripts order: `vocab-seam-core → vocab-seam → word-prediction → spell-check-core → spell-rules/* → spell-check (adapter)`. The rule files only push to `self.__lexiSpellRules`; they don't need VOCAB at load time (they get it via ctx at check time).

**Warning signs:** word-prediction dropdowns empty after LANGUAGE_CHANGED. (Regression catch: test the language switcher manually.)

### Pitfall 4: Zipf boost overshoots and suppresses edit-distance

**What goes wrong:** Adding `s += zipf * 30` to `scoreCandidate` — a Zipf-7 candidate at distance 2 (2*-100 + 7*30 = -10) beats a Zipf-3 candidate at distance 1 (1*-100 + 3*30 = -10). Tied, but could flip to the wrong answer if any prefix/suffix contribution nudges it. Result: distant-common-words beat close-rare-words. This is exactly the opposite of what the user wants.

**Why it happens:** Naive linear weights don't respect the semantic priority "distance dominates; frequency only tiebreaks."

**How to avoid:**
- Tune the Zipf multiplier against the fixture: it should never override a clear distance difference. Floor the multiplier so even a Zipf-7 candidate can't make up for +1 distance.
- Better: **separate ordering key** — `score` is (`-d`, `zipf`, `pref`, `suff`, ...) compared lexicographically, not summed. Simpler to reason about.
- Fixture protection: add a negative fixture case (typo at d=1 to a common word + another neighbor at d=2 to a rare word → expect the d=1 suggestion).

**Warning signs:** New fixture cases pass but existing ones regress. Particularly: `skirver → skriver` (d=1) being beat by some high-Zipf d=2 candidate.

### Pitfall 5: Rule dedupe assumes insertion order = rule evaluation order

**What goes wrong:** `dedupeOverlapping` (spell-check-core.js:352-359) keeps the first-listed finding on overlap. Today, rule evaluation order inside `check()` is literal (gender → modal → særskriving → curated-typo → fuzzy-typo) and this order is "load-bearing" per the code comment at :80-81. After the registry refactor, order is determined by `priority`. If the plan sets priorities inconsistently with the current order, dedupe outcomes change — and existing fixtures catch it as regressions.

**Why it happens:** Two independent orderings (insertion / priority) must converge on the same result.

**How to avoid:**
- Assign priorities in the same order the current `check()` evaluates rules: gender=10, modal=20, sarskriving=30, typo-curated=40, typo-fuzzy=50.
- Run `npm run check-fixtures` before and after the refactor; any change in output is a priority misalignment.
- Document priority semantics in `spell-rules/README.md`: "lower priority runs first; dedupeOverlapping keeps the earliest-accepted finding."

**Warning signs:** Specific fixture cases flip from pass to fail after refactor — typically ones that have both a særskriving and a gender/typo overlap.

### Pitfall 6: Signal-table refactor breaks word-prediction for non-NB/NN languages

**What goes wrong:** The `applyBoosts` function branches heavily on `currentLang` (NB/NN-specific agreement, DE-specific case, ES/FR-specific pronouns). Extracting into signals, some signals must be no-ops for the wrong language. A missed check leaves e.g. a Spanish user getting NB agreement boosts applied to Spanish words → random score inflation.

**Why it happens:** The monolithic function had implicit early-outs per-language; the signal-table pattern needs each signal to be self-checking.

**How to avoid:**
- Every signal function that is language-specific includes `if (ctx.lang !== 'nb' && ctx.lang !== 'nn') return 0;` (or equivalent) as its first line.
- Regression: manual test all 6 languages (type a query, inspect dropdown).
- Optional: add lightweight "prediction fixture" at a later phase; out of scope for Phase 3 but noted for Phase 4/5.

**Warning signs:** DE/ES/FR/EN dropdown suggestions change noticeably after refactor, typically favoring Norwegian-looking candidates.

### Pitfall 7: Entry-level `frequency` values across languages are on totally different scales

**What goes wrong:** `de.json` frequencies range 0-30000+, `fr.json` likewise, `en.json` similar. Feeding raw `entry.frequency` into the score formula gives the highest-frequency entries 1000x the boost of anything else.

**Why it happens:** Papertek-vocabulary `frequency` field is raw corpus count or rank, not a normalized value; it's only meaningful within-language.

**How to avoid:**
- Compute per-language max/min at seam-build time and store `zipf = log10(1 + freq)` or similar normalization.
- Or: replace entry.frequency with a seam-time computed `freqRank` inside the wordList.
- Better: for WP-01, use Zipf from sidecar when available (NB/NN) and a normalized-within-language rank otherwise. Keep the two code paths distinguishable in the signal.

**Warning signs:** DE prediction top-3 becomes dominated by the same handful of ultra-high-frequency words regardless of context.

### Pitfall 8: SC-06 regression — someone adds a `fetch` for "just one extra dictionary"

**What goes wrong:** Someone working on WP-04 (stricter filtering) notices the current proper-noun list is ad-hoc and decides to fetch a loan-word list from a URL. Or adds `chrome.runtime.sendMessage` to the service worker which then calls fetch. Now spell-check/prediction is leaking typed words.

**Why it happens:** The Pitfall-8 constraint is cultural, not enforced. Innocent-looking performance/quality improvements violate it.

**How to avoid:**
- Add to Release Workflow step 1 (`npm run check-fixtures`): a grep gate checking that `extension/content/spell-check*.js`, `extension/content/spell-rules/**`, and `extension/content/word-prediction.js` contain zero occurrences of `fetch(`, `XMLHttpRequest`, `http://`, `https://` (whitelisted patterns for `chrome.runtime.getURL` and `chrome-extension://` OK — those are local).
- Consider wrapping into a `scripts/check-network-silence.js` (like `check-bundle-size.js`). Release gate shape already established in Phase 2.
- Manual DevTools Network-panel check for SC-06 criterion #4 (already on the acceptance list).

**Warning signs:** DevTools Network panel shows any request during a 30-second typing session that isn't TTS (which is allowed per SC-06 because TTS is premium-gated but still extension-side).

### Pitfall 9: "Useful top-3" reviewer judgment is ambiguous without a rubric

**What goes wrong:** SC #5 asks for an 80%+ "useful" rate across 20 sampled contexts per language. Without a rubric the reviewer's gut swings between strict ("none of these are exactly what I'd type") and permissive ("there's at least something here"), making the test unrepeatable across reviewers or days.

**How to avoid:**
- Plan a lightweight rubric in the Phase 3 work: "useful" = at least one of the top-3 suggestions is a real completion (not a substring match masquerading as one), grammatical in context (honors determiner/gender/case where applicable), and commonly used. Hand-author ~20 context sentences per language in a markdown file; reviewer records yes/no per top-3.
- Bundle the rubric with the phase's verification artifact so future tuning iterations can re-use the contexts.
- Flag: this is a one-person judgment call; that's intentional (per the criterion wording). Accept the subjectivity; write the rubric so the same person on a different day lands ±10%.

**Warning signs:** Verification conversation surfaces "I'm not sure" answers; different sittings give wildly different pass rates.

### Pitfall 10: WP-02 DE/ES/FR/EN bigram coverage question left implicit

**What goes wrong:** The success criterion says "top-3 suggestions across all six languages are visibly ranked by frequency AND bigram context." But DE/ES/FR ship tiny hand-authored bigrams (3-4 KB, ~30 head-words) and EN has none. If the plan doesn't address this, the bigram signal is effectively a no-op for 3-4 of the 6 languages and SC #3's "visibly ranked by bigram context" fails on sample inspection.

**How to avoid:**
- Plan explicitly picks one of: (a) keep DE/ES/FR/EN bigrams as-is, (b) hand-author +20-40 pairs for each, (c) relax the success criterion wording. Default recommendation: (b) for EN (since it's bundled), leave DE/ES/FR as-is (their hand-authored pairs are already decent for the A1/A2 level learners they target; freq signal alone handles the "visibly ranked" part).
- Document in the verification artifact which 3 of 6 languages were sampled for SC #3 — the criterion says "at least 3 of the 6" so a strict reading allows picking NB, NN, DE.

**Warning signs:** Verification sampling on FR or EN shows identical rankings regardless of preceding word.

---

## Code Examples

### Example 1: Loading freq-{lang}.json into the seam

```javascript
// extension/content/vocab-seam.js (modified loadForLanguage)
async function loadRawFrequency(lang) {
  try {
    const url = chrome.runtime.getURL(`data/freq-${lang}.json`);
    const res = await fetch(url);
    if (!res.ok) return null;           // DE/ES/FR/EN have no sidecar — OK
    return await res.json();
  } catch (_) { return null; }
}

async function loadForLanguage(lang) {
  ready = false;
  // … existing enabledFeatures read …
  const raw = await loadRawVocab(lang);
  if (!raw) { state = null; return; }

  // Parallel fetch — bigrams + freq
  const [bigrams, freq] = await Promise.all([
    loadRawBigrams(lang),
    loadRawFrequency(lang),
  ]);
  const isFeatureEnabled = buildFeaturePredicate(lang);

  state = core.buildIndexes({ raw, bigrams, freq, lang, isFeatureEnabled });
  ready = true;
  const toRun = readyCallbacks.splice(0);
  for (const cb of toRun) { try { cb(); } catch (_) {} }
}
```

```javascript
// extension/content/vocab-seam-core.js (modified buildIndexes)
function buildIndexes({ raw, bigrams, freq, lang, isFeatureEnabled } = {}) {
  const iff = typeof isFeatureEnabled === 'function' ? isFeatureEnabled : () => true;
  const wordList = buildWordList(raw, lang, iff);
  const { nounGenus, verbInfinitive, validWords, typoFix, compoundNouns } =
    buildLookupIndexes(wordList, lang);
  const normBigrams = bigrams ? normalizeBigrams(bigrams) : null;

  // NEW: populate freq Map from sidecar (NB/NN). Empty Map for other langs.
  const freqMap = new Map();
  if (freq && typeof freq === 'object') {
    for (const [k, v] of Object.entries(freq)) {
      if (typeof v === 'number') freqMap.set(k.toLowerCase(), v);
    }
  }

  return {
    wordList, nounGenus, verbInfinitive, validWords, typoFix, compoundNouns,
    bigrams: normBigrams,
    freq: freqMap,            // replaces `new Map()` hard-coded empty
    typoBank: typoFix,
  };
}
```

### Example 2: Zipf-aware fuzzy scoring

```javascript
// extension/content/spell-rules/nb-typo-fuzzy.js (new)
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  function scoreCandidate(query, cand, d, vocab) {
    const pref = sharedPrefixLen(query, cand);
    const suff = sharedSuffixLen(query, cand);
    let s = pref * 15 + suff * 10 - d * 100;
    if (cand.length < query.length) s -= 50;
    if (isAdjacentTransposition(query, cand)) s += 40;
    // NEW: Zipf tiebreaker. Bounded multiplier so a Zipf-7 word at d=2
    // (s = -200 + 7*20 = -60) NEVER beats a Zipf-0 word at d=1 (s = -100).
    // (Math: distance +1 = -100, max Zipf swing = 7*20 = 140 — so a d=1
    // Zipf-0 can lose to a d=2 Zipf-7 with delta +40. Cap at *15 to be
    // strictly tie-breaking.)
    if (vocab.freq) {
      const z = vocab.freq.get(cand);
      if (typeof z === 'number') s += z * 15;
    }
    return s;
  }

  function findFuzzyNeighbor(word, vocab) {
    const validWords = vocab.validWords;
    const len = word.length;
    const k = len <= 6 ? 1 : 2;
    let best = null, bestScore = -Infinity;
    const first = word[0];
    for (const cand of validWords) {
      const cl = cand.length;
      if (Math.abs(cl - len) > k) continue;
      if (cand[0] !== first) continue;
      if (cand === word) continue;
      const d = editDistance(word, cand, k);
      if (d > k) continue;
      const score = scoreCandidate(word, cand, d, vocab);
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    return best;
  }

  host.__lexiSpellRules.push({
    id: 'typo-fuzzy',
    languages: ['nb', 'nn'],
    priority: 50,
    explain: 'Ukjent ord — sjekk stavinga.',
    check(ctx) {
      const { tokens, vocab, cursorPos, text } = ctx;
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (t.word.length < 4) continue;
        if (vocab.validWords.has(t.word)) continue;
        if (vocab.typoFix.has(t.word)) continue;            // curated branch owns this
        if (isLikelyProperNoun(t, i, tokens, text)) continue;
        const fuzzy = findFuzzyNeighbor(t.word, vocab);
        if (fuzzy) {
          out.push({
            rule_id: 'typo',
            start: t.start, end: t.end,
            original: t.display,
            fix: matchCase(t.display, fuzzy),
            message: `Skrivefeil: "${t.display}" → "${fuzzy}"`,
          });
        }
      }
      return out;
    },
  });
})();
```

### Example 3: SC-01 fixture case structure

```jsonl
# fixtures/nb/typo.jsonl (append)
# ── SC-01 Zipf-tiebreaker cases (Phase 3) ──
# Both candidates are equidistant (d=1), neither is an adjacent transposition,
# Zipf decides. Chosen via `node scripts/find-zipf-tiebreak-candidates.js`
# (one-shot dev script, not shipped).
{"id":"nb-typo-zipf-001","text":"TBD — candidate pair picked during Phase 3","expected":[{"rule_id":"typo","start":N,"end":M,"suggestion":"TBD"}],"must_not_flag":[]}
```

### Example 4: Signal-table freq signal

```javascript
// word-prediction.js (inside signal table)
function freqSignal(ctx, entry) {
  // NB/NN: Zipf from sidecar (seam-loaded).
  // DE/ES/FR/EN: per-entry frequency normalized to ~0-7 range at seam time.
  if (ctx.lang === 'nb' || ctx.lang === 'nn') {
    const z = ctx.vocab.getFrequency(entry.word);
    if (typeof z === 'number') return z * 20;            // 0..140 pts
    return 0;
  }
  // Non-NB/NN: entry.frequency is a raw corpus count; normalize at seam time
  // to a Zipf-alike scale. If the normalization is done (e.g. entry.zipf),
  // prefer that. Otherwise log-dampen the raw value.
  if (typeof entry.zipf === 'number') return entry.zipf * 20;
  if (typeof entry.frequency === 'number') return Math.log10(entry.frequency + 1) * 20;
  return 0;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Monolithic `check()` body with 4 inline rules | Plugin registry (INFRA-03) | Phase 3 (this phase) | Adding rule #5 becomes one-file; per-rule enable/disable becomes trivial; per-rule fixture slicing already works |
| Fuzzy ranking via prefix/suffix/length/transposition only | Same + Zipf tiebreaker (SC-01) | Phase 3 | Distinguishes `bedre` from `berre` for edit-distance-equal candidates (and the `flik → flink` case in the fixture note, which currently fails because of length-growing-edit penalty) |
| Prediction ranker: 12-branch `applyBoosts` | Signal table + deterministic tiebreaks + frequency signal (WP-01/03) | Phase 3 | Individual signals unit-testable; new signal = one row; tiebreakers remove iteration-order randomness |
| DE/ES/FR/EN bigrams: ~30 hand-authored pairs each | Same or +EN ~40 pairs (WP-02, user decision) | Phase 3 optional | Minor top-3 improvement for bundled languages |
| NB/NN bigrams: ~2000 pairs from NB N-gram 2021 (Phase 2) | Unchanged | Phase 2 | Phase 3 uses them in the new signal table |
| Frequency data: `freq-nb/nn.json` on disk but unread at runtime | Loaded into `state.freq` by seam; consumed by spell-check + prediction | Phase 3 | The whole point of DATA-01 starts paying off |

**Nothing deprecated or outdated — this is additive wiring on top of stable Phase 1+2 infrastructure.**

---

## Open Questions

1. **Does the user want EN bigrams hand-authored in Phase 3?**
   - What we know: EN has no `bigrams-en.json`; would take ~1-2 hours to hand-author 30-40 pairs at A1/A2 level (greetings, common verb+object, "I am", "do you", "thank you"); <5 KB bundle impact.
   - What's unclear: Whether SC #3's "visibly ranked by bigram context" applies strictly to EN.
   - Recommendation: Include a small EN bigram file in Phase 3 plan; it's cheap and directly addresses WP-02 for EN. Flag for user confirmation during `/gsd:discuss-phase`.

2. **How should entry-level `frequency` for DE/ES/FR/EN be normalized to Zipf-alike scale?**
   - What we know: Raw values are 0-30000+; directly summed into score would explode the ranker.
   - What's unclear: Whether to compute per-language max at seam-build time and derive a normalized `zipf = log10(freq+1) / log10(maxFreq+1) * 7` or just use `log10(freq+1)` with a uniform multiplier.
   - Recommendation: Use `log10(freq+1) * M` with a per-language `M` chosen to put the top Zipf around 7. This is a tuning parameter, not a structural decision; plan can pick a value and the fixture/manual review confirms.

3. **Should `dedupeOverlapping` stay in spell-check-core.js (the runner) or become a rule-level concern?**
   - What we know: Current dedupe is runner-level and order-dependent.
   - What's unclear: Whether some rules should always suppress others (e.g., curated-typo always beats fuzzy-typo on the same span).
   - Recommendation: Keep dedupe in the runner; set priorities so earlier-ordered rules win on overlap (matches current semantics). Leave "rule X vetoes rule Y" for Phase 4 if it turns out to be needed.

4. **Should the `spell-check-core.js` runner be the one that maintains `self.__lexiSpellRules`, or should it live in `spell-check.js` (the DOM adapter)?**
   - What we know: Both work; the core is what the fixture harness requires, so the registry must be reachable from there.
   - Recommendation: Core owns the registry (initializes the array, provides the runner); rule files push into it. Adapter (`spell-check.js`) stays unchanged.

5. **Can the "flik → flink" deferred case (fixtures/nb/typo.jsonl note:34-38) be closed in Phase 3?**
   - What we know: Currently returns nothing because `len(flik) = 4 ≤ 6 → k = 1` and `flink` is length 5 (d=1, length growth). The `cand.length < query.length ? -50` heuristic doesn't apply (cand is LONGER), but… `flink` isn't in freq-nb (verified). If Zipf is 0, the boost is 0. `flak` IS in freq-nb (Zipf 3.63) and is length 4 (same length → no length-growth penalty, no transposition bonus, some prefix) — so `flak` wins on equal-length + slight freq.
   - What's unclear: Is `flink` in `validWords` at all? It should be — it's a common NB adjective. If it's there but Zipf-missing, the fuzzy matcher skips because `flink` IS in validWords → not flagged, but that's fine because the sentence isn't flagged either (`flik` is the unknown). The issue is the fuzzy matcher picks `flak` instead of `flink` for `flik`. A Zipf boost on `flink` would only help if `flink` has a Zipf entry.
   - Recommendation: Close it in Phase 3 IF `flink` appears in `freq-nb.json` after a rebuild of the frequency table (maybe it was excluded by the Zipf-0 floor elsewhere; check during planning). Otherwise defer to Phase 4.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/ARCHITECTURE.md:99-272` — Pattern 1 (shared vocab layer), Pattern 2 (rule-pack registry), Pattern 3 (signal pipeline), Pattern 4 (language tags). Already verified against existing code.
- `.planning/research/STACK.md` — zero-dependency recommendation; algorithm justification for bounded Damerau-Levenshtein. Verified against current code at `spell-check-core.js:236-266`.
- `.planning/research/PITFALLS.md:19-281` — Pitfall 1 (ranking bug berde→berre), Pitfall 8 (privacy/SC-06).
- `.planning/phases/01-foundation-vocab-seam-regression-fixture/01-02-SUMMARY.md` — Phase 1 locked-in seam shape; Finding contract (`rule_id`); dual-export pattern.
- `.planning/phases/01-foundation-vocab-seam-regression-fixture/01-03-SUMMARY.md` — fixture runner + 132 ground-truth cases; current F1=1.000 baseline.
- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-01-SUMMARY.md` — `freq-nb.json` (13,132 entries, 61 KB gz) and `freq-nn.json` (11,013 entries, 52 KB gz) on disk; Zipf values; top-10 function-word sanity verified.
- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-02-SUMMARY.md` — NB/NN bigrams regrown to ~2020 head-words at ~32 KB gz; `{prev: {next: weight}}` schema; hand-authored idioms preserved (max-merge).
- Direct in-repo inspection of:
  - `extension/content/spell-check-core.js:83-212` (rule bodies to extract)
  - `extension/content/spell-check-core.js:268-329` (fuzzy matcher to extend)
  - `extension/content/word-prediction.js:802-1012` (applyBoosts to refactor)
  - `extension/content/vocab-seam-core.js:472-497` (buildIndexes; `freq: new Map()` to wire)
  - `extension/content/vocab-seam.js:102-146` (seam loader to extend with freq fetch)
  - `extension/content/vocab-seam.js:209-213` (getFrequency; already exposed, just empty)
  - `extension/data/freq-nb.json` (verified `bedre=5.58`, `berre=4.61`; `flink` absent)
  - `extension/manifest.json:17-34` (content_scripts load order to update)
  - `fixtures/nb/typo.jsonl:12` (berde case already passing; note:34-38 documents flik gap)
  - `scripts/check-fixtures.js:84-91` (loadVocab; needs freq injection for SC-01 regression)
  - Live `npm run check-fixtures` run → 138/138 pass, F1=1.000 across 10 files

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md:99-109` — Phase 3 rationale (the original roadmap research; note it merged today's Phase 3 + Phase 4 into one "Phase 3", but the current ROADMAP.md has them split; architecture patterns unchanged).
- `.planning/research/FEATURES.md` (not read in full this time but referenced by SUMMARY.md) — ranking quality and WP-04 usefulness framing.

### Tertiary (LOW confidence)

- None. All claims either code-verified or cited from phase research.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero-new-dependency rule is well-established in prior research; all pieces are in-repo and compile.
- Architecture: HIGH — patterns already described in `.planning/research/ARCHITECTURE.md` and validated against Phase 1's successful extraction of `vocab-seam-core.js`.
- Pitfalls: HIGH — Pitfalls 1-7 are code-specific and verifiable against the diff; Pitfalls 8-10 are operational/verification pitfalls and should be noted in plan verification blocks.
- Wiring correctness: HIGH — `getFrequency` is unused today; I confirmed by grep. Adding the loader is mechanical.
- Per-language frequency normalization for WP-01: MEDIUM — depends on how noisy the raw `entry.frequency` values are across languages; the log-dampen approach is a safe default but may need per-language tuning.
- SC-01 fixture case picking: MEDIUM — requires a small one-shot dev script to find a good pair; straightforward but not yet done.
- EN bigram author effort: MEDIUM — low-risk, but needs user buy-in on scope.

**Research date:** 2026-04-19
**Valid until:** 30 days (stable architecture; only invalidated if Phase 2.1 or earlier decisions get reopened)
