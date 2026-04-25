# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15 (active; started 2026-04-24)

## Phases

<details>
<summary>✅ v1.0 Spell-Check & Prediction Quality (Phases 1-5 + decimal inserts) — SHIPPED 2026-04-21</summary>

- [x] Phase 1: Foundation — Vocab Seam + Regression Fixture (3/3 plans) — completed 2026-04-18
- [x] Phase 2: Data Layer — Frequency, Bigrams, Typo Bank (5/5 plans) — completed 2026-04-18
- [x] Phase 02.1: Close SC-4 Bundle-Size Cap (INSERTED) (2/2 plans) — completed 2026-04-19
- [x] Phase 3: Rule Architecture & Ranking Quality (5/5 plans) — completed 2026-04-20
- [x] Phase 03.1: Close SC-01 Browser Wiring (INSERTED) (1/1 plan) — completed 2026-04-20
- [x] Phase 4: False-Positive Reduction on NB/NN (3/3 plans) — completed 2026-04-20
- [x] Phase 5: Student Experience Polish (5/5 plans) — completed 2026-04-20
- [x] Phase 05.1: Close UX-01 Gaps from Phase 5 Smoke Test (INSERTED) (5/5 plans) — completed 2026-04-21

See: `.planning/milestones/v1.0-ROADMAP.md` for full phase detail and success criteria.

</details>

### 🚧 v2.0 Depth of Coverage — Grammar Governance Beyond Tokens

- [x] **Phase 6: Structural Infrastructure + Register & Stylistic Polish** — Land the sentence segmenter, priority bands, severity contract, new release gates, and quotation-span suppression; ship register / collocation / redundancy rules as infra validators (completed 2026-04-24)
- [x] **Phase 7: Word-Order Violations (NB + DE + FR)** — Land tagged-token view + syntax-lite helpers; flag V2 violations (NB wh-inversion, DE main-clause / subordinate verb-final) and FR BAGS adjective placement; spike Phase 13 document-state seam shape (completed 2026-04-24)
- [x] **Phase 8: DE Case & Agreement Governance** — Flag preposition-case mismatches (adjacent window), unsplit separable verbs, wrong perfekt auxiliary, and compound-noun gender; deliver shared `grammar-tables.js` primitive (completed 2026-04-24)
- [x] **Phase 9: ES ser/estar, por/para, Personal "a"** — Flag ser/estar misuse via copula tag, por/para via trigger-pattern tree, and missing personal "a" on human direct objects; expose reusable trigger-table shape (completed 2026-04-25)
- [x] **Phase 10: FR Élision, Auxiliary, Participe Passé (10.3a)** — Flag missing élision, wrong être/avoir auxiliary, and PP agreement in adjacent-DO-pronoun window (opt-in toggle, default off); 10.3b deferred to v3.0 (completed 2026-04-25)
- [x] **Phase 11: Aspect & Mood (ES + FR)** — Flag indicative-where-subjunctive-required after closed trigger sets in ES and FR; warn on ES pretérito/imperfecto aspectual hints at hint severity (completed 2026-04-25)
- [x] **Phase 12: Pronoun & Pro-Drop (ES + FR)** — Warn on ES subject-pronoun overuse, flag ES gustar-class syntax errors, flag FR clitic-cluster ordering; all at hint or warn severity (completed 2026-04-25)
- [ ] **Phase 13: Register Drift Within a Document** — Land document-state two-pass runner with stateful-rule-invalidation gate; warn on DE du/Sie drift, FR tu/vous drift, NB bokmål/riksmål mixing, NN a-/e-infinitiv mixing
- [ ] **Phase 14: Morphology Beyond Tokens (EN + ES/FR)** — Flag EN morphological overgeneration (`childs`, `eated`), ES/FR opaque-noun gender mismatch, and EN word-family POS confusion
- [ ] **Phase 15: Collocations at Scale (NB + DE + FR + ES)** — Flag preposition collocation errors in NB, DE, FR, ES via shared collocation-bank shape proven in Phase 6

