# Milestones

## v3.1 Polish & Intelligence (Shipped: 2026-05-01)

**Phases completed:** 13 phases (24-36 + Phase 28.1 deferred by design), 32 plans, 23/23 in-scope requirements satisfied. EXAM-09 deferred (skriveokt-zero not yet shipped).

**Timeline:** 2026-04-27 → 2026-05-01 (5 days)
**Released versions:** 2.5.0 → 2.9.18 (18 published versions)
**Release gates:** 12 (added INFRA-08 benchmark-coverage, INFRA-09 governance-data, INFRA-10 vocab-seam-coverage)
**Bundle:** 12.68 MiB / 20 MiB cap; NB baseline 130 KB / 200 KB cap

**Delivered (one sentence):** Compound-word dictionary intelligence, an expandable "Lær mer" pedagogy panel covering DE preps + FR aspect + ES por/para + ES gustar-class (10 verbs), per-feature exam-mode markers with student toggle + lockdown teacher-lock + cross-app sync, shared popup view modules unifying extension popup with the lockdown sidepanel host, and an INFRA-10 release gate that defends the entire vocab seam from silent-empty regressions.

**Key accomplishments:**

1. **Compound Word Intelligence** (Phase 24) — `decomposeCompound`-powered popup search suggests compounds from partial input (e.g., "chefsstu" → "Chefsstuhl"); compound card displays pedagogical note explaining last-component-determines-gender with clickable component navigation + "Tilbake til [compound]" back-link; qualified translation guess assembled from component translations. Built atop the v3.0 IndexedDB vocab cache.

2. **"Lær mer" Pedagogy Panel** (Phases 26 + 32) — Spell-check popover gains an expandable teaching panel rendering case badges, summary, paragraph explanation, correct/incorrect example pairs, Wechselpräposition motion-vs-location pairs, and `colloquial_note` asides. Trilingual (nb/nn/en) data sourced from papertek-vocabulary `pedagogy` field. Phase 32 extended pattern to FR (`fr-aspect-hint` — first FR pedagogy block, passé-composé vs imparfait soft-hint), ES por/para (data-led migration), and ES gustar-class (1 → 10 verbs: encantar/interesar/doler/etc, fixture extended to ≥30 cases at ≥80% recall). New `check-explain-contract` pedagogy-shape branch + paired self-test; new `check-pedagogy-shape` gate.

3. **Exam Mode** (Phases 27 + 28 + 29) — Per-feature `exam: { safe, reason, category }` marker on every spell-check rule + new `extension/exam-registry.js` for non-rule UI surfaces (dictionary popup, conjugation tables, TTS, word prediction, pedagogy panels, side panel). Student-facing toggle in popup with EKSAMENMODUS badge + amber widget border. Lockdown teacher-lock via new `RESOURCE_PROFILES.LEKSIHJELP_EXAM` profile — `firestore.rules` enum + Cloud Functions enum + locales (nb/nn/en) + `applyExamModeLock` writer + classroom illustration. Five resource profiles consistent across firestore + Cloud Functions + UI. New `check-exam-marker` release gate. Default-conservative classification with `exam.safe=false` on lookup-shaped grammar rules pending browser-baseline audit (Phase 33 flipped where appropriate).

4. **Shared Popup View Modules** (Phase 30) — Extracted `extension/popup/popup.js` user-facing surfaces into `extension/popup/views/{dictionary,settings,pause,report}-view.js` with explicit dependency injection (no `chrome.*` / `window.__lexi*` / unscoped `getElementById` — enforced by new `check-popup-deps` gate + paired self-test). Lockdown's stub `<input>+<div>` sidepanel replaced with `leksihjelp-sidepanel-host.js` that mounts the synced view modules with limited deps (`audioEnabled: false`, no auth/payment, no exam-toggle). Three independent safeguards keep audio out of lockdown.

