# Pitfalls Research — v2.0 Structural Grammar Governance

**Domain:** Adding structural grammar rules (word-order, case governance, aspect/mood, register drift, collocations) on top of the v1.0 per-token spell-check surface for NB/NN/DE/ES/FR/EN. Offline heuristic rules. `benchmark-texts/` as validation source of truth.

**Researched:** 2026-04-24
**Confidence:** HIGH — grounded in v1.0 audit evidence and stated v2.0 scope.

**Scope note:** This file supersedes the v1.0-era PITFALLS.md for v2.0 roadmap planning. v1.0 token-level pitfalls (captured in that earlier document) are now embedded in release gates; v2.0 pitfalls are structural/integration-level.

---

## Critical Pitfalls

### Pitfall 1: Fixture-Green False-Positive Avalanche on Structural Rules

**What goes wrong:** A structural rule (Phase 7 NB V2, Phase 8 DE case, Phase 10 FR participe passé) hits P/R targets on a hand-authored fixture, ships, and then fires on half of a student's real sentences because legitimate constructions (quoted speech, interrogatives, subordinate clauses, stylistic fronting, poetic inversion) were never in the fixture.

**Why it happens:** v1.0 fixtures were token-local — `et bok` either fires or doesn't. Structural rules operate on spans; the *acceptance set* (constructions the rule must NOT flag) is open-ended. Writing 30 positive cases is easy; enumerating every legitimate inversion is not, and authors unconsciously curate examples the rule already handles.

**How to avoid:**
- Invert v1.0's fixture ratio: structural rules ship with **≥2× acceptance cases vs positive cases** (e.g., 30 positive + 60 acceptance).
- New release gate `check-benchmark-acceptance` runs full `benchmark-texts/<lang>.txt` and asserts only lines tagged `# EXPECT-FLAG` light up; ceiling of ≤2 stray flags per 500-word passage.
- Make the acceptance sweep binding — phase doesn't close without it green.

**Warning signs:**
- Fixture P=1.000 but first pilot paste of real prose has 40 underlines.
- All acceptance cases are short single sentences, no multi-clause/quoted examples.
- Reviewer says "this is just inversion detection, what could go wrong."

**Phase to address:** Phase 7 MUST land `check-benchmark-acceptance` gate before any word-order rule ships. Every structural phase after inherits.

---

### Pitfall 2: Benchmark-Corpus Overfitting (Training-Set Leak)

**What goes wrong:** Rule authors engineer detection for the specific phrasings in `benchmark-texts/<lang>.txt` lines. Fixture + benchmark both green; ship. A student writes the same error class with different words and the rule misses it — the rule was engineered to the benchmark's sentence shapes, not the underlying pattern.

**Why it happens:** v2.0 roadmap explicitly ties "ship when 80% of promised benchmark lines flip." That's a direct incentive to overfit visible text. If fixture cases are written by paraphrasing benchmark lines (same author's intuition), the corpora reinforce rather than cross-validate.

**How to avoid:**
- **Hold-out corpus:** reserve 30% of each phase's benchmark additions as a hold-out set hidden during rule authoring. Rule must hit ≥0.80 recall on hold-out, not just training-visible lines.
- Seed fixtures from *independent sources* (student writing samples, textbook errata, Språkrådet corpora) — not by paraphrasing the benchmark lines.
- Phase plan's "Validates against:" bullet must cite ≥2 external sources of error evidence, not just benchmark line numbers.

**Warning signs:**
- Fixture cases and benchmark lines share the same 5 verbs and 3 adverbials.
- Rule code has literal-string matches (`"i går"`) rather than category checks (`TIME_ADVERBIAL` set).
- Phase claims 100% benchmark flip-rate but misses obviously-analogous student errors in smoke-test.

**Phase to address:** Cross-cutting — roadmap instruction for every structural phase. Phase 7 is the first test.

---

### Pitfall 3: Feature-Gated Index Starvation, v2

**What goes wrong:** A structural rule reads `__lexiVocab.someIndex`, passes fixtures (harness uses unfiltered vocab, predicate `() => true`), but in the browser the user's grammar-feature preset filters `someIndex` to a subset that doesn't contain the lookup key. Rule silently no-ops — exactly the Phase 05.1 `check-spellcheck-features` bug, repeated at scale.

