# Feature Research — v2.0 Structural Grammar Governance

**Domain:** Offline grammar-check surface for Norwegian students writing NB/NN/DE/ES/FR/EN
**Researched:** 2026-04-24
**Confidence:** HIGH (grounded in shipped v1.0 infrastructure + user-authored benchmark corpus; MEDIUM on a few phases the roadmap itself flags as aspirational)

> **Scope note:** This file supersedes the v1.0 feature research dated 2026-04-17 for the purposes of the v2.0 milestone. v1.0 validated capabilities (dictionary, TTS, word-prediction, per-token spell-check) are already shipped and are **not re-researched**. The question here is: *what structural-grammar features should v2.0 add, in what categories, with what dependencies on the shipped v1.0 rule infrastructure?*

## How Students Typically Make These Errors

The target user is a Norwegian secondary-school student writing a foreign
language. Their error profile is **transfer-dominated**: they apply NB
mental grammar to DE/ES/FR/EN and miss closed-class morphology the NB
system doesn't have (case, subjunctive, aspect, BAGS placement). The
benchmark passages at `benchmark-texts/*.txt` were hand-authored to
reproduce exactly that — every promised-to-flag line is a plausible
mid-intermediate-learner artefact, not a stress test.

Shared traits across the corpus:

- **Syntactic transfer** is the single richest error class. NB V2
  gets dropped when writing EN, and conversely NB V2 is broken by
  EN interference ("Hvorfor du tror" in the NB benchmark). DE
  subordinate verb-final is the inverse failure mode and shows up in
  every DE benchmark paragraph.
- **Closed-class governance failures** (DE case after prep, ES
  ser/estar, FR auxiliary choice, FR participe passé agreement) are
  the highest error-density items per token. They're also the most
  tractable for a lookup-driven rule — trigger sets are finite and
  authored once in `papertek-vocabulary`.
- **Register drift** (du/Sie, tu/vous, bokmål/riksmål, a-inf/e-inf)
  never fails *per-token* — each individual form is legal. It fails
  at the *document* level when two legal registers appear in one
  text. This is a fundamentally different detection mode from
  everything v1.0 ships and needs its own document-state seam.
- **Morphology overgeneration** (EN `goed/childs/mouses`, DE
  `ich aufstehe`, ES `yo gusto`) follows from applying a productive
  pattern to a lexical exception. Cheap to flag: check if the surface
  form is a regular-pattern derivation of a word that carries an
  irregular-override flag.
- **Aspect/mood selection** (ES pretérito/imperfecto, subjuntivo,
  FR subjonctif) is the hardest category. Triggers are closed
  (`quiero que`, `il faut que`, `ayer`, `mientras`), but the rule
  has to warn rather than hard-flag because legitimate variation
  exists.

**Expected spell-check behaviour (inherited from v1.0):**
offline + deterministic + non-rewriting. A rule fires → a coloured
dot marks the token(s) → click reveals a student-friendly
`{nb, nn}` explainer + top-3 suggestions + "Vis flere". Structural
rules have to fit that UI — which means picking a *canonical anchor
token* per finding (not highlighting the whole clause). That
constraint is the single biggest UX implication of Phases 7, 11, 13,
and 16.

## Feature Landscape

### Table Stakes (Students Expect These; Competing Extensions Ship Them)

Students using LanguageTool, Grammarly-free, or the Bing Editor
assume these categories work. Missing them makes v2.0 feel regressed
vs a shipped competitor, even though the brand angle is offline-first.