5. **Phase 30-04 dict-state-builder + lockdown sync hygiene** (Phase 33) — Lifted `flattenBanks` / `BANK_TO_POS` / `genusToGender` from sidepanel-host stubs into a shared module so lockdown gets full inflection index + NB enrichment + working language switcher + working direction toggle (was hardcoded to ES) + visible ordbok tab inside EKSAMENMODUS envelope. Re-ran lockdown sync to mirror Phase 26/27 surfaces. Browser-baseline `exam.safe` audit flipped lookup-shaped rules where appropriate.

6. **INFRA-10 vocab-seam-coverage release gate** (Phase 36) — Static-parses `vocab-seam-core.js`'s `buildIndexes` return literal (incl. `...moodIndexes` recursive resolution), enumerates every key, asserts each non-exempt key has matching `getX()` getter on `vocab-seam.js` AND matching entry in `spell-check.js`'s `runCheck()` `vocab` consumer composition. Paired `:test` self-test. Caught three additional seam-bug instances (`frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms`) on first run that the v2.9.15 ad-hoc fix had missed. Plus population canaries asserting indexes are non-empty under the default preset, defending against the seam-bug class that took down Phase 35 verification.

7. **UAT debt closure cycle** (Phases 34 + 35 + 36) — Three-phase consolidated walkthrough sequence: Phase 34 surfaced 7 findings (F1-F7); Phase 35 closed F1/F2/F3/F5/F6 (FR aspect-hint trigger, ES gustar/doler data, DE Wechselpräposition, Tab-nav focus-restore race) plus deferred F7 to a vanilla extension UAT session; Phase 36 closed F36-1..F36-5 (FR partial spell-check priority/dedupe, ES Aa-pill watch-item, DE kein/keine paradigm, `noAutoFix` opt-in on structural rules) and added the INFRA-10 process gate that defends against the regression class going forward.

8. **Pre-archive hygiene** (Quick Task 1) — Flipped EXAM-01..EXAM-07 in REQUIREMENTS.md from "Planned" → "Complete" to match verification reality. Deleted orphan `.planning/phases/31-fr-rule-suite/` directory (only CONTEXT.md, never made it into roadmap; FR work shipped under Phase 32). Backfilled retroactive `25-VERIFICATION.md` documenting out-of-band commits 41aa4e6 / 72c9c29 / f655552 / 2438f49 for the Phase 25 success criteria that shipped in earlier branch work without formal phase execution.

**Known Tech Debt (deferred to v3.2 by design):**

- Browser UAT backlog (6 walkthroughs): F36-1 fr-aspect-hint browser confirmation; F7 Phase 26 NN + EN Lær mer locale walks; Phase 30 lockdown sidepanel 8-step staging UAT; Phase 26 6 DE Lær mer browser walks (partial); Phase 27 9-step exam-mode walk; Phase 30-01 9-step extension popup view walk.
- Lockdown-stb production Firebase deploy outstanding (firestore rules + Cloud Functions for EXAM-10; staging-lockdown deployed 2026-04-28).
- Lockdown papertek.app production hosting deploy outstanding (Phase 30 sidepanel host; staging-lockdown deployed).
- Phase 28.1 (skriveokt-zero exam-mode sync) un-defer when skriveokt-zero ships to consumers.
- Pre-existing FR sidecar 404 console noise (bigrams-fr / freq-fr / pitfalls-fr) — gracefully handled, visible in DevTools only.

**See:**
- `.planning/milestones/v3.1-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v3.1-REQUIREMENTS.md` — final traceability (23/23)
- `.planning/milestones/v3.1-MILESTONE-AUDIT.md` — audit report (tech_debt, all in-scope requirements satisfied)

---

## v3.0 Data-Source Migration (Shipped: 2026-04-27)

**Phases completed:** 1 phase (23), 8 plans, 16/16 requirements satisfied.

**Timeline:** 2026-04-27 (1 day, 28 commits)
**Code delta:** 71 files changed, +5,242 / -2,472 lines
**Extension LOC:** 21,091 JS
**Bundle:** 2.17 MiB / 20 MiB cap (down from 12.59 MiB — bundled vocab removed)