## Phase Details

### Phase 6: Structural Infrastructure + Register & Stylistic Polish
**Goal**: Land the cross-cutting infrastructure every later phase depends on (sentence segmenter, priority bands, severity contract, quotation suppression, new release gates), and ship the lowest-risk rule family (register / collocation / redundancy) to validate the infrastructure under real rules.
**Depends on**: v1.0 (shipped). No in-milestone dependencies.
**Requirements**: INFRA-05, INFRA-08, INFRA-09, INFRA-11, INFRA-12, REG-01, REG-02, REG-03
**Success Criteria** (what must be TRUE):
  1. `ctx.sentences` is available to every rule via the new segmenter; token-local rules are unaffected and their v1.0 fixture green is preserved.
  2. `benchmark-texts/en.txt` line `"I'm gonna tell you"` flips from unflagged → flagged by the register rule; curated redundancy phrases (`return back`, `free gift`) flip in fixture cases added to each language's corpus; `benchmark-texts/en.txt` EN collocation error (`make a photo`) flips from unflagged → flagged.
  3. Priority bands (P1 hard-flag / P2 warn / P3 hint) are documented in `spell-rules/README.md` with distinct dot-colour tiers in `content.css`; a hint-severity rule renders visually distinct from an error-severity rule in Chrome smoke-test.
  4. New release gates `check-benchmark-coverage` and `check-governance-data` exit 0; `check-rule-css-wiring` TARGETS list extends to cover priority-tier classes; `check-explain-contract` requires `severity` on explain output; `check-spellcheck-features` extends to any new index introduced here.
  5. Quotation-span suppression tier (`ctx.suppressedFor.structural`) is active: a benchmark line wrapping a foreign-language quotation in `"…"` or `«…»` does NOT flag under any Phase 6 rule.
**Plans**: 3 plans
Plans:
- [x] 06-01-PLAN.md — Core infrastructure: sentence segmenter, quotation suppression, severity contract on all rules, priority-band CSS tiers
- [x] 06-02-PLAN.md — New release gates: check-benchmark-coverage + check-governance-data with paired self-tests
- [x] 06-03-PLAN.md — Data-driven rules: REG-01 register + REG-02 collocation + REG-03 redundancy, vocab-seam pipeline, benchmark expectations

### Phase 7: Word-Order Violations (NB + DE + FR)
**Goal**: Ship the first structural rules and the tagged-token view that Phases 8–12/14/15 will reuse; agree (but do not yet build) the Phase 13 document-state seam shape.
**Depends on**: Phase 6 (sentence segmenter, priority bands, severity tier, quotation suppression, `check-benchmark-coverage` skeleton)
**Requirements**: INFRA-06, WO-01, WO-02, WO-03, WO-04
**Success Criteria** (what must be TRUE):
  1. `ctx.getTagged(i)` plus helpers `findFiniteVerb`, `findSubordinator`, `isMainClause` land in `spell-check-core.js` and are consumed by every Phase 7 rule without any rule re-implementing the walk.
  2. `benchmark-texts/nb.txt` lines `"Hvorfor du tror at norsk er lett?"` and `"I går jeg gikk på kino"` flip from unflagged → flagged by the NB V2 rule; interrogative / subordinate acceptance fixtures stay green.
  3. `benchmark-texts/de.txt` lines `"Letzte montag ich bin gegangen zu der supermarkt"`, `"Dann ich aufstehe"`, and `"dass er ist nett"` flip from unflagged → flagged by the DE V2 + verb-final rule.
  4. `benchmark-texts/fr.txt` BAGS acceptance fixture `"une belle femme"` does NOT flag, and a post-nominal BAGS counter-example flips from unflagged → flagged by the FR BAGS rule.
  5. The Phase 13 document-state seam shape (`kind: 'document'`, `checkDocument(ctx, findings)` signature, priority 200+) is documented in `spell-rules/README.md` with no code change; ≥2× acceptance-vs-positive fixture ratio is enforced for every word-order rule by the fixture runner.
