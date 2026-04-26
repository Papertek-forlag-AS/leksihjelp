# Requirements: Leksihjelp v2.2

**Defined:** 2026-04-26
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v2.2 Requirements

Requirements for v2.2 Student Language Intelligence. Each maps to roadmap phases.

### False Friends

- [x] **FF-01**: User sees a warning banner on dictionary popup when looking up a word that has a cross-language false friend (e.g., "aktuell" shows warning: not "actual" in English)
- [x] **FF-02**: False-friend data lives in Papertek API as `falseFriends` field on NB entries, seeded with ~50 pairs across NB→EN/DE/ES/FR
- [x] **FF-03**: Warning renders prominently above translations so students see it before picking a translation
- [x] **FF-04**: Floating-widget inline lookup also shows false-friend warnings

### Preposition Polysemy

- [x] **POLY-01**: User sees sense-grouped translations for polysemous words in dictionary popup (e.g., "på" grouped by time/location/manner instead of flat list)
- [x] **POLY-02**: Sense data lives in Papertek API as structured `senses` field with trigger context and example sentences
- [x] **POLY-03**: Popup renders sense headers with expandable groups — student can't just grab the first translation
- [x] **POLY-04**: Floating-widget inline lookup shows sense grouping for polysemous words

### å/og Confusion

- [x] **AAOG-01**: User sees spell-check flag when "og" is used where "å" is required (e.g., "hun liker og lese" → "hun liker å lese")
- [x] **AAOG-02**: User sees spell-check flag when "å" is used where "og" is required (e.g., "kaffe å kake" → "kaffe og kake")
- [x] **AAOG-03**: Posture verb constructions correctly accepted ("sitter og leser" = valid)
- [x] **AAOG-04**: Rule has student-friendly explain text (NB/NN) following explain-contract

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dictionary Enhancements (future)

- **DICT-01**: Context-aware sense selection — popup reads surrounding sentence, highlights likely sense (Level C from polysemy design)
- **DICT-02**: Foreign-side false-friend entries (EN→NB, DE→NB direction)
- **DICT-03**: False-friend warnings in floating-widget TTS context (audio + warning)

### Carry-Over

- **VERIF-01**: Browser visual verification (deferred from v2.0/v2.1)
- **DEBT-01**: NN phrase-infinitive triage (~214 papertek-vocabulary verbbank entries)
- **DEBT-02**: Data-source architecture move (bundled baseline + sync)
- **DEBT-03**: Leksi-in-skriv integration
- **DEBT-04**: Vocab-seam parity gate

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Context-aware sense selection (Level C) | Requires sentence parsing + per-preposition signal tables; multi-week effort beyond v2.2 scope |
| å/og detection in word prediction | Only ~85-90% accurate without full sentence context; false corrections undermine trust |
| Auto-correct å↔og | Violates "no auto-correct" principle; show candidate, never silently rewrite |
| Foreign→Norwegian false friends | NB→foreign is the primary student direction; reverse direction deferred |
| ML-based polysemy disambiguation | Violates SC-06 network silence + offline constraint |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FF-01 | Phase 21.1 | Complete |
| FF-02 | Phase 21 | Complete |
| FF-03 | Phase 21.1 | Complete |
| FF-04 | Phase 21.1 | Complete |
| POLY-01 | Phase 21.1 | Complete |
| POLY-02 | Phase 21 | Complete |
| POLY-03 | Phase 21.1 | Complete |
| POLY-04 | Phase 21.1 | Complete |
| AAOG-01 | Phase 22 | Complete |
| AAOG-02 | Phase 22 | Complete |
| AAOG-03 | Phase 22 | Complete |
| AAOG-04 | Phase 22 | Complete |

### Integration Gap Tracking (from v2.2 audit)

| Gap | Affected Reqs | Fix Phase | Status |
|-----|---------------|-----------|--------|
| `fin_adj` NB: null linkedTo → FR false-friend dropped | FF-01, FF-04 (partial FR) | Phase 21.2 | Pending |
| `på_contr` NB: missing linkedTo.de → DE senses unreachable | POLY-01, POLY-03, POLY-04 (partial DE) | Phase 21.2 | Pending |

**Coverage:**
- v2.2 requirements: 12 total
- Mapped to phases: 12
- Complete: 8 (FF-01–04, POLY-01–04)
- Pending: 4 (AAOG-01–04 in Phase 22)
- Integration gaps: 2 (assigned to Phase 21.2)
- Unmapped: 0

---
*Requirements defined: 2026-04-26*
*Last updated: 2026-04-26 after milestone audit gap closure planning*
