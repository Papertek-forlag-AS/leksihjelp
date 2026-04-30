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
- [x] **Phase 26: "Lær mer" Pedagogy UI** — Spell-check popover gets a "Lær mer" button that expands a teaching panel with explanations, contrastive examples, and Wechselpräposition pairs sourced from papertek-vocabulary pedagogy data (completed 2026-04-28)
- [x] **Phase 27: Exam Mode** — Per-feature exam markers, popup toggle, lockdown teacher-lock, EKSAMENMODUS badge + amber widget border, check-exam-marker release gate (completed 2026-04-28)
- [x] **Phase 28: Lockdown Webapp Exam-Mode Sync (GAP CLOSURE — plumbing only)** — Closed EXAM-08 plumbing 2026-04-28 (lockdown b7a92b4 staging; leksihjelp c6aff0f). Teacher-lock writer split off to Phase 29 (now EXAM-10) because Option B requires a `firestore.rules` deploy + new resource profile UX
- [x] **Phase 29: Lockdown Teacher-Lock UX (NEW — split from Phase 28)** — Wire the teacher-control surface for lockdown's exam-mode lock (EXAM-10): pick UX (new `RESOURCE_PROFILES.LEKSIHJELP_EXAM` vs per-test toggle), update `firestore.rules` + Cloud Functions enums, add UI option + locales, wire `applyExamModeLock` in `writing-environment.js`, manual Firebase deploy to staging-lockdown then lockdown-stb (completed 2026-04-29; 29-03 UAT deferred → Phase 30)
- [ ] **Phase 30: Shared Popup View Modules** — Eliminate drift between leksihjelp's extension popup and lockdown's stub sidepanel. Refactor extension popup into mountable view modules (dictionary/settings/pause/report) with explicit dep injection. Sync into lockdown. Replace stub sidepanel with thin host that excludes auth/payment/audio. Single source of truth in extension repo. Rolls up Phase 29-03 verification.
- [x] **Phase 32: FR/ES Pedagogy (Lær mer)** — First cross-repo data-led pedagogy enrichment for non-DE languages. Three independent rule-units: (A) NEW FR `fr-aspect-hint` rule with passé-composé vs imparfait soft-hint + first FR pedagogy block; (B) ES `por`/`para` pedagogy migration from inline strings to data; (C) ES `gustar`-class pedagogy migration + extension from 1 verb to 10 verbs. Extends `check-explain-contract` with additive pedagogy-shape branch. All data lives in papertek-vocabulary; rules read structured pedagogy from synced JSON. (completed 2026-04-30)
- [ ] **Phase 28.1: Skriveokt-Zero Exam-Mode Sync (GAP CLOSURE)** — Close EXAM-09 for the **second** downstream consumer (Tauri desktop app at `lockdown/skriveokt-zero/`): extend its `scripts/sync-leksihjelp.js` to copy `extension/exam-registry.js`, wire the Tauri loader equivalent to inject it before consumers, refresh stale `src/leksihjelp/*.js`, wire teacher-lock writer in the Tauri exam-profile path, update leksihjelp `CLAUDE.md` to document both consumers
- [x] **Phase 33: v3.1 Cleanup — Phase 30-04 + Lockdown Sync + exam.safe Audit (GAP CLOSURE)** — Close the v3.1 audit's integration gap and cross-phase tech debt: complete Phase 30-04 dict-state-builder extraction (lift sidepanel host's stub flattenBanks/BANK_TO_POS/genusToGender into a shared module, populate full inflection index + NB enrichment + language-switcher state-on-first-paint, fix direction toggle hardcoded to ES, fix B-blocker where exam profile hides ordbok tab); re-run lockdown `sync-leksihjelp.js` to mirror Phase 26/27 surfaces; browser-baseline research to flip `exam.safe=true` on lookup-shaped grammar rules that don't exceed Chrome native parity (Phase 27-01 default-conservative call)
- [ ] **Phase 34: v3.1 Browser UAT Sweep (GAP CLOSURE)** — Close all v3.1 deferred manual browser walkthroughs in one consolidated session: Phase 29-03/30 lockdown exam-mode E2E on staging-lockdown (lock mechanism + dictionary parity + audio-suppression + Phase 28 dev-button regression), 6 Phase 26 Lær mer DE walkthroughs (dativ badge colour, Wechsel pair rendering, Esc collapse, NN locale, EN locale, Tab nav state reset), 3 Phase 32 walkthroughs (FR aspect_choice / ES por-para / extended ES gustar-class verbs render correctly in the Lær mer panel)

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
**Plans:** 3/3 plans complete
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
| 26. "Lær mer" Pedagogy UI | v3.1 | 3/3 | Complete | 2026-04-28 |
| 27. Exam Mode | v3.1 | 3/3 | Complete | 2026-04-28 |
| 28. Lockdown Exam-Mode Sync (GAP) | v3.1 | 0/1 | Pending | - |

