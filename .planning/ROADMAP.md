# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15.1 (shipped 2026-04-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Compound Decomposition & Polish** — Phases 16–19 (shipped 2026-04-26) — [archive](milestones/v2.1-ROADMAP.md)
- ✅ **v2.2 Student Language Intelligence** — Phases 21–22 + 21.1/21.2 decimal inserts (shipped 2026-04-27) — [archive](milestones/v2.2-ROADMAP.md)
- ✅ **v3.0 Data-Source Migration** — Phase 23 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v3.1 Polish & Intelligence** — Phases 24–25 (in progress)

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

<details>
<summary>✅ v2.1 Compound Decomposition & Polish (Phases 16-19) — SHIPPED 2026-04-26</summary>

- [x] Phase 16: Decomposition Engine (2/2 plans) — completed 2026-04-26
- [x] Phase 17: Compound Integration (6/6 plans) — completed 2026-04-26
- [x] Phase 18: Spell-Check Polish (2/2 plans) — completed 2026-04-26
- [x] Phase 19: NB/NN Passiv-s Detection (3/3 plans) — completed 2026-04-26
- [ ] Phase 20: Browser Visual Verification — deferred (VERIF-01)

See: `.planning/milestones/v2.1-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.2 Student Language Intelligence (Phases 21-22 + decimal inserts) — SHIPPED 2026-04-27</summary>

- [x] Phase 21: Dictionary Intelligence — False Friends + Preposition Polysemy (2/2 plans) — completed 2026-04-26
- [x] Phase 21.1: Fix Dictionary Intelligence Data Pipeline (GAP CLOSURE) (1/1 plan) — completed 2026-04-26
- [x] Phase 21.2: Dictionary Intelligence Data Fixes (GAP CLOSURE) (1/1 plan) — completed 2026-04-26
- [x] Phase 22: å/og Confusion Detection (1/1 plan) — completed 2026-04-26

See: `.planning/milestones/v2.2-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v3.0 Data-Source Migration (Phase 23) — SHIPPED 2026-04-27</summary>

- [x] Phase 23: Data-Source Migration (8/8 plans) — completed 2026-04-27

See: `.planning/milestones/v3.0-ROADMAP.md` for full phase detail and success criteria.

</details>

### 🚧 v3.1 Polish & Intelligence (In Progress)

**Milestone Goal:** Compound word intelligence in the popup (prediction, pedagogy, translation guess), accumulated UX polish (language buttons, side panel, spell-check navigation, min-chars thresholds), and tech-debt cleanup (version alignment, fixture triage, browser verification, schema-mismatch UX, stale code).

- [x] **Phase 24: Compound Word Intelligence** — Popup search suggests compounds, displays pedagogical notes, back-navigation, and qualified translation guesses (completed 2026-04-27)
- [x] **Phase 25: UX Polish & Tech Debt** — Language buttons fixed, Side Panel hardened, spell-check Tab navigation + Aa threshold, prediction min-chars, version alignment, fixture triage (exit 0), schema-mismatch banner, BUNDLED_LANGS cleanup (completed 2026-04-28)
- [ ] **Phase 26: "Lær mer" Pedagogy UI** — Spell-check popover gets a "Lær mer" button that expands a teaching panel with explanations, contrastive examples, and Wechselpräposition pairs sourced from papertek-vocabulary pedagogy data

## Phase Details

### Phase 24: Compound Word Intelligence
**Goal**: Students discover and understand compound words through the popup — prediction from partial input, pedagogical explanation of how compounds work, and translation guesses for unknown compounds
**Depends on**: Phase 23 (v3.0 — IndexedDB vocab data available for compound lookup)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. Student types a valid first component + fuge + partial second component in popup search and sees compound suggestions in the results list (e.g., "chefsstu" suggests "Chefsstuhl")
  2. Compound card displays a pedagogical note explaining that the last component determines gender, with a clickable link that navigates to the last component's dictionary entry
  3. After navigating from a compound card to a component entry, a "Tilbake til [compound]" link appears and returns the student to the compound card
  4. Compound card shows a translation guess assembled from component translations, labeled as a qualified guess ("Kvalifisert gjetning")
**Plans:** 2/2 plans complete
Plans:
- [ ] 24-01-PLAN.md — Compound prediction engine (TDD) in vocab-seam-core.js
- [ ] 24-02-PLAN.md — Wire prediction into popup search + enhanced compound card (pedagogy, back-nav, translation guess)

