# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15.1 (shipped 2026-04-25) — [archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v2.1 Compound Decomposition & Polish** — Phases 16–20 (in progress)

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

<details>
<summary>✅ v2.0 Depth of Coverage — Grammar Governance Beyond Tokens (Phases 6-15.1) — SHIPPED 2026-04-25</summary>

- [x] Phase 6: Structural Infrastructure + Register & Stylistic Polish (3/3 plans) — completed 2026-04-24
- [x] Phase 7: Word-Order Violations NB + DE + FR (4/4 plans) — completed 2026-04-24
- [x] Phase 8: DE Case & Agreement Governance (3/3 plans) — completed 2026-04-24
- [x] Phase 9: ES ser/estar, por/para, Personal "a" (3/3 plans) — completed 2026-04-25
- [x] Phase 10: FR Elision, Auxiliary, Participe Passe 10.3a (3/3 plans) — completed 2026-04-25
- [x] Phase 11: Aspect & Mood ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 12: Pronoun & Pro-Drop ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 13: Register Drift Within a Document (3/3 plans) — completed 2026-04-25
- [x] Phase 14: Morphology Beyond Tokens EN + ES/FR (3/3 plans) — completed 2026-04-25
- [x] Phase 14.1: Vocab-Seam Browser Wiring (GAP CLOSURE) (1/1 plan) — completed 2026-04-25
- [x] Phase 15: Collocations at Scale NB + DE + FR + ES (1/1 plan) — completed 2026-04-25
- [x] Phase 15.1: Fixture Gate Triage (GAP CLOSURE) (1/1 plan) — completed 2026-04-25

See: `.planning/milestones/v2.0-ROADMAP.md` for full phase detail and success criteria.

</details>

### 🚧 v2.1 Compound Decomposition & Polish (In Progress)

**Milestone Goal:** Algorithmic compound word decomposition for NB/NN/DE (dictionary, spell-check, gender inference) plus carry-over polish items from v1.0/v2.0.

- [x] **Phase 16: Decomposition Engine** — Pure compound-splitting algorithm in vocab-seam-core.js with linking-element awareness for NB/NN/DE (completed 2026-04-26)
- [x] **Phase 17: Compound Integration** — Dictionary popup rendering, spell-check acceptance, NB/NN gender inference, DE engine consolidation, and sarskriving expansion for decomposable compounds (completed 2026-04-26)
- [x] **Phase 18: Spell-Check Polish** — Manual trigger button, demonstrative-mismatch rule, triple-letter typo rule (completed 2026-04-26)
- [x] **Phase 19: NB/NN Passiv-s Detection** — S-passive overuse reminder (NB), strict finite/infinitive s-passive rules (NN), st-verb recognition, participle agreement (completed 2026-04-26)
- [ ] **Phase 20: Browser Visual Verification** — Deferred Phase 6/7 visual checks plus v2.1 compound rendering verification

## Phase Details

### Phase 16: Decomposition Engine
**Goal**: Unknown compound words can be algorithmically split into known noun components with linking elements identified
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: COMP-05, COMP-06
**Success Criteria** (what must be TRUE):
  1. `decomposeCompound("hverdagsmas", nounGenus, "nb")` returns parts [hverdag, mas] with linker "s" and gender from "mas"
  2. `decomposeCompound("skolebroedoppskrift", nounGenus, "nb")` returns 3 components (recursive up to 4)
  3. DE linking elements (s, n, en, er, e, es) and NB/NN linking elements (s, e) are all handled correctly
  4. Words already in nounbank return null (stored entries take precedence over decomposition)
  5. False-positive rate < 2% when run against all existing nounbank entries (non-compound nouns must not decompose)
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md — TDD: Implement decomposeCompound with unit tests (core algorithm + linking elements + recursion)
- [x] 16-02-PLAN.md — Wire through vocab-seam.js and spell-check.js + false-positive validation