### Phase 27: Exam Mode

**Goal:** Make Leksihjelp installable on Norwegian school exam machines. Add a per-feature `examSafe` marker to every user-visible feature (spellcheck rules, dictionary popup, conjugation tables, TTS, word prediction, pedagogy panels, Fest/side-panel surfaces). Add a student-facing exam-mode toggle in the popup that disables every non-exam-safe feature so the extension behaves close to the browser's native spellcheck (which exam regulations permit). Add a teacher-controlled exam-mode lock in the lockdown variant so students cannot turn it off mid-exam. Add a release gate (`check-exam-marker`) that fails CI if any feature ships without an `examSafe` declaration. Cross-app: lockdown sibling project must consume the new marker via the existing sync pipeline.
**Requirements**: EXAM-01, EXAM-02, EXAM-03, EXAM-04, EXAM-05, EXAM-06, EXAM-07, EXAM-08
**Depends on:** Phase 26
**Plans:** 3/3 plans complete

Plans:
- [ ] 27-01-PLAN.md — Marker contract: exam:{safe,reason,category} on every spell-rule + new exam-registry.js for non-rule surfaces
- [ ] 27-02-PLAN.md — check-exam-marker release gate + paired self-test + CLAUDE.md Release Workflow update
- [ ] 27-03-PLAN.md — Runtime gating: popup toggle + lockdown lock + suppression in spell-check/widget/prediction + EKSAMENMODUS badge + amber widget border + i18n + version bump (human verify)

### Phase 28: Lockdown Exam-Mode Sync (GAP CLOSURE)

**Goal:** Close the lockdown-side half of EXAM-08 so exam mode actually deploys on stb-lockdown.app / papertek.app. The v3.1 audit found that `extension/exam-registry.js` is not in the sync pipeline, `LEKSI_BUNDLE` in lockdown's loader does not inject it, the synced content scripts predate Phase 27 (no `examMode` references), and no lockdown code writes `chrome.storage.local.examModeLocked` for teacher control.
**Requirements**: EXAM-08
**Depends on:** Phase 27
**Gap Closure:** Closes the EXAM-08 partial from `.planning/v3.1-MILESTONE-AUDIT.md`
**Cross-repo:** Modifies the lockdown sibling project at `/Users/geirforbord/Papertek/lockdown` (not the leksihjelp tree)

**Success Criteria** (what must be TRUE):
  1. `lockdown/scripts/sync-leksihjelp.js` copies `extension/exam-registry.js` into `lockdown/public/leksihjelp/exam-registry.js`
  2. `lockdown/public/js/leksihjelp-loader.js` `LEKSI_BUNDLE` array includes `'leksihjelp/exam-registry.js'` ahead of `'leksihjelp/spell-check-core.js'` so `host.__lexiExamRegistry` is defined before any consumer initialises
  3. After running the refreshed sync, `grep -l examMode lockdown/public/leksihjelp/*.js` returns matches in `floating-widget.js`, `word-prediction.js`, and `spell-check.js` (proving Phase 27 commits are present)
  4. Lockdown's resource-profile / writing-test resolver writes `chrome.storage.local.set({ examModeLocked: true, examMode: true })` when the teacher selects an exam profile, so the popup's `Slått på av lærer` caption activates inside lockdown
  5. End-to-end: load lockdown locally with exam profile selected → leksihjelp popup shows toggle ON + disabled + locked caption; floating widget shows amber border; word-prediction dropdown does not open; grammar-lookup dots are suppressed but typo dots and dictionary lookups remain
