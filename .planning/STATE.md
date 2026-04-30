---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Polish & Intelligence
status: planning
last_updated: "2026-04-30T22:06:24.346Z"
last_activity: "2026-04-30 -- Plan 33-03 complete. exam.safe audit: 22 lookup-shaped rules flipped to safe=true (NB/EN/DE/ES/FR single-token banks + gender/elision/contraction/coordination/agreement); 27 stayed with one-line audit comment (pedagogy / multi-token / doc-drift / context-dependent aux/mood). Version bumped 2.9.11 -> 2.9.12 across manifest.json + package.json + backend/public/index.html. All 24 release gates green (check-fixtures, check-explain-contract+test, check-rule-css-wiring+test, check-spellcheck-features, check-network-silence+test, check-exam-marker+test, check-popup-deps+test, check-bundle-size, check-baseline-bundle-size+test, check-benchmark-coverage+test, check-governance-data+test, check-pedagogy-shape+test, check-stateful-rule-invalidation+test, test:vocab-store/seam/popup-views/dict-state-builder). Bundle 12.67 MiB / 20 MiB cap. NB baseline 130 KB / 200 KB cap. Final ship step: leksihjelp main pushed; lockdown staging branch (beadf6b from 33-02) pushed."
progress:
  total_phases: 12
  completed_phases: 7
  total_plans: 27
  completed_plans: 21
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.1 Polish & Intelligence -- Phase 24 ready to plan

## Position

**Milestone:** v3.1 Polish & Intelligence (cleanup phase)
**Phase:** 33 (v3.1 cleanup) -- COMPLETE
**Plan:** Phase 33 done (3/3 plans complete); next milestone work or close v3.1
**Status:** Ready to plan
**Last activity:** 2026-04-30 -- Plan 33-03 complete. exam.safe audit: 22 lookup-shaped rules flipped to safe=true (NB/EN/DE/ES/FR single-token banks + gender/elision/contraction/coordination/agreement); 27 stayed with one-line audit comment (pedagogy / multi-token / doc-drift / context-dependent aux/mood). Version bumped 2.9.11 -> 2.9.12 across manifest.json + package.json + backend/public/index.html. All 24 release gates green (check-fixtures, check-explain-contract+test, check-rule-css-wiring+test, check-spellcheck-features, check-network-silence+test, check-exam-marker+test, check-popup-deps+test, check-bundle-size, check-baseline-bundle-size+test, check-benchmark-coverage+test, check-governance-data+test, check-pedagogy-shape+test, check-stateful-rule-invalidation+test, test:vocab-store/seam/popup-views/dict-state-builder). Bundle 12.67 MiB / 20 MiB cap. NB baseline 130 KB / 200 KB cap. Final ship step: leksihjelp main pushed; lockdown staging branch (beadf6b from 33-02) pushed.

