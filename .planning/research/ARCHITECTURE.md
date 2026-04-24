# Architecture Patterns — v2.0 Structural Grammar Governance

**Domain:** Browser-extension spell/grammar surface, structural rules beyond token-local
**Researched:** 2026-04-24
**Scope:** How Phases 6–16 integrate with the existing `__lexiVocab` + `__lexiSpellRules` plugin architecture
**Confidence:** HIGH (grounded in direct code read of the v1.0 runner + seam + a representative rule; cross-checked against v2.0 benchmark-driven roadmap and PROJECT.md carry-over debt)

---

## 1. What Exists Today (Baseline)

### 1.1 Rule pipeline (token-local, stateless)

```
Text in active editable
        │
        ▼
┌───────────────────────────────────────────────┐
│ spell-check.js (DOM adapter, ~746 LOC)        │
│   - debounce, focus tracking, popover render  │
│   - builds vocab bundle from __lexiVocab      │
│   - dismissal state, marker overlay           │
└───────────────┬───────────────────────────────┘
                │ (text, vocab, {cursorPos, lang})
                ▼
┌───────────────────────────────────────────────┐
│ spell-check-core.js  CORE.check()             │
│   1. tokenize(text)  → [{word, display,       │
│                          start, end}]         │
│   2. build ctx = {text, tokens, vocab,        │
│                   cursorPos, lang,            │
│                   suppressed: Set()}          │
│   3. for rule of __lexiSpellRules             │
│        .filter(lang).sortBy(priority)         │
│        rule.check(ctx) → Finding[]            │
│   4. dedupeOverlapping(findings)              │
└───────────────────────────────────────────────┘
```

Every finding is `{rule_id, priority, start, end, original, fix?, message}`. The runner has **one** pass, **one** context object, **no sentence segmentation**, **no cross-token state beyond `ctx.suppressed`** (a `Set<tokenIndex>` that only pre-pass rules at priority 1–9 may mutate).

### 1.2 Vocab seam (`__lexiVocab`, ~299 LOC façade + 890 LOC core)

Pure getter surface — already language-aware, already rebuilt on `LANGUAGE_CHANGED`. Current getters:

```
getLanguage · getWordList · getValidWords · getNounGenus · getNounForms
getVerbInfinitive · getVerbForms · getKnownPresens · getKnownPreteritum
getIsAdjective · getTypoFix · getCompoundNouns · getPitfalls · getFreq
getBigrams · getTypoBank · getSisterValidWords · getFrequency(word)
onReady(cb) · isReady()
```

All getters return `Map`/`Set`/`Object` and are **empty-safe** (never null). This is the single coupling surface between spell-check and word-prediction.

### 1.3 Rule shape (plugin contract)

```js
{
  id: 'sarskriving',
  languages: ['nb','nn'],
  priority: 30,                 // 1–9 = suppression pre-pass; 10+ = emitters
  explain: (f) => ({nb, nn}),   // mandatory for popover-surfacing rules
  check(ctx) { return findings; }
}
```

Rules are self-registering IIFEs in `extension/content/spell-rules/*.js`. Registry: `self.__lexiSpellRules`. Adding a rule = new file + one manifest line + CSS dot binding + explain contract. Three CI gates enforce the shape.

### 1.4 Release gates binding v2.0

- `check-fixtures` — 262 NB/NN cases; per-rule P/R/F1
- `check-explain-contract` + `:test` — every popover rule has callable explain returning `{nb,nn}`
- `check-rule-css-wiring` + `:test` — every popover rule has a `.lh-spell-<id>` colour binding
- `check-spellcheck-features` — feature-gated preset still builds lookup indexes from superset
- `check-network-silence` + `:test` — no `fetch/XHR/beacon/http(s)://` in spell-rules or prediction
- `check-bundle-size` — 20 MiB cap

Gates are a constraint on every architectural decision below. Each new seam must be audit-shaped.

---

## 2. What Structural Rules Need That Token-Local Rules Did Not