| Feature | Phase | Why Expected | Complexity | Notes |
|---------|-------|--------------|------------|-------|
| **DE preposition-case governance** | 8.1 | Flagship rule in LanguageTool DE; most student errors are prep-case | M | Data: `papertek-vocabulary` prep table with `case: "dat"\|"acc"\|"gen"\|"two-way"`; rule: next-NP article-form check. Flips `de.txt` "mit den Schule", "in eine fabrik", "auf einem insel", "Wegen dem wetter" |
| **DE separable-verb split** | 8.2 | High-frequency NB-student error; every classroom covers `aufstehen`/`mitkommen` | S | Additive `separable: true` flag on verbbank. Rule detects unsplit sep-verb in main clause. Flips `de.txt` "ich aufstehe" |
| **DE perfekt auxiliary (haben vs sein)** | 8.3 | Textbook grammar point; closed verb list | S | `aux: "sein"` flag on movement/state-change verbs |
| **DE compound-noun gender from last component** | 8.4 | NB students consistently gender compounds on first stem | M | Compound splitter + fallback to last-component gender. Flips `de.txt` "das Schultasche" pattern |
| **ES ser vs estar** | 9.1 | Number-one ES classroom distinction; benchmark "Soy cansado" | M | Predicate-adjective list with `copula: "ser"\|"estar"\|"both"`. Closed set ~200 entries |
| **ES por vs para** | 9.2 | Second-most-taught ES distinction; benchmark "comida por mi familia" + "por leer" | M | Decision tree over ~15 trigger patterns. Warn, don't hard-flag |
| **ES personal "a"** | 9.3 | Finite human-object rule; distinctive mark of Spanish | S | `human: true` flag on pronouns/proper nouns. Rule: transitive verb + bare human DO → missing `a` |
| **FR élision** | 10.1 | Deterministic; every FR textbook teaches it | S | Closed list `{le, la, je, que, si, ne, me, te, se}` + vowel/silent-h onset detection |
| **FR être vs avoir auxiliary** | 10.2 | DR MRS VANDERTRAMP is named in FR pedagogy; benchmark "je ai" → "j'ai" | S | `aux: "être"` flag on verbbank |
| **NB V2 word-order** | 7.1 | Most common NB structural error in wh-questions + fronted adverbials; benchmark "Hvorfor du tror" | M-L | High FP risk. Conservative trigger: wh-word / temporal adv at position 0 + subject + finite verb. Heavy acceptance-fixture budget |
| **EN morphological overgeneration** | 14.1 | Every EN teacher's "top 10 NB-student errors" list; benchmark "childs", "eated" | S | Irregular-verb + irregular-plural lists in papertek |
| **Stylistic redundancy** | 6.3 | Trivially detectable; high perceived value per LOC | S | Literal-match list per language: `return back`, `free gift`, `future plans` |

### Differentiators (Competitive Advantage — Set Leksihjelp Apart)

Features that match or beat competitors on coverage but add value
unique to the Leksihjelp brand: offline-first, NB-student-centric,
dyslexia-supportive, free forever.

| Feature | Phase | Value Proposition | Complexity | Notes |
|---------|-------|-------------------|------------|-------|
| **NB bokmål/riksmål drift** | 13.3 | No competitor ships this — it's a Norwegian-in-Norwegian problem; directly serves the "elever med dysleksi" brand | L | Document-level state: collect norm markers per paragraph (`boken` vs `boka`, `efter` vs `etter`, `sne` vs `snø`), flag when both appear. Requires new cross-sentence state seam |
| **NN a-infinitiv / e-infinitiv drift** | 13.4 | Zero competitors ship it; very NN-specific | M | NN-infinitive classification from papertek verbbank (carry-over debt already tracked: "NN phrase-infinitive triage ~214 entries") |
| **FR BAGS adjective placement** | 7.3 | Closed-set (~40 adjs) rule; most grammar tools miss it or warn instead of flag | S-M | `bags: true` flag on adjbank |
| **ES subjuntivo triggers** | 11.1 | Closed trigger set makes this cheap; most free tools don't cover it | M | Trigger list `{quiero que, espero que, dudo que, es importante que, …}` + embedded-verb inflection check. Reuses existing conjugation data. Flips `es.txt` "Quiero que mi hermano viene" |
| **FR subjonctif triggers** | 11.3 | Mirror of 11.1; benchmark "Il faut que je parle mieux" | M | Trigger list `{il faut que, avant que, bien que, pour que}` + verb form check |
| **FR participe passé agreement with preceding DO** | 10.3 | The famously hard rule; shipping it offline + free is a brand statement | L | DO-pronoun detection (`la/les/que`) preceding `avoir` + past participle. Ship behind `grammar_fr_pp_agreement` toggle so strict-threshold students can opt out |
| **NB preposition collocations** | 15.1 | `glad i` vs `glad på`, `flink til` vs `flink i` — tight NB lexical governance; benchmark "flink i å gå" | S-M | Literal-match list in papertek (new `collocationbank` or extended generalbank). Data-driven |
| **ES pro-drop overuse** | 12.1 | Distinctive NB-to-ES transfer pattern; benchmark every sentence-initial `yo` | S | Subject-pronoun + finite verb where agreement is unambiguous → soft flag |
| **ES gustar-class syntax** | 12.2 | Deeply systematic error; ~30 gustar-class verbs; benchmark "Él no gusta ayudar" | M | `gustar_class: true` flag. Suggest dative restructuring |
| **DE/FR/ES preposition collocation governance** | 15.2 | Parallel to 15.1 at scale; lookup-driven | M (×3) | Depends on Phase 6.2 proving the pattern. Data-authoring cost is real |
| **Collocation errors (EN seed)** | 6.2 | "make a photo → take"; competitor coverage exists but is spotty | M | Curated bigram list. Start EN (highest NB-student base), expand language-by-language |
| **Register/formality detector** | 6.1 | Matches brand + teaches good writing habits | S-M | Closed vocabulary lists per language + sentence-level formality heuristic (punctuation, length). Opt-in toggle. Flips `en.txt` "gonna" and `nb.txt` anglicism leakage |
| **DE du/Sie + FR tu/vous register drift** | 13.1 + 13.2 | Document-level; reuses 13.3/13.4 seam | M (×2) | Build seam once in Phase 13, reuse across all four sub-rules |
| **ES/FR opaque-noun gender** | 14.2 | `le problème`, `la voiture`; NB students default to -e→fem | S | Already supported by `genus` field; article-noun mismatch rule. Flips `fr.txt` "La problème", "un bon humeur" |
| **EN word-family confusion** | 14.3 | `creative/creativity/creation`; `succeed/success/successful` | M | Closed family list in papertek + POS-of-slot detection |
| **FR double-pronoun clitic order** | 12.3 | `je le lui donne` vs `je lui le donne`; closed cluster | M | Cluster detection + permutation check against fixed order |
| **DE V2 + subordinate verb-final** | 7.2 | Classic NB-student DE error; benchmark "dass er ist nett", every main-clause V2 miss in `de.txt` | M | Shares syntactic reasoner with 7.1. Trigger on subordinator set `{dass, weil, wenn, ob, obwohl, damit, …}` |

