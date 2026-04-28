---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Polish & Intelligence
status: executing
last_updated: "2026-04-28T20:54:00.719Z"
last_activity: 2026-04-28 -- Plan 29-02 complete (firestore enum + writer + staging deploy; prod deferred)
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 17
  completed_plans: 11
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.1 Polish & Intelligence -- Phase 24 ready to plan

## Position

**Milestone:** v3.3 Exam Mode
**Phase:** 29 (Lockdown Teacher-Lock UX) -- IN PROGRESS
**Plan:** 2 of 3 complete (29-01, 29-02)
**Status:** In progress
**Last activity:** 2026-04-28 -- Plan 29-02 complete (firestore enum + writing-environment writer + staging deploy; prod deploy deferred)

Progress: [██████░░░░] 67% (Phase 29)

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

### Pending Todos

- Phase 26 human verification deferred (6 browser walkthroughs in 26-VERIFICATION.md) — approve in a later session
- Phase 27 human browser verification deferred (Task 3 auto-approved per auto-mode policy; 9 walkthrough steps in 27-03-PLAN.md `<how-to-verify>` block) — approve in a later session
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

Last session: 2026-04-28
Stopped at: Completed 29-02-PLAN.md (firestore.rules + Cloud Functions five-value enum extension + writing-environment.js applyExamModeLock writer/clear-on-transition; lockdown commits d7825eb + b35b409; staging-lockdown Firebase deploy successful). 29-03 (browser verification) remaining. PROD DEPLOY DEFERRED to lockdown-stb per user instruction — re-run `firebase deploy --only firestore:rules,functions --project lockdown-stb` after staging browser verification passes.