### Phase 25: UX Polish & Tech Debt
**Goal**: Accumulated UX friction points resolved and tech debt cleaned up so the extension feels polished and the codebase is healthy for future work
**Depends on**: Phase 24 (compound intelligence complete; POPUP-02 side panel may interact with compound card rendering)
**Requirements**: POPUP-01, POPUP-02, SPELL-01, SPELL-02, SPELL-03, DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05
**Success Criteria** (what must be TRUE):
  1. Clicking NB, EN, or NN language buttons in popup switches the active lookup language and re-triggers search with updated results
  2. "Fest" button opens a Chrome Side Panel that persists across tab switches on macOS (replacing the floating popup window)
  3. Clicking the Aa spell-check button jumps viewport to the first marker; pressing Tab advances to the next marker sequentially
  4. Aa spell-check button does not appear on text inputs with fewer than ~20 characters
  5. Word prediction dropdown does not appear until the student has typed 3+ characters
  6. Version numbers in package.json, manifest.json, and index.html are aligned
  7. `npm run check-fixtures` exits 0 on main — all 5 pre-existing failing suites either fixed or quarantined
  8. The 12 accumulated deferred browser visual verification tests from v2.0-v3.0 are executed and documented
  9. Popup subscribes to `lexi:schema-mismatch` and surfaces a "Versjonskonflikt" diagnostic when schema versions diverge
  10. Stale `BUNDLED_LANGS` entries (nn/en) removed from vocab-seam.js
**Plans:** 5 plans (closed out-of-band: most success criteria already shipped in earlier branch work; remaining 3 items — DEBT-02 fixture triage, DEBT-04 schema banner, DEBT-05 BUNDLED_LANGS — landed as commits 41aa4e6 / 72c9c29 / f655552 on 2026-04-28)

### Phase 26: "Lær mer" Pedagogy UI
**Goal**: Students who hit a DE preposition spell-check finding can click "Lær mer" in the popover to expand a teaching panel that explains *why* the case is wrong, shows a correct/incorrect example pair, and (for Wechselpräpositionen) contrasts motion vs placement — all powered by the trilingual pedagogy data already in papertek-vocabulary
**Depends on**: papertek-vocabulary commits 664f2970 / 937ef4a2 / 7bdf6775 (DE prep pedagogy data with nb/nn/en strings)
**Requirements**: PED-01, PED-02, PED-03, PED-04, PED-05, PED-06
**Success Criteria** (what must be TRUE):
  1. The de-prep-case rule's spell-check popover shows a "Lær mer" button when the flagged token has a `pedagogy` block in the lexicon
  2. Clicking "Lær mer" expands a panel below the suggestion showing case label badge, summary, paragraph explanation, and a `correct ✓` / `incorrect ✗` example pair with note
  3. For Wechselpräpositionen the expanded panel additionally shows the motion vs location pair side-by-side (or stacked on narrow inputs)
  4. The colloquial_note (e.g. "want to sound like a young German speaker?", or "in spoken German, dative is common") surfaces as a friendly aside, not a correction
  5. All popover text adapts to the user's chosen UI language (nb / nn / en) — pulled from chrome.storage.local.uiLanguage with nb fallback
  6. Pedagogy data ships in the bundled extension data (offline-first per SC-06) — sync-vocab.js copies the `pedagogy` field from generalbank into extension/data/de.json without bloating it past the 200 KB baseline cap or the 20 MiB packaged-zip cap
  7. A new gate `npm run check-pedagogy-shape` exits 0 when every rule that returns `pedagogy` from `explain()` returns the required fields (case, summary, explanation), and exits 1 otherwise — paired self-test included
  8. The existing `check-explain-contract` gate continues to pass (the optional `pedagogy` field is additive, the required `{nb, nn}` strings stay in place)
**Plans:** 3 plans
Plans:
- [ ] 26-01-PLAN.md — Sync-vocab audit + de.json refresh + prepPedagogy index in vocab-seam-core + de-prep-case finding hookup
- [ ] 26-02-PLAN.md — New check-pedagogy-shape release gate + paired self-test, wired into package.json
- [ ] 26-03-PLAN.md — i18n strings, popover Lær mer button + expandable panel, CSS for case badges / examples / wechsel / colloquial aside, version bump, full gate sweep + human verify

## Progress

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
| 17. Compound Integration | v2.1 | 6/6 | Complete | 2026-04-26 |
| 18. Spell-Check Polish | v2.1 | 2/2 | Complete | 2026-04-26 |
| 19. NB/NN Passiv-s Detection | v2.1 | 3/3 | Complete | 2026-04-26 |
| 20. Browser Verification | v2.1 | 0/0 | Deferred | - |
| 21. Dictionary Intelligence | v2.2 | 2/2 | Complete | 2026-04-26 |
| 21.1 Pipeline Fix (GAP) | v2.2 | 1/1 | Complete | 2026-04-26 |
| 21.2 Data Fixes (GAP) | v2.2 | 1/1 | Complete | 2026-04-26 |
| 22. å/og Confusion | v2.2 | 1/1 | Complete | 2026-04-26 |
| 23. Data-Source Migration | v3.0 | 8/8 | Complete | 2026-04-27 |
| 24. Compound Word Intelligence | 2/2 | Complete    | 2026-04-27 | - |
| 25. UX Polish & Tech Debt | v3.1 | 5/5 | Complete | 2026-04-28 |
| 26. "Lær mer" Pedagogy UI | v3.1 | 0/0 | Not started | - |

---
*Roadmap updated: 2026-04-28 — Phase 25 closed (out-of-band commits); Phase 26 added (Lær mer pedagogy UI)*