### Anti-Features (Commonly Requested, Out-of-Scope or Actively Harmful)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-correct / silent rewrite** | "Grammarly does it, just fix my text" | Dyslexia research: silent fixes compound future errors. Already Out-of-Scope in PROJECT.md | Show candidate, require click — v1.0 pattern holds |
| **ML-powered structural rewrite (Grammarly parity)** | LLM marketing drives expectation | Breaks offline (SC-06), breaks free-forever promise (inference costs), breaks deterministic release gate | Deterministic rules only — roadmap enforces |
| **Phase 16 (tense harmony + anaphora + long-distance agreement)** | Would complete "full grammar-check" promise | Requires cross-sentence NLP that heuristics handle badly; high FP risk destroys trust; roadmap itself flags as "aspirational, may defer to v3.0" | Ship Phases 6–15; revisit each Phase-16 sub-rule individually only if it crosses an FP threshold |
| **Idiomatic-literalism detection (15.3, "katter og hunder")** | Cute demo, memorable | Idiom detection requires semantic understanding; FP rate on creative writing is high; roadmap itself says "scope TBD" | Curated closed list of ~20 idioms, exact-match only. Skip open-ended detection |
| **Dialect-specific rules beyond NB/NN (nordlandsk, sunnmørsk)** | Teacher regional-coverage requests | Infinite tail; already Out-of-Scope in roadmap | NB + NN official written standards only |
| **Premium-gating any v2.0 grammar rule** | Obvious monetisation play | Contradicts landing-page public commitment; breaks trust; Out-of-Scope in PROJECT.md | Keep funding via TTS quota (ElevenLabs cost centre) |
| **LLM-assisted explain popover ("why is this wrong")** | Richer explanations | Online call per flag; privacy concern on student writing; explain() contract is deterministic by design | Expand hand-authored `{nb, nn}` explains; bundle cost is tiny |
| **Hunspell / spellchecker-wasm dependency** | "Why reinvent the wheel?" | All mature NO Hunspell dicts are GPL-2.0 — incompatible with MIT promise. Also: structural rules are the point, not base spelling | Roll-own — already proven in NB/NN at ~180 LOC |
| **Grammar-check as online-only skriv.papertek.app integration** | "Students already work in skriv" | Online integration breaks offline gate | Native embedding via shared local code (tech-debt `project_lexi_in_skriv_integration.md`) — not an API |
| **Telemetry on student writing content** | "Would drive quality improvements" | GDPR/Schrems-II; minors; breaks trust | Anonymous opt-in belongs in future milestone with legal review |
| **Cross-sentence / discourse style suggestions (tone, flow)** | Grammarly marketing | English-centric subjectivity; wrong audience; risks teaching register mismatches | Do not build for student audience |