Progress: [██████████] 100% (Phase 33 complete — 3/3 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (v3.1)
- Cumulative across milestones: 91 plans shipped (Phase 26 added 3)

| Phase | Plan | Duration (min) | Tasks | Files |
| ----- | ---- | -------------- | ----- | ----- |
| 26    | 03   | 12             | 4     | 6     |
| 27    | 01   | 18             | 2     | 62    |
| 27    | 02   | 2              | 2     | 4     |
| 27    | 03   | 22             | 3     | 12    |
| 29    | 01   | 12             | 2     | 6     |
| 29    | 02   | 22             | 3     | 5     |
| Phase 30 P01 | 14 | 1 tasks | 9 files |
| Phase 30 P01 | 50 | 3 tasks | 11 files |
| Phase 30 P02 | 10 | 4 tasks | 8 files |
| Phase 32-fr-es-pedagogy P02 | 12 | 2 tasks | 5 files |
| Phase 32-fr-es-pedagogy P01 | 23 | 3 tasks | 9 files |
| Phase 32 P03 | 75 | 2 tasks | 8 files |
| Phase 33 P01 | 32 | 4 tasks | 5 files |
| Phase 33 P02 | 2 min | 3 tasks | 18 files |
| Phase 33 P03 | 8 | 6 tasks | 53 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- v3.1 roadmap: 2 consolidated phases (user preference for fewer, larger phases with 1M context)
- Phase 24 = feature work (COMP), Phase 25 = polish + debt (POPUP + SPELL + DEBT)
- 24-01: Simple filter scan over nounGenus keys for compound prediction
- 24-02: Exact decomposition before fallback search; simple translation concatenation for guess; decomposeCompound as verification
- 26-02: Use env-var injection (LEXI_PEDAGOGY_GATE_EXTRA_TARGETS) for self-test target injection instead of regex source mutation; gate stays informational pre-26-01
- [Phase 26-laer-mer-pedagogy-ui]: 26-01: prepPedagogy Map keyed by ASCII+umlaut variants; pedagogy block rides on finding object, NOT through explain() (preserves contract)
- [Phase 26]: Lær mer panel: stacked-only wechsel layout (no side-by-side variant) — popover fixed at ~320px makes container queries unnecessary
- [Phase 26]: Confirmed uiLanguage storage key (not 'language') — strings.js _initI18n is canonical
- [Phase 27-01]: exam marker shape `{ safe, reason, category }` lands on every rule + new exam-registry.js for non-rule surfaces
- [Phase 27-01]: Default-conservative classification: lookup-shaped grammar rules safe=false pending browser-baseline research; collocation/quotation-suppression promoted to safe=true (lexical/scaffolding)
- [Phase 27-01]: de-prep-case is the sole dual-marker case today (rule.exam grammar-lookup + rule.explain.exam pedagogy via Object.assign-wrapped explain)
- [Phase 27]: 27-02: check-exam-marker gate; registry entries require category (strict surface), rules accept it as optional but validate closed set when present; hard-fail by default per CONTEXT.md
- [Phase 27-03]: Filter findings post-CORE.check rather than pre-iteration — keeps spell-check-core pure; functionally identical effect (dot + popover both suppressed because finding is dropped before render)
- [Phase 27-03]: Cached examMode + onChanged listener per content script — avoids per-keystroke storage reads; live toggle handled by hideOverlay + reschedule
- [Phase 27-03]: Lockdown lock defensively forces examMode=true if only examModeLocked set; toggle disabled+ON; "Slått på av lærer" caption shown
- [Phase 27-03]: exam-registry.js registered in manifest BEFORE floating-widget/word-prediction/spell-check; without correct order the fail-safe path hides everything even when examMode is off
- [Phase 27-03]: Version bumped to 2.7.0 (manifest + package + landing page) — signals lockdown to re-pin per CLAUDE.md
- [Phase 29]: 29-01: Locked LEKSIHJELP_EXAM as fifth resource profile in lockdown — label 'Eksamen med Leksihjelp', envelope { leksihjelp:true, lexinIframe:false, spellEngineOptions:['off'] }; no dual-engine variant
- [Phase 29]: 29-01: Promoted PROFILE_LABELS_NN and PROFILE_LABELS_EN to first-class exports from shared/resource-profile.js (deviation: plan's <interfaces> overclaimed they existed)
- [Phase 29]: 29-02: Five-value resourceProfile enum is now consistent across firestore.rules + createTest.js + toggleResourceAccess.js (+ test); lockdown commits d7825eb (enum) + b35b409 (writer)
- [Phase 29]: 29-02: applyExamModeLock helper is module-level (not class method) and called twice — initial paint with prevProfile=null (clear branch is intentional no-op there) + on-change handler as sibling branch beside BSPC-01, sequenced AFTER applyEnvelopeToDOM so the leksihjelp bundle is alive when its examMode listener fires
- [Phase 29]: 29-02: Production deploy (lockdown-stb) DEFERRED per user instruction; staging-lockdown deployed cleanly
- [Phase 30]: Plan 30-01 Task 1 only landed (skeletons + check-popup-deps gate); Task 2 logic-migration + Task 3 human-verify deferred — recommend re-planning Task 2 as four smaller per-view sub-plans to preserve incremental smoke-test discipline
- [Phase 30]: 30-01: Sub-step A (dictionary view) FULL extraction; Sub-step B (settings view) PARTIAL — UI lang + darkmode + 2 toggles; pause + report kept inline; CSS extraction deferred. Audio gated behind deps.audioEnabled. viewState shared-state pattern (single source of truth).
- [Phase 30]: 30-01 Task 3 human-verify auto-approved per workflow.auto_advance=true; 9-step browser walkthrough logged for deferred manual verification (extension not yet shipping to paying users).
- [Phase 30]: 30-02: lockdown sidepanel-host as the lockdown-only inclusion contract (declares what to mount with what deps; bug fixes go upstream and re-sync); audioEnabled:false hardcoded with three independent safeguards (renderResults gate + host never passes real playAudio + extension/audio/ NOT in sync); showSection in lockdown surfaces only grammar+darkmode (uiLanguage:false explicit deviation from plan-text spirit since plan text omitted it).
- [Phase 30]: 30-02: deleted ~150-line stub search implementation in writing-environment.js (LEKSI_BANKS, leksiRenderCard, leksiTranslation, leksihjelpPerformSearch, search input listener) — that logic now lives upstream in dictionary-view.js and is sync'd in.
- [Phase 30]: 30-02: static <script src> for view modules in elev.html (not LEKSI_BUNDLE) since views have no chrome.* / __lexi* implicit deps (enforced by check-popup-deps); decouples view loading from bootLeksihjelp lifecycle.
- [Phase 30]: 30-02: check-popup-deps inserted as numbered Release Workflow step 7 in CLAUDE.md (between exam-marker step 6 and bundle-size now step 8); subsequent steps renumbered 7-13 -> 8-14.
- [Phase 30]: 30-02: version bumped 2.7.0 -> 2.8.0 across manifest.json + package.json + backend/public/index.html — signals lockdown to re-pin.
- [Phase 30]: 30-02: production deploy to papertek.app explicitly NOT done (staging-lockdown branch pushed only); user takes the production deploy decision separately per auto-mode-but-no-prod-deploy rule.
- [Phase 32-02]: Followed Phase 26 finding.pedagogy contract over plan <interfaces> proposal — pedagogy rides on the finding object (not via explain() return); explain() pre-templates {nb,nn} from pedagogy.subtypes[patternType] with {fix}/{wrong} substitution. Avoids breaking check-explain-contract while still surfacing the rich Lær mer panel.
- [Phase 32-02]: ES pedagogy uses semantic_category: 'preposition' (no DE-style 'case' field); check-pedagogy-shape's case-validator doesn't reject because synthetic ctx ('durch die Schule') doesn't trigger es-por-para patterns. Gate exits informational-PASS.
- [Phase 32-02]: Subtype keys mirror the rule's existing patternType discriminators verbatim (purpose / beneficiary / deadline / duration). Pedagogy lives on the *suggested-fix* preposition (para_prep carries purpose+beneficiary+deadline; por_prep carries duration).
- [Phase 32-02]: Side-patched extension/data/es.json directly because deployed papertek-vocabulary Vercel API hadn't picked up the lexicon edit; documented as recognised future-sync no-op (same pattern as 32-03 chore commit b2a4be2).
- [Phase 32]: 32-01: FR aspect-hint rule (P3 hint, P=R=F1=1.000, 86 fixtures) + first FR pedagogy block (aspect_choice) sourced from papertek-vocabulary; check-explain-contract extended with optional pedagogy-shape branch + 3 paired scratch scenarios; version bumped 2.9.9 → 2.9.11
- [Phase 32]: 32-03: Lexical verb_class marker on verbbank entries (vs inline grammar-table list); shared pedagogy under grammarbank.pedagogy.{class_name}; explain() returns pedagogy (not finding.pedagogy — gustar is not a case-prep so the check-pedagogy-shape VALID_CASES validator wouldn't accept it); PREPOSITION_COLLISIONS guard prevents sobre→sobrar false positives
- [Phase 33]: 33-01: lifted buildDictState + buildInflectionIndex into shared dict-state-builder.js; popup.js delegates via posMapper/genusMapper opts so i18n labels stay popup-side; lockdown sidepanel host populateDictState updated (STAGED, not committed — Plan 33-03 lands cross-repo coordination)
- [Phase 33]: 33-01: exam-profile ordbok-hide audit claim INVESTIGATED, not present — getSpellEngineEnvelope('exam') already returns leksihjelp:true post-Phase-29 redesign; no fix needed
- [Phase 33]: 33-02: lockdown sync mirrored 18 files (1 new fr-aspect-hint.js, 17 modified); sync script + LEKSI_BUNDLE order verified correct as-is — no script edits needed; 4 orphan upstream working-tree changes flowed through as faithful mirror per CLAUDE.md downstream-consumers contract
- [Phase 33]: 33-03: exam.safe audit closed — 22/49 lookup-shaped rules flipped to safe=true (NB/EN/FR/ES/DE single-token typo banks + gender/elision/contraction/coordination/agreement); 27 stayed safe=false with one-line `// exam-audit 33-03:` annotation (5 pedagogy popovers, 11 multi-token, 5 doc-drift, 6 context-aux/mood); version 2.9.11 -> 2.9.12 aligned across 3 files; all 24 release gates green

### Pending Todos

- Phase 26 human verification deferred (6 browser walkthroughs in 26-VERIFICATION.md) — approve in a later session
- Phase 27 human browser verification deferred (Task 3 auto-approved per auto-mode policy; 9 walkthrough steps in 27-03-PLAN.md `<how-to-verify>` block) — approve in a later session
- Phase 30-01 human browser verification deferred (Task 3 auto-approved per auto-mode policy; 9 walkthrough steps in 30-01-PLAN.md `<how-to-verify>` block: load extension, search, lang switch, direction toggle, compound suggestion, Lær mer popover, settings, account section, pause, vocab-updates banner) — approve in a later session before merging to v3.1 release branch
- Phase 30-02 staging-lockdown UAT deferred (8-step walkthrough captured in 30-02-SUMMARY.md "User Setup Required" section: create leksihjelp-enabled test, join as student, switch to Leksihjelp tab, verify dictionary view renders without audio buttons, verify EKSAMENMODUS badge under LEKSIHJELP_EXAM profile, verify settings shows only grammar+darkmode, verify dark mode toggle scoped to sidepanel) — approve before production papertek.app deploy
- Phase 30-02 production papertek.app deploy outstanding: run `firebase deploy --only hosting --project lockdown-stb` from /Users/geirforbord/Papertek/lockdown after staging UAT passes (deferred per user instruction this run)
- Lockdown loader needs to either include the synced extension/exam-registry.js before leksihjelp scripts OR provide host.__lexiExamRegistry via shim — without either, fail-safe path hides every surface in lockdown context
- Phase 27 release: bump done at 2.6.0 → 2.7.0; rebuild zip via `npm run package` and upload as GitHub Release asset (Release Workflow steps 11-13)
- Phase 29-02 production deploy outstanding: run `firebase deploy --only firestore:rules,functions --project lockdown-stb` from /Users/geirforbord/Papertek/lockdown after Plan 29-03 staging browser verification passes (deferred per user instruction this run)

### Roadmap Evolution

- Phase 27 added: Exam Mode — per-feature examSafe markers, student toggle, teacher control in lockdown variant, release gate. Big architecture change touching every feature module. Captured 2026-04-28; user flagged as high priority.

### Blockers/Concerns

- VERIF-01 (browser visual verification) carried across 4 milestones -- in scope as DEBT-03
- Version skew: package.json=2.5.0 vs manifest.json=2.4.1 -- in scope as DEBT-01
- check-fixtures 5 pre-existing failing suites -- in scope as DEBT-02

## Session Continuity

Last session: 2026-04-30
Stopped at: Completed 33-02-PLAN.md (lockdown sync). 18 files refreshed in lockdown public/leksihjelp/, committed as beadf6b on staging branch (NOT pushed; Plan 33-03 owns version bump + push). Sync script + LEKSI_BUNDLE order verified correct as-is. 4 orphan upstream changes flowed through; flagged for separate triage. Previous (2026-04-29): Completed 30-02-PLAN.md (all four tasks). Task 1 extended lockdown sync script to copy extension/popup/views/ + extension/styles/popup-views.css (latter graceful no-op until Plan 30-01 sub-step E ships). Task 2 created /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js (lockdown-only IIFE host; mounts dictionary + settings views with audioEnabled:false + showSection limited to grammar+darkmode); replaced ~150-line stub search in writing-environment.js with real sidepanel mount; bumped writing-environment marker to v4.10.0; loaded view modules + host via static <script src> in elev.html. Task 3 updated leksihjelp CLAUDE.md downstream-consumers section + inserted check-popup-deps as numbered Release Workflow step 7 (renumbered 7-13 -> 8-14); bumped version 2.7.0 -> 2.8.0 across manifest.json + package.json + backend/public/index.html. Task 4 ran all 15 release gates clean; cross-repo commits landed (leksihjelp 98f4a9a + lockdown 1193e56 on staging branch); pushed origin/staging successfully; production deploy to papertek.app explicitly NOT done. Plan 30-03 (skriveokt-zero parity, deferred Phase 28.1) remains.