**Why it happens:** v1.0 learned word-prediction filters by preset while spell-check must not. v2.0 structural rules introduce *new* indexes (preposition-case tables, separable-verb lists, BAGS adjectives, subjunctive trigger sets). Each new index is a new opportunity to wire the gated path by accident.

**How to avoid:**
- **Extend `check-spellcheck-features`** for every new index a structural rule consumes — assert it stays populated under minimal-preset simulation.
- Convention: spell-check rule indexes go in `buildLookupIndexes()` (unfiltered); word-prediction indexes go in `buildIndexes()` (preset-filtered). Enforce with new gate `check-seam-routing` — static grep of rule files asserts `__lexiVocab.xxx` reads target the correct builder.
- Phase plan "Verification" section MUST name the index path and which builder populates it.

**Warning signs:**
- New rule works in `check-fixtures` but fires zero findings in a fresh-profile smoke-test.
- Phase plan mentions "new vocab index" without specifying `buildLookupIndexes` vs `buildIndexes`.
- Smoke-test done with all grammar features manually enabled.

**Phase to address:** Phase 6 (first v2.0 phase with new indexes — collocations, register markers). Every subsequent structural phase inherits.

---

### Pitfall 4: Discourse State Staleness (Phase 13)

**What goes wrong:** Phase 13 (register consistency, du/Sie drift, bokmål/riksmål mixing) needs state that spans sentences. State attached to a contenteditable DOM; user deletes half the text; state still describes ghost tokens; false positives erupt.

**Why it happens:** Every v1.0 rule is stateless — input is (token, neighbors, vocab), output is a finding. No rule has persistent cross-sentence state. Adding state means reasoning about invalidation (edits, focus changes, paste, undo), which no current rule does. Spell-check debounce updates incrementally rather than re-scanning from scratch.

**How to avoid:**
- **Document-level state = derived, never cached.** Phase 13 rules recompute from current DOM text every pass.
- If cost forces caching, key state by a content hash; invalidate on hash change. Hash logic lives in the seam, not in rules.
- Phase 13 research step (flagged in roadmap: *"Phase 13 depends on document-level state management that no current rule needs"*) must propose an explicit invalidation protocol BEFORE any rule is written.
- New release gate `check-stateful-rule-invalidation` runs scripted edit sequences (type, delete, paste, undo) and asserts findings match the final text.

**Warning signs:**
- Rule code references a module-level `Map`/`Set` that accumulates findings across `runCheck` calls.
- User reports "the underline stays after I delete the word."
- Findings differ depending on typing vs. paste order.

**Phase to address:** Phase 13 research step (pre-Phase-13 seam change). Invalidation protocol must land before any Phase 13 rule code.

---

### Pitfall 5: DE Case Governance Requires Parsing We Don't Have

**What goes wrong:** Phase 8.1 (preposition-case governance) needs to find the NP head after a preposition, read its gender+number, and check the article. Without a real parser, the rule heuristically grabs "the next noun after the preposition" — German nouns can be 3 tokens away past adjective chains, compound articles, or a relative clause, and "the next noun" can belong to a different phrase. Norwegian learners of German produce exactly the ambiguous structures (adjective chains, embedded relatives) that break heuristic NP detection.

**Why it happens:** v1.0 rules operated in a 1–3 token window. Phase 8's "closed morphology, tractable lookup" framing hides that *which noun to look up* is itself a parsing problem.

**How to avoid:**
- **Scope Phase 8.1 aggressively:** only flag prep+article pairs where the article is *immediately adjacent* to the prep (`mit den`, `mit dem`). No multi-token NP traversal. Sacrifice recall, keep precision.
- **Precision floor** as explicit phase success criterion: DE benchmark acceptance sweep must hit precision ≥0.90 before recall is optimized. If precision dips, narrow scope.
- Document limitation in rule's `explain()`: "Denne regelen sjekker bare artikkelen rett etter preposisjonen" — manage expectations.
- Phase 8 plan has explicit "what this rule will NOT catch" bullet with examples.

**Warning signs:**
- Rule code has `while (i < tokens.length && !isNoun(tokens[i]))` — unbounded traversal.
- No acceptance cases with intervening adjectives or relative clauses.
- Precision drops on longer sentences.

**Phase to address:** Phase 8 plan + research step. Precision floor is explicit success criterion.