## Feature Dependencies

```
v1.0 Plugin Rule Architecture (INFRA-03, shipped)
    │
    ├──enables──> Phase 6 (Register + Collocation + Redundancy)
    │                 │
    │                 └──proves──> Phase 15 (Collocations at scale)
    │
    ├──enables──> Phase 7 (Word-order)           [shared: light syntactic reasoner]
    │                 ├── 7.1 NB V2
    │                 ├── 7.2 DE V2 + verb-final
    │                 └── 7.3 FR BAGS
    │
    ├──enables──> Phase 8 (DE case/agreement)   [DE-siloed]
    │                 ├──requires──> papertek verbbank `separable`/`aux` flags
    │                 └──requires──> papertek prepbank with case map
    │
    ├──enables──> Phase 9 (ES ser/estar, por/para, personal a)  [ES-siloed]
    │                 │
    │                 └──gates──> Phase 11 (ES subjuntivo, aspect)
    │                                 └── reuses Phase 9 trigger-detection infra
    │
    ├──enables──> Phase 10 (FR élision, aux, PP agreement)   [FR-siloed]
    │                 │
    │                 └──gates──> Phase 11 (FR subjonctif)
    │                                 └── reuses Phase 10 trigger-detection infra
    │
    ├──enables──> Phase 12 (ES/FR pronoun)
    │                 └──requires──> Phase 9/10 closed-class infra
    │
    ├──requires──> [NEW] Document-state seam
    │                 ├──enables──> Phase 13 (all 4 register-drift rules)
    │                 └──enables──> Phase 16 (tense harmony, anaphora) — if ever
    │
    └──enables──> Phase 14 (EN/ES/FR morphology)
                      └──requires──> papertek irregular-lists

v1.0 __lexiVocab seam (INFRA-01) ──feeds──> every phase's lookup
v1.0 check-fixtures gate (INFRA-02) ──enforces──> every phase's P/R/F1
v1.0 explain() + CSS wiring gates (UX-01) ──enforces──> every popover rule
v1.0 check-spellcheck-features gate ──enforces──> feature-gated lookup parity
v1.0 check-network-silence gate ──enforces──> SC-06 for every new rule
```

### Dependency Notes

- **Phase 6 is the opening phase because** it reuses 100% of v1.0
  infrastructure (literal lookup + explain popover + CSS dot).
  Zero new seams. Validates roadmap velocity before committing to
  Phase 7's harder work.
- **Phase 7.1 and 7.2 share a light syntactic reasoner.** Build
  it in 7.1 (NB) first because fixture density is highest there;
  reuse in 7.2 (DE). 7.3 (FR BAGS) is independent and can run
  parallel.
- **Phases 8, 9, 10 are language-siloed and independent.** They
  can ship in any order or in parallel. Recommend Phase 8 first
  because DE has the highest error-density per benchmark token.
- **Phase 11 gates behind Phases 9 and 10** because it reuses their
  trigger-detection infrastructure. Violating this = duplicated
  closed-class lookup code.
- **Phase 13 is the seam-change phase.** Every preceding phase
  fires per-token or per-clause. Phase 13 needs a document-level
  state collector (per-paragraph and per-document norm markers).
  Introduce the seam *in* Phase 13; don't retrofit later.
- **Phase 15 depends on Phase 6.2** proving the curated-collocation-list
  pattern works before scaling to four languages.
- **Phase 16 is conditional.** If Phase 13's seam generalises
  cleanly to tense-tracking, Phase 16 becomes feasible. If not,
  defer to v3.0 — roadmap explicitly allows this.
- **Every phase depends on `papertek-vocabulary`** data authoring.
  The data-authoring queue is a real bottleneck; requirements
  phase should identify which papertek schema changes each phase
  needs and open them as data-track tickets early.

## MVP Definition (for v2.0 Milestone)

### Launch With (v2.0.0 — Phase 6 only)

Minimum that validates the v2.0 theme and proves benchmark-driven
release works. Ships fast, reuses v1.0 infra.