**Plans**: 4 plans
Plans:
- [x] 07-01-PLAN.md — Tagged-token view (INFRA-06), POS helpers, fixture ratio enforcement, Phase 13 seam docs
- [x] 07-02-PLAN.md — NB V2 (WO-01) + DE V2 (WO-02) rules with fixtures and benchmark expectations
- [x] 07-03-PLAN.md — DE verb-final (WO-03) + FR BAGS (WO-04) rules with fixtures and benchmark expectations
- [ ] 07-04-PLAN.md — Gap closure: fix nb-v2 false positives, update fixture co-fire expected arrays, add "une belle femme" acceptance

### Phase 8: DE Case & Agreement Governance
**Goal**: Ship DE's four highest-impact structural rules (preposition case, separable-verb split, perfekt auxiliary, compound-noun gender), and deliver the shared `grammar-tables.js` primitive that Phases 9/10/11 will consume.
**Depends on**: Phase 6 (infrastructure), Phase 7 (tagged-token view, `findFiniteVerb`)
**Requirements**: DE-01, DE-02, DE-03, DE-04
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/de.txt` lines `"mit den Schule"`, `"in eine fabrik"`, `"auf einem insel"`, and `"Wegen dem wetter"` flip from unflagged → flagged by the DE prep-case rule; precision on the full DE benchmark acceptance sweep is ≥0.90 (adjacent-article scope only).
  2. `benchmark-texts/de.txt` line `"ich aufstehe"` flips from unflagged → flagged by the DE separable-verb rule; a correct split usage (`"ich stehe um sieben auf"`) does NOT flag.
  3. `benchmark-texts/de.txt` line `"ich habe gegangen"` (haben+sein-verb) flips from unflagged → flagged; correct `"ich bin gegangen"` does NOT flag.
  4. `benchmark-texts/de.txt` pattern `"das Schultasche"` flips from unflagged → flagged by the compound-gender rule via greedy longest-suffix split against nounbank.
  5. `grammar-tables.js` ships with a documented API (preposition-case table, trigger-phrase sets, closed-adjective lists) and is imported by ≥1 non-DE consumer stub (Phase 9/10 prototype) before phase close.
**Plans**: 3 plans
Plans:
- [ ] 08-01-PLAN.md — Shared grammar-tables.js primitive, participleToAux index, DE benchmark additions
- [ ] 08-02-PLAN.md — DE-01 prep-case + DE-02 separable-verb rules with fixtures and release-gate wiring
- [ ] 08-03-PLAN.md — DE-03 perfekt-aux + DE-04 compound-gender rules with fixtures and check-spellcheck-features update

### Phase 9: ES ser/estar, por/para, Personal "a"
**Goal**: Ship Spanish's three closed-trigger structural rules and expose a trigger-table shape that Phase 11's subjuntivo rule will reuse without re-invention.
**Depends on**: Phase 6, Phase 7, Phase 8 (`grammar-tables.js` primitive)
**Requirements**: ES-01, ES-02, ES-03
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/es.txt` line `"Soy cansado"` flips from unflagged → flagged (ser→estar) via predicate-adjective copula-tag lookup; legitimate `ser`/`estar` usage in acceptance fixtures does NOT flag.
  2. `benchmark-texts/es.txt` line `"para comprar comida por mi familia"` flips from unflagged → flagged by the por/para rule (warn severity); closed set of ≤15 trigger patterns is documented in the rule file header.
  3. `benchmark-texts/es.txt` line `"Veo Juan todos los dias"` flips from unflagged → flagged by the personal-"a" rule via `human: true` flag on proper-noun / pronoun entries.
  4. The rule's trigger-table data shape is consumed from `grammar-tables.js` (no local re-implementation); a Phase 11 stub rule reading the same shape passes shape-sanity unit test.