---

### Pitfall 6: FR Participe Passé Agreement Eats the Whole Phase

**What goes wrong:** Phase 10.3 (`la pomme que j'ai mangée`) is the genuinely hard rule. "Ship with a feature toggle" is the escape hatch, not the plan. Full rule chains: find `avoir` aux → find past participle → find preceding DO pronoun (`la`/`les`/`que`) → resolve pronoun gender+number → check participle agreement. Five failure surfaces.

**Why it happens:** PP agreement is context-free-grammar-level. ML handles it by learning from examples; heuristic rules handle it by scoping tightly to reliable trigger windows. No middle ground.

**How to avoid:**
- **Split Phase 10.3 into 10.3a / 10.3b:**
  - **10.3a:** only the `[DO-pronoun] [ai/as/a/avons/avez/ont] [past-participle-with-e/s-mismatch]` pattern — single finite window, no cross-clause resolution. ~30% recall, ~95% precision.
  - **10.3b (aspirational, possibly v3.0):** the `que j'ai mangée` relative-clause case.
- `grammar_fr_pp_agreement` toggle defaults **off** for first release of 10.3a. Opt-in, explicitly experimental. Flip to default-on only after one release cycle of field feedback.
- Phase plan explicitly documents: the benchmark line `la pomme que j'ai mangée` may not flip in 10.3a. That's acceptable.

**Warning signs:**
- Rule code does antecedent resolution across >3 tokens.
- Phase plan treats 10.3 as "the full agreement rule."
- Author says "we'll just also handle the relative-clause case."

**Phase to address:** Phase 10 plan. Tight scope for 10.3a; explicit deferral of 10.3b.

---

### Pitfall 7: Quoted Speech / Code-Block Bleed-Through

**What goes wrong:** Student pastes a German quote in a Norwegian document, or cites an example sentence, or writes dialogue in dialect. Structural rules fire inside quotation marks, `<code>`, `<pre>`, `<blockquote>`. Student sees noise in places the tool shouldn't touch.

**Why it happens:** v1.0's `nb-codeswitch` handles the *paragraph-density* case for full foreign paragraphs. It doesn't know about quotation marks. Structural rules trigger on shorter spans where a single quoted sentence lights up fully.

**How to avoid:**
- Extend v1.0's `ctx.suppressed` infrastructure: quotation-span detector marks tokens inside `"…"`, `«…»`, `„…"`, `'…'` as suppressed **for structural rules** — but NOT for typo rules (typos in quoted text remain typos).
- Tier suppression: `ctx.suppressedFor.structural` vs `ctx.suppressedFor.token`. Typo rules respect `.token`; structural rules respect `.structural`.
- DOM-level: detect `<blockquote>`, `<code>`, `<pre>` and suppress their ranges entirely.
- Benchmark corpus must include lines with quoted foreign sentences; assert they do NOT flag.

**Warning signs:**
- Benchmark has no lines with `"…"` or block quotes.
- Smoke-test protocol doesn't include pasting a quote.
- User reports "it underlines my citations."

**Phase to address:** Phase 6 (first phase where register registers differently in quoted vs main text). Payoff compounds for Phases 7+.

---

### Pitfall 8: "Warn, Don't Hard-Flag" Softening That Never Actually Softens

**What goes wrong:** Multiple Phase 11/12/13 rules say "soft warning — aspect legitimately varies" but ship with the same red 3px underline as typo rules. Users can't distinguish a definite typo from a soft aspect hint. Trust erodes.

**Why it happens:** Current popover/CSS wiring has one visual style — solid colored underline + dot. "Soft warning" requires a different UI affordance (dashed underline, muted colour, "hint" badge, different click behavior). That's a UX design task, not a flag-flip. Phase authors default to what exists.

**How to avoid:**
- Phase 6 (first phase with soft warnings via 6.1 register detector) builds a **second visual tier**: dashed/dotted underline, muted colour (amber/grey vs red/blue), popover copy prefixed "Kanskje:" / "Maybe:". Built once, reused by Phases 11/12/13/16.
- Extend `check-rule-css-wiring`: rules declaring `severity: "hint"` must have `.lh-spell-<id>-hint` CSS class with distinct style; `severity: "error"` keeps the existing solid class.
- Explain-contract extension: `{nb, nn, severity}`. Renderer honors severity in popover copy.

