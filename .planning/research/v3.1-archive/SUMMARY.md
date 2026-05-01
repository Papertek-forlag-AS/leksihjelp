# Project Research Summary

**Project:** Leksihjelp v2.0 — Depth of Coverage: Grammar Governance Beyond Tokens
**Domain:** Offline structural grammar rules for a Chrome MV3 extension; Norwegian students writing DE/ES/FR/EN/NB/NN
**Researched:** 2026-04-24
**Confidence:** HIGH

## Executive Summary

v2.0 extends the shipped v1.0 per-token spell-check surface into structural
grammar: word order, case/agreement governance, aspect/mood selection, register
drift, and collocation errors. The research is unusually well-grounded — v1.0 is
already in production, all constraints are binding, the benchmark corpus is
hand-authored, and the codebase was read directly. The recommended approach
requires exactly one new browser primitive (`Intl.Segmenter`), zero new npm
dependencies, and additive data schema changes in `papertek-vocabulary`. Every
new capability is achieved through three new architectural seams — a sentence
segmenter (Phase 6), a tagged-token view with syntax-lite helpers (Phase 7), and
a document-state two-pass runner (Phase 13) — layered on top of the existing
plugin rule architecture and `__lexiVocab` seam.

The dominant delivery risk is not technical novelty but discipline: structural
rules have an open-ended acceptance surface that token-local rules did not.
Fixture green is a necessary but insufficient release criterion for structural
rules; the new `check-benchmark-acceptance` gate (≤2 stray flags per 500-word
passage) is equally binding. A second compounding risk is data-track latency:
every phase depends on `papertek-vocabulary` schema additions (`aux`, `separable`,
`copula`, `human`, `bags`, governance tables, trigger banks), and that authoring
queue must be opened as data-track tickets in parallel with logic work, not after.

Phase 6 is deliberately overloaded: beyond its own register/collocation/redundancy
features, it must land the sentence segmenter, quotation-span suppression tier,
hint-tier CSS and severity contract, priority-band documentation, the P1/P2/P3
benchmark-line labeling convention, the `papertek-vocabulary` SCHEMA.md ownership
model, and the skeleton of `check-benchmark-acceptance`. If Phase 6 is scoped as
"just register polish" these infrastructure items slip to Phase 7, where they
arrive too late because Phase 7 is the first high-FP-risk word-order phase.
Phase 6 is the infrastructure phase.

## Key Findings

### Recommended Stack

v2.0 requires no new runtime dependencies. The addition set is: `Intl.Segmenter`
(browser-native since Chromium 87, ICU-backed, Baseline 2024-04, zero bundle
cost) for locale-aware sentence and word segmentation; additive JSON fields on
`papertek-vocabulary` banks; and rolled-own micro-helpers of 40–200 LOC each for
light syntactic reasoning. All alternatives considered (sentencex-js, compromise,
de-compromise, NLP libraries, WASM Hunspell, ML taggers) were rejected for bundle
cost, license incompatibility (GPL-2.0 Norwegian dicts), or mismatch with the
closed-set, deterministic, offline requirements.

**Core technologies:**
- `Intl.Segmenter` — locale-aware sentence/word segmentation — zero bundle cost, ICU-backed, handles DE/FR/ES/NB punctuation edge cases (`¿?`, `«»`, decimals, abbreviations) that a regex segmenter cannot
- Additive `papertek-vocabulary` schema — authoritative data source for governance fields (`aux`, `separable`, `copula`, `human`, `bags`, governance tables, trigger banks) — cross-app single source of truth; additive-only to protect sibling consumers
- Rolled-own rule-local helpers (~40–200 LOC each) — closed-set syntactic reasoning (V2 detection, subordinator lookup, clitic-cluster order, prefix-stranding) — lighter than any library candidate by 10–100×

**New gate scripts (v2.0 additions):**
- `check-benchmark-coverage` (~80 LOC) — phase-close criterion anchored to P1/P2/P3-weighted benchmark flip-rate; not a bare 80% percentage
- `check-governance-data` (~60 LOC) — asserts verbbank entries matching aux/separable heuristics have the expected field; guards against silent no-ops when sync drops a field
- `check-stateful-rule-invalidation` — edit-sequence simulator for Phase 13 discourse-state rules; asserts findings match final text after paste, undo, delete

### Expected Features