**Plans:** 1 plan
Plans:
- [ ] 28-01-PLAN.md — Lockdown webapp exam-mode integration: sync script + LEKSI_BUNDLE order + re-sync + teacher-lock writer + CLAUDE.md note + human verify

### Phase 29: Lockdown Teacher-Lock UX (NEW — split from Phase 28)

**Goal:** Wire the teacher-control surface for lockdown's exam-mode lock so a teacher can opt students into "leksihjelp + Phase 27 lock" — closing **EXAM-10**. Phase 28 staged the runtime suppression plumbing (`exam-registry.js` synced, `LEKSI_BUNDLE` order, refreshed content scripts), but no lockdown surface writes `chrome.storage.local.examModeLocked` yet, so today the lock is only triggerable via the dev-only "Simuler lærer-lås" button. This phase adds the production teacher-control path.
**Requirements:** EXAM-10
**Depends on:** Phase 28
**Cross-repo:** Modifies the lockdown sibling project at `/Users/geirforbord/Papertek/lockdown` (not the leksihjelp tree). Requires `firestore.rules` deploy and Cloud Functions deploy to both `staging-lockdown` and `lockdown-stb` Firebase projects.

**Success Criteria** (what must be TRUE):
  1. A teacher-control UX is chosen and implemented — Phase 28 verification flagged Option B (new `RESOURCE_PROFILES.LEKSIHJELP_EXAM`) as the user-selected direction; final decision recorded in plan and CONTEXT
  2. `lockdown/firestore.rules` enum (lines ~25, ~30 — the resource-profile allowlist) updated to include the new value, and rules deployed to both `staging-lockdown` and `lockdown-stb` Firebase projects
  3. Cloud Functions enums updated — at minimum `createTest.js` and `toggleResourceAccess.js` — and deployed to both projects
  4. Lockdown UI exposes the new option (teacher resource-profile picker / per-test toggle, whichever Option B variant lands), with `nb`/`nn`/`en` locale strings
  5. `lockdown/public/js/writing-test/student/writing-environment.js` (`applyExamModeLock`-style hook around the existing BSPC-01 wiring at ~line 953) calls `chrome.storage.local.set({ examModeLocked: true, examMode: true })` when the new profile is active, and clears both flags on profile transition away
  6. End-to-end on `stb-lockdown.app`: teacher selects the new profile → student writing environment loads → leksihjelp popup shows toggle ON + disabled + "Slått på av lærer" caption; floating widget gains amber border; word-prediction dropdown does not open; grammar-lookup dots suppressed; typo dots + dictionary lookups remain. Then teacher unselects → flags clear and surfaces re-enable
  7. Phase 28's dev-only "Simuler lærer-lås" button still works (no regression of the dev path)
**Plans:** 3/3 plans complete
Plans:
- [x] 29-01-PLAN.md — Add LEKSIHJELP_EXAM resource profile + locales + classroom illustration + teacher picker (UX decision checkpoint) — Complete 2026-04-28 (lockdown 612bcf1)
- [x] 29-02-PLAN.md — Backend enum (firestore.rules + Cloud Functions) + applyExamModeLock writer + Firebase deploy to staging-lockdown and lockdown-stb — Code Complete 2026-04-28 (lockdown d7825eb + b35b409); staging-lockdown DEPLOYED; **lockdown-stb prod deploy DEFERRED per user instruction**
- [⤓] 29-03-PLAN.md — End-to-end browser verification — DEFERRED to Phase 30. UAT surfaced that lockdown's leksihjelp dictionary panel is a stub; verifying the lock surface in isolation without the dictionary parity in place would be misleading. In-flight fixes during UAT shipped (45df438, 5144f24, a856f43). See 29-03-SUMMARY.md.