| Capability | Phase(s) needing it | Current support | Verdict |
|---|---|---|---|
| Sentence boundaries | 6, 7, 8, 11, 13, 16 | None (runner passes whole text blob) | **New seam required** (§3.1) |
| Multi-token windows within a clause | 7, 8.1, 8.2, 9.2, 10.3, 12.3 | Each rule re-walks `tokens` manually | **Helper library** (§3.2) |
| Clause/subordinator detection | 7.2, 11, 16.3 | None | **Derived from sentence seam** (§3.2) |
| POS/feature tagging per token | 7, 8, 9, 10, 12, 14 | Implicit via multiple `isAdjective/knownPresens/...` Sets; each rule re-queries | **Tagged-token helper** (§3.2) |
| Cross-sentence document state | 13.1–13.4, 16.1 | None — each `runCheck()` is a fresh context | **New seam required** (§3.3) |
| New vocab fields (separable, aux, copula, human, BAGS adj, irregular list, register level, etc.) | 6.2, 6.3, 7.3, 8.2, 8.3, 9, 10.2, 11.1, 11.3, 12.2, 14, 15 | Schema is per-entry in `papertek-vocabulary`, bundled JSON | **Additive vocab fields + new `__lexiVocab` getters** (§3.4) |
| Curated pattern banks (phrase-banks, collocations, redundancy, élision, subjunctive triggers) | 6.1, 6.2, 6.3, 9.1, 9.2, 10.1, 11.1, 11.3, 12.3, 15 | No generic "pattern bank" concept — `typoBank`/`compoundNouns` are the only precedent | **New bank type** (§3.4) |
| Language-specific rules for non-Norwegian languages | 6–12, 14, 15 | 14 existing non-NB rule files already live alongside NB rules | **No seam change** — rule files scale |

Core insight: the plugin registry already scales horizontally (one file per rule). The missing primitives are **sentence segmentation**, a **syntax-lite tagged-token view**, a **document-state seam**, and **new vocab getters for closed-class grammar data**. Everything else is just more rule files.

---

## 3. New and Modified Components

### 3.1 Sentence segmenter — new helper on `__lexiSpellCore`

**What:** Pure function `segmentSentences(text, tokens) → Sentence[]`
where `Sentence = {start, end, tokens: Token[], tokenStart, tokenEnd, kind: 'decl'|'interrog'|'imper'|'frag'}`.

**Where:** New helper in `spell-check-core.js`, exposed via `host.__lexiSpellCore.segmentSentences`.

**Algorithm (deterministic, no ML):** split on `[.!?…]` outside quotes/parens, with abbreviation allow-list per language (NB: `f.eks.`, `bl.a.`, `dvs.`; DE: `z.B.`, `u.a.`; EN: `Mr.`, `Dr.`, `e.g.`; FR: `M.`, `Mme.`). Interrogative detection from `?` or initial interrogative pronoun (`hvem/hva/hvorfor` in NB, `wer/was/warum` in DE, etc.).

**Runner change:** `ctx` gains `ctx.sentences: Sentence[]`. Token-local rules ignore it. Structural rules iterate sentences.

**Phase landed:** **Phase 6** (register detector needs sentence-level heuristics for formality signal) — makes the seam available for Phase 7 (word order) without adding two separate infrastructure changes.

### 3.2 Tagged-token view + syntax-lite helpers — new helper surface

**What:** Lazy enrichment on `ctx` — `ctx.getTagged(tokenIdx) → TaggedToken`
with `{pos, lemma, features: {finite?, case?, gender?, number?, tense?, mood?, aux?}}`. Tagger is **rule-based, not statistical**: lookups against existing `__lexiVocab` indexes (`verbInfinitive`, `nounGenus`, `isAdjective`, `verbForms`) plus new getters (§3.4).

**Helper library** (on `__lexiSpellCore`):
- `findFiniteVerb(sentence, taggedTokens) → idx | -1`
- `findSubordinator(sentence, taggedTokens) → idx | -1` (triggers verb-final in DE 7.2, subjunctive in 11.x)
- `findCliticCluster(sentence, taggedTokens) → {start, end}` (FR 12.3, ES 9.3)
- `isMainClause(sentence) → bool`
- `agree(tokenA, tokenB, features=['gender','number']) → bool`

**Why lazy:** Tagging every token on every keystroke is wasted work when only Phase 6 register rules fire. Tagger is called on-demand by rules that need it; spell-check-core memoizes per `ctx`.

**Phase landed:** **Phase 7** (first word-order phase — V2 detection needs `findFiniteVerb` + `isMainClause`). Phases 8–12 reuse.

### 3.3 Document-state seam — new rule kind

**Problem:** Phase 13 (register drift) needs to compare findings across sentences within a single text, and Phase 16 needs cross-sentence tense tracking. Today's `runCheck()` fires once per debounce and returns a fresh `Finding[]` with no memory.