**Must have — P1 (table stakes, v2.0.0–v2.1):**
- 6.3 Stylistic redundancy (`return back`, `free gift`) — highest ROI per LOC; literal-match
- 6.1 Register/formality detector — EN `gonna` + NB anglicisms; proves opt-in toggle pattern
- 6.2 Collocation errors EN seed — `make a photo → take`; proves data-bigram rule shape
- 8.1 DE preposition-case governance — highest error-density per benchmark token
- 8.2 DE separable verbs (`ich aufstehe`)
- 8.3 DE perfekt auxiliary (`haben` vs `sein`)
- 8.4 DE compound-noun gender from last component
- 9.1 ES ser vs estar
- 9.2 ES por vs para
- 9.3 ES personal "a"
- 10.1 FR élision — deterministic, closed set
- 10.2 FR être vs avoir
- 14.1 EN morphological overgeneration (`childs`, `eated`)

**Should have — P2 (differentiators, v2.1–v2.2):**
- 7.1 NB V2 word-order (`Hvorfor du tror`) — HIGH impact, MEDIUM-HIGH FP risk
- 7.2 DE V2 + subordinate verb-final (`dass er ist nett`) — shares syntactic reasoner with 7.1
- 7.3 FR BAGS adjective placement — closed ~40-adj list; competitors miss it
- 10.3a FR participe passé agreement — tight adjacent-window scope, default-off toggle; 10.3b explicitly deferred
- 11.1 ES subjuntivo triggers
- 11.3 FR subjonctif triggers
- 13.3 NB bokmål/riksmål drift — brand-distinctive; no competitor ships it
- 13.4 NN a-infinitiv/e-infinitiv drift — brand-distinctive for NN users
- 12.1 ES pro-drop overuse (soft hint)
- 12.2 ES gustar-class syntax
- 14.2 ES/FR opaque-noun gender mismatch

**Defer to v3.0 or kill:**
- Phase 16 (tense harmony, anaphora, long-distance SV agreement) — high FP risk; defer unless Phase 13 seam generalizes cleanly
- 15.3 Idiomatic literalism detection — "scope TBD" is a trap; curated exact-match only or kill
- P3 features (13.1 DE du/Sie drift, 13.2 FR tu/vous drift, 12.3 FR clitic order, 15.x collocation banks at scale) — after Phase 6/13 seams proven

**Anti-features (never build):** auto-correct/silent rewrite, ML-powered grammar rewrites, online-only integration, premium gating for any spell-check rule.

### Architecture Approach

v2.0 extends the existing `spell-check-core.js` → plugin rule registry pipeline
with three new seams, each introduced at its first point of need. The plugin
registry, `__lexiVocab` getter contract, popover rendering, and all six v1.0
release gates are unchanged. The only structural edit to `spell-check.js` is the
Phase 13 two-pass runner (~50 LOC). Everything else is additive.

**Three new seams (lands-in phase):**

1. **Sentence segmenter `segmentSentences(text, tokens) → Sentence[]`** — Phase 6, `spell-check-core.js`. Exposes `ctx.sentences`. Uses `Intl.Segmenter` + per-language abbreviation allow-list. Rules that do not need sentences ignore it.
2. **Tagged-token view `ctx.getTagged(i) → TaggedToken` + syntax-lite helpers** — Phase 7, `spell-check-core.js`. Lazy lookup-based enrichment (not statistical). Helpers: `findFiniteVerb`, `findSubordinator`, `findCliticCluster`, `isMainClause`, `agree`. Memoized per `ctx`. Phases 8–12 reuse.
3. **Document-state two-pass runner `kind: 'document'` + `checkDocument(ctx, findings)`** — Phase 13, `spell-check-core.js`. Shape agreed by design spike in Phase 7 (no code lands until Phase 13). Priority ranges: sentence rules 1–199, document rules 200+.

**New `__lexiVocab` getters (additive, staggered):**
`getRegisterLevel`, `getCollocationBank`, `getRedundancyPhrases` (Phase 6);
`getBagsAdjectives` (Phase 7);
`getPrepositionCase`, `getSeparablePrefixes`, `getAuxiliary`, `getCompoundSplitter` (Phase 8);
`getCopulaTag`, `getPorParaPatterns`, `getHumanNouns` (Phase 9);
`getElisionTriggers` (Phase 10);
`getSubjunctiveTriggers`, `getAspectAdverbs` (Phase 11);
`getGustarVerbs` (Phase 12);
`getIrregularForms`, `getWordFamily` (Phase 14).
All follow the existing empty-safe contract (`return new Map()`).

### Critical Pitfalls

Top five of twelve identified:

1. **FP avalanche on structural rules (Pitfall 1)** — Structural rules have open-ended acceptance surfaces; fixture-green alone is not enough. Prevention: ≥2× acceptance cases vs positive cases per structural rule; `check-benchmark-acceptance` gate (≤2 stray flags per 500-word passage) is binding alongside `check-fixtures`. Must land in Phase 7 before any word-order rule ships.

2. **Discourse-state staleness in Phase 13 (Pitfall 4)** — Cross-sentence state goes stale on edit/paste/undo; ghost findings erode trust. Prevention: document-level state is derived never cached; content-hash keyed invalidation; `check-stateful-rule-invalidation` gate. Mandatory research step before any Phase 13 rule code.

3. **Benchmark overfitting (Pitfall 2)** — The 80%-flip-rate incentive drives rules tuned to visible benchmark phrasings rather than underlying patterns. Prevention: hold-out corpus (30% of benchmark additions hidden during authoring); fixtures seeded from independent sources; P1/P2/P3 weighted closure (100% P1 required, not just 80% overall).

4. **DE case governance parsing overreach (Pitfall 5)** — "Find the NP head after the preposition" breaks on adjective chains and embedded relatives. Prevention: Phase 8.1 scoped to adjacent-article-only window; precision floor ≥0.90 before recall optimization.

5. **Feature-gated index starvation v2 (Pitfall 3)** — New vocab indexes (preposition tables, BAGS list, trigger banks) can be silently wired through `buildIndexes` (preset-filtered) instead of `buildLookupIndexes` (unfiltered), disabling rules under default presets. Prevention: extend `check-spellcheck-features` for every new index; `check-seam-routing` static grep asserts correct builder.

Additional high-impact: Pitfall 7 (quoted-speech bleed-through — tier `ctx.suppressedFor.structural` in Phase 6), Pitfall 8 (hint tier never differentiated — Phase 6 builds dashed-underline tier), Pitfall 9 (schema drift — SCHEMA.md ownership per field), Pitfall 12 (80%-flip fetishism — P1/P2/P3 closure criterion required).

## Implications for Roadmap

The research validates the 11-phase grouping in the seed roadmap. The synthesis
adds specific scoping decisions and sequencing constraints that were implicit in
the seed.

### Phase 6 — Register, Collocations, Redundancy + Infrastructure Build-Out
**Rationale:** Lowest-risk features open the milestone, but Phase 6 must be
explicitly scoped as infrastructure delivery — not just feature delivery. Every
cross-cutting convention needed by Phases 7–16 must land here.
**Delivers:** 6.1 register/formality detector; 6.2 EN collocation errors seed;
6.3 stylistic redundancy; sentence segmenter (`ctx.sentences`); quotation-span
suppression tier (`ctx.suppressedFor.structural`); hint-tier CSS + `severity`
contract; priority-band documentation; P1/P2/P3 benchmark labeling; SCHEMA.md
ownership model; `check-benchmark-acceptance` skeleton; `check-spellcheck-features`
extended for new indexes.
**Avoids:** Pitfalls 7, 8, 9, 10, 12.
**Research flag:** Design spikes at phase start (not pre-phase research) for sentence segmenter abbreviation lists and suppression tier shape.

### Phase 7 — Word-Order Violations (NB + DE + FR) + Seam Design Spike
**Rationale:** First high-FP-risk structural phase. Tagged-token view lands here.
A document-state seam design spike is embedded (shape agreed, no code) so Phase
13 does not design it under pressure.
**Delivers:** 7.1 NB V2; 7.2 DE V2 + verb-final; 7.3 FR BAGS (parallel-safe
with 7.1/7.2); tagged-token view + helpers in `spell-check-core.js`;
document-state seam shape stubbed in `spell-rules/README.md`;
`check-benchmark-acceptance` fully active and green.
**Avoids:** Pitfall 1 (≥2× acceptance fixtures mandatory), Pitfall 2 (hold-out corpus active).
**Research flag:** Needs pre-phase research. NB V2 FP risk and acceptance-fixture strategy require upfront design.

