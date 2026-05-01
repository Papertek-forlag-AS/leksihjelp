---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: UAT & Deploy Prep
status: unknown
last_updated: "2026-05-01T17:30:00.000Z"
progress:
  total_phases: 14
  completed_phases: 10
  total_plans: 41
  completed_plans: 30
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01 after starting v3.2)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.2 UAT & Deploy Prep — walk v3.1 features in browser, fix surfaced bugs, sync to lockdown, validate in lockdown-staging, prepare prod deploy runbooks.

## Current Position

Phase: 38 (Extension UAT Batch + Bug Fix Loop + REGR) — In progress (1/5 plans complete)
Plan: 01 complete (UAT-EXT-01 warm-up walkthrough — F36-1 fr-aspect-hint browser confirmation)
Status: Warm-up walk surfaced 1 blocker (F38-1) + 1 deferred minor (F38-2). F38-1 requires decimal-insert fix plan (38-01.1) BEFORE Plan 38-05 ships the release asset (FIX-04 must not bundle a known-blocker build). F38-2 deferred per walker — Phase 38-04 (DE Lær mer 4+2 walk) accumulates more NN signal.
Last activity: 2026-05-01 — Plan 38-01 complete; HYG-03 hard-pause discipline validated end-to-end (auto-mode paused at human-browser-walk checkpoint; walker resumed manually)

## Performance Metrics