- [ ] **Register/formality detector (6.1)** — EN + NB closed lists; proves opt-in toggle pattern
- [ ] **Collocation errors EN seed (6.2)** — ~50 curated EN verb+object pairs; proves data-bigram rule shape
- [ ] **Stylistic redundancy (6.3)** — ~20 per language literal matches; highest ROI per LOC
- [ ] **Benchmark validation**: `en.txt` "gonna" + `nb.txt` anglicism leakage flip from unflagged → flagged

### Add After Validation (v2.1 — Phases 7, 8, 9, 10, 14.1)

Language-specific structural coverage, siloed so each can ship alone.

- [ ] **Phase 8 (DE case + separable + aux + compound gender)** — highest error-density; strong NB learner base
- [ ] **Phase 9 (ES ser/estar + por/para + personal a)** — closed-trigger, paper-tractable
- [ ] **Phase 10 (FR élision + aux)** — 10.1 + 10.2 easy; defer 10.3 (PP agreement) to v2.2 behind toggle
- [ ] **Phase 7 (NB + DE + FR word-order)** — structural reasoner; budget generous acceptance fixtures
- [ ] **Phase 14.1 (EN morphological overgeneration)** — low-cost, high-impact
- [ ] **Benchmark validation target**: 80% of promised-lines flip per-language

### Future Consideration (v2.2+ — Phases 10.3, 11, 12, 13, 14.2/14.3, 15)

Larger structural bets. Each is its own minor release once preceding
infra lands.

- [ ] **Phase 10.3 (FR PP agreement)** — toggle-gated; ship when fixture bank stable
- [ ] **Phase 11 (aspect + mood)** — requires Phase 9/10 trigger infra
- [ ] **Phase 12 (ES/FR pronoun)** — requires Phase 9/10
- [ ] **Phase 13 (register drift within text)** — requires new document-state seam; hardest seam change in v2.0
- [ ] **Phase 14.2 / 14.3 (opaque gender, word-family)** — parallel to Phase 11/12
- [ ] **Phase 15 (collocation bank at scale)** — requires Phase 6.2 as pattern proof

### Out of v2.0 Scope (Defer v3.0 or Kill)

- [ ] **Phase 16 (tense harmony + anaphora + long-distance agreement)** — defer unless one sub-rule independently passes FP threshold
- [ ] **15.3 Idiomatic-literalism detection** — kill unless curated-only
- [ ] **Leksi-in-skriv native embedding** — owns its own milestone

## Feature Prioritization Matrix

| Feature | Student Impact | Implementation Cost | Priority |
|---------|----------------|---------------------|----------|
| 6.3 Stylistic redundancy | MEDIUM | LOW | P1 |
| 6.1 Register/formality | MEDIUM | LOW | P1 |
| 6.2 Collocation errors EN | HIGH | MEDIUM | P1 |
| 8.1 DE prep-case governance | HIGH | MEDIUM | P1 |
| 8.2 DE separable verbs | HIGH | LOW | P1 |
| 8.3 DE perfekt aux | MEDIUM | LOW | P1 |
| 8.4 DE compound gender | MEDIUM | MEDIUM | P1 |
| 9.1 ES ser/estar | HIGH | MEDIUM | P1 |
| 9.2 ES por/para | HIGH | MEDIUM | P1 |
| 9.3 ES personal "a" | MEDIUM | LOW | P1 |
| 10.1 FR élision | MEDIUM | LOW | P1 |
| 10.2 FR être/avoir | HIGH | LOW | P1 |
| 14.1 EN morphological overgeneration | HIGH | LOW | P1 |
| 7.1 NB V2 | HIGH | MEDIUM-HIGH | P2 |
| 7.2 DE V2 + verb-final | HIGH | MEDIUM | P2 |
| 7.3 FR BAGS | MEDIUM | LOW-MEDIUM | P2 |
| 10.3 FR PP agreement (toggle) | MEDIUM | HIGH | P2 |
| 11.1 ES subjuntivo | HIGH | MEDIUM | P2 |
| 11.3 FR subjonctif | HIGH | MEDIUM | P2 |
| 14.2 ES/FR opaque gender | MEDIUM | LOW | P2 |
| 14.3 EN word-family | MEDIUM | MEDIUM | P2 |
| 12.1 ES pro-drop overuse | MEDIUM | LOW | P2 |
| 12.2 ES gustar-class | MEDIUM | MEDIUM | P2 |
| 11.2 ES pretérito/imperfecto | MEDIUM | MEDIUM | P2 |
| 13.3 NB bokmål/riksmål drift | HIGH (brand-distinctive) | HIGH | P2 |
| 13.4 NN a-inf/e-inf drift | MEDIUM (brand-distinctive) | MEDIUM | P2 |
| 13.1 DE du/Sie drift | MEDIUM | MEDIUM | P3 |
| 13.2 FR tu/vous drift | MEDIUM | MEDIUM | P3 |
| 12.3 FR clitic order | MEDIUM | MEDIUM | P3 |
| 15.1 NB prep collocations | HIGH | MEDIUM | P3 |
| 15.2 DE/FR/ES prep collocations | MEDIUM | MEDIUM (×3) | P3 |
| 15.3 Idiomatic literalism | LOW (risk) | HIGH | defer/kill |
| 16.1 Tense harmony | LOW-MEDIUM (FP risk) | HIGH | defer v3.0 |
| 16.2 Anaphora ambiguity | LOW (FP risk) | HIGH | defer v3.0 |
| 16.3 Long-distance SV agreement | MEDIUM | HIGH | defer v3.0 |