### Phases 8 / 9 / 10 — Language-Siloed Structural Coverage (Can Parallel)
**Rationale:** Fully siloed languages; all depend only on Phase 6+7 seams.
DE first (highest error-density). Phase 8 must deliver shared `grammar-tables.js`
primitive before Phases 9/10 rule code starts.
**Delivers (Phase 8 DE):** 8.1 prep-case (adjacent scope, precision ≥0.90 floor); 8.2 separable verbs; 8.3 perfekt aux; 8.4 compound gender; `grammar-tables.js` shared primitive.
**Delivers (Phase 9 ES):** 9.1 ser/estar; 9.2 por/para (≤15 trigger patterns); 9.3 personal "a".
**Delivers (Phase 10 FR):** 10.1 élision; 10.2 être/avoir; 10.3a PP agreement (adjacent-window, default-off; 10.3b explicitly deferred).
**Avoids:** Pitfall 5 (parsing overreach), Pitfall 6 (FR PP eating phase), Pitfall 11 (zero-transfer language work — Phase 8 primitive enforced).
**Research flag:** Phase 8 needs research on shared-primitive API shape. Phases 9/10 are standard patterns once primitive shape is known.

### Phase 11 — Aspect and Mood (ES + FR)
**Rationale:** Gates on Phase 9/10 trigger infrastructure. Entry requires gate
check confirming the trigger-detection primitive is shared. If not, refactor
sub-phase blocks entry.
**Delivers:** 11.1 ES subjuntivo triggers; 11.2 ES pretérito/imperfecto (hint tier only); 11.3 FR subjonctif triggers.
**Avoids:** Pitfall 8 (11.2 aspect is a hint, not an error), Pitfall 11 (must consume Phase 8/9 primitive).
**Research flag:** Gate check (not research) before opening: confirm primitive is reusable.

### Phase 12 — Pronoun and Pro-drop (ES + FR)
**Rationale:** All three rules are soft hints or complex patterns. Parallel-safe
with Phase 11. All must use hint tier.
**Delivers:** 12.1 ES pro-drop (soft hint); 12.2 ES gustar-class syntax; 12.3 FR clitic cluster order.
**Avoids:** Pitfall 8 (all Phase 12 rules must be hint tier, not error tier).
**Research flag:** Standard patterns; no dedicated research needed.

### Phase 13 — Register Consistency Within a Text (Document-State Seam)
**Rationale:** Highest-risk phase in v2.0. Mandatory pre-phase research step
on invalidation protocol before any rule code. The seam shape was agreed in
Phase 7 spike; now it becomes code.
**Delivers:** Two-pass runner in `spell-check-core.js`; 13.1 DE du/Sie drift;
13.2 FR tu/vous drift; 13.3 NB bokmål/riksmål drift (brand-distinctive);
13.4 NN a-/e-infinitiv drift; `check-stateful-rule-invalidation` gate active.
**Avoids:** Pitfall 4 (content-hash invalidation, never module-level mutable state, edit-sequence gate).
**Research flag:** Mandatory pre-phase research on document-state invalidation protocol. Do not start rule code before seam design passes review.

### Phase 14 — Morphology and Agreement Beyond Tokens (EN + ES + FR)
**Rationale:** Language-siloed; reuses tagged-token infra. Low seam cost. 14.1
is P1 and ships earliest.
**Delivers:** 14.1 EN morphological overgeneration; 14.2 ES/FR opaque-noun gender mismatch; 14.3 EN word-family confusion.
**Avoids:** Pitfall 9 (SCHEMA.md entry per new field — word-family map, irregular-form map).
**Research flag:** Standard patterns; no dedicated research needed.

### Phase 15 — Collocations and Idioms at Scale
**Rationale:** Depends on Phase 6.2 proving the collocation-list pattern works.
Data-heavy, little new logic. 15.3 must be explicitly decided — kill unless
curated-only exact-match.
**Delivers:** 15.1 NB preposition collocations; 15.2 DE/FR/ES preposition governance; (15.3 curated exact-match only if approved).
**Avoids:** Pitfall 11 (must share Phase 6.2 list data shape).
**Research flag:** Standard patterns. Kill/scope decision on 15.3 required in phase plan.

### Phase 16 — Tense Harmony and Discourse (Conditional)
**Rationale:** Defer to v3.0 unless Phase 13 seam generalizes cleanly to tense
tracking. Do not duct-tape. Individual sub-rules may ship if they independently
clear the FP threshold.
**Avoids:** Pitfall 4 (same risk class as Phase 13, harder).
**Research flag:** No planning until post-Phase-13 evaluation. Conditional on seam generalization.

### Phase Ordering Rationale

- Phase 6 first because it lands the sentence segmenter and all cross-cutting infrastructure conventions (hint tier, priority bands, suppression tier, P-labeling) that every later phase depends on; opening with low-risk features validates velocity before harder structural phases
- Phase 7 second because tagged-token view is needed by Phases 8/9/10 and the FP-risk mitigation gates must be proven green before high-risk structural phases open
- Phases 8/9/10 parallel after Phase 7 because they are fully language-siloed and depend only on Phase 6+7 seams; DE first due to highest error-density
- Phase 11 gates hard on Phase 9/10 trigger infrastructure — forced gate check before entry
- Phase 13 after Phases 8–12 because the seam shape matures through those phases before it becomes code; highest-risk phase benefits from maximum infrastructure stability
- Phase 15 after Phase 6.2; Phase 16 conditional on Phase 13 seam