- **Phases:** 0/5 complete
- **Plans:** 0/0 (planning not yet started)
- **Requirements:** 0/27 satisfied
- **Release gates active (post Phase 37):** 14 (added in Phase 37-02: check-version-alignment HYG-04, check-synced-surface-version HYG-05)

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
- [Phase 37]: 37-04: [lockdown-resync-needed] commit-message convention adopted; doc-based ledger pattern at .planning/deferred/
- [Phase 37-hygiene-templates-pre-flight]: HYG-07 pre-flight: re-implemented upstream computeRevision inline (zero-dep CommonJS) and compare hex8 suffix only (date prefix shifts on UTC-day rollover); per-language drift report with actionable fix lines; explicitly NOT a release gate
- [Phase 37-01]: UAT templates' HTML usage comment placed AFTER frontmatter (gsd-tools.cjs `frontmatter get` regex requires file to start with `---`); literal `TBD` placeholders in frontmatter values keep parsed output clean
- [Phase 37-01]: `verification_kind: human-browser-walk` documented as top-level CLAUDE.md `##` section (placed before `## graphify`) — cross-cutting GSD convention, sits with Release Workflow / Downstream consumers as canonical agent instruction
- [Phase 37-02]: HYG-04 plant target chosen as backend/public/index.html (lowest-risk source — display only, never touched by build/test pipeline) per RESEARCH Pitfall 3
- [Phase 37-02]: HYG-05 self-test cleanup uses non-destructive `git reset --soft BEFORE_SHA` instead of `--hard` — preserves any unrelated dirty files in working tree, so the self-test is safe to run mid-development without clobbering pending work
- [Phase 37-02]: extension/data/*.json no-exclusion in HYG-05 honored per CONTEXT lock; vocab-sync-with-version-bump is the canonical pattern, the noise floor is the right tradeoff
- [Phase 37-02]: [lockdown-resync-needed] commit-message hint coupled directly into HYG-05 failure diagnostic — pulls HYG-06 nudge into the surface where developers will actually see it (at gate-failure time, in copy-pastable form)
- [Phase 38-01]: F38-1 (blocker) requires decimal-insert fix plan (38-01.1) BEFORE Plan 38-05 ships the release asset; FIX-04 must not bundle a known-blocker build
- [Phase 38-01]: F38-2 (NN locale partial) deferred per walker — NOT decimal-inserted into Phase 38; Phase 38-04 (DE Lær mer 4+2 walk, includes NN+EN cross-locale walks) accumulates more NN signal before dedicated NN coverage phase
- [Phase 38-01]: Sidecar-pipeline gap is universal (pitfalls-nb.json also 404 in Step 6 console), not FR-specific — F38-1 fix should regenerate sidecars for all 6 languages, not just FR
- [Phase 38-01]: F38-1 proximate-cause hypothesis: per-input language not propagating popup foreign-language to spell-check seam (NB rules fire on French tokens) — fix plan to verify
- [Phase 38-01]: HYG-03 hard-pause discipline validated end-to-end: auto-mode paused at human-browser-walk checkpoint despite system reminder; closed exactly the Pitfall 2 class STATE v3.2 entry called out

### Pending Todos

(All carried-over items now mapped to phases — see ROADMAP.md coverage table)

- Phase 26 6 DE Lær mer browser walks → UAT-EXT-02 / Phase 38
- Phase 26 NN + EN locale Lær mer (F7) → UAT-EXT-02 / Phase 38
- Phase 27 9-step exam-mode walk → UAT-EXT-03 / Phase 38
- Phase 30-01 9-step extension popup view walk → UAT-EXT-04 / Phase 38
- Phase 30-02 8-step staging-lockdown sidepanel UAT → UAT-LOCK-02 / Phase 39
- ~~F36-1 fr-aspect-hint browser confirm → UAT-EXT-01 / Phase 38~~ ✅ Complete (Plan 38-01, 2026-05-01) — surfaced F38-1 blocker + F38-2 minor deferred
- Lockdown-stb production Firebase deploy runbook → DEPLOY-01 / Phase 40 (deploy itself = PROD-01, deferred)
- Lockdown papertek.app production hosting deploy runbook → DEPLOY-02 / Phase 40 (deploy itself = PROD-02, deferred)

### Blockers/Concerns

- **HYG-07 risk:** If papertek-vocabulary deployment lags HEAD, Phase 37 carries papertek-vocabulary repo work as a sub-step (direct repo access at `/Users/geirforbord/Papertek/papertek-vocabulary`). Cross-app blast radius applies.
- **Cross-repo coordination:** UAT-LOCK-03 needs a PR against the lockdown repo's sync script — coordinate during Phase 39 plan.
- **Auto-mode + human-browser-walk:** HYG-03 is the unblocker — without `verification_kind: human-browser-walk` frontmatter discipline, auto-mode will skip Phase 38 verification (Pitfall 2 — root cause of v3.1's six-walkthrough deferral). ✅ Validated end-to-end in Plan 38-01.
- **F38-1 (blocker, open):** fr-aspect-hint silent in real Chrome — French input scored against NB dictionary; FR sidecars 404; sidecar-pipeline gap universal across languages. Requires decimal-insert fix plan (38-01.1) BEFORE Plan 38-05 release asset. See `.planning/uat/findings/F38-1.md`.
- **F38-2 (minor, deferred):** NN locale partial — popover button labels translate but explanation body stays in NB. NOT a Phase 38 blocker per walker classification; Phase 38-04 will accumulate more NN signal. See `.planning/uat/findings/F38-2.md`.

## Session Continuity

Last session: 2026-05-01
Stopped at: Plan 38-01 complete (warm-up walkthrough UAT-EXT-01, F36-1 fr-aspect-hint browser confirmation). Walker signed off 2026-05-01T17:00:00+02:00 on ext_version 2.9.18 / Chrome 147.0.7727.117 arm64. Surfaced F38-1 (blocker) + F38-2 (minor, deferred). Plan commits: 92ea7eb (Task 1), 8294e25 (interim STATE), 66248a7 (Task 2 walker artifacts). SUMMARY at `.planning/phases/38-extension-uat-batch-bug-fix-loop-regr/38-01-SUMMARY.md`.
Next: Orchestrator decision. Two open paths (likely interleaved):
- (a) Append decimal-insert fix plan 38-01.1 to close F38-1 blocker (regenerate sidecars for all 6 languages + audit per-input language propagation popup → spell-check seam + add `regression_fixture_id` per HYG-02). MUST land before Plan 38-05 release asset.
- (b) Proceed to Plan 38-02 (canonical popup view 9-step walkthrough — independent surface, can run in parallel with F38-1 fix work).
F38-2 explicitly deferred per walker — NOT actionable in Phase 38.