**Plans**: 3 plans
Plans:
- [ ] 09-01-PLAN.md — ES trigger tables in grammar-tables.js, ES subject pronouns in spell-check-core.js, benchmark expectations
- [ ] 09-02-PLAN.md — ES-01 ser/estar copula-adjective mismatch rule with fixtures
- [x] 09-03-PLAN.md — ES-02 por/para + ES-03 personal "a" rules with fixtures, Phase 11 stub shape-sanity (completed 2026-04-25)

### Phase 10: FR Élision, Auxiliary, Participe Passé (10.3a)
**Goal**: Ship French's deterministic structural rules (élision, être/avoir) and a tightly-scoped adjacent-window PP agreement rule behind an opt-in toggle; explicitly defer 10.3b corner cases to v3.0.
**Depends on**: Phase 6, Phase 7, Phase 8 (`grammar-tables.js`, shared `aux` field semantics)
**Requirements**: FR-01, FR-02, FR-03
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/fr.txt` lines `"je ai"`, `"si il pleut"` flip from unflagged → flagged by the élision rule; `"j'ai"`, `"s'il"` acceptance fixtures do NOT flag.
  2. `benchmark-texts/fr.txt` pattern `"j'ai allé"` flips from unflagged → flagged by the être/avoir rule; DR MRS VANDERTRAMP acceptance fixtures (`"je suis allé"`, `"elle est venue"`) do NOT flag.
  3. `grammar_fr_pp_agreement` opt-in toggle defaults OFF; when enabled, an adjacent-window `[DO-pronoun][avoir-form][mis-agreed-PP]` acceptance case flips from unflagged → flagged at precision ≥0.95 on the fixture suite; 10.3b relative-clause cases (`"la pomme que j'ai mangée"`) are documented as deferred.
  4. Release gates (`check-fixtures`, `check-explain-contract`, `check-rule-css-wiring`, `check-benchmark-coverage`, `check-network-silence`) all exit 0 for the three new FR rules.
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md — FR grammar tables, seam fix (buildParticipleToAux for passe_compose), fr-contraction refactor, PP toggle, benchmark lines
- [ ] 10-02-PLAN.md — FR-01 elision + FR-02 etre/avoir rules with fixtures and release gate wiring
- [ ] 10-03-PLAN.md — FR-03 PP agreement rule (opt-in toggle, adjacent-window 10.3a scope) with fixtures

### Phase 11: Aspect & Mood (ES + FR)
**Goal**: Ship subjunctive-trigger rules for ES and FR, and a hint-tier aspectual-adverb rule for ES, all consuming the trigger-table primitive proven in Phases 9/10.
**Depends on**: Phase 6 (hint severity tier), Phase 7 (tagged-token view), Phase 9 (ES trigger-table shape), Phase 10 (FR trigger-table shape)
**Requirements**: MOOD-01, MOOD-02, MOOD-03
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/es.txt` line `"Quiero que mi hermano viene conmigo"` flips from unflagged → flagged (indicative where subjuntivo required) via closed trigger set (`quiero que`, `espero que`, `dudo que`, `es importante que`, …).
  2. `benchmark-texts/fr.txt` line `"Il faut que je parle mieux"` is correctly evaluated by the FR subjonctif trigger rule; a minimal-pair fixture with indicative-after-trigger flips from unflagged → flagged.
  3. ES pretérito/imperfecto rule fires at hint severity only — it renders with the dashed-underline / muted-colour tier from Phase 6, and never fires at error severity on the full `es.txt` benchmark.
  4. All three MOOD rules read from `grammar-tables.js` trigger-table primitive; no rule re-implements the closed-set matcher.
