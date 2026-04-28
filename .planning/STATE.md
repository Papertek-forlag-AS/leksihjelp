---
gsd_state_version: 1.0
milestone: v3.3
milestone_name: Exam Mode
status: executing
last_updated: "2026-04-28T18:00:00.000Z"
last_activity: 2026-04-28 -- Plan 27-01 complete (exam-mode markers contract scaffolding; registry + 62 rule markers)
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 13
  completed_plans: 7
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.1 Polish & Intelligence -- Phase 24 ready to plan

## Position

**Milestone:** v3.3 Exam Mode
**Phase:** 27 (Exam Mode) -- in progress
**Plan:** 1 of 3 complete (27-01)
**Status:** Plan 02 (gate) ready to start
**Last activity:** 2026-04-28 -- Plan 27-01 complete (markers contract scaffolding shipped)

Progress: [███░░░░░░░] 33% (Phase 27)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (v3.1)
- Cumulative across milestones: 91 plans shipped (Phase 26 added 3)

| Phase | Plan | Duration (min) | Tasks | Files |
| ----- | ---- | -------------- | ----- | ----- |
| 26    | 03   | 12             | 4     | 6     |
| 27    | 01   | 18             | 2     | 62    |

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

### Pending Todos

- Phase 26 human verification deferred (6 browser walkthroughs in 26-VERIFICATION.md) — approve in a later session
- Lockdown sync needed: run `node scripts/sync-leksihjelp.js` from /Users/geirforbord/Papertek/lockdown to mirror Phase 26 spell-check.js/content.css changes downstream

### Roadmap Evolution

- Phase 27 added: Exam Mode — per-feature examSafe markers, student toggle, teacher control in lockdown variant, release gate. Big architecture change touching every feature module. Captured 2026-04-28; user flagged as high priority.

### Blockers/Concerns

- VERIF-01 (browser visual verification) carried across 4 milestones -- in scope as DEBT-03
- Version skew: package.json=2.5.0 vs manifest.json=2.4.1 -- in scope as DEBT-01
- check-fixtures 5 pre-existing failing suites -- in scope as DEBT-02

## Session Continuity

Last session: 2026-04-28
Stopped at: Completed 27-01-PLAN.md (exam-mode markers contract scaffolding). Plan 02 (check-exam-marker gate) ready to start.
