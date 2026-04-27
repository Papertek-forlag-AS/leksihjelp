# Requirements: Leksihjelp v3.1

**Defined:** 2026-04-28
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v3.1 Requirements

Requirements for v3.1 Polish & Intelligence. Each maps to a roadmap phase.

### COMP (Compound Word Intelligence)

- [ ] **COMP-01**: Popup search suggests compound words when student types a valid first component + fuge element + partial second component (e.g., "chefsstu" → "chefsstuhl")
- [ ] **COMP-02**: Compound card displays a pedagogical note explaining that the last component determines gender and conjugation, with a link to the last component entry
- [ ] **COMP-03**: When navigating from a compound card to a component entry, popup shows a "Tilbake til [compound]" back-navigation link
- [ ] **COMP-04**: Compound card shows a qualified translation guess by concatenating component translations, labeled "Kvalifisert gjetning av det sammensatte ordets betydning"

### POPUP (Popup & Dictionary Fixes)

- [ ] **POPUP-01**: NB/EN/NN language buttons in popup switch the active lookup language and re-trigger search (currently only DE/ES/FR work)
- [ ] **POPUP-02**: Replace "Fest" floating popup window with Chrome Side Panel API so it persists across tab switches on macOS

### SPELL (Spell-Check UX)

- [ ] **SPELL-01**: Clicking the Aa spell-check button jumps to the first marker; pressing Tab cycles through subsequent markers one by one
- [ ] **SPELL-02**: Aa spell-check button only appears on text inputs with ~20+ characters (not on single-word fill-in-blank fields)
- [ ] **SPELL-03**: Word prediction dropdown only appears after the student has typed 3+ characters (not after 1 character)

### DEBT (Tech Debt Cleanup)

- [ ] **DEBT-01**: Version numbers aligned across package.json, manifest.json, and backend/public/index.html
- [ ] **DEBT-02**: check-fixtures triage: all 5 pre-existing failing suites (de/doc-drift, nb/homophone, nb/saerskriving, nn/typo, de/verb-final) either fixed or quarantined so the gate exits 0 on main
- [ ] **DEBT-03**: Browser visual verification (VERIF-01): execute the 12 accumulated deferred browser tests from v2.0–v3.0
- [ ] **DEBT-04**: SCHEMA-01 developer-view: popup subscribes to `lexi:schema-mismatch` message and surfaces "Versjonskonflikt" diagnostic
- [ ] **DEBT-05**: Remove stale `BUNDLED_LANGS` list in vocab-seam.js (nn/en entries for deleted files)

## Future Requirements

Deferred to a future release. Tracked but not in v3.1.

### Carry-Over

- **CORE-01**: Extract `lexi-core` shared module consumed by extension and skriv.papertek.app
- **CORE-02**: Storage adapter abstraction for lexi-core (IndexedDB vs fetch-on-demand)
- **DEBT-NN**: NN phrase-infinitive triage (~214 papertek-vocabulary verbbank entries)
- **DEBT-CROSS**: Move `CROSS_DIALECT_MAP` from `nb-dialect-mix.js` into papertek-vocabulary
- **DEBT-PARITY**: Vocab-seam parity gate (`check-vocab-seam-parity`)

### Future Features

- Tense harmony & discourse (TH-01 through TH-03)
- Idiomatic-literalism curated match (IDI-01)
- FR participe passé full corner cases (FR-04)
- Verb/adjective compound decomposition (COMP-09)
- Definite-form compound lookup (COMP-10)
- Per-noun fuge data in papertek-vocabulary (COMP-11)
- Context-aware sense selection (DICT-01)
- Foreign-side false-friend entries (DICT-02)
- Lockdown bootstrap implementation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Lexi-core extraction (shared module) | Depends on skriv integration being actively planned; premature now |
| New grammar rules (tense harmony, idioms, etc.) | Own milestone-scale effort; v3.1 is polish, not depth |
| Lockdown bootstrap implementation | Lockdown's concern; adapter contract delivered in v3.0 |
| ML-based compound prediction | Heuristic decomposition + nounbank matching is sufficient; ML adds dependency + offline violation |
| Per-keystroke API fetches for compounds | Violates SC-06 network silence; compound prediction works from cached IndexedDB data |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | TBD | Pending |
| COMP-02 | TBD | Pending |
| COMP-03 | TBD | Pending |
| COMP-04 | TBD | Pending |
| POPUP-01 | TBD | Pending |
| POPUP-02 | TBD | Pending |
| SPELL-01 | TBD | Pending |
| SPELL-02 | TBD | Pending |
| SPELL-03 | TBD | Pending |
| DEBT-01 | TBD | Pending |
| DEBT-02 | TBD | Pending |
| DEBT-03 | TBD | Pending |
| DEBT-04 | TBD | Pending |
| DEBT-05 | TBD | Pending |

**Coverage:**
- v3.1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-04-28*