**Plans**: 3 plans
Plans:
- [x] 11-01-PLAN.md — Vocab-seam indexes (subjuntivo/imperfecto/subjonctif), grammar-tables trigger sets, CSS bindings, release gate updates
- [x] 11-02-PLAN.md — MOOD-01 ES subjuntivo + MOOD-02 ES imperfecto-hint rules with fixtures
- [x] 11-03-PLAN.md — MOOD-03 FR subjonctif rule with homophony guard and fixtures

### Phase 12: Pronoun & Pro-Drop (ES + FR)
**Goal**: Ship ES pro-drop-overuse hint, ES gustar-class syntax flagger, and FR double-pronoun clitic-order rule; all must use hint or warn severity (none at error).
**Depends on**: Phase 6 (hint tier), Phase 7 (tagged-token subject detection, clitic cluster detection), Phase 9 (ES trigger infra)
**Requirements**: PRON-01, PRON-02, PRON-03
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/es.txt` lines `"yo voy a la playa"`, `"Yo pienso"`, `"yo fui a la tienda"` flip from unflagged → flagged by the ES pro-drop-overuse rule at hint severity.
  2. `benchmark-texts/es.txt` line `"Él no gusta ayudar"` flips from unflagged → flagged by the gustar-class rule, with suggestion copy proposing dative restructuring (`"A él no le gusta ayudar"`).
  3. A FR acceptance fixture `"je le lui donne"` does NOT flag, while `"je lui le donne"` flips from unflagged → flagged by the FR clitic-order rule using the documented cluster order (`me/te/se/nous/vous < le/la/les < lui/leur < y < en`).
  4. No Phase 12 rule renders with error-tier CSS (visually verified in Chrome smoke-test and asserted by `check-rule-css-wiring` severity check).
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Infra: ES_GUSTAR_CLASS_VERBS table, CSS bindings, manifest wiring (Phase 11+12), release gates, benchmark expectations
- [ ] 12-02-PLAN.md — PRON-01 ES pro-drop + PRON-02 ES gustar rules with fixtures
- [ ] 12-03-PLAN.md — PRON-03 FR clitic-order rule with fixtures

### Phase 13: Register Drift Within a Document
**Goal**: Highest-risk phase in v2.0. Land the document-state two-pass runner with a mandatory pre-phase invalidation-protocol research step, ship the four register-drift rules, and enforce the stateful-rule-invalidation release gate.
**Depends on**: Phase 6 (sentence segmenter, register getters), Phase 7 (document-state seam shape agreed), Phase 8+ (shared data patterns)
**Requirements**: INFRA-07, INFRA-10, DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. Pre-phase research deliverable — invalidation protocol (content-hash keyed, never module-level mutable state) — is documented and reviewed before any rule code lands; the two-pass runner (`kind: 'document'`, `checkDocument(ctx, findings)`) ships in `spell-check-core.js` with priority band 200+.
  2. `check-stateful-rule-invalidation` release gate plus its paired `:test` self-test (plants a broken invalidation, gate must fire) exits 0; scripted edit sequences (type → delete → paste → undo) produce findings that match the final text with no ghost flags.
  3. A DE document mixing `du`- and `Sie`-address forms flips from unflagged → flagged (warn) by DOC-01; a FR document mixing `tu`- and `vous`-address flips by DOC-02; a consistent-register counter-example does NOT flag.
  4. `benchmark-texts/nb.txt` paragraph with `boken`/`efter`/`sne` alongside bokmål forms flips from unflagged → flagged by DOC-03 (bokmål/riksmål mixing), extending v1.0's `CROSS_DIALECT_MAP` into a `BOKMAL_RIKSMAL_MAP` sibling.
  5. A NN text mixing `-a` and `-e` infinitives within a single register-text flips from unflagged → flagged by DOC-04; a consistent-register NN fixture does NOT flag.
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Infra: ES_GUSTAR_CLASS_VERBS table, CSS bindings, manifest wiring (Phase 11+12), release gates, benchmark expectations
- [ ] 12-02-PLAN.md — PRON-01 ES pro-drop + PRON-02 ES gustar rules with fixtures
- [ ] 12-03-PLAN.md — PRON-03 FR clitic-order rule with fixtures

### Phase 14: Morphology Beyond Tokens (EN + ES/FR)
**Goal**: Ship three morphology-governance rules that catch errors token-local v1.0 rules can't: EN overgeneration of regular patterns, ES/FR article-noun gender mismatch on opaque nouns, and EN word-family POS confusion.
**Depends on**: Phase 6 (infrastructure), Phase 7 (tagged-token view for POS-slot detection)
**Requirements**: MORPH-01, MORPH-02, MORPH-03
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/en.txt` lines containing `"childs"`, `"eated"`, `"clothe for childrens"`, `"i still makes"`, `"when i writes"` flip from unflagged → flagged by the EN morphological-overgeneration rule via closed irregular-forms list from `papertek-vocabulary`.
  2. `benchmark-texts/fr.txt` lines `"La problème"` and `"un bon humeur"` flip from unflagged → flagged by the opaque-noun gender rule; correct `"le problème"`, `"une bonne humeur"` acceptance fixtures do NOT flag.
  3. EN word-family rule flags `"i have improve"` (noun-in-verb-slot) via closed word-family list and tagged-token POS-slot detection; rule acceptance fixtures covering all four family slots (noun / verb / adj / adv) stay green.
  4. All new vocab indexes (`getIrregularForms`, `getWordFamily`) are registered with `check-spellcheck-features` and `check-governance-data`, which exit 0 under minimal-preset simulation.
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Infra: ES_GUSTAR_CLASS_VERBS table, CSS bindings, manifest wiring (Phase 11+12), release gates, benchmark expectations
- [ ] 12-02-PLAN.md — PRON-01 ES pro-drop + PRON-02 ES gustar rules with fixtures
- [ ] 12-03-PLAN.md — PRON-03 FR clitic-order rule with fixtures