### Phase 17: Compound Integration
**Goal**: Students see compound breakdowns in the dictionary popup, spell-check accepts valid compounds, NB/NN compound gender is inferred, and sarskriving detection covers productive compounds beyond the stored nounbank
**Depends on**: Phase 16
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):
  1. Searching an unknown compound in the popup shows a "Samansett ord" card with component breakdown (e.g., "hverdag + s + mas"), gender badge from last component, and no inherited examples
  2. Each component in the breakdown is clickable — clicking triggers a new search for that component's full dictionary entry
  3. Spell-check no longer flags decomposable compounds as unknown words (typo-fuzzy d=1 correction still wins over decomposition acceptance for misspelled compounds like "skoledegen")
  4. Stored nounbank entries always take precedence — decomposition UI never appears for words already in the dictionary
  5. "en fotballsko" is accepted (sko = m, matches "en") via decomposition gender inference for NB/NN
  6. "et fotballsko" is flagged as gender mismatch (sko = m, "et" expects n) with correct suggestion
  7. Existing DE compound-gender rule (`de-compound-gender.js`) delegates to the shared decomposition engine (no duplicated splitting logic)
  8. Compound-gender inference only fires when the decomposition has high confidence (both components are known nouns)
  9. "skole dag" is flagged as sarskriving even when "skoledag" is not stored in compoundNouns, because decomposition validates "skoledag" as a valid compound
  10. Existing SARSKRIVING_BLOCKLIST still prevents false positives on function-word pairs ("god dag", "stor dag")
  11. Sarskriving precision remains at or above the P >= 0.92 threshold in check-fixtures (expanded fixture suite with 15+ new acceptance and 15+ new rejection cases)
  12. Only confidence=high decompositions trigger sarskriving flags (both components must be known nouns)
**Plans**: 6 plans

Plans:
- [x] 17-01-PLAN.md — Dictionary popup compound card rendering with clickable components + floating-widget fallback
- [x] 17-02-PLAN.md — Spell-check compound acceptance + DE engine consolidation + NB/NN compound gender rule
- [x] 17-03-PLAN.md — Sarskriving expansion with decomposition fallback + expanded fixture suite
- [x] 17-04-PLAN.md — Gap closure: DE fixture pending markers + network silence fix
- [x] 17-05-PLAN.md — Gap closure: sarskriving decomposition false positives (lemma-only nounGenus)
- [ ] 17-06-PLAN.md — Gap closure: remove decomposition fallback from sarskriving (zero recall loss, eliminates remaining 6 FP suites)

### Phase 18: Spell-Check Polish
**Goal**: Students have a manual spell-check trigger, demonstrative-gender checking, and triple-letter typo detection
**Depends on**: Nothing (independent of decomposition)
**Requirements**: SPELL-01, SPELL-02, SPELL-03
**Success Criteria** (what must be TRUE):
  1. A visible spell-check button appears near the TTS widget; clicking it runs an immediate check and shows a toast ("3 feil funnet" or "Ser bra ut!"); no visual flash when text is unchanged since last auto-check
  2. "Det boka" is flagged as demonstrative-mismatch (det expects n, boka = f) with suggestion "Den boka"; "Det bok" (indefinite noun) is handled by nb-gender, not the demonstrative rule
  3. "tykkkjer" is flagged as triple-letter typo with suggestion "tykkjer"; the rule fires as a separate rule file (not a modification to nb-typo-fuzzy), at priority ~45
  4. All 9 existing release gates pass after these additions; no regression on existing fixture suites
**Plans**: 2 plans

Plans:
- [ ] 18-01-PLAN.md — Demonstrative-gender mismatch rule + triple-letter typo rule with full release gate wiring
- [ ] 18-02-PLAN.md — Manual spell-check button with toast feedback