**Warning signs:**
- Phase plan uses "soft warning" verbally; rule file looks identical to v1.0 rules.
- Two rules of different confidence flag with identical visual weight.
- User feedback: "I don't know which of these to trust."

**Phase to address:** Phase 6 builds the tier. Every subsequent phase using hints inherits.

---

### Pitfall 9: papertek-vocabulary Schema Drift Across Consumers

**What goes wrong:** Phase 8.2 lands `separable: true` on DE verbbank. Phase 8.3 adds `aux: "sein"`. Phase 10.2 uses the same `aux` on FR. By Phase 11, `papertek-webapps` or `papertek-nativeapps` breaks because they don't expect these fields, or a batch script leaks `separable` onto EN verbs that shouldn't have it.

**Why it happens:** Additive schema changes are safe in the "old readers ignore new fields" sense, but *sparse* fields (present on some entries, absent on others) create branches in every consumer. Without a running spec of v2.0-owned fields, siblings either miss data or inherit it spuriously.

**How to avoid:**
- Maintain `papertek-vocabulary/SCHEMA.md` with per-field ownership: which repo introduced it, which banks+languages carry it, what absent-vs-false means.
- Every v2.0 phase plan adding a field names: (a) exact field, (b) banks+languages, (c) consumer behavior when absent.
- Before data PR ships, check sibling repos for adjacent-field consumers; warn maintainers.
- `sync-vocab` sanity check: assert no DE-only field leaked into EN/ES/FR verbbanks (or inverse) after sync.

**Warning signs:**
- Data PR touches multiple languages' banks simultaneously without clear reason.
- Sibling repos start failing CI after a vocab sync.
- New field name overlaps with an existing field in another bank.

**Phase to address:** Cross-cutting. Schema-documentation requirement lands in Phase 6 plan template; every phase inherits.

---

### Pitfall 10: Rule Priority Collisions Cascade

**What goes wrong:** v1.0 priorities are sparse (proper-noun-guard=5, codeswitch=1, dialect-mix=35, etc.). v2.0 adds ~25 rules across 11 phases. Two rules fire on overlapping spans; which wins? Current behavior (typo-fuzzy short-circuits when dialect-mix fires) was hand-wired in Phase 05.1. Without an explicit priority contract, the 20th rule will silently shadow the 3rd.

**Why it happens:** Priority numbers are ints with ad-hoc spacing. No contract describes what "higher" means (fires first? instead-of? alongside?). v1.0 answered per-pair implicitly; v2.0's N² interaction space demands explicit policy.

**How to avoid:**
- Document priority semantics in `spell-rules/README.md`: what priority means, what bands reserved for what rule classes, how suppression interacts with priority.
- **Priority bands:** 1–10 structural guards (codeswitch, proper-noun); 20–40 domain-specific structural (dialect-mix, V2, preposition-case); 50–70 morphological (gender, særskriving, modal); 80–95 typo (curated, fuzzy). New rules declare band + justify deviations.
- New release gate `check-rule-priority-collisions`: when two rules emit findings on overlapping spans in the fixture, outcome must match documented expectation. No silent shadowing.

**Warning signs:**
- Adding a new rule breaks an existing rule's fixture without touching the existing rule.
- Two rule files grep for the same trigger token.
- Popover shows inconsistent rule attribution across re-renders.

**Phase to address:** Phase 6 documents bands + lands gate. Every subsequent phase respects.

---

### Pitfall 11: Zero-Transfer Language-Specific Work Pretending to be Cross-Cutting

**What goes wrong:** Phase 8 is 100% DE, Phase 9 is 100% ES, Phase 10 is 100% FR. Each invents internal abstractions ("governance tables," "decision-tree wrappers," "trigger-list matchers") that sound reusable but aren't. Phase 11 ES subjuntivo tries to reuse Phase 10 FR subjonctif infrastructure; shapes don't align; developer rewrites or copy-pastes.

**Why it happens:** Under schedule pressure, language-siloed rules are written fast and specific. Shared abstractions emerge by accretion, not design. By Phase 15, four slightly-different trigger-list structures exist and nobody knows which to copy.

