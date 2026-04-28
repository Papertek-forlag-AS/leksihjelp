# Requirements: Leksihjelp v3.1

**Defined:** 2026-04-28
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v3.1 Requirements

Requirements for v3.1 Polish & Intelligence. Each maps to a roadmap phase.

### COMP (Compound Word Intelligence)

- [x] **COMP-01**: Popup search suggests compound words when student types a valid first component + fuge element + partial second component (e.g., "chefsstu" → "chefsstuhl")
- [x] **COMP-02**: Compound card displays a pedagogical note explaining that the last component determines gender and conjugation, with a link to the last component entry
- [x] **COMP-03**: When navigating from a compound card to a component entry, popup shows a "Tilbake til [compound]" back-navigation link
- [x] **COMP-04**: Compound card shows a qualified translation guess by concatenating component translations, labeled "Kvalifisert gjetning av det sammensatte ordets betydning"

### POPUP (Popup & Dictionary Fixes)

- [x] **POPUP-01**: NB/EN/NN language buttons in popup switch the active lookup language and re-trigger search (already wired via popup.js:1318+ before Phase 25)
- [x] **POPUP-02**: Replace "Fest" floating popup window with Chrome Side Panel API so it persists across tab switches on macOS (manifest + popup.js:2556 — landed before Phase 25; needs ongoing macOS browser verification)

### SPELL (Spell-Check UX)

- [x] **SPELL-01**: Clicking the Aa spell-check button jumps to the first marker; pressing Tab cycles through subsequent markers one by one (spell-check.js:207-211 — landed before Phase 25)
- [x] **SPELL-02**: Aa spell-check button only appears on text inputs with ~20+ characters (spell-check.js:742 — landed before Phase 25)
- [x] **SPELL-03**: Word prediction dropdown only appears after the student has typed 3+ characters (commit 2438f49 — language-aware: 4 for nb/nn/de, 3 elsewhere)

### DEBT (Tech Debt Cleanup)

- [x] **DEBT-01**: Version numbers aligned across package.json, manifest.json, and backend/public/index.html (all at 2.5.0)
- [x] **DEBT-02**: check-fixtures triage: all 5 pre-existing failing suites either fixed or quarantined so the gate exits 0 on main (commit f655552 — fixed `de-capitalization` recht-haben false positives + `nb-demonstrative-gender` 1-ahead/2-ahead bridging)
- [x] **DEBT-03**: Browser visual verification (VERIF-01): the 12 accumulated deferred browser tests executed and documented (user-verified 2026-04-28)
- [x] **DEBT-04**: SCHEMA-01 developer-view: popup subscribes to `lexi:schema-mismatch` message and surfaces "Versjonskonflikt" diagnostic (commit 72c9c29)
- [x] **DEBT-05**: Remove stale `BUNDLED_LANGS` list in vocab-seam.js (commit 41aa4e6 — trimmed to ['nb'])

### PED (Pedagogy "Lær mer" UI)

- [x] **PED-01**: When the de-prep-case rule fires on a flagged preposition that has a `pedagogy` block in the lexicon, the spell-check popover shows a "Lær mer" button alongside the existing suggestion
- [ ] **PED-02**: Clicking "Lær mer" expands a teaching panel inside the popover showing case label badge, summary, paragraph explanation, and a `correct ✓` / `incorrect ✗` example pair with student-facing note
- [ ] **PED-03**: For Wechselpräpositionen the expanded panel additionally shows the motion (Akk) vs location (Dat) pair side-by-side or stacked, each with sentence + translation + note
- [ ] **PED-04**: Where the lexicon entry has a `colloquial_note`, the expanded panel surfaces it as a friendly aside (italic / lighter visual treatment) — never as a correction
- [ ] **PED-05**: All popover and panel text adapts to the user's chosen UI language (nb / nn / en) read from `chrome.storage.local.uiLanguage`, with `nb` fallback when missing
- [x] **PED-06**: Pedagogy data ships in the bundled `extension/data/de.json` (offline-first per SC-06) — `scripts/sync-vocab.js` copies the `pedagogy` field from generalbank, and `npm run check-bundle-size` continues to pass under the 20 MiB packaged-zip cap

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
| COMP-01 | Phase 24 | Complete |
| COMP-02 | Phase 24 | Complete |
| COMP-03 | Phase 24 | Complete |
| COMP-04 | Phase 24 | Complete |
| POPUP-01 | Phase 25 | Complete |
| POPUP-02 | Phase 25 | Complete |
| SPELL-01 | Phase 25 | Complete |
| SPELL-02 | Phase 25 | Complete |
| SPELL-03 | Phase 25 | Complete |
| DEBT-01 | Phase 25 | Complete |
| DEBT-02 | Phase 25 | Complete |
| DEBT-03 | Phase 25 | Complete |
| DEBT-04 | Phase 25 | Complete |
| DEBT-05 | Phase 25 | Complete |
| PED-01 | Phase 26 | Complete |
| PED-02 | Phase 26 | Pending |
| PED-03 | Phase 26 | Pending |
| PED-04 | Phase 26 | Pending |
| PED-05 | Phase 26 | Pending |
| PED-06 | Phase 26 | Complete |

**Coverage:**
- v3.1 requirements: 20 total (14 v3.1 polish + 6 pedagogy UI)
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements updated: 2026-04-28 — Phase 25 closed, Phase 26 (Lær mer pedagogy UI) added*