### Phase 15: Collocations at Scale (NB + DE + FR + ES)
**Goal**: Scale the Phase 6 EN-collocation-seed pattern into full preposition-collocation coverage across NB, DE, FR, ES; data-heavy, reuses existing rule shape.
**Depends on**: Phase 6 (`getCollocationBank` shape proven), Phase 8/9/10 (language-specific trigger-table conventions)
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04
**Success Criteria** (what must be TRUE):
  1. `benchmark-texts/nb.txt` line `"flink i å gå i bånd"` flips from unflagged → flagged by the NB preposition-collocation rule suggesting `flink til`; `glad i`, `bra med` acceptance fixtures do NOT flag.
  2. DE, FR, ES preposition-collocation rules each ship with ≥30 positive + ≥15 acceptance fixtures per language, all consuming the same `collocationbank` data shape introduced in Phase 6.
  3. No Phase 15 rule introduces a new trigger-list shape; code review confirms all four rules are ≤50 LOC wrappers over the shared data shape.
  4. Bundle-size gate stays green (≤20 MiB) after the four expanded collocation banks land; `check-network-silence` stays green for all new rule files.
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Infra: ES_GUSTAR_CLASS_VERBS table, CSS bindings, manifest wiring (Phase 11+12), release gates, benchmark expectations
- [ ] 12-02-PLAN.md — PRON-01 ES pro-drop + PRON-02 ES gustar rules with fixtures
- [ ] 12-03-PLAN.md — PRON-03 FR clitic-order rule with fixtures

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation (Vocab Seam + Regression Fixture) | v1.0 | 3/3 | Complete | 2026-04-18 |
| 2. Data Layer (Frequency, Bigrams, Typo Bank) | v1.0 | 5/5 | Complete | 2026-04-18 |
| 02.1 Close SC-4 Bundle-Size Cap (INSERTED) | v1.0 | 2/2 | Complete | 2026-04-19 |
| 3. Rule Architecture & Ranking Quality | v1.0 | 5/5 | Complete | 2026-04-20 |
| 03.1 Close SC-01 Browser Wiring (INSERTED) | v1.0 | 1/1 | Complete | 2026-04-20 |
| 4. False-Positive Reduction on NB/NN | v1.0 | 3/3 | Complete | 2026-04-20 |
| 5. Student Experience Polish | v1.0 | 5/5 | Complete | 2026-04-20 |
| 05.1 Close UX-01 Gaps from Phase 5 Smoke Test (INSERTED) | v1.0 | 5/5 | Complete | 2026-04-21 |
| 6. Structural Infrastructure + Register & Stylistic Polish | v2.0 | 3/3 | Complete | 2026-04-24 |
| 7. Word-Order Violations (NB + DE + FR) | v2.0 | 4/4 | Complete | 2026-04-24 |
| 8. DE Case & Agreement Governance | v2.0 | 3/3 | Complete | 2026-04-24 |
| 9. ES ser/estar, por/para, Personal "a" | v2.0 | 3/3 | Complete | 2026-04-25 |
| 10. FR Élision, Auxiliary, Participe Passé (10.3a) | v2.0 | 3/3 | Complete | 2026-04-25 |
| 11. Aspect & Mood (ES + FR) | v2.0 | 3/3 | Complete | 2026-04-25 |
| 12. Pronoun & Pro-Drop (ES + FR) | 3/3 | Complete    | 2026-04-25 | — |
| 13. Register Drift Within a Document | v2.0 | 0/? | Not started | — |
| 14. Morphology Beyond Tokens (EN + ES/FR) | v2.0 | 0/? | Not started | — |
| 15. Collocations at Scale (NB + DE + FR + ES) | v2.0 | 0/? | Not started | — |