**How to avoid:**
- Phase 8 delivers a shared `grammar-tables.js` utility with documented data shapes for: preposition-case tables, trigger-phrase sets, closed-adjective lists. Phases 9/10/11 consume it.
- gsd-roadmapper flags: Phase 8 research deliverable includes "shared table-lookup primitive spec."
- Refactor-forcing gate: before Phase 11 opens, Phase 9/10 rules must consume the Phase 8 primitive or a refactor sub-phase blocks.

**Warning signs:**
- Two phases have near-identical utility functions with different names.
- Each language's rules live in distinct folder conventions.
- "Trigger list" appears in 4 files with 4 different shapes.

**Phase to address:** Phase 8 research. Enforced at Phase 11 entry.

---

### Pitfall 12: 80%-Flip-Rate Fetishism

**What goes wrong:** Roadmap rule: "ship when 80% of promised benchmark lines flip." A phase lands, 8/10 flip, phase closes. The 2 that didn't were the most pedagogically important (e.g., subjunctive after `dudo que`); the 8 that did were easy cases. Headline hits; student value is marginal.

**Why it happens:** Benchmark lines aren't weighted by pedagogical priority. "80%" is a floor, not a quality bar.

**How to avoid:**
- Tag each benchmark line with priority (`# P1`, `# P2`, `# P3`): P1 = high-frequency student error, P3 = edge case. Require 100% P1 flip, 80% P2, 50% P3.
- Phase closure checklist lists which P1 lines flipped and which didn't. Any unflipped P1 blocks closure without written exception.
- Manual teacher-eye pass: one human reads benchmark + detected flags side-by-side before closure.

**Warning signs:**
- Closure report is bare percentage, no qualitative discussion.
- The 20% unflipped are always the same family.
- Benchmark grows without P1/P2/P3 labels.

**Phase to address:** Phase 6 introduces labeling. Every phase inherits.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding trigger lists inside rule files instead of papertek-vocabulary | Ship today without a papertek PR cycle | Cross-app reuse lost; data-logic separation violated; contributors edit code for data changes | Spike/prototype only — promote to papertek within the same phase before close |
| Literal-string matching over category matching (`if (token === 'mit')`) | Fewer moving parts initially | Rule won't generalize; every near-miss spawns a new rule | Never beyond the first positive fixture case |
| "We'll just feature-toggle it if noisy" (Phase 10.3 escape hatch) | Ship risky rule without field testing | Features accumulate; defaults never change; users don't know which toggles matter | Only for explicitly-experimental rules with default-off and one-release review |
| Regex-based tokenization for structural rules | Reuses v1.0 tokenizer | Structural rules need syntactic categories (subject position, finite-verb position) regex can't express | Phase 6 register only; never for Phase 7+ |
| Skipping acceptance-case fixtures "because rule is narrow" | Cuts fixture authoring in half | FP avalanche on first pilot; phase closes with smoke-test gap | Never |
| In-memory document state without hash invalidation | Simpler code | Ghost findings after edits; trust erosion; debugging nightmare | Never for Phase 13+ |
| Cloning a rule file and tweaking it for another language (DE→ES) | One-day feature delivery | Four near-identical rule implementations; any bug needs four fixes | Never after Phase 8 primitive ships |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `__lexiVocab` seam (INFRA-04) | Rule reads `__lexiVocab.someIndex` without checking it's populated by `buildLookupIndexes` (unfiltered) vs `buildIndexes` (preset-filtered) | Phase plan names builder; `check-spellcheck-features` extended to cover new index |
| `ctx.suppressed` | Structural rule ignores suppression because "my rule is different" | Tier suppression: `ctx.suppressedFor.structural` vs `ctx.suppressedFor.token`; rule-API type check enforces tier awareness |
| `rule.explain()` contract (UX-01) | Rule returns `{nb, nn}` but uses teacher jargon (`Akkusativ`, `Partizip`, `copula`) | Explain-contract gate extended with register-readability heuristic — rejects teacher jargon; requires student-register Norwegian |
| CSS dot-colour wiring | New rule id ships without matching `.lh-spell-<id>` class | `check-rule-css-wiring` extended: if `severity` declared, require `.lh-spell-<id>-<severity>` binding |
| papertek-vocabulary sync | Direct edits to `extension/data/*.json` for a "quick fix" | Always edit in papertek-vocabulary → `npm run sync-vocab`; lint asserts `extension/data/` files aren't ahead of API |
| Priority ordering | New rule picks random int that shadows existing triggers | Documented bands in `spell-rules/README.md`; `check-rule-priority-collisions` gate |
| Cross-sentence state (Phase 13) | Module-level `let`/`Map` caching across calls | Hash-keyed derived state; invalidation on content-hash change; release gate simulates edit sequences |
| Benchmark corpus | Adding positive lines without acceptance contrast | New positive lines paired with acceptance sibling-lines that must NOT flag |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| O(n²) structural rules scanning long inputs | Debounce lags on 2000-word paste | Rules scan left-to-right once with pointer cursors, no nested loops | ~1500 words in one paste |
| Re-parsing document on every keystroke (Phase 13) | CPU pegs while typing | Content-hash gate on document-level recompute | 500 words + active typing |
| Rebuilding lookup indexes on preset toggle | Pause when student flips a feature | Build once from unfiltered data (v1.0 fix); preset filter is read-time predicate | Already v1.0 learning — don't regress |
| Benchmark-acceptance gate running full corpus serially in CI | CI time climbs per phase | Parallelize per-language; cache tokenization; "changed rules only" local mode | 1000+ benchmark lines across languages |
| Loading separable-verb / BAGS / trigger lists eagerly at content-script init | Cold-start latency on every page | Lazy-load per-language slice on first keystroke; reuse v1.0 per-language split | Cumulative loaded indexes exceed ~2 MB in memory |