**Delivered (one sentence):** Migrated the extension's vocabulary data source from bundled JSON files to a Papertek-API-fetched IndexedDB cache with offline-first NB baseline, atomic update detection, silent v2→v3 migration, and two new release gates — shrinking the extension zip from 12.59 MiB to ~2 MiB while preserving the offline promise.

**Key accomplishments:**

1. **Papertek API vocabulary endpoints** (Plan 23-01) — `GET /api/vocab/v1/bundle/{language}` returns full per-language payload (all banks + freq + bigrams + grammar features + falseFriends + senses) with `{schema_version, revision}` metadata; `GET /api/vocab/v1/revisions` returns lightweight revision map; pre-gzip compression drops DE wire size from 4.45 MB to ~795 KB; CORS whitelists chrome-extension + leksihjelp.no.
2. **IndexedDB cache adapter + baseline-first hydration** (Plan 23-02) — `vocab-store.js` IDB adapter with schema_version gating; `vocab-seam.js` loads NB baseline synchronously then swaps to full indexes asynchronously; `swapIndexes` idempotent atomic swap; spell-check + word-prediction never block on network.
3. **NB baseline + service-worker bootstrap + popup status UI** (Plan 23-03) — `build-nb-baseline.js` filters to top-2k Zipf + pronouns/articles/typos (~130 KB); `vocab-bootstrap.js` auto-downloads on install; popup pills show per-language progress with offline error differentiation.
4. **Update detection + manual refresh** (Plan 23-04) — `vocab-updater.js` checks revisions on startup; popup "Nye ordlister tilgjengelig" notice with "Oppdater ordlister nå" button; atomic cache replacement via IndexedDB transaction; two-channel sync (push + poll on popup open).
5. **Silent v2→v3 migration + bundled data removal** (Plan 23-05) — `onInstalled` migration trigger writes `lexiMigratedFromV2` breadcrumb and bootstraps fresh IDB downloads; 20 bundled data files deleted (de/es/fr/en/nb/nn vocab + freq + bigrams + grammarfeatures); test fixtures migrated to `tests/fixtures/vocab/`; lockdown adapter contract documented.
6. **Release gates: SC-06 carve-out + baseline cap** (Plan 23-06) — `check-network-silence` SC-06 carve-out documents `vocab-bootstrap.js` as the sanctioned fetch site with self-test; `check-baseline-bundle-size` enforces 200 KB cap on NB baseline with paired self-test.

**Known Tech Debt (from audit):**
- SCHEMA-01 developer-view UX: `lexi:schema-mismatch` message emitted but no popup subscriber (dormant while schema_version=1)
- Stale `BUNDLED_LANGS` list in `vocab-seam.js` includes deleted nn/en files (cosmetic, no runtime break)
- check-fixtures exits 1 from 5 pre-existing suites outside Phase 23 scope
- 2 human verification items with code-level approval but incomplete step-by-step logs

**See:**
- `.planning/milestones/v3.0-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v3.0-REQUIREMENTS.md` — final traceability (16/16)
- `.planning/milestones/v3.0-MILESTONE-AUDIT.md` — audit report (tech_debt, all requirements satisfied)

---

## v2.2 Student Language Intelligence (Shipped: 2026-04-27)

**Phases completed:** 4 phases (21–22, including 21.1 and 21.2 gap-closure decimal phases), 5 plans, 12/12 requirements satisfied.

**Timeline:** 2026-04-26 → 2026-04-27 (1 day, 28 commits)
**Code delta:** 35 files changed, +3,258 / -104 lines
**Rule engine:** 59 rule files (new: `nb-aa-og.js`), 12 new fixtures
**Bundle:** 12.59 MiB / 20 MiB cap
**Unit tests:** 6 new tests (dictionary intelligence + å/og confusion)