### Phase 30: Shared Popup View Modules (lockdown sidepanel parity)

**Goal:** Eliminate drift between leksihjelp's extension popup and lockdown's stub sidepanel by extracting the popup's user-facing views (dictionary, settings, pause, report) into mountable modules with explicit dependency injection. Sync those modules into lockdown via the existing sync script. Replace lockdown's stub `<input>+<div>` panel with a thin host that mounts the synced modules with limited deps (no audio, no auth/payment, no exam-toggle). Single source of truth lives in the extension repo; lockdown holds only the host file declaring what it includes/excludes.
**Requirements:** Closes 29-03 verification scope as a side-effect.
**Depends on:** Phase 29 code (which is deployed on staging-lockdown).
**Cross-repo:** Refactors `extension/popup/popup.js` (no behavior change for extension users); modifies lockdown's `scripts/sync-leksihjelp.js`, `public/js/writing-test/student/writing-environment.js`, and adds `public/js/writing-test/student/leksihjelp-sidepanel-host.js`.

**Success Criteria** (what must be TRUE):
  1. Extension popup behavior unchanged — every existing popup feature still works (auth, payments, dictionary, settings, exam-toggle, etc.). Verified via existing extension manual test pass.
  2. `extension/popup/views/{dictionary,settings,pause,report}-view.js` exist and export `mount{Name}View(container, deps)` functions with no implicit globals — all chrome.storage / chrome.runtime / vocab access via deps.
  3. `lockdown/scripts/sync-leksihjelp.js` copies `extension/popup/views/` → `lockdown/public/leksihjelp/popup/views/` (and any extracted CSS) on next sync.
  4. Lockdown's writing-environment leksihjelp-panel mounts a sidepanel host (new file, lockdown-only) that calls `mountDictionaryView` + `mountSettingsView` + `mountPauseView` + `mountReportView` with limited deps. Vipps login/logout, subscribe/yearly/top-up, quota usage bar, access-code field, "Skriv" button, "Pin" button, vocab refresh, exam-toggle, and "Simuler lærer-lås" are NOT mounted.
  5. **No vocab audio in lockdown.** Dictionary view's audio-play buttons render only when `deps.audioEnabled === true`. Extension passes true; lockdown host passes false. The `extension/audio/` tree is already excluded from sync (verified 2026-04-29) so no MB-level downloads land in lockdown.
  6. End-to-end on `stb-lockdown.app` (Phase 29 + Phase 30 rolled-up UAT): teacher creates LEKSIHJELP_EXAM test → student opens → EKSAMENMODUS badge + locked toggle → leksihjelp engine running → dictionary panel shows full conjugations/declensions, language switcher works, direction toggle works, no audio buttons; profile transition clears lock flags; Phase 28 dev-button regression still passes.
  7. CLAUDE.md "Downstream consumer" section names the new synced surface (`extension/popup/views/`) so a future popup.js change knows it must keep the views' dep contracts stable.

**Plans:** 2/3 plans executed
- [ ] 30-01-PLAN.md — Refactor `extension/popup/popup.js` into mountable view modules with dep injection. Tests for each view module. No behavior change in extension popup.
- [ ] 30-02-PLAN.md — Extend lockdown sync; build `leksihjelp-sidepanel-host.js`; replace stub panel; wire deps with no-audio + no-auth flags; CLAUDE.md update for the new synced surface.
- [ ] 30-03-PLAN.md — Rolled-up E2E browser verification (Phase 29 + Phase 30 UAT): lock mechanism + dictionary parity + audio-suppression + Phase 28 regression. Staging only; production deploy still user-driven.

### Phase 28.1: Skriveokt-Zero Exam-Mode Sync (GAP CLOSURE — DEFERRED)