**Priority key:**
- P1 — v2.0 MVP + immediate next (Phases 6, 8, 9, 10-lite, 14.1)
- P2 — v2.1 / v2.2 release candidates (Phases 7, 10.3, 11, 13.3/13.4, 12, 14.2/14.3)
- P3 — later release or scope-reduce (Phases 12.3, 13.1/13.2, 15)

## Dependencies on Existing v1.0 Rule Infrastructure

Every v2.0 phase rides on shipped v1.0 infrastructure. The mapping:

| v1.0 Infrastructure | v2.0 Phases That Need It | Change Required? |
|---------------------|---------------------------|-------------------|
| `__lexiVocab` shared seam (INFRA-01) | All phases | No — additive reads only |
| Plugin rule architecture (INFRA-03, one-file-per-rule) | All phases | No — same pattern |
| `check-fixtures` P/R/F1 gate (INFRA-02) | All phases | Extend fixture bank per language; thresholds table grows |
| `explain()` + CSS dot-colour contract (UX-01) | All popover-surfacing phases | New CSS class per new rule; extend `check-explain-contract` + `check-rule-css-wiring` TARGETS lists |
| `check-spellcheck-features` (feature-gated indexes) | Any phase that gates on a grammar-feature toggle | Extend predicates per new feature |
| `check-network-silence` (SC-06) | All phases | No — additive scan paths |
| `check-bundle-size` (20 MiB cap) | Especially Phase 15 (collocation lists), 14 (irregular lists) | No structural change, but data growth budget tracked |
| `papertek-vocabulary` data source | Every phase with a data lookup | Schema extension per phase: `aux`, `separable`, `copula`, `human`, `gustar_class`, `bags`, `trigger_subjuntivo`, … All additive |
| `chrome.storage.local.enabledGrammarFeatures` | Phases with opt-in (6.1, 10.3, 13.x, 11.2) | Add feature IDs to `grammarfeatures-{lang}.json` |
| Frequency-aware ranking tables (DATA-01, WP-01/03/04, SC-01) | Phases with fuzzy fallback | No change |
| Proper-noun + code-switch guards (SC-02, SC-04) | Phase 7 (word-order FP mitigation) | Possibly reuse proper-noun guard inside V2 detector to skip names |
| NB↔NN CROSS_DIALECT_MAP (SC-03) | Phase 13.3 (bokmål/riksmål drift) | Extend to `BOKMAL_RIKSMAL_MAP` sibling structure |

**New infrastructure v2.0 must build:**

1. **Light syntactic reasoner** — shared by 7.1, 7.2, 7.3, and many
   Phase 8/9/10 rules. POS-aware token stream with tagged
   "finite verb", "subject", "adverbial", "subordinator" slots.
   Built once, reused everywhere. Introduce in Phase 7 because
   pressure is highest there.
2. **Document-state seam** — for Phase 13 (and Phase 16 if ever).
   Per-document collection of norm markers, address-form counts,
   tense counts. New module in `extension/content/spell-check.js`
   or a sibling. Introduce in Phase 13.
