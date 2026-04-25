# Requirements: Leksihjelp v2.0 — Depth of Coverage

**Defined:** 2026-04-24
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.
**Milestone goal:** Extend spell-check from per-token rules (v1.0) into *structural* errors (word-order, case/agreement governance, aspect/mood, register drift, collocations). Validation anchored to `benchmark-texts/<lang>.txt`.

## v2.0 Requirements

Grouped by capability cluster. Each REQ maps to exactly one phase in ROADMAP.md. Validation = specific benchmark line(s) flip from unflagged → flagged, plus fixture P/R/F1 gates.

### Infrastructure (shared seams + release gates)

- [x] **INFRA-05**: Sentence segmenter available as shared helper (`Intl.Segmenter`-backed) — consumed by every structural rule that needs clause boundaries
- [x] **INFRA-06**: Tagged-token view (POS-aware token stream with finite-verb / subject / adverbial / subordinator slots) available to all word-order and governance rules
- [ ] **INFRA-07**: Document-state two-pass runner (`kind: 'document'` rule type) with explicit invalidation protocol — consumed by all DOC-* rules
- [x] **INFRA-08**: New release gate `check-benchmark-coverage` — measures per-phase benchmark flip-rate with P1/P2/P3 priority weighting; hard gate before phase close
- [x] **INFRA-09**: New release gate `check-governance-data` — mirrors v1.0 feature-independent-index gate; catches vocab sync dropping `aux` / `separable` / `human` / `bags` / trigger flags
- [ ] **INFRA-10**: New release gate `check-stateful-rule-invalidation` — paired self-test for Phase 13 document-state; plants a broken invalidation, gate must fire
- [x] **INFRA-11**: Priority bands in rule registry (P1 hard-flag / P2 warn / P3 hint) with distinct dot-colour tiers in `content.css`; extend `check-rule-css-wiring` TARGETS list
- [x] **INFRA-12**: `rule.severity` field in explain contract (`error` / `warning` / `hint`); extend `check-explain-contract` to require it

### Register, Collocation, Redundancy (Phase 6)

- [x] **REG-01**: Register/formality detector flags colloquialisms in formal prose (EN `gonna`/`wanna`/`ain't`, NB anglicisms `downloade`/`booket`, FR `je sais pas`); opt-in via grammar feature toggle *(Phase 6 Plan 03, 2026-04-24)*
- [x] **REG-02**: Collocation-error detector flags wrong-verb bigrams from a curated `papertek-vocabulary` collocation list (EN seed: `make a photo → take`, `big rain → heavy`); data-only rule *(Phase 6 Plan 03, 2026-04-24)*
- [x] **REG-03**: Stylistic-redundancy detector flags phrase-bank literal matches (`return back`, `free gift`, `future plans`, `past history`); one phrase-bank file per language *(Phase 6 Plan 03, 2026-04-24)*

### Word-Order Violations (Phase 7)

- [x] **WO-01**: NB V2 violation flagged when `<fronted-adv> <subject> <finite-verb>` in main clauses (benchmark `nb.txt` "Hvorfor du tror"); acceptance fixtures for interrogatives, subordinate clauses, V2-compliant inversions
- [x] **WO-02**: DE main-clause V2 violation flagged (benchmark `de.txt` "Letzte montag ich bin gegangen", "Dann ich aufstehe"); shares detection code with WO-01
- [x] **WO-03**: DE subordinate verb-final violation flagged when subordinator (`dass/weil/wenn/ob/…`) + finite verb not at clause end (benchmark `de.txt` "dass er ist nett")
- [x] **WO-04**: FR BAGS adjective placement flagged when BAGS adjective (`bags: true` flag in adjbank, ~40 closed-set) appears post-nominally; acceptance fixture from `"une belle femme"`

### DE Case & Agreement Governance (Phase 8)

- [x] **DE-01**: DE preposition-case governance flagged when next-NP article-form mismatches required case (`mit + dat`, `durch + acc`, two-way preps warn only); data in `papertek-vocabulary` prep table
- [x] **DE-02**: DE separable-verb split flagged when `separable: true` verb used unsplit in main clause (benchmark `de.txt` "ich aufstehe")
- [x] **DE-03**: DE perfekt auxiliary choice flagged when `haben` used with `aux: "sein"` verb (or vice versa)
- [x] **DE-04**: DE compound-noun gender inferred from final component via greedy longest-suffix split against nounbank (benchmark `de.txt` "das Schultasche" pattern)

### ES ser/estar, por/para, Personal "a" (Phase 9)

- [x] **ES-01**: ES ser vs estar flagged by predicate-adjective lookup (`copula: "ser"|"estar"|"both"`); benchmark `es.txt` "Soy cansado"
- [x] **ES-02**: ES por vs para flagged via ~15 trigger-pattern decision tree (duration, deadline, cause, purpose); warn rather than hard-flag; benchmark `es.txt` "para comprar comida por mi familia"
- [x] **ES-03**: ES personal "a" flagged when transitive verb + bare human direct object (`human: true` on pronouns/proper nouns); benchmark `es.txt` "Veo Juan"