## Cross-Cutting Constraints (inherited from v1.0)

Every v2.0 phase must satisfy, on every release:

- **SC-06 network silence** — `check-network-silence` exits 0 (no `fetch/XHR/beacon/http(s)://` under `spell-check*.js`, `spell-rules/**`, `word-prediction.js`).
- **Bundle size ≤ 20 MiB** — `check-bundle-size` exits 0.
- **Data-driven vs function-driven decision** — every phase plan must explicitly answer, per rule: *is this data or is this logic?* Heavy data (prepositions, trigger sets, BAGS adjectives, irregular forms, collocations, phrase banks, copula tags, aux choice, `human`/`separable`/`gustar_class` flags) belongs in `papertek-vocabulary` and is authored there via cross-repo PR before the rule lands. Logic (detection, scoring, ranking, decision trees over triggers, tagged-token walks) belongs in this repo. Closed classes that are stable for decades (e.g. the 7 NB modal verbs) stay inline per `project_data_logic_separation_philosophy.md` — don't extract just to satisfy symmetry. Every rule-landing PR must name the matching papertek-vocabulary PR (or declare "no data component").
- **Explain + CSS + severity contract** — every popover-surfacing rule ships with `explain() => {nb, nn, severity}`, a `.lh-spell-<id>` (and if hint-tier, `.lh-spell-<id>-hint`) CSS dot-colour binding, and paired self-tests; `check-explain-contract` + `check-rule-css-wiring` + their `:test` self-tests all exit 0.
- **Fixture gate** — `check-fixtures` exits 0 on every release; new structural rules ship with ≥30 positive + ≥15 acceptance fixtures per language (≥2× acceptance vs positive ratio mandated from Phase 7 onward).
- **Feature-gated index parity** — `check-spellcheck-features` extended for every new index; spell-check lookup indexes built from the unfiltered superset.
- **Benchmark-driven closure** — phase closes when `check-benchmark-coverage` reports 100% P1 flip, ≥80% P2 flip, ≥50% P3 flip on the relevant `benchmark-texts/<lang>.txt` lines; bare percentages are not sufficient.

---
*Roadmap updated: 2026-04-25 — Health repair: marked phases 6–9 complete, fixed progress table, removed stale plan listings from phases 12–15.*