### Phase 19: NB/NN Passiv-s Detection
**Goal**: Students get passiv-s guidance — NB overuse reminders, NN strict finite/infinitive rules, st-verb recognition, and participle agreement checking
**Depends on**: Nothing (independent — but benefits from Papertek data enrichment of -s/-st verb forms)
**Requirements**: DEBT-04
**Success Criteria** (what must be TRUE):
  1. NB: s-passive forms (e.g. "skrives", "leses") are accepted as valid words (not flagged as typos)
  2. NB: when a text contains >3 s-passives, an informational hint suggests considering active voice for clarity
  3. NN: finite s-passive ("Boka lesest av mange") is flagged as error with suggestion to use bli/verte-passiv
  4. NN: s-passive after modal in infinitive ("Boka kan lesast") is accepted as correct
  5. NN: bli/verte + participle forms are accepted as valid passive constructions (basic acceptance; full gender/number agreement checking deferred to a future phase per RESEARCH.md recommendation)
  6. NN: st-verbs (møtast, synast, trivast, finnast, etc.) are recognised as deponent/reciprocal, not flagged as passive errors
  7. All existing release gates pass after additions; no regression on fixture suites
**Plans**: 2 plans

Plans:
- [ ] 19-01-PLAN.md — Papertek data enrichment: add s-passive forms + deponent marking to NB/NN verbbanks, deploy and sync
- [ ] 19-02-PLAN.md — Vocab-seam sPassivForms index + NN finite s-passive rule + NB overuse hint rule + fixtures + release gate wiring

### Phase 20: Browser Visual Verification
**Goal**: All deferred visual checks from v2.0 plus v2.1 compound rendering are verified in a real browser
**Depends on**: Phases 17, 18, 19 (all code phases complete)
**Requirements**: VERIF-01
**Success Criteria** (what must be TRUE):
  1. P1/P2/P3 dot colours render correctly in Chrome (error = red, warning = orange, hint = blue) on real page content
  2. Quotation suppression works visually — text inside quotes does not show spell-check underlines
  3. Word-order rule dots (NB V2, DE verb-final, FR BAGS) render at correct positions with correct severity colours
  4. Compound decomposition popup renders correctly in the dictionary with component breakdown and gender badge
  5. Manual spell-check button is visible, clickable, and toast appears with correct result count
**Plans**: TBD

Plans:
- [ ] 20-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 16 → 17 → 18 → 19 → 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-04-18 |
| 2. Data Layer | v1.0 | 5/5 | Complete | 2026-04-18 |
| 02.1 Bundle-Size Cap | v1.0 | 2/2 | Complete | 2026-04-19 |
| 3. Rule Architecture | v1.0 | 5/5 | Complete | 2026-04-20 |
| 03.1 Browser Wiring | v1.0 | 1/1 | Complete | 2026-04-20 |
| 4. False-Positive Reduction | v1.0 | 3/3 | Complete | 2026-04-20 |
| 5. Student Experience Polish | v1.0 | 5/5 | Complete | 2026-04-20 |
| 05.1 UX-01 Gaps | v1.0 | 5/5 | Complete | 2026-04-21 |
| 6. Structural Infrastructure | v2.0 | 3/3 | Complete | 2026-04-24 |
| 7. Word-Order Violations | v2.0 | 4/4 | Complete | 2026-04-24 |
| 8. DE Case & Agreement | v2.0 | 3/3 | Complete | 2026-04-24 |
| 9. ES ser/estar, por/para | v2.0 | 3/3 | Complete | 2026-04-25 |
| 10. FR Elision, Auxiliary, PP | v2.0 | 3/3 | Complete | 2026-04-25 |
| 11. Aspect & Mood | v2.0 | 3/3 | Complete | 2026-04-25 |
| 12. Pronoun & Pro-Drop | v2.0 | 3/3 | Complete | 2026-04-25 |
| 13. Register Drift | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14. Morphology Beyond Tokens | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14.1 Vocab-Seam Wiring | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15. Collocations at Scale | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15.1 Fixture Gate Triage | v2.0 | 1/1 | Complete | 2026-04-25 |
| 16. Decomposition Engine | v2.1 | 2/2 | Complete | 2026-04-26 |
| 17. Compound Integration | 6/6 | Complete    | 2026-04-26 | - |
| 18. Spell-Check Polish | 2/2 | Complete    | 2026-04-26 | - |
| 19. NB/NN Passiv-s | 2/2 | Complete   | 2026-04-26 | - |
| 20. Browser Verification | v2.1 | 0/0 | Not started | - |

---
*Roadmap updated: 2026-04-26 — Phase 19 planned: 2 plans in 2 waves*