3. **Trigger-set matching utility** — for 8.2, 9.1/9.2/9.3,
   10.1/10.2, 11.1/11.3, 12.1/12.2, 15.x. Closed-vocabulary fast
   lookup with context window. Likely partially present from
   bigram work; extract and generalise in Phase 8.
4. **Compound splitter** — for 8.4 and potentially 14.3.
   Greedy longest-suffix match against nounbank. New helper;
   modest LOC.

## Benchmark-Line Validation Anchors

Preserved verbatim so requirements and fixtures can grep them.

**nb.txt:**
- Phase 7.1: `"Hvorfor du tror at norsk er lett?"` (wh-question SV inversion)
- Phase 7.1: `"I går jeg gikk på kino"` (roadmap-named; fronted-adv + uninverted)
- Phase 13.3: `boken` + `efter` + `sne` in same paragraph (roadmap-named)
- Phase 15.1: `"flink i å gå i bånd"` → `flink til`
- Adjacent (double definiteness, not explicitly scoped but flagged in benchmark comments): `"Den store huset"`

**nn.txt:**
- Phase 13.4: `"Boka var vakker, men boken kosta mykje"` (hokjønn + hankjønn mixing within paragraph)
- Phase 13 crossover: `"Hva tenker du om det?"` + `"Jeg syns"` in NN text — already partly in dialect-mix but merits doc-level register check
- Phase 7.1 (NN): `"Hvorfor du trur at nynorsk er lett?"`

**de.txt (most-covered benchmark):**
- Phase 7.2 main-clause V2: `"Letzte montag ich bin gegangen zu der supermarkt"`, `"Dann ich aufstehe"`, `"Am abend wir haben gegessen"`
- Phase 7.2 subordinate verb-final: `"dass er ist nett"` (roadmap-named), benchmark `"dass ich bin besser geworden"`
- Phase 8.1 prep-case: `"mit den Schule"` (roadmap-named), `"in eine fabrik"`, `"auf einem insel"`, `"Wegen dem wetter"`
- Phase 8.2 separable: `"ich aufstehe"`
- Phase 8.3 perfekt aux: `"ich habe gegangen"` (roadmap-named) vs correct `"ich bin gegangen"` (acceptance)
- Phase 8.4 compound gender: `"das Schultasche"` (roadmap-named pattern)

**es.txt:**
- Phase 9.1 ser/estar: `"Soy cansado"`, `"yo era en un humor bueno"` → `estaba`, `"Estaba mucho queso"` (hay vs estar adjacent)
- Phase 9.2 por/para: `"comida por mi familia"`, `"por leer un libro"`, `"para comprar comida por mi familia"`
- Phase 9.3 personal "a": `"Veo Juan todos los dias"`
- Phase 11.1 subjuntivo: `"Quiero que mi hermano viene conmigo"` → `venga`
- Phase 12.1 pro-drop: `"yo voy a la playa"`, `"Yo pienso"`, `"yo fui a la tienda"` (every sentence-initial `yo`)
- Phase 12.2 gustar-class: `"Él no gusta ayudar"` → `"A él no le gusta ayudar"`

**fr.txt:**
- Phase 10.1 élision: `"je avais"` → `j'avais`, `"si il pleut"` → `s'il`, `"je ai"` → `j'ai`
- Phase 10.2 être/avoir: `"je ai amélioré"`; roadmap pattern `"j'ai allé"` → `"je suis allé"`
- Phase 10.3 PP agreement: `"la pomme que j'ai mangée"` (acceptance from roadmap)
- Phase 11.3 subjonctif: `"Il faut que je parle mieux"` (roadmap-named; borderline — form syncretism, fixture validates the trigger + mood check)
- Phase 14.2 opaque gender: `"La problème"`, `"un bon humeur"` (article-gender mismatch)
- Phase 7.3 BAGS: no explicit wrong-placement line; add acceptance fixture from `"une belle femme"`

**en.txt:**
- Phase 6.1 register: `"gonna"` in essay prose
- Phase 6.3 redundancy: no explicit `"return back"` in current text; add fixture
- Phase 14.1 morphology: `"childs"`, `"eated"`, `"clothe for childrens"`, `"i still makes"`, `"when i writes"`
- Phase 14.3 word-family: `"i have improve"` (overlaps morphology)
- Phase 15.x EN prep collocations: `"help in the house"` → `"help around/with"` (borderline)

## Competitor Feature Analysis

