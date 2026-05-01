---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: UAT & Deploy Prep
status: active
last_updated: "2026-05-01T12:00:00.000Z"
last_activity: "2026-05-01 - Roadmap created (5 phases, 37→41). 27/27 requirements mapped. Ready for /gsd:plan-phase 37."
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01 after starting v3.2)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.2 UAT & Deploy Prep — walk v3.1 features in browser, fix surfaced bugs, sync to lockdown, validate in lockdown-staging, prepare prod deploy runbooks.

## Current Position

Phase: 37 (Hygiene, Templates & Pre-flight) — not yet planned
Plan: —
Status: Roadmap complete, awaiting `/gsd:plan-phase 37`
Last activity: 2026-05-01 — Roadmap created with 5 phases (37→41), 27/27 requirements mapped

## Performance Metrics

- **Phases:** 0/5 complete
- **Plans:** 0/0 (planning not yet started)
- **Requirements:** 0/27 satisfied
- **Release gates active (entering v3.2):** 12 (target +2 in Phase 37: check-version-alignment, check-synced-surface-version)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

(v3.1 phase-level decisions archived to .planning/milestones/v3.1-* — see archive for full history)

**v3.2 entry decisions:**
- 5-phase consolidation (per `feedback_fewer_phases.md` — 1M context allows it; GSD designed for 200k)
- Sequential ordering (37→41), NOT interleaved per fix — context-switching wastes warm-up
- Phase 37 must finish before Phase 38 starts: HYG-07 vocab pre-flight is hard pre-condition for UAT (Pitfall 1: stale-artifact)
- Phase 38 single-phase per `feedback_fewer_phases.md`: walkthroughs sequenced warm-up (F36-1) → canonical (Phase 30-01) → highest-stakes (Phase 27) → final (Phase 26)
- Lockdown sync (Phase 39) consumes tagged Phase 38 head — never working-tree (defends Phase 30-02 orphan-mirror class)
- Production deploys explicitly OUT of scope; runbook + sign-off is the v3.2 deliverable (PROD-01/PROD-02 deferred to v3.3 user-gated)
- REGR (FIX-02) is HARD criterion, no exceptions — school-year stakes

### Pending Todos

(All carried-over items now mapped to phases — see ROADMAP.md coverage table)

- Phase 26 6 DE Lær mer browser walks → UAT-EXT-02 / Phase 38
- Phase 26 NN + EN locale Lær mer (F7) → UAT-EXT-02 / Phase 38
- Phase 27 9-step exam-mode walk → UAT-EXT-03 / Phase 38
- Phase 30-01 9-step extension popup view walk → UAT-EXT-04 / Phase 38
- Phase 30-02 8-step staging-lockdown sidepanel UAT → UAT-LOCK-02 / Phase 39
- F36-1 fr-aspect-hint browser confirm → UAT-EXT-01 / Phase 38
- Lockdown-stb production Firebase deploy runbook → DEPLOY-01 / Phase 40 (deploy itself = PROD-01, deferred)
- Lockdown papertek.app production hosting deploy runbook → DEPLOY-02 / Phase 40 (deploy itself = PROD-02, deferred)

### Blockers/Concerns

- **HYG-07 risk:** If papertek-vocabulary deployment lags HEAD, Phase 37 carries papertek-vocabulary repo work as a sub-step (direct repo access at `/Users/geirforbord/Papertek/papertek-vocabulary`). Cross-app blast radius applies.
- **Cross-repo coordination:** UAT-LOCK-03 needs a PR against the lockdown repo's sync script — coordinate during Phase 39 plan.
- **Auto-mode + human-browser-walk:** HYG-03 is the unblocker — without `verification_kind: human-browser-walk` frontmatter discipline, auto-mode will skip Phase 38 verification (Pitfall 2 — root cause of v3.1's six-walkthrough deferral).

## Session Continuity

Last session: 2026-05-01
Stopped at: Roadmap complete (5 phases, 37→41), 27/27 requirements mapped, ready for `/gsd:plan-phase 37`.
Next: `/gsd:plan-phase 37`