**Delivered (one sentence):** Dictionary intelligence that prevents wrong-word choices — false-friend warning banners (~56 curated pairs), sense-grouped preposition translations, cross-language NB→target enrichment pipeline — plus å/og confusion detection for Norway's most common writing error.

**Key accomplishments:**

1. **False-friend warnings** (Phase 21) — `renderFalseFriends` in popup.js and floating-widget.js; 56 curated NB→EN/DE/ES/FR pairs from Papertek API `falseFriends` field; prominent banner above translations warns students before they pick a wrong cognate (e.g., "aktuell" ≠ "actual").
2. **Sense-grouped translations** (Phase 21) — `renderSenses` replaces flat translation list with expandable sense headers (location, time, manner); prevents "grab first translation of på" error.
3. **Cross-language enrichment pipeline** (Phase 21.1) — Reverse `linkedTo` index pattern: NB entries are canonical source for `falseFriends`/`senses`; popup builds Map-based `nbEnrichmentIndex` for O(1) lookup; floating-widget uses linear scan for single-word lookup.
4. **Data pipeline fixes** (Phase 21.2) — Fixed missing `linkedTo` entries at Papertek API (`fin_adj`→FR, `på_contr`→DE); re-synced all 6 language data files; DE sense-grouped and FR false-friend now reachable end-to-end.
5. **å/og confusion detection** (Phase 22) — `nb-aa-og.js` (priority 15) with posture-verb exception set (sitter/står/ligger/går + og + verb = valid progressive aspect); 12 regression fixtures; explain-contract + CSS wiring gates; removed å/og from homophones rule to prevent duplicate flagging.

**Known Tech Debt (from audit):**
- 12 deferred browser visual verification tests (accumulated across Phases 21, 21.1, 21.2, 22)
- Version skew: package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1 — needs alignment at release

**See:**
- `.planning/milestones/v2.2-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v2.2-REQUIREMENTS.md` — final traceability (12/12)
- `.planning/milestones/v2.2-MILESTONE-AUDIT.md` — audit report (tech_debt, all requirements satisfied)

---

## v2.1 Compound Decomposition & Polish (Shipped: 2026-04-26)

**Phases completed:** 4 code phases (16–19), 13 plans, 11/12 requirements satisfied. Phase 20 (browser visual verification) deferred.

**Timeline:** 2026-04-25 → 2026-04-26 (1 day, 70 commits)
**Code delta:** 39 files changed, +27,808 / -3,947 lines
**Rule engine:** 58 rule files, 3 new rules (nb-compound-gender, nb-demonstrative-gender, nb-triple-letter, nn_passiv_s, doc-drift-nb-passiv-overuse)
**Bundle:** 12.59 MiB / 20 MiB cap
**Unit tests:** 58 tests across 4 test files, all passing

**Delivered (one sentence):** Algorithmic compound decomposition for NB/NN/DE with dictionary popup rendering, spell-check acceptance, gender inference, sarskriving expansion — plus spell-check polish (manual trigger, demonstrative-gender, triple-letter) and NB/NN s-passive detection with deponent recognition.

**Key accomplishments:**

1. **Compound decomposition engine** (Phase 16) — `decomposeCompound` in `vocab-seam-core.js` splits unknown NB/NN/DE compounds at known noun boundaries with linking elements (s, e, n, en, er, es), recursive up to 4 components, <2% false-positive rate on full nounbank validation.
2. **Compound dictionary + spell-check integration** (Phase 17) — "Samansett ord" card in popup with clickable components and gender badge; spell-check compound acceptance (typo d=1 > decomposition precedence); NB/NN compound gender mismatch rule via shared engine; sarskriving expansion with decomposition fallback then removal (supplementary compounds preserve recall).
3. **Spell-check polish** (Phase 18) — Manual trigger button with toast feedback; `nb-demonstrative-gender` rule (priority 12) for den/det/denne/dette + noun mismatch; `nb-triple-letter` rule (priority 45) for accidental triple-letter typos.
4. **NB/NN s-passive detection** (Phase 19) — Papertek data enrichment (648 NB + 435 NN s-passive forms, 8 deponent verbs); `sPassivForms` vocab-seam index; `nn_passiv_s` finite s-passive rule; `doc-drift-nb-passiv-overuse` hint; algorithmic NN presens derivation (-ast → -est); deponent override list.
5. **Unit test suite** (cross-phase) — 58 tests covering decomposition, compound gender, demonstrative-gender, triple-letter, s-passive indexing, NN passiv rule, NB overuse hint. All passing.