Bundle-size ceiling remains 20 MiB (`check-bundle-size`). Current 10.25 MiB.

---

## Security / Trust Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding a runtime network call "just for one collocation list" | Breaks SC-06 offline promise + landing-page free-offline-forever commitment | `check-network-silence` gate (already live) covers `spell-rules/**` |
| Silent auto-correct after a structural flag | Dyslexia research: silent fixes compound errors; violates explicit v1.0 out-of-scope | Never replace user text programmatically; always require click-to-accept |
| Sending student writing to papertek-vocabulary for "corpus building" | GDPR/Schrems-II; breaks telemetry-free commitment | Explicitly out of scope pending future milestone with legal review; code path must not exist |
| Debug logging of rule inputs in production | Student writing appears in console; screen-share reveals private text | Debug logging behind dev-only flag; never persist |
| chrome.storage.local for rule state across documents | State from one site leaks to another via shared popover | Rule state in-memory per content-script instance; storage only for user preferences |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Identical visual treatment for hard errors and soft hints | Student can't prioritize flags | Two-tier underline (solid=error, dashed=hint) + popover copy prefix |
| Structural flags spanning 10+ tokens underline everything | Visual noise; student can't locate the issue | Underline only the anchor token (finite-verb position, missing-pronoun slot); popover explains the span |
| Grammar-jargon explanations ("agreement mismatch nominative→dative") | Student doesn't learn from the flag | `explain()` uses student Norwegian, references the target-language learning goal |
| No way to dismiss/snooze a structural rule per document | Student writing dialect dialogue sees flags they can't address | Per-document "Ignore this rule here" via Esc-dismiss, backed by in-memory doc state (not persisted without opt-in) |
| New rules ship without in-UI discovery | Student doesn't know new rules exist | First-run notice on phase release: "Nytt: vi sjekker nå for …" in existing first-run UI slot |
| Feature toggle defaults changing between releases | Student's "I turned this off" gets reset | Defaults frozen within a major version; changes require changelog + notification |
| Soft warnings that block text flow visually | Student stops typing mid-sentence to check hints | Hint-tier rules fire at lower priority; popover appears only on hover/focus, never autofocus |

---

## "Looks Done But Isn't" Checklist

Walk this before closing any structural phase.

