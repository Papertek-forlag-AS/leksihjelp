# Requirements: Leksihjelp v2.1

**Defined:** 2026-04-26
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v2.1 Requirements

Requirements for v2.1 Compound Decomposition & Polish. Each maps to roadmap phases.

### Compound Decomposition

- [ ] **COMP-01**: User sees dictionary entry for unknown compound nouns (NB/NN/DE) with gender badge and declension derived from last component
- [ ] **COMP-02**: User sees compound breakdown visualization ("hverdag + s + mas") labeled "Samansett ord" in dictionary popup
- [ ] **COMP-03**: Decomposable compound nouns are accepted as valid words by spell-check (no false flags on productive compounds)
- [ ] **COMP-04**: User sees gender inference from last component for NB/NN compound nouns (extends existing DE compound-gender)
- [x] **COMP-05**: Decomposition engine handles linking elements (NB/NN: s, e; DE: s, n, en, er, e, es) and zero-fuge
- [x] **COMP-06**: Decomposition handles recursive compounds up to 4 components
- [ ] **COMP-07**: Expanded sarskriving detection flags split compounds verified by decomposition, not just stored nounbank
- [ ] **COMP-08**: User sees compound-aware NB/NN gender mismatch flags ("et fotballsko" when sko = m)

### Spell-Check Polish

- [ ] **SPELL-01**: User can trigger spell-check manually via a visible button, with result toast ("3 feil funnet" / "Ser bra ut!")
- [ ] **SPELL-02**: User sees demonstrative-mismatch flags ("Det boka", "Den huset") for den/det/denne/dette gender agreement
- [ ] **SPELL-03**: User sees triple-letter typo flags ("tykkkjer") with compound-boundary consonant-elision awareness

### Browser Verification

- [ ] **VERIF-01**: All deferred Phase 6/7 browser visual checks pass (P1/P2/P3 dot colours, quotation suppression, word-order dots)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Compound Decomposition (future)

- **COMP-09**: Verb and adjective compound decomposition (overtale, langvarig)
- **COMP-10**: Definite-form compound lookup (strip -en/-et/-a before decomposition)
- **COMP-11**: Per-noun fuge data in papertek-vocabulary for lexical exceptions

### Carry-Over Tech-Debt (future)

- **DEBT-01**: NN phrase-infinitive triage (~214 papertek-vocabulary verbbank entries)
- **DEBT-02**: Data-source architecture move (bundled baseline + sync with papertek-vocabulary)
- **DEBT-03**: Leksi-in-skriv integration (embed in skriv.papertek.app)
- **DEBT-04**: papertek-vocabulary data gaps (markeres s-passiv, setningen NB bestemt form)
- **DEBT-05**: Move CROSS_DIALECT_MAP from nb-dialect-mix.js into papertek-vocabulary

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ML-based decompounding | Violates SC-06 network silence gate + offline constraint; dictionary-based greedy match achieves >95% accuracy |
| Auto-correct compound splits | Violates "no auto-correct" principle; dyslexia research says silent fixes compound errors |
| Inherited examples from components | "broed examples are misleading on skolebroed" — show breakdown + gender badge only |
| Exhaustive fuge-rule database | Partially lexical, partially pattern-based; accept false negatives on rare patterns over false positives |
| Decomposing non-nouns | Verb/adjective compounds follow different patterns; scope creep for v2.1 |
| Whole-page manual check | Requires content-script permissions expansion; manual button checks focused textarea only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 17 | Pending |
| COMP-02 | Phase 17 | Pending |
| COMP-03 | Phase 17 | Pending |
| COMP-04 | Phase 17 | Pending |
| COMP-05 | Phase 16 | Complete |
| COMP-06 | Phase 16 | Complete |
| COMP-07 | Phase 17 | Pending |
| COMP-08 | Phase 17 | Pending |
| SPELL-01 | Phase 18 | Pending |
| SPELL-02 | Phase 18 | Pending |
| SPELL-03 | Phase 18 | Pending |
| VERIF-01 | Phase 19 | Pending |

**Coverage:**
- v2.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-26*
*Last updated: 2026-04-26 after roadmap creation (12/12 mapped)*