**Known Gap:**
- VERIF-01: Browser visual verification (Phase 20) never executed — deferred to next milestone or ad-hoc verification.

**See:**
- `.planning/milestones/v2.1-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v2.1-REQUIREMENTS.md` — final traceability (11/12)

---

## v2.0 Depth of Coverage — Grammar Governance Beyond Tokens (Shipped: 2026-04-25)

**Phases completed:** 12 phases (6–15.1, including 2 gap-closure decimal phases), 31 plans, 42/42 requirements satisfied.

**Timeline:** 2026-04-24 → 2026-04-25 (2 days, ~140 commits)
**Code delta:** 213 files changed, +28,530 / -424 lines
**Rule engine:** 57 rule files (9,148 LOC), core engine 2,793 LOC, 53 fixture suites (3,326 lines)
**Bundle:** 12.47 MiB / 20 MiB cap

**Delivered (one sentence):** Extended the spell-check surface from per-token rules into structural grammar governance — word-order violations, case/agreement, aspect/mood, register drift, collocations — across 5 languages with 42 requirements, 9 release gates, and 2,734 regression fixtures all green.

**Key accomplishments:**

1. **Structural infrastructure** (Phase 6) — Sentence segmenter (`Intl.Segmenter`), priority bands (P1 error / P2 warn / P3 hint) with distinct dot-colour CSS tiers, severity contract on explain output, quotation-span suppression, `check-benchmark-coverage` + `check-governance-data` release gates with paired self-tests. Register/collocation/redundancy rules validated the infrastructure.
2. **Word-order rules** (Phase 7) — Tagged-token POS view (`ctx.getTagged(i)`, `findFiniteVerb`, `isMainClause`) in `spell-check-core.js`; NB V2 inversion, DE main-clause V2 + subordinate verb-final, FR BAGS adjective placement; Phase 13 document-state seam shape documented.
3. **DE case & agreement governance** (Phase 8) — Preposition-case mismatches (adjacent window), unsplit separable verbs, wrong perfekt auxiliary, compound-noun gender; shared `grammar-tables.js` primitive consumed by Phases 9–13.
4. **ES structural rules** (Phases 9, 11, 12) — ser/estar copula, por/para trigger tree, personal "a"; subjuntivo trigger sets (ES + FR), pretérito/imperfecto aspectual hints; pro-drop overuse, gustar-class syntax, FR clitic-cluster ordering.
5. **FR structural rules** (Phases 10, 11, 12) — Élision detection, être/avoir auxiliary, participe passé agreement (10.3a adjacent-window scope, 10.3b deferred to v3.0); subjonctif triggers; clitic-order rule.
6. **Document-level analysis** (Phase 13) — Two-pass runner (`kind: 'document'` rules), `detectDrift` helper, `check-stateful-rule-invalidation` gate; DE du/Sie drift, FR tu/vous drift, NB bokmål/riksmål mixing, NN a-/e-infinitiv mixing.
7. **Morphology & collocations** (Phases 14, 15) — EN irregular overgeneration (`childs`, `eated`), ES/FR opaque-noun gender, EN word-family POS confusion; preposition-collocation errors across NB/DE/FR/ES with 97 seed entries.
8. **Gap closure** (Phases 14.1, 15.1) — Vocab-seam browser wiring (9 missing indexes), deleted `doc-drift-de-address.js` restored, 27 fixture failures triaged (stale rule-ids, missing co-fire expectations).