- [ ] **New structural rule:** `check-fixtures` green — but `check-benchmark-acceptance` green on full language corpus? Ceiling of ≤2 stray flags per 500-word passage held?
- [ ] **New vocab index:** `check-spellcheck-features` extended to cover it under minimal-preset simulation?
- [ ] **Explain contract:** returns `{nb, nn}` — but in student register, not grammar-teacher jargon?
- [ ] **Rule CSS wiring:** dot-colour bound — and if `severity: "hint"`, muted-tier CSS class also bound?
- [ ] **Priority number:** int picked from documented band; `check-rule-priority-collisions` green?
- [ ] **Data additions:** landed in papertek-vocabulary — SCHEMA.md updated with ownership + sibling-repo impact noted?
- [ ] **Benchmark lines:** 80% flipped — and every P1 line flipped? Teacher-eye pass completed?
- [ ] **Cross-sentence state (Phase 13):** rule survives paste+undo+delete sequence in edit-simulator gate?
- [ ] **Quoted-speech / code-block:** sample quote in benchmark does NOT flag?
- [ ] **Feature toggle:** documented in grammar-features JSON for the language; default matches phase plan?
- [ ] **Soft warning:** visually distinguishable from hard errors in Chrome smoke-test (photograph it, compare)?
- [ ] **Rule interaction:** new rule run alongside every existing rule on stress corpus — no silent shadowing?
- [ ] **Hold-out corpus:** rule hit ≥0.80 recall on unseen lines, not just training-visible?
- [ ] **Cross-repo sync:** `papertek-webapps` and `papertek-nativeapps` CIs green after data PR?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| FP avalanche in field | MEDIUM | (a) Flip feature toggle default off; (b) harvest 50+ acceptance cases from reports; (c) narrow rule scope; (d) patch release with gate update |
| Feature-gated index starvation v2 | LOW pre-release, HIGH in field | (a) Extend `check-spellcheck-features`; (b) patch seam routing; (c) re-run fixture + benchmark sweeps; (d) document in CLAUDE.md |
| Discourse-state ghost findings | MEDIUM | (a) Disable Phase 13 rules via toggle; (b) rewrite state layer with content-hash invalidation; (c) ship invalidation gate; (d) re-enable |
| Benchmark overfitting exposed by pilot | MEDIUM | (a) Introduce hold-out corpus for affected phase; (b) measure recall against hold-out; (c) broaden rule to category matching; (d) revalidate |
| Priority collision | LOW | (a) Bump new rule into correct band; (b) add fixture case proving both fire appropriately; (c) extend `check-rule-priority-collisions` |
| papertek-vocabulary schema break | HIGH (3 consumers) | (a) Coordinate rollback across three repos; (b) re-author as additive; (c) update SCHEMA.md; (d) re-release all three |
| FR PP agreement over-firing | LOW if toggle default off | (a) Flip default off; (b) scope to 10.3a window; (c) defer 10.3b |
| Hint-tier CSS missing | LOW | (a) Extend `check-rule-css-wiring` for severity tiers; (b) add `.lh-spell-<id>-hint` classes; (c) patch release |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 FP avalanche on structural rules | Phase 7 (land `check-benchmark-acceptance` gate) | ≤2 stray flags per 500-word benchmark passage |
| #2 Benchmark overfitting | Phase 6 (hold-out corpus rule added to roadmap template) | Hold-out recall ≥0.80, measured independently |
| #3 Feature-gated index starvation v2 | Phase 6 (extend `check-spellcheck-features`) | New index populated under minimal-preset simulation |
| #4 Discourse-state staleness | Phase 13 research step (pre-phase seam change) | `check-stateful-rule-invalidation` passes paste+undo+delete scripts |
| #5 DE case parsing overreach | Phase 8 plan (precision floor ≥0.90; adjacent-article scope) | DE benchmark sweep measures precision before phase closes |
| #6 FR PP agreement eating phase | Phase 10 plan (split 10.3a/10.3b; default toggle off) | 10.3a ships narrow-scope, default-off; 10.3b explicitly deferred |
| #7 Quoted-speech bleed-through | Phase 6 (quotation-span detector; `ctx.suppressedFor.structural`) | Quoted foreign-sentence benchmark lines do NOT flag |
| #8 Hint tier never differentiated | Phase 6 (dashed-underline tier + gate extension) | Chrome smoke-test visually distinguishes hint from error |
| #9 papertek-vocabulary schema drift | Phase 6 (SCHEMA.md ownership model; every phase updates) | Sibling-repo CI green after each data PR |
| #10 Priority collisions | Phase 6 (document bands; `check-rule-priority-collisions`) | Overlapping-span fixture cases produce documented outcomes |
| #11 Zero-transfer language work | Phase 8 (deliver shared `grammar-tables.js` primitive) | Phase 11 consumes Phase 8 primitive; refactor sub-phase otherwise |
| #12 80%-flip fetishism | Phase 6 (P1/P2/P3 labeling) | Phase closure reports P1 recall (target 100%) separately |