### FR Élision, Auxiliary, Participe Passé (Phase 10)

- [x] **FR-01**: FR élision flagged when closed-set clitic (`le/la/je/que/si/ne/me/te/se`) + vowel/silent-h onset without apostrophe (benchmark `fr.txt` "je ai", "si il pleut")
- [x] **FR-02**: FR être vs avoir auxiliary flagged using DR MRS VANDERTRAMP set + pronominal verbs (`aux: "être"` flag on verbbank); benchmark `fr.txt` "j'ai allé"
- [x] **FR-03**: FR participe passé agreement (10.3a scope only) flagged when `avoir` + past participle with *adjacent-window* preceding direct-object pronoun (`la/les/que`); ship behind `grammar_fr_pp_agreement` opt-in toggle; complex corner cases (10.3b) deferred to v3.0

### Aspect & Mood (Phase 11)

- [x] **MOOD-01**: ES subjuntivo trigger rule flags indicative-when-subjunctive-required after closed trigger set (`quiero que`, `espero que`, `dudo que`, `es importante que`, …); benchmark `es.txt` "Quiero que mi hermano viene"
- [x] **MOOD-02**: ES pretérito vs imperfecto (warn-only) on aspectual hints (`ayer/la semana pasada` → pretérito; `mientras/siempre/cada día` → imperfecto); hint-tier severity
- [x] **MOOD-03**: FR subjonctif trigger rule flags indicative-when-subjunctive-required after `il faut que / avant que / bien que / pour que`; benchmark `fr.txt` "Il faut que je parle"

### Pronoun & Pro-Drop (Phase 12)

- [ ] **PRON-01**: ES pro-drop-overuse warn when subject pronoun appears with unambiguous verb agreement; benchmark `es.txt` "yo voy a la playa", "Yo pienso"; hint-tier severity
- [ ] **PRON-02**: ES gustar-class syntax flagged when `sujeto + gustar-class-verb + objeto` pattern; suggest dative restructuring; `gustar_class: true` flag; benchmark `es.txt` "Él no gusta ayudar"
- [ ] **PRON-03**: FR double-pronoun clitic order flagged when clitic cluster violates `me/te/se/nous/vous < le/la/les < lui/leur < y < en` order

### Register Drift Within a Document (Phase 13)

- [ ] **DOC-01**: DE du/Sie drift warn when a single document mixes `du`-address and `Sie`-address forms
- [ ] **DOC-02**: FR tu/vous drift warn (mirror of DOC-01)
- [ ] **DOC-03**: NB bokmål/riksmål mixing warn when paragraph contains riksmål forms (`boken`, `efter`, `sne`) alongside bokmål; `BOKMAL_RIKSMAL_MAP` extension to v1.0 cross-dialect infra
- [ ] **DOC-04**: NN a-infinitiv / e-infinitiv mixing warn when register-text contains both inflection patterns

### Morphology & Agreement Beyond Tokens (Phase 14)

- [ ] **MORPH-01**: EN morphological overgeneration flagged when regular-pattern derivation applied to irregular-flagged verb/noun (`goed`, `runned`, `childs`, `mouses`, `womans`); benchmark `en.txt` "childs", "eated"
- [ ] **MORPH-02**: ES/FR opaque-noun gender flagged when article-noun form mismatches `genus` field (benchmark `fr.txt` "La problème", "un bon humeur")
- [ ] **MORPH-03**: EN word-family POS-slot confusion flagged (`creative/creativity/creation`; `succeed/success/successful`) via closed word-family list + POS-of-slot detection

### Collocations at Scale (Phase 15)

- [ ] **COLL-01**: NB preposition collocations flagged (`flink i → til`, `glad på → i`, `bra i → med`); benchmark `nb.txt` "flink i å gå i bånd"
- [ ] **COLL-02**: DE preposition collocations flagged (parallel to COLL-01, data-driven)
- [ ] **COLL-03**: FR preposition collocations flagged (parallel to COLL-01)
- [ ] **COLL-04**: ES preposition collocations flagged (parallel to COLL-01)

## v3.0 Requirements (Deferred)

Explicitly carried forward to the next milestone cycle. Not in current roadmap.

### Tense harmony & discourse (was Phase 16)

- **TH-01**: Unmotivated past→present tense switches flagged across sentence runs
- **TH-02**: Anaphora ambiguity warn (NB first) when pronoun referent unclear among two matching-gender candidates
- **TH-03**: Long-distance subject–verb agreement flagged across embedded clauses

### Idiomatic literalism (killed from v2.0, curated-only candidate for v3.0)

- **IDI-01**: Idiomatic-literalism curated match (~20-idiom closed list) — only if literal-match keeps FP rate at zero