### Research Flags

Phases requiring dedicated pre-phase research or design spikes:
- **Phase 7:** High-FP-risk NB V2 rule + document-state seam spike. Recommend pre-phase research step.
- **Phase 8:** Shared-primitive API shape design. Short research step needed.
- **Phase 13:** Mandatory pre-phase research on document-state invalidation protocol. Highest-risk phase.

Phases with standard patterns (skip dedicated research):
- **Phase 6:** Design spikes at phase start, not discovery research.
- **Phase 9, 10:** Standard lookup patterns after Phase 8 primitive known.
- **Phase 11:** Gate check (not research) before entry.
- **Phase 12, 14, 15:** Standard lookup or data patterns; no research needed.
- **Phase 16:** No planning until post-Phase-13 evaluation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Constraints are binding; `Intl.Segmenter` verified Baseline 2024-04; all alternatives reviewed and rejected with specific reasons; no dependency uncertainty |
| Features | HIGH | P1/P2/P3 grounded in hand-authored benchmark corpus, competitor analysis, and v1.0 complexity analogues; MEDIUM on Phase 11 trigger-set completeness and FR BAGS adj count |
| Architecture | HIGH | Direct code read of `spell-check.js`, `spell-check-core.js`, `vocab-seam.js`, `vocab-seam-core.js`; seam boundaries verified against existing runner |
| Pitfalls | HIGH | All 12 pitfalls map to specific project evidence (v1.0 audit bugs, benchmark construction, codebase patterns); no speculative entries |

**Overall confidence:** HIGH

### Gaps to Address

- **Phase 11 trigger-set completeness:** Open as data-track ticket early; needs a `papertek-vocabulary` audit during Phase 11 planning. Do not assume roadmap canonical list is complete.
- **FR BAGS adjective list size:** "~40" is a roadmap estimate; actual closed-set size needs audit at authoring time.
- **`papertek-vocabulary` schema shape per field:** Cross-app coordination with `papertek-webapps` and `papertek-nativeapps` required before any data PR. SCHEMA.md ownership record (Phase 6) is the coordination artifact.
- **Phase 13 invalidation protocol:** Never built in this codebase. Mandatory research step; do not treat as known-cost item.
- **Phase 15.3 idiomatic literalism scope:** Explicit kill/curated-only decision required in Phase 15 plan.
- **Phase 16 feasibility:** Evaluate post-Phase-13 only.
- **80%-flip-rate must be weighted by priority:** Bare 80% target in seed roadmap is insufficient. Every phase plan must specify P1 (100% required), P2 (80%), P3 (50%); unflipped P1 blocks closure without written exception.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — technology decisions, dependency rationale, "what NOT to use"
- `.planning/research/FEATURES.md` — feature landscape, P1/P2/P3 matrix, dependency graph, benchmark-line anchors
- `.planning/research/ARCHITECTURE.md` — seam design, data-flow changes, build-order plan, scalability considerations
- `.planning/research/PITFALLS.md` — 12 pitfalls with phase-to-prevention mapping and recovery strategies
- `.planning/PROJECT.md` — binding constraints, Out-of-Scope list, v1.0 shipped requirements, Key Decisions table
- `.planning/v2.0-benchmark-driven-roadmap.md` — 11-phase groupings, benchmark-line anchors, validation protocol, non-goals
- `extension/content/spell-check.js`, `spell-check-core.js`, `vocab-seam.js`, `vocab-seam-core.js` — direct code read (via ARCHITECTURE.md research)
- `CLAUDE.md` — 8 release gates, data-logic separation principle, release workflow

### Secondary (MEDIUM confidence)
- `benchmark-texts/*.txt` — 6 hand-authored student-error corpora; high confidence on error patterns, MEDIUM on whether the benchmark fully represents real student writing variance
- Competitor analysis (LanguageTool, Grammarly free tier) — feature comparison; training-data based, not current product audit

### Tertiary (LOW confidence)
- Phase 11 trigger-set completeness — no `papertek-vocabulary` data audit yet; needs validation during Phase 11 planning
- FR BAGS adjective count — "~40" is a roadmap estimate; actual closed-set size unverified

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*