---

## Phase-Specific Risk Summary

| Phase | Group | Highest-Risk Pitfall(s) | Prevention Landing This Phase |
|-------|-------|-------------------------|-------------------------------|
| 6 | Register (S, cross-lang) | #7 quotes, #8 hint tier, #9 schema, #10 priority bands, #12 P1/P2/P3 | **Meta-phase:** land infrastructure for 7–16. Benchmark-acceptance gate skeleton, hold-out corpus rule, priority-band doc, hint-tier CSS, quotation-span detector, SCHEMA.md ownership, P-label convention |
| 7 | Word-order (M, NB+DE+FR) | #1 FP avalanche, #2 overfitting (NB V2 is easy to caricature) | `check-benchmark-acceptance` fully green; 2× acceptance cases; hold-out split |
| 8 | DE case (M) | #5 parsing overreach, #11 zero-transfer | Precision floor ≥0.90; adjacent-token scope; deliver shared `grammar-tables.js` primitive |
| 9 | ES (M) | #11 zero-transfer, #5 scope creep on ser/estar decision tree | Consume Phase 8 primitive; cap at ~15 trigger patterns for 9.2 |
| 10 | FR (M) | #6 PP agreement eating phase | Split 10.3a/10.3b; 10.3a default-off toggle |
| 11 | Aspect & mood (L, ES+FR) | #11 zero-transfer, #8 hint tier (aspect legitimately varies) | Phase 11.2 (pretérito vs imperfecto) uses hint tier, not error |
| 12 | Pronoun & pro-drop (M, ES+FR) | #8 hint tier (pro-drop overuse is a hint) | All 12.x rules use hint tier |
| 13 | Register consistency (L, cross-lang) | #4 discourse-state staleness — **highest-risk phase in v2.0** | Research step mandatory; `check-stateful-rule-invalidation` gate; content-hash invalidation |
| 14 | Morphology (M, EN+ES+FR) | #9 schema drift (word-family + irregular-list fields) | SCHEMA.md entry per field; sibling-repo sync check |
| 15 | Collocations (L, cross-lang) | #11 zero-transfer (should share Phase 6.2 seed shape) | Explicit dependency on Phase 6.2's list shape; no re-invention |
| 16 | Tense harmony & discourse (L, aspirational) | #4 discourse-state staleness (cross-sentence tense tracking) | If Phase 13's invalidation protocol didn't generalize, defer to v3.0 — don't duct-tape |

---

## Sources

- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — v1.0 bug taxonomy: SC-01 dead Zipf tiebreaker, feature-gated index starvation, CSS dot-colour wiring gap, modal-verb bare-infinitive silence, dialect-mix framing reversal (Phase 05.1 Gap D). HIGH confidence — direct project evidence.
- `.planning/v2.0-benchmark-driven-roadmap.md` — phase groupings, validation protocol (80% flip rate), cross-cutting constraints. HIGH confidence.
- `.planning/PROJECT.md` — constraints (SC-06 offline, 20 MiB cap, data-logic separation, free-tier commitment). HIGH confidence.
- `CLAUDE.md` — release-gate suite and rationale per gate (fixtures, explain-contract, rule-CSS wiring, feature-independent indexes, network silence, bundle size). HIGH confidence.
- `benchmark-texts/nb.txt` FUTURE/UNPLANNED section — explicit error-class enumeration (V2, register mix, collocations, double definiteness, anglicism, anaphora, hyphen compounds). HIGH confidence.
- `extension/content/spell-rules/*.js` directory — 25 v1.0 rule files, priority distribution, one-file-per-rule convention, `ctx.suppressed` API shape. HIGH confidence.
- User memory: `project_data_source_architecture.md`, `project_nb_nn_no_mixing.md`, `project_data_logic_separation_philosophy.md`, `project_phase5_manual_spellcheck_button.md`, `project_v2_benchmark_roadmap.md`. HIGH confidence.

General heuristic-NLP framing (parse-heuristic false-positive rates, soft-warning UI patterns) is background; every specific pitfall cited maps to project evidence, not general claims. No LOW-confidence items.

---
*Pitfalls research for: v2.0 structural grammar governance on top of per-token spell-check surface*
*Researched: 2026-04-24*