**Two options considered:**

| Option | Pros | Cons |
|---|---|---|
| **A.** `ctx.docState: Map<string, any>` — shared mutable scratchpad passed into every rule invocation | Zero new seam; every rule can stash collector state | Unbounded; no lifecycle; hard to reason about |
| **B.** Two-pass runner — Pass 1: per-sentence rules (today's shape); Pass 2: document-level rules with `ctx.sentences` + `ctx.passOneFindings` | Explicit lifecycle, document rules declare themselves | One-off rule shape divergence |

**Recommendation: Option B.** New `kind: 'sentence' | 'document'` field on the rule object, defaulting to `'sentence'`. Document rules run after all sentence rules, receive the accumulated findings and sentence array. Example:

```js
{
  id: 'register_drift_du_sie',
  languages: ['de'],
  kind: 'document',
  priority: 60,
  checkDocument(ctx) {
    const forms = ctx.sentences.flatMap(s => detectAddressForm(s));
    if (hasMixed(forms)) return [{rule_id:'register_drift', ...}];
    return [];
  }
}
```

**Phase landed:** **Phase 13** — no earlier phase needs it. But §5 build-order places a **seam-design spike in Phase 7** so the shape is agreed before Phase 13 commits to it.

### 3.4 New `__lexiVocab` getters + vocab schema additions

Each is an additive field in `papertek-vocabulary` and a new getter on `__lexiVocab`:

| Getter | Returns | Feeds | Phase |
|---|---|---|---|
| `getRegisterLevel()` | `Map<word, 'formal'\|'neutral'\|'colloquial'>` | 6.1 | 6 |
| `getCollocationBank()` | `Map<headword, {wrong→right}[]>` | 6.2, 15 | 6 |
| `getRedundancyPhrases()` | `Map<phrase, replacement>` | 6.3 | 6 |
| `getBagsAdjectives()` | `Set<adj>` (FR) | 7.3 | 7 |
| `getPrepositionCase()` | `Map<prep, 'acc'\|'dat'\|'gen'\|'twoway'>` (DE) | 8.1 | 8 |
| `getSeparablePrefixes()` | `Map<verb, prefix>` (DE, derived from `verbbank.separable`) | 8.2 | 8 |
| `getAuxiliary()` | `Map<verb, 'sein'\|'haben'\|'être'\|'avoir'>` | 8.3, 10.2 | 8 |
| `getCompoundSplitter()` | function(`noun`) → `[head...tail]` (DE) | 8.4 | 8 |
| `getCopulaTag()` | `Map<adj, 'ser'\|'estar'\|'both'>` (ES) | 9.1 | 9 |
| `getPorParaPatterns()` | structured trigger tree | 9.2 | 9 |
| `getHumanNouns()` | `Set<noun>` (ES) | 9.3 | 9 |
| `getElisionTriggers()` | `Set<word>` + vowel-initial predicate (FR) | 10.1 | 10 |
| `getSubjunctiveTriggers()` | `Map<trigger, {lang}>` (ES+FR) | 11.1, 11.3 | 11 |
| `getAspectAdverbs()` | `Map<adv, 'preterite'\|'imperfect'>` (ES) | 11.2 | 11 |
| `getGustarVerbs()` | `Set<verb>` (ES) | 12.2 | 12 |
| `getIrregularForms()` | `Map<lemma, form[]>` (EN) | 14.1 | 14 |
| `getWordFamily()` | `Map<stem, {noun,verb,adj,adv}>` (EN) | 14.3 | 14 |

**Pattern:** every new getter follows the existing empty-safe contract (`return new Map()` if not loaded). **No structural edit to `vocab-seam-core.js`** — just new optional source banks that populate new state fields. This is the same additive shape as v1.0 `typoBank` / `compoundNouns` / `sisterValidWords`.

**Data-logic separation check (CLAUDE.md):** every field above is **data**. The rules that consume them are **logic**. Authoritative copies live in `papertek-vocabulary`; `scripts/sync-vocab.js` pulls bundled JSON. No inline word lists in rule files (the `SARSKRIVING_BLOCKLIST` in `nb-sarskriving.js` is a known acceptable exception per `project_data_logic_separation_philosophy.md` — friction test, not purity).

### 3.5 Rule-file conventions (additive)

Structural rules follow the same IIFE / registry / priority / explain-contract / CSS-colour convention as v1. Two new conventions:

- **Structural-rule priority range:** reserve **100–199** so they sort after all token-local rules. Keeps `dedupeOverlapping` bias toward the narrower finding when a word-order issue and a spelling issue overlap.
- **Document-rule priority range:** 200+. Document rules run after sentence pass; priority only orders them among themselves.

---

## 4. Data-Flow Changes

### 4.1 New pipeline

```
Text → tokenize → segmentSentences(text, tokens)
                       │
                       ▼
                  ctx = {text, tokens, sentences, vocab, cursorPos, lang,
                         suppressed: Set, getTagged: lazy, docState: Map}
                       │
                       ▼
          ┌────────────────────────────────┐
          │  Sentence-rule pass             │
          │  (priority 1–199)               │
          │    - token-local (v1.0 rules)   │
          │    - structural (Phases 6–12,14,15) │
          │    - each rule may read ctx.sentences │
          │      or call ctx.getTagged(i)   │
          └────────────┬────────────────────┘
                       │ findings[]
                       ▼
          ┌────────────────────────────────┐
          │  Document-rule pass             │
          │  (priority 200+)                │
          │  (Phases 13, 16)                │
          │  checkDocument(ctx, findings)   │
          └────────────┬────────────────────┘
                       │
                       ▼
                dedupeOverlapping → Finding[]
```

### 4.2 What doesn't change

- `__lexiVocab` public shape (only adds getters)
- Rule registration (still self-registering IIFE into `__lexiSpellRules`)
- Popover / marker rendering in `spell-check.js`
- Release gates (all 8 still apply; structural rules just add rows to the fixture threshold table and the CSS wiring check)
- Manifest content-script load order (new rule files slot in the same spot)

### 4.3 What does change in `spell-check.js`

Small additions only:
- Render new CSS dot colours for structural rule ids
- Popover may need a "why" section longer than the v1 one-liner — structural findings often require two sentences of explanation. Design decision for Phase 6 UX spike: keep the existing `explain → {nb, nn}` contract but allow HTML-richer body (escape still mandatory).

---

## 5. Phase Build-Order and Seam-Landing Plan

Ordered to minimize rework and respect dependencies surfaced by v2.0-benchmark-driven-roadmap.md §Sequencing notes ("Phase 13 depends on document-level state management that no current rule needs").

| Phase | Lands seam | Reuses | Rationale |
|---|---|---|---|
| **6** Register & stylistic | **Sentence segmenter (§3.1)**; getRegisterLevel, getCollocationBank, getRedundancyPhrases (§3.4) | — | Low-risk phase is the right place to pay the sentence-segmenter cost. Register detection needs sentence-level formality signal (avg length, punctuation density). Collocation & redundancy rules fit the token-local shape but benefit from sentence boundaries for proximity windows. |
| **7** Word-order (NB+DE+FR) | **Tagged-token view + syntax-lite helpers (§3.2)**; getBagsAdjectives | Sentence segmenter from Phase 6 | Three rules (7.1 NB V2, 7.2 DE V2+verb-final, 7.3 FR BAGS) all need `findFiniteVerb` / `isMainClause`. Land the helper library once, reuse across languages. **7.2 sub-rules share detection code** per benchmark roadmap — implement `findSubordinator` + `findFiniteVerb` once in the helper library, not once per rule. |
| **7-spike** Document-state seam design | **Seam shape agreed** (§3.3), implementation deferred | — | Small design spike: agree on `kind: 'document'` + `checkDocument(ctx, findings)` signature before Phase 8 starts referring to future Phase 13 shape. Document a stub in `spell-rules/README.md`. **No code lands yet.** |
| **8** DE case & agreement | getPrepositionCase, getSeparablePrefixes, getAuxiliary, getCompoundSplitter | Tagged-token view, sentence segmenter | All DE-only; no new seam. 8.2 separable-prefix needs `findFiniteVerb` from Phase 7. 8.4 compound splitter is a pure helper — could live on `__lexiSpellCore` if EN/NB later need similar logic; for v2.0 keep it DE-scoped. |
| **9** ES ser/estar, por/para, personal "a" | getCopulaTag, getPorParaPatterns, getHumanNouns | Tagged-token view | All ES-only. **Gate per roadmap:** "confirm Phase 9/10 trigger-detection infrastructure can be reused [in Phase 11] — don't duplicate." Implement 9 and 10 with a shared `triggerTable` data shape on `__lexiSpellCore` so 11.x subjunctive triggers can reuse it. |
| **10** FR élision, auxiliary, PP agreement | getElisionTriggers, getAuxiliary (shared with 8.3) | Tagged-token view, sentence segmenter | Parallel-safe with Phase 9 (different language). |
| **11** Aspect & mood (ES+FR) | getSubjunctiveTriggers, getAspectAdverbs | Trigger-table shape from Phase 9/10; tagged-token `features.mood` added here | Depends on Phase 9/10 trigger detection. If `triggerTable` landed correctly there, Phase 11 is mostly data. |
| **12** Pronoun & pro-drop (ES+FR) | getGustarVerbs | Tagged-token view for subject detection (12.1 pro-drop) and clitic detection (12.3) | Parallel-safe with Phase 11 once tagged-token view is stable. |
| **13** Register consistency | **Document-state seam implemented (§3.3)** — two-pass runner, `kind: 'document'`, `checkDocument(ctx)` | Sentence segmenter, register getters from Phase 6 | Spike in Phase 7 already agreed the shape. Landing it here unblocks 13.1–13.4. |
| **14** Morphology beyond tokens (EN+ES+FR) | getIrregularForms, getWordFamily | Tagged-token view | Language-siloed; reuses infra. |
| **15** Collocations at scale | (reuses getCollocationBank from Phase 6, extends coverage) | Sentence segmenter | Data-heavy, little new logic. |
| **16** Tense harmony & discourse | — | Document-state seam from Phase 13; tagged-token features from earlier phases | Aspirational. Reuse, don't extend. |

### Dependency graph (compressed)

```
Phase 6 ── sentence-segmenter ──┐
                                ├── Phase 7 ── tagged-token-view ──┐
                                │                                   ├── Phase 8 (DE)
                                │                                   ├── Phase 9 (ES) ──┐
                                │                                   │                   ├── Phase 11 (aspect/mood)
                                │                                   ├── Phase 10 (FR) ─┘
                                │                                   ├── Phase 12 (pronouns)
                                │                                   ├── Phase 14 (morphology)
                                │                                   └── Phase 15 (collocations)
                                │
                                └── Phase 13 ── doc-state seam ── Phase 16 (tense harmony)
                                        ↑
                              seam-shape spike in Phase 7
```

### Parallel tracks

- **Phases 8 / 9 / 10 can run in parallel** (three siloed languages, all depending only on Phase 6+7 seams).
- **Phase 6.1 register + Phase 6.2 collocations + Phase 6.3 redundancy** are independent sub-phases within Phase 6 — can fan out once sentence segmenter lands.
- **Phase 7 sub-phases** (7.1 NB, 7.2 DE, 7.3 FR) ship serially against the same tagged-token helper to avoid API churn.

---

## 6. Risks and Mitigations

| Risk | Phase | Mitigation |
|---|---|---|
| Sentence segmenter gets abbreviation-heavy on DE/FR | 6 | Start with NB abbreviation list (known); expand per-language inside the getter, not the segmenter logic |
| Tagged-token view becomes a half-built POS tagger | 7 | Scope is deterministic lookup-based enrichment only; no probabilistic tagging. If a rule needs data the current `__lexiVocab` getters can't supply, add a getter rather than smarter tagging |
| Document-state seam grows unbounded over phases | 13 | Reserve `kind: 'document'` for the explicit use case (per-text drift detection). Reject PRs that use `docState` as a scratchpad from sentence-level rules — those belong on `ctx` |
| Structural rules increase false-positive rate on code-switched / technical text | 7, 8, 11 | Structural rules MUST honor `ctx.suppressed` from `nb-codeswitch` and `nb-propernoun-guard` (priority 1 + 5). Add this to the rule-authoring checklist in `spell-rules/README.md` |
| Benchmark validation drifts from fixture | all | Per roadmap §Validation protocol: phase closes when 80% of promised benchmark lines flip. Fixture remains the release gate; benchmark is the acceptance gate |
| Bundle-size regression from new vocab banks (preposition tables, conjugation aux fields, trigger tables) | 8, 9, 10, 11 | `check-bundle-size` already gates. Current zip 10.25 MiB / 20 MiB cap → ~49% headroom. New per-language banks are small (closed-class lists in low single-digit KB each). Monitor after Phase 11 |
| SC-06 network silence regression | all | `check-network-silence` gates every release. Structural rules must not fetch (e.g., "just pull the latest subjunctive trigger list at runtime") — all data ships bundled |

---

## 7. Scalability Considerations

| Concern | At 1 rule added | At 10 rules added (post-v2.0) | At 30+ rules (v3.0 trajectory) |
|---|---|---|---|
| Runner per-keystroke latency | Negligible — lazy tagger, short-circuit on language filter | Monitor; rule filter + priority sort is O(n log n) where n = total rules | Consider pre-computed language-bucketed registry |
| Memory (ctx, tagged-token cache) | Per-keystroke alloc only | Same shape | Same |
| Bundle size | Each rule file ~100–300 LOC | ~3KB × 10 = 30KB JS growth | Still trivial vs. vocab data |
| Fixture maintenance | +30 positive + +15 acceptance per rule (roadmap contract) | ~450 new fixture cases by end of v2.0 | Consider fixture-generation helper |
| Gate runtime | `check-fixtures` ~seconds | `check-fixtures` scales linearly with rules × cases | Parallelize by language if needed |

---

## 8. Integration Points Summary (for Roadmapper)

**Existing surfaces reused without change:**
- `__lexiVocab` public getter contract (new getters added, none broken)
- `__lexiSpellRules` registry (new rules added, runner unchanged for sentence pass)
- Release gate shape (fixtures / explain / CSS / network / bundle / features)
- Popover + marker rendering in `spell-check.js`
- `scripts/sync-vocab.js` pipeline for bundled data

**New seams (this milestone):**

| Seam | Lands in | File(s) | Owner |
|---|---|---|---|
| `segmentSentences()` helper | Phase 6 | `spell-check-core.js` | core |
| `ctx.sentences` on runner | Phase 6 | `spell-check-core.js` | core |
| Tagged-token view `ctx.getTagged(i)` | Phase 7 | `spell-check-core.js` | core |
| Syntax-lite helpers (`findFiniteVerb` etc.) | Phase 7 | `spell-check-core.js` | core |
| Document-rule kind + two-pass runner | Phase 13 (shape spike Phase 7) | `spell-check-core.js` | core |
| New `__lexiVocab` getters (§3.4) | Phases 6–14 (staggered) | `vocab-seam-core.js` + `vocab-seam.js` | seam |
| Structural-rule priority reservation (100–199 sentence, 200+ document) | Phase 6 | `spell-rules/README.md` | docs |
| Structural rule = must honor `ctx.suppressed` convention | Phase 6 | `spell-rules/README.md` | docs |

**Data-schema additions in `papertek-vocabulary` (additive, cross-app safe):**
- Register level per entry (optional)
- Collocation / redundancy / phrase banks (new banks)
- DE: preposition-case, `separable`, `aux` fields on verb entries, compound splitter hints
- ES: `copula` tag on adjectives, `human` flag on nouns, por/para pattern bank, subjunctive trigger bank, aspect-adverb bank, gustar-class verb bank
- FR: BAGS adjective set, élision trigger set, `aux` on verbs (shared with DE-style field), subjunctive trigger bank
- EN: irregular-form map, word-family map
- NB/NN: register level (bokmål/riksmål distinction for 13.3), preposition collocations (15.1)

All additions follow the existing additive-schema rule — no consumer breaks.

---

## Sources

- `.planning/PROJECT.md` — v2.0 milestone framing, carry-over debt, constraints (HIGH confidence — shipped v1.0 + current milestone brief)
- `.planning/v2.0-benchmark-driven-roadmap.md` — Phase groupings and benchmark lines (HIGH confidence — user-authored seed)
- `.planning/codebase/ARCHITECTURE.md` — v1.0 baseline architecture (HIGH confidence — 2026-04-17 analysis)
- `extension/content/spell-check.js` (746 LOC), `spell-check-core.js` (324 LOC), `vocab-seam.js` (299 LOC), `vocab-seam-core.js` (890 LOC) — runner, ctx, getter surface (HIGH confidence — direct code read)
- `extension/content/spell-rules/README.md` — plugin convention, priority semantics, explain contract, suppression convention (HIGH confidence — repo docs)
- `extension/content/spell-rules/nb-sarskriving.js` — representative rule shape (HIGH confidence — direct code read)
- `CLAUDE.md` — release workflow, 8 release gates, data-logic separation principle (HIGH confidence — project instructions)
- Memory notes: `project_data_logic_separation_philosophy.md`, `project_data_source_architecture.md`, `project_v2_benchmark_roadmap.md` (HIGH confidence — user-authored)
