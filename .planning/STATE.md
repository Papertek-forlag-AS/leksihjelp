---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Polish & Intelligence
status: executing
last_updated: "2026-04-29T11:45:00.000Z"
last_activity: "2026-04-29 -- Plan 30-03 complete: staging UAT pass on stb-lockdown.app. Plan 30-01 deferred sub-step E shipped (popup-views.css generator + scoped CSS). Five tactical fixes during UAT (state population via inline flattenBanks, vocab-adapter wrap with norwegianInfinitive/getTranslation, dark-mode dropped, settings drawer hidden, freq-en 404 silenced, searchDirection enum fix). Plan 30-04 filed (lockdown sidepanel UX integration). Phase 31 filed (FR rule suite). Production deploy still deferred. Versions bumped 2.8.0 -> 2.8.1 -> 2.8.2."
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 21       # +1: 30-04 filed mid-UAT
  completed_plans: 17   # +3: 30-01, 30-02, 30-03
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.1 Polish & Intelligence -- Phase 24 ready to plan

## Position

**Milestone:** v3.3 Exam Mode
**Phase:** 30 (Shared Popup Views) -- IN PROGRESS
**Plan:** 30-04 next (30-01 + 30-02 + 30-03 complete; 30-04 lockdown sidepanel UX integration filed)
**Status:** Staging UAT passed; ready to plan/execute 30-04
**Last activity:** 2026-04-29 -- Plan 30-03 staging UAT complete (stb-lockdown.app). Five tactical UAT fixes shipped via cross-repo commits (popup-views.css generator, dictionary state population, vocab-adapter wrap, dark-mode dropped, freq-en silence). Plan 30-04 filed for shared-helper extraction + UX integration (single-source language picker, pinned Aa, click-rebind). Phase 31 filed (FR rule suite). Production deploy to papertek.app still deferred per user instruction. skriveokt-zero parity stays at deferred Phase 28.1, ordered AFTER Phase 31.

Progress: [████████░░] 75% (Phase 30 — 3 of 4 plans complete; 30-04 next)

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

### Pending Todos

- Phase 26 human verification deferred (6 browser walkthroughs in 26-VERIFICATION.md) — approve in a later session
- Phase 27 human browser verification deferred (Task 3 auto-approved per auto-mode policy; 9 walkthrough steps in 27-03-PLAN.md `<how-to-verify>` block) — approve in a later session
- Phase 30-01 human browser verification deferred (Task 3 auto-approved per auto-mode policy; 9 walkthrough steps in 30-01-PLAN.md `<how-to-verify>` block: load extension, search, lang switch, direction toggle, compound suggestion, Lær mer popover, settings, account section, pause, vocab-updates banner) — approve in a later session before merging to v3.1 release branch
- Phase 30-02 staging-lockdown UAT deferred (8-step walkthrough captured in 30-02-SUMMARY.md "User Setup Required" section: create leksihjelp-enabled test, join as student, switch to Leksihjelp tab, verify dictionary view renders without audio buttons, verify EKSAMENMODUS badge under LEKSIHJELP_EXAM profile, verify settings shows only grammar+darkmode, verify dark mode toggle scoped to sidepanel) — approve before production papertek.app deploy
- Phase 30-02 production papertek.app deploy outstanding: run `firebase deploy --only hosting --project lockdown-stb` from /Users/geirforbord/Papertek/lockdown after staging UAT passes (deferred per user instruction this run)
- Lockdown sync needed: run `node scripts/sync-leksihjelp.js` from /Users/geirforbord/Papertek/lockdown to mirror Phase 26 + Phase 27 spell-check.js/content.css/i18n/strings.js/exam-registry.js changes downstream
- Lockdown loader needs to either include the synced extension/exam-registry.js before leksihjelp scripts OR provide host.__lexiExamRegistry via shim — without either, fail-safe path hides every surface in lockdown context
- Browser-baseline research: revisit lookup-shaped grammar rules currently classified exam.safe=false (Phase 27-01 default-conservative call) and flip to safe=true any rule that doesn't actually exceed Chrome native parity
- Phase 27 release: bump done at 2.6.0 → 2.7.0; rebuild zip via `npm run package` and upload as GitHub Release asset (Release Workflow steps 11-13)
- Phase 29-02 production deploy outstanding: run `firebase deploy --only firestore:rules,functions --project lockdown-stb` from /Users/geirforbord/Papertek/lockdown after Plan 29-03 staging browser verification passes (deferred per user instruction this run)

### Roadmap Evolution

- Phase 27 added: Exam Mode — per-feature examSafe markers, student toggle, teacher control in lockdown variant, release gate. Big architecture change touching every feature module. Captured 2026-04-28; user flagged as high priority.

### Blockers/Concerns

- VERIF-01 (browser visual verification) carried across 4 milestones -- in scope as DEBT-03
- Version skew: package.json=2.5.0 vs manifest.json=2.4.1 -- in scope as DEBT-01
- check-fixtures 5 pre-existing failing suites -- in scope as DEBT-02

## Session Continuity

Last session: 2026-04-29
Stopped at: Completed 30-02-PLAN.md (all four tasks). Task 1 extended lockdown sync script to copy extension/popup/views/ + extension/styles/popup-views.css (latter graceful no-op until Plan 30-01 sub-step E ships). Task 2 created /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js (lockdown-only IIFE host; mounts dictionary + settings views with audioEnabled:false + showSection limited to grammar+darkmode); replaced ~150-line stub search in writing-environment.js with real sidepanel mount; bumped writing-environment marker to v4.10.0; loaded view modules + host via static <script src> in elev.html. Task 3 updated leksihjelp CLAUDE.md downstream-consumers section + inserted check-popup-deps as numbered Release Workflow step 7 (renumbered 7-13 -> 8-14); bumped version 2.7.0 -> 2.8.0 across manifest.json + package.json + backend/public/index.html. Task 4 ran all 15 release gates clean; cross-repo commits landed (leksihjelp 98f4a9a + lockdown 1193e56 on staging branch); pushed origin/staging successfully; production deploy to papertek.app explicitly NOT done. Plan 30-03 (skriveokt-zero parity, deferred Phase 28.1) remains.