| Feature | LanguageTool (free) | Grammarly (free) | Leksihjelp v2.0 |
|---------|---------------------|-------------------|-------------------|
| Online required | Yes (free tier limits) | Yes | **No — offline-first** |
| NB + NN coverage | Partial NB, weak NN | Effectively none | **First-class, NB + NN equal footing** |
| DE prep-case | Yes (partial) | Weak | **Full, benchmark-validated** |
| ES ser/estar | Partial | Yes | **Closed-list deterministic** |
| FR PP agreement | Partial, noisy | Yes, often wrong | **Toggle-gated, low-FP** |
| Register/formality | Yes | Yes | **Opt-in, NB-student-aware** |
| Bokmål/riksmål drift | No | No | **Brand-distinctive differentiator** |
| NN a-/e-inf consistency | No | No | **Brand-distinctive differentiator** |
| Free forever | Yes (limited) | No (freemium) | **Yes, publicly committed** |
| Open source | Yes (LGPL) | No | **Yes (MIT)** |
| Dyslexia-optimised UX | No | Partial | **Named brand feature** |
| Silent auto-correct | Warn only | Yes (default) | **Never — show candidate, require confirm** |

**Positioning:** Leksihjelp v2.0 doesn't try to out-recall Grammarly
on EN. It trades recall for (a) offline, (b) free-forever,
(c) NB/NN first-class, (d) dyslexia-supportive confirm-don't-autocorrect
UX, (e) deterministic rules authored in the open.

## Confidence & Gaps

**HIGH confidence on:**
- Category splits (table stakes / differentiator / anti-feature) —
  driven by competitor analysis + user-memory domain policy +
  PROJECT.md Out-of-Scope list.
- Dependency graph — flows directly from v1.0 shipped infrastructure
  and roadmap sequencing notes.
- Benchmark-line anchors — hand-authored by user, verified line-by-line.
- Complexity S/M/L ratings — anchored to roadmap estimates and
  v1.0 comparable-LOC patterns (särskriving was M; lands-anchor
  for what M means in this codebase).

**MEDIUM confidence on:**
- Phase 11 trigger-set completeness — roadmap lists canonical
  triggers but real-language coverage needs a papertek-data audit
  in the requirements phase.
- Phase 13 seam design — never built in this codebase; the
  "document state collector" abstraction is sketched but not proven.
- FR BAGS adjective list — roadmap says ~40; real closed set may
  be 30 or 60; papertek audit needed.

**LOW confidence / explicit gaps:**
- Phase 16 feasibility — roadmap flags as aspirational. Defer to v3.0.
- 15.3 Idiomatic literalism scope — roadmap says "TBD"; open scope
  is a trap; recommend curated-only or kill.
- Exact papertek schema shape for each new flag (`aux`, `separable`,
  `copula`, `human`, `bags`, `trigger_subjuntivo`, …) — cross-app
  coordination with papertek-webapps / papertek-nativeapps required.
  Research for STACK.md, not FEATURES.md.

## Sources

- `.planning/PROJECT.md` — shipped v1.0 requirements and Out-of-Scope list (HIGH)
- `.planning/v2.0-benchmark-driven-roadmap.md` — 11 phase groupings, dependencies, non-goals, validation protocol (HIGH)
- `benchmark-texts/*.txt` — 6 hand-authored student-error corpora with explicit roadmap-phase tags in comment headers (HIGH)
- User-memory entries (HIGH):
  - `project_spelling_grammar_check.md` — origin of grammar-check feature set
  - `project_nb_nn_no_mixing.md` — NB/NN are distinct standards; cross-standard = student error
  - `project_data_logic_separation_philosophy.md` — pattern for data-vs-rule authoring
  - `project_preposition_polysemy_feature.md` — Level-A sense grouping (roadmap-adjacent)
  - `project_false_friends_feature.md` — cross-language look-alike warnings (roadmap-adjacent)
  - `project_phase5_manual_spellcheck_button.md` — carry-over debt relevant to v2.0 UX
- Competitor analysis (training-data, MEDIUM confidence):
  - [LanguageTool (languagetool.org)](https://languagetool.org) — open-source LGPL, online
  - Grammarly free tier — freemium, online, silent auto-correct default
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (referenced in PROJECT.md) — carry-over tech-debt source

---
*Feature research for: v2.0 structural grammar governance*
*Researched: 2026-04-24*