**See:**
- `.planning/milestones/v2.0-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v2.0-REQUIREMENTS.md` — final traceability (42/42)
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md` — audit report (passed, all 9 gates green)

---

## v1.0 Spell-Check & Prediction Quality (Shipped: 2026-04-21)

**Phases completed:** 8 phases (1, 2, 02.1, 3, 03.1, 4, 5, 05.1), 29 plans, 19/19 v1 requirements satisfied.

**Timeline:** 2026-04-18 → 2026-04-21 (4 days, 133 commits)
**Code delta:** 150 files changed, +162,913 / -95,958 lines
**Shipped artifact:** `leksihjelp-2.3.1.zip` (~10.25 MiB / 20 MiB cap)

**Delivered (one sentence):** Norwegian spell-check and word-prediction promoted from v1 proof-of-concept to production quality — Zipf-ranked fuzzy matching, particular-særskriving gated at P≥0.92/R≥0.95, NB↔NN cross-standard detection, student-friendly explain popover — all offline, all free, all extension-side.

**Key accomplishments:**

1. **Vocab seam + regression fixture** (Phase 1) — `__lexiVocab` shared module replaces `__lexiPrediction`; `scripts/check-fixtures.js` runner with 262 hand-authored NB/NN cases across 5 rule classes; P/R/F1 gated per rule; new release-workflow gate.
2. **Data foundation** (Phase 2 + 02.1) — NB N-gram 2021 Zipf frequency tables (`freq-{nb,nn}.json`), expanded bigrams, typo-bank growth in sibling `papertek-vocabulary`; bundle-size release gate at 20 MiB internal engineering ceiling (zip 10.25 MiB, 9.75 MiB headroom).
3. **Plugin rule architecture + Zipf ranking** (Phase 3 + 03.1) — `extension/content/spell-rules/` registry (add a rule = add one file); `nb-typo-fuzzy` + word-prediction ranking both consume frequency signal; SC-01 closed end-to-end after audit caught browser wiring gap (`VOCAB.getFreq()` + `runCheck` vocab literal + adapter-contract guard); `check-network-silence` gate enforces SC-06.
4. **NB/NN false-positive reduction** (Phase 4) — `nb-propernoun-guard` (priority 5, name/loan layers), `nb-codeswitch` (priority 1, density window with `ctx.suppressed`), `sisterValidWords` cross-standard rail, særskriving fixture expanded to 55 NB + 46 NN with THRESHOLDS gate (observed P=1.000 R=1.000).
5. **Student-facing polish** (Phase 5 + 05.1) — `rule.explain: (finding) => ({nb, nn})` callable on 5 popover-surfacing rules; renderExplain 3-way lookup; top-3 suggestions cap with "Vis flere ⌄" reveal; NB/NN register badge in popover header; `check-explain-contract` + `check-rule-css-wiring` release gates.
6. **SC-03 policy reversal — flag cross-standard tokens** (Phase 05.1 Gap D) — reversed earlier NB↔NN dialect tolerance per user domain policy (two distinct official standards): new `nb-dialect-mix.js` (priority 35) with `CROSS_DIALECT_MAP` authoritative fire-gate; typo rules no longer early-exit into sister-valid lookup.
7. **Chrome smoke test + 8-gate release checklist** (Phase 05.1) — 11/11 smoke-test scenarios PASS on `leksihjelp-2.3.1`; 4 inline-discovered browser bugs resolved (feature-gated lookup decouple, modal-verb bare-infinitive silent, dialect-mix CROSS_DIALECT_MAP fire-gate, dialect-mix dot CSS missing); all 8 release gates (fixtures, explain-contract + self-test, rule-CSS wiring + self-test, feature-independent indexes, network silence, bundle size) exit 0.

**See:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v1.0-REQUIREMENTS.md` — final traceability (19/19)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — audit report (passed 19/19, 2 doc-drift items resolved pre-tag)

---