### FR participe passé corner cases (10.3b)

- **FR-04**: FR PP agreement full corner-case coverage (distance > adjacent window, pronominal verbs with reflexive DO, elided DO) — may or may not be feasible without a real parser

## Out of Scope

Explicitly excluded from v2.0. Documented to prevent scope creep mid-milestone.

| Feature | Reason |
|---------|--------|
| ML-powered structural rewrite / Grammarly-parity LLM suggestions | Breaks SC-06 (offline), breaks free-forever promise (inference cost), breaks deterministic release gates |
| Silent auto-correct (no confirm) | Dyslexia research: silent fixes compound future errors; already in PROJECT.md Out-of-Scope |
| Phase 16 (tense harmony, anaphora, long-distance SV agreement) | Deferred to v3.0 per scope review 2026-04-24; roadmap itself flagged as aspirational |
| 15.3 Idiomatic literalism (open-ended detection) | Requires semantic understanding; FP rate uncontrolled; curated-only variant moved to v3.0 as IDI-01 |
| 10.3b FR PP agreement full corner cases | Moved to v3.0 (FR-04); shippable adjacent-window subset stays as FR-03 |
| Dialect-specific rules beyond NB/NN (nordlandsk, sunnmørsk) | Infinite tail; NB + NN are the official written standards |
| Premium-gating any v2.0 grammar rule | Contradicts public landing-page commitment; already in PROJECT.md Out-of-Scope |
| LLM-assisted explain popover | Breaks SC-06; bundled hand-authored `{nb, nn}` explains stay cheap |
| Hunspell / spellchecker-wasm dependency | NO Hunspell dicts are GPL-2.0 (MIT-incompatible) |
| New runtime npm deps for structural rules | Research confirmed `Intl.Segmenter` + additive `papertek-vocabulary` fields cover every phase; roll-own helpers, no new deps |
| Telemetry on student writing content | GDPR/Schrems-II; minors; breaks trust; anonymous-opt-in is a future-milestone question |
| Cross-sentence style/tone/flow suggestions | English-centric subjectivity; wrong audience for NB students |
| Online-only `skriv.papertek.app` integration | Breaks offline gate; native embedding (memory `project_lexi_in_skriv_integration.md`) is a separate future milestone |
| Changing Firestore schema or vocab API shape | v2.0 is additive-only across all data stores |

## Traceability

Phase mapping populated by `gsd-roadmapper`. Starting phase number: **Phase 6** (v1.0 ended at Phase 5 / 05.1).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-05 | Phase 6 | Complete |
| INFRA-06 | Phase 7 | Complete |
| INFRA-07 | Phase 13 | Pending |
| INFRA-08 | Phase 6 | Complete |
| INFRA-09 | Phase 6 | Complete |
| INFRA-10 | Phase 13 | Pending |
| INFRA-11 | Phase 6 | Complete |
| INFRA-12 | Phase 6 | Complete |
| REG-01 | Phase 6 | Complete (Plan 06-03, 2026-04-24) |
| REG-02 | Phase 6 | Complete (Plan 06-03, 2026-04-24) |
| REG-03 | Phase 6 | Complete (Plan 06-03, 2026-04-24) |
| WO-01 | Phase 7 | Complete |
| WO-02 | Phase 7 | Complete |
| WO-03 | Phase 7 | Complete |
| WO-04 | Phase 7 | Complete |
| DE-01 | Phase 8 | Complete |
| DE-02 | Phase 8 | Complete |
| DE-03 | Phase 8 | Complete |
| DE-04 | Phase 8 | Complete |
| ES-01 | Phase 9 | Complete |
| ES-02 | Phase 9 | Complete |
| ES-03 | Phase 9 | Complete |
| FR-01 | Phase 10 | Complete |
| FR-02 | Phase 10 | Complete |
| FR-03 | Phase 10 | Complete |
| MOOD-01 | Phase 11 | Complete |
| MOOD-02 | Phase 11 | Complete |
| MOOD-03 | Phase 11 | Complete |
| PRON-01 | Phase 12 | Pending |
| PRON-02 | Phase 12 | Pending |
| PRON-03 | Phase 12 | Pending |
| DOC-01 | Phase 13 | Pending |
| DOC-02 | Phase 13 | Pending |
| DOC-03 | Phase 13 | Pending |
| DOC-04 | Phase 13 | Pending |
| MORPH-01 | Phase 14 | Pending |
| MORPH-02 | Phase 14 | Pending |
| MORPH-03 | Phase 14 | Pending |
| COLL-01 | Phase 15 | Pending |
| COLL-02 | Phase 15 | Pending |
| COLL-03 | Phase 15 | Pending |
| COLL-04 | Phase 15 | Pending |

**Coverage:**
- v2.0 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 — traceability populated by gsd-roadmapper (42/42 mapped across Phases 6–15)*