**Status:** Deferred — papertek zero (skriveokt-zero Tauri app) is **not yet pushed to consumers**, so closing EXAM-09 is NOT blocking for v3.1. Tracked here so it isn't lost; will become must-have once skriveokt-zero ships to schools.
**Goal:** Same gap-closure as Phase 28 but for the **second** downstream consumer that the v3.1 audit blind-spotted: skriveokt-zero, the Tauri desktop app at `/Users/geirforbord/Papertek/lockdown/skriveokt-zero/` that consumes leksihjelp via npm postinstall (`node_modules/@papertek/leksihjelp` → `src/leksihjelp/`). It has its own `scripts/sync-leksihjelp.js`, its own loader (different from the webapp's `LEKSI_BUNDLE` pattern), and its own exam-profile flow.
**Requirements:** EXAM-09
**Depends on:** Phase 28 (so the webapp closure is the canonical reference implementation)
**Cross-repo:** Modifies files inside `lockdown/skriveokt-zero/` and updates leksihjelp `CLAUDE.md`

**Success Criteria** (what must be TRUE when un-deferred):
  1. `lockdown/skriveokt-zero/scripts/sync-leksihjelp.js` copies `extension/exam-registry.js` into `src/leksihjelp/exam-registry.js`
  2. Skriveokt-zero's loader injects `exam-registry.js` BEFORE `spell-check-core.js` so `__lexiExamRegistry` exists when consumers initialise
  3. After running the refreshed sync, `grep -l examMode src/leksihjelp/*.js` returns matches in `floating-widget.js`, `word-prediction.js`, `spell-check.js`
  4. The Tauri exam-profile path writes `chrome.storage.local.set({ examModeLocked: true, examMode: true })` via the chrome shim when teacher activates exam mode
  5. End-to-end: launch the skriveokt-zero desktop app with exam mode enabled → toggle disabled with lock caption, badge visible, widget amber border, prediction suppressed, grammar-lookup dots suppressed, typo dots + dictionary lookups remain
  6. Leksihjelp `CLAUDE.md` "Downstream consumer" section is updated to document BOTH consumers (the webapp + skriveokt-zero), with each consumer's sync path and loader contract listed
**Plans:** 1 plan (estimated, deferred)

### Phase 33: v3.1 Cleanup — Phase 30-04 + Lockdown Sync + exam.safe Audit (GAP CLOSURE)

**Goal:** Close the v3.1 audit's integration gap and accumulated cross-phase tech debt so v3.1 can be archived cleanly. Three independent work-units:
  - **(A) Phase 30-04 completion** — finish dict-state-builder extraction so the lockdown sidepanel host has full vocab state (full inflection index, NB enrichment, language-switcher state-on-first-paint), fix sidepanel direction toggle currently hardcoded to ES, and fix the B-blocker where the exam profile hides the ordbok tab. Unblocks lockdown prod-merge.
  - **(B) Lockdown sync hygiene** — run `node scripts/sync-leksihjelp.js` from `/Users/geirforbord/Papertek/lockdown` to mirror Phase 26 + Phase 27 surfaces (`spell-check.js`, `content.css`, `i18n/strings.js`, `exam-registry.js`).
  - **(C) exam.safe browser-baseline audit** — revisit lookup-shaped grammar rules currently classified `exam.safe=false` (Phase 27-01 default-conservative call) and flip to `safe=true` any rule that doesn't actually exceed Chrome native parity.

**Requirements:** None new (closes integration gap on EXAM-10 surfaces + Phase 30-04 dict-state-builder)
**Depends on:** Phase 30 (sidepanel host scaffolding), Phase 27 (exam-marker contract)
**Cross-repo:** Touches both `extension/popup/views/` (dict-state-builder lift) and `lockdown/` (sync re-run + sidepanel host integration)
**Gap Closure:** Closes the integration partial from `.planning/v3.1-MILESTONE-AUDIT.md` (Phase 30-04 unshipped, lockdown sync stale, exam.safe over-conservative)

**Success Criteria** (what must be TRUE):
  1. A shared `dict-state-builder` module is exported from the extension popup views surface; lockdown's sidepanel host imports it instead of inlining stubs of `flattenBanks` / `BANK_TO_POS` / `genusToGender`.
  2. Lockdown's sidepanel populates the full vocab state on first paint: language switcher works (no hardcoded direction), direction toggle reflects the actual selected pair (not stuck on ES), and the inflection index + NB enrichment match the extension popup's behaviour.
  3. The exam profile no longer hides the ordbok tab in the lockdown sidepanel — the dictionary view renders inside the EKSAMENMODUS envelope, gated only by per-feature exam markers (audio off, conjugation tables on, etc.).
  4. After running lockdown's `node scripts/sync-leksihjelp.js`, `git status` in lockdown shows the Phase 26 + Phase 27 surfaces refreshed (or no diff if already in sync); `npm run check-popup-deps` and `npm run check-explain-contract` still exit 0 in leksihjelp.
  5. Each rule under `extension/content/spell-rules/` whose work is purely lookup (no algorithmic generation beyond Chrome native spellcheck) and is currently `exam.safe=false` is either flipped to `safe=true` with an updated `reason` string, or has a one-line note in the rule file documenting why it stays conservative. `check-exam-marker` exits 0.
  6. Version bumped (`extension/manifest.json` + `package.json` + `backend/public/index.html` aligned per the Release Workflow). Downstream consumers re-pin.
  7. All 15 release-workflow gates exit 0.

**Plans:** 3/3 plans complete
Plans:
- [x] 33-01-PLAN.md — Lift dict-state-builder into a shared module + remove sidepanel host stubs + fix direction toggle + fix exam-profile ordbok hide
- [x] 33-02-PLAN.md — Lockdown sync re-run + verify Phase 26/27 surfaces refreshed; document any diffs that need upstream fix
- [x] 33-03-PLAN.md — exam.safe browser-baseline audit + flip lookup-shaped rules + version bump + full gate sweep

### Phase 34: v3.1 Browser UAT Sweep (GAP CLOSURE)

**Goal:** Close all v3.1 deferred manual browser walkthroughs in one consolidated session so v3.1 can be archived without `human_needed` items rolling forward indefinitely. Single phase, single plan, single QA day.
**Requirements:** None new (closes flow gap from v3.1 audit + tech debt walkthrough backlog)
**Depends on:** Phase 33 (Phase 30-04 prod-blocker fixes need to be in place before lockdown UAT is meaningful)
**Gap Closure:** Closes the flow gap (Phase 29-03/30 lockdown exam-mode UAT) and tech-debt browser walkthroughs from Phase 26 + Phase 32

**Success Criteria** (what must be TRUE):
  1. **Lockdown exam-mode E2E (Phase 29-03 + Phase 30 rolled-up UAT, on staging-lockdown):** teacher creates a LEKSIHJELP_EXAM test → student loads writing environment → leksihjelp popup shows toggle ON + disabled + "Slått på av lærer" caption; floating widget gains amber border; word-prediction dropdown does not open; grammar-lookup dots are suppressed; typo dots + dictionary lookups remain. Profile transition clears `examModeLocked` + `examMode`. Phase 28's dev-only "Simuler lærer-lås" button still works.
  2. **Lockdown sidepanel dictionary parity:** ordbok tab visible inside EKSAMENMODUS, full conjugations/declensions render, language switcher works, direction toggle works, no audio buttons render.
  3. **Phase 26 Lær mer DE walkthroughs (6/6):** dativ case badge colour matches the case colour token; Wechselpräposition pair renders side-by-side on wide inputs and stacked on narrow; Esc collapses the panel; NN locale strings render correctly when `uiLanguage=nn`; EN locale strings render when `uiLanguage=en`; Tab navigation between markers resets panel state.
  4. **Phase 32 walkthroughs (3/3):** FR `fr-aspect-hint` rule → Lær mer panel renders `pedagogy.aspect_choice` from synced `fr.json`; ES `es-por-para` rule → Lær mer panel renders por/para pedagogy from data (not inline strings); ES `es-gustar` rule → Lær mer panel renders extended gustar-class pedagogy on the new verbs (encantar/interesar/doler/etc).
  5. UAT findings either land as in-flight fixes during the session or are filed as discrete follow-up phases — no `human_needed` deferrals roll forward.
  6. VERIFICATION.md authored summarising the walk, with screenshots/notes per surface and a clear pass/fail per criterion.

**Plans:** 0/1 plan (planned)
Plans:
- [ ] 34-01-PLAN.md — Consolidated browser UAT walkthrough script + VERIFICATION.md authoring

### Phase 32: FR/ES Pedagogy (Lær mer)

**Goal:** Establish the cross-repo data-led pedagogy pattern for non-DE languages. Data (every pedagogy string) lives in papertek-vocabulary; functions (rule files) live in leksihjelp and read structured pedagogy from the synced JSON. Three independent rule-units, three cross-repo PRs, three independent leksihjelp version bumps. The Phase 26 Lær mer panel surface is reused with zero changes — same widget, more languages.

**Requirements:** PHASE-32-A (FR aspect-hint rule + first FR pedagogy block), PHASE-32-B (ES por/para pedagogy migration), PHASE-32-C (ES gustar-class pedagogy migration + extension to 10 verbs)
**Depends on:** Phase 26 (Lær mer panel surface), Phase 27 (exam markers — every new rule needs one)
**Cross-repo:** Modifies papertek-vocabulary (data) + leksihjelp (rule + gate updates)

**Success Criteria** (what must be TRUE):
  1. FR `fr-aspect-hint` rule fires on ≥80% of fixture positives, ≤2% FP on negatives. Lær mer panel renders pedagogy.aspect_choice from synced fr.json.
  2. ES `es-por-para` rule still passes existing 50-case fixture at P=R=F1=1.000; pedagogy now sourced from por_prep.pedagogy + para_prep.pedagogy in synced es.json.
  3. ES `es-gustar` rule passes existing 94-case fixture at P=R=F1=1.000 AND extends to ≥30 new fixture cases at ≥80% recall on encantar/interesar/doler/faltar/etc. Class membership read from `verb_class: gustar-class` in verbbank; pedagogy from shared pedagogy.gustar_class entry.
  4. `check-explain-contract` extended with additive pedagogy-shape branch (validates non-empty summary.nb/summary.en, explanation.nb, examples shape if present, common_error shape if present); paired :test gate covers positive + negative scratch rules.
  5. All 15 release-workflow gates exit 0.
  6. Three independent version bumps (one per plan) signal lockdown + skriveokt-zero downstream consumers to re-pin.

**Plans:** 3/3 plans complete
Plans:
- [ ] 32-01-PLAN.md — FR aspect-hint rule + first FR pedagogy block + check-explain-contract pedagogy branch
- [ ] 32-02-PLAN.md — ES por/para pedagogy migration (inline strings → data)
- [ ] 32-03-PLAN.md — ES gustar pedagogy migration + extension from 1 to 10 verbs


---
*Roadmap updated: 2026-04-28 — Phase 25 closed (out-of-band commits); Phase 26 added (Lær mer pedagogy UI); Phase 27 added (Exam Mode — major architecture change); Phase 28 added (lockdown webapp exam-mode sync — gap closure for EXAM-08 from v3.1 audit); Phase 28.1 added as DEFERRED (skriveokt-zero Tauri sync, EXAM-09 — surfaced during Phase 28 walkthrough as a second downstream consumer; not blocking v3.1 because skriveokt-zero is not yet shipped to consumers); Phase 28 closed as plumbing-only and Phase 29 added (lockdown teacher-lock UX, EXAM-10 — Task 4 split out because Option B requires firestore.rules + Cloud Functions deploy)*
