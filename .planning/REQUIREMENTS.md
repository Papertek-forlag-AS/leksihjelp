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

### EXAM (Exam Mode — Phase 27)

- [x] **EXAM-01**: Every spell-check rule file in `extension/content/spell-rules/*.js` declares an `exam: { safe: boolean, reason: string, category?: string }` marker on the rule object (and additionally on `rule.explain` where the popover surface is independently classifiable)
- [x] **EXAM-02**: A new `extension/exam-registry.js` enumerates every non-rule user-visible feature surface (dictionary popup, conjugation tables, TTS, word prediction, pedagogy panel, Fest/side-panel, grammar-features popover) with the same `exam: { safe, reason, category? }` marker shape; serves as the single source of truth for non-rule surfaces
- [x] **EXAM-03**: Popup settings exposes a student-facing exam-mode toggle persisted in `chrome.storage.local.examMode`; toggle is shown disabled (greyed in ON state, caption "Slått på av lærer") when `chrome.storage.local.examModeLocked` is true (set by lockdown loader)
- [x] **EXAM-04**: When exam mode is ON, every feature surface with `exam.safe = false` is hidden entirely (no tooltip, no greyed placeholder) — spell-check rules are filtered, dictionary/conjugation/TTS/prediction surfaces are suppressed, Lær mer popovers are hidden
- [x] **EXAM-05**: When exam mode is ON, the popup shows a persistent "EKSAMENMODUS" badge near the logo and the floating widget gains an amber border tint — both visible at-a-glance for teacher walkthrough
- [x] **EXAM-06**: A new release gate `check-exam-marker` (in `scripts/check-exam-marker.js`) hard-fails CI if any spell-rule file or registry entry is missing the `exam` marker, the marker is malformed (missing `safe` boolean or non-empty `reason` string), or category (when present) is not a recognized value; paired self-test `check-exam-marker.test.js` plants malformed and well-formed rules to prove the gate is not silently permissive
- [x] **EXAM-07**: All exam-mode UI text (toggle label, EKSAMENMODUS badge, "Slått på av lærer" caption) reads from i18n strings with nb/nn/en variants matching the existing `chrome.storage.local.uiLanguage` mechanism
- [x] **EXAM-08**: Cross-app contract — leksihjelp exam-mode plumbing propagates to the lockdown webapp at `/Users/geirforbord/Papertek/lockdown`: `extension/exam-registry.js` synced to `public/leksihjelp/exam-registry.js`; `LEKSI_BUNDLE` in `public/js/leksihjelp-loader.js` injects it before `spell-check-core.js`; Phase 27 content scripts (`floating-widget.js`, `word-prediction.js`, `spell-check.js`) refreshed downstream with `examMode` runtime gating; leksihjelp `CLAUDE.md` documents both consumers and the load-order rule. Closed 2026-04-28 by Phase 28 (lockdown commit b7a92b4 on staging branch; leksihjelp commit c6aff0f). Teacher-control of the lock — originally bundled into this requirement — split out as EXAM-10.
- [ ] **EXAM-09**: Cross-app contract (skriveokt-zero / lockdown-zero Tauri app): same exam-mode propagation as EXAM-08 for the second downstream consumer at `/Users/geirforbord/Papertek/lockdown/skriveokt-zero` — its own `scripts/sync-leksihjelp.js` (npm-postinstall path, pulls from `node_modules/@papertek/leksihjelp`) extended to copy `extension/exam-registry.js` into `src/leksihjelp/`; the Tauri loader equivalent injects it before consumers; refresh stale `src/leksihjelp/*.js` to include Phase 27 `examMode` references; teacher-lock writer wired in the Tauri exam-profile path (depends on EXAM-10 product decision)
- [ ] **EXAM-10**: Teacher-controlled exam-mode lock in the lockdown webapp — when a teacher opts students into "leksihjelp + Phase 27 lock" via a chosen UX (new `RESOURCE_PROFILES.LEKSIHJELP_EXAM` profile vs per-test toggle vs other), `public/js/writing-test/student/writing-environment.js` writes `chrome.storage.local.set({ examModeLocked: true, examMode: true })` and clears both flags on profile transition away. Requires `firestore.rules` enum update (lines 25, 30) + Cloud Functions enum update (`createTest.js`, `toggleResourceAccess.js`) + manual Firebase deploy to both staging-lockdown and lockdown-stb. Assigned to Phase 29. Phase 28 staged plumbing already supports the runtime suppression; this requirement is just the teacher-control surface area.

### PED (Pedagogy "Lær mer" UI)

- [x] **PED-01**: When the de-prep-case rule fires on a flagged preposition that has a `pedagogy` block in the lexicon, the spell-check popover shows a "Lær mer" button alongside the existing suggestion
- [x] **PED-02**: Clicking "Lær mer" expands a teaching panel inside the popover showing case label badge, summary, paragraph explanation, and a `correct ✓` / `incorrect ✗` example pair with student-facing note
- [x] **PED-03**: For Wechselpräpositionen the expanded panel additionally shows the motion (Akk) vs location (Dat) pair side-by-side or stacked, each with sentence + translation + note
- [x] **PED-04**: Where the lexicon entry has a `colloquial_note`, the expanded panel surfaces it as a friendly aside (italic / lighter visual treatment) — never as a correction
- [x] **PED-05**: All popover and panel text adapts to the user's chosen UI language (nb / nn / en) read from `chrome.storage.local.uiLanguage`, with `nb` fallback when missing
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
| PED-02 | Phase 26 | Complete |
| PED-03 | Phase 26 | Complete |
| PED-04 | Phase 26 | Complete |
| PED-05 | Phase 26 | Complete |
| PED-06 | Phase 26 | Complete |
| EXAM-01 | Phase 27 | Planned |
| EXAM-02 | Phase 27 | Planned |
| EXAM-03 | Phase 27 | Planned |
| EXAM-04 | Phase 27 | Planned |
| EXAM-05 | Phase 27 | Planned |
| EXAM-06 | Phase 27 | Planned |
| EXAM-07 | Phase 27 | Planned |
| EXAM-08 | Phase 28 | Complete (plumbing) — staged on lockdown 2026-04-28 |
| EXAM-09 | Phase 28.1 | Deferred (skriveokt-zero not yet shipped — not blocking v3.1; un-defer when zero ships to schools) |
| EXAM-10 | Phase 29 | Pending (teacher-control UX + firestore deploy — split from EXAM-08 during Phase 28 execution) |

**Coverage:**
- v3.1 requirements: 30 total (4 COMP + 2 POPUP + 3 SPELL + 5 DEBT + 6 PED + 10 EXAM)
- Mapped to phases: 30
- Unmapped: 0
- Pending (active): 1 (EXAM-10 → Phase 29; teacher-control UX for lockdown exam-mode lock)
- Deferred (not blocking v3.1): 1 (EXAM-09 → Phase 28.1; skriveokt-zero Tauri app not yet shipped to consumers)

---
*Requirements updated: 2026-04-28 — Phase 25 closed, Phase 26 (Lær mer pedagogy UI) added; v3.1 audit reset EXAM-08 → reassigned to Phase 28 (lockdown webapp exam-mode sync); EXAM-09 added for skriveokt-zero (Tauri sibling consumer) → assigned to Phase 28.1*
