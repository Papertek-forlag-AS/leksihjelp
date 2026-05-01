---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: UAT & Deploy Prep
status: unknown
last_updated: "2026-05-01T20:31:29.706Z"
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 43
  completed_plans: 35
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01 after starting v3.2)

**Core value:** Norwegian students write foreign languages better -- with correct words, correct form, and confidence in pronunciation -- without leaving the page they're working on.
**Current focus:** v3.2 UAT & Deploy Prep — walk v3.1 features in browser, fix surfaced bugs, sync to lockdown, validate in lockdown-staging, prepare prod deploy runbooks.

## Current Position

Phase: 38 (Extension UAT Batch + Bug Fix Loop + REGR) — In progress (Plans 01 + 02 + 03 + 04 + 01.1 + 01.2 complete; 38-05 release-asset plan pending; browser re-walk deferred outside plans pending Saturday staging on stb-lockdown.app)
Plan: 01 + 02 + 03 + 04 complete; 01.1 complete (Task 4 walker re-walk surfaced regression → 01.2 spawned); 01.2 complete (F38-1 v2 fix shipped — root cause: API serves FR generalbank from lexicon/fr/ missing 3 aspect meta entries; defensive seam-side backfill from bundled fr.json; v2.9.20 DRAFT GitHub Release)
Status: Plan 38-01.2 closed cleanly. F38-1 status flipped from `open` (REOPENED) back to `closed` with Resolution v2 documenting actual proximate cause. F38-3 status flipped to `partial-deferred-to-future-plan` (aspect-hint half closes here; FR typo-coverage gap on `pelle`/`Francais`/cedilla deferred — upstream Papertek-API data work). All 14 release gates green + new check-fr-bundle-completeness regression gate green. v2.9.20 GitHub Release created as DRAFT (NOT Latest) — promotion gates on deferred browser re-walk after Saturday staging. Both fix commit (addbb64) and version-bump commit (07dc423) carry [lockdown-resync-needed] markers. NO files modified under lockdown/ or papertek-vocabulary/. Plan 38-05 release-asset plan still pending (now actually unblocked since F38-1 closed-pending-rewalk).
Last activity: 2026-05-01 — Plan 38-01.2 completed; commits 1542499 (Task 1 RED regression artifact) / addbb64 (Task 2 GREEN seam fix + F38-1/F38-3 finding updates) / 07dc423 (Task 3 v2.9.20 version bump). GitHub Release v2.9.20 DRAFT with lexi-extension.zip uploaded.

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
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: [Phase 38-01.1]: F38-1 root cause is BRANCH C (multi-language nb-typo-fuzzy F36-1 guard, elision-side miss) — guard checked frAuxPresensForms.has(t.word) against literal token but tokenizer emits 'j'ai' while set contains 'ai'; fixed by adding ELISION_RE strip
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: [Phase 38-01.1]: companion popup.js LANGUAGE_CHANGED broadcast moved out of try/catch (was branch A latent bug, not F38-1 critical path but bundled here)
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: [Phase 38-01.1]: GitHub Release v2.9.19 created as DRAFT pending Task 4 walker re-walk; honours plan's no-publish-without-approval constraint; promote to Latest after re-walk evidence appended to UAT-EXT-01.md
- [Phase 38-02]: Canonical popup view 9-step walk = clean pass; Phase 30-01 view-module dep-injection refactor confirmed end-to-end in real Chrome 147; zero defects filed; Plan 38-03 unblocked
- [Phase 38-02]: Step 6 (Lær mer) recorded as plan-scope N/A clarification — Lær mer is content-script (extension/content/spell-check.js), not popup-view; future popup-view walks should omit it
- [Phase 38-02]: Step 9 vocab-updates banner sub-test deferred — service-worker-driven, no manual trigger from clean pre-flight; FOLLOW-UP CANDIDATE: add dev-only force-refresh affordance
- [Phase 38-03]: Phase 27 exam-mode contract clean-pass in real Chrome 147 against v2.9.19; school-deployment trust validated
- [Phase 38-03]: Step 8 architectural clarification: lockdown exam-mode is teacher-only (no student toggle); 'dual mode' framing was vanilla-extension projection; Phase 39 UAT-LOCK-02 scoped to assert student toggle hidden in lockdown sidepanel host UI
- [Phase 38-03]: Inline-clarification-instead-of-finding pattern reinforced (3rd recurrence after 38-02 Step 6): use ✅ + downstream follow-up when a step's framing projects vanilla-extension UI assumptions onto a constrained downstream surface
- [Phase 38-04]: UAT-EXT-02 final walk = clean pass on all 6 walks (4 NB DE + 2 cross-locale NN/EN); Phase 35 F7 deferred carry-over (NN/EN locale Lær mer) explicitly CLOSED via Steps 5+6; F38-2 partial-NN gap remains scoped to FR-aspect-hint-pedagogy specifically (DE pedagogy NN render is healthy — distinct surface); zero F38-N findings filed; locked Phase 38 walk sequence complete (warm-up → canonical → highest-stakes → final all clean); HYG-03 hard-pause discipline validated end-to-end for the fourth time
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: F38-1 v2 closure: actual proximate cause was Papertek API serving FR generalbank from lexicon/fr/ (865 keys) missing aspect meta entries; bundled fr.json has them; narrow seam-side defensive backfill in vocab-seam.js#buildAndApply leksihjelp-only
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: F38-3 partial-deferred: aspect-hint silence half closes with F38-1; FR typo-coverage gap (Francais cedilla, pelle typo) deferred to future plan as upstream Papertek-API data work (FR typobank empty in both bundled and API)
- [Phase 38-extension-uat-batch-bug-fix-loop-regr]: GitHub Release v2.9.20 ships as DRAFT pending deferred browser re-walk after Saturday staging on stb-lockdown.app; lockdown re-sync gated on same

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
- **F38-1 (blocker, closed v2 pending re-walk):** Fix shipped in v2.9.20 DRAFT release. Root cause v2: Papertek API serves FR generalbank from `lexicon/fr/` (865 keys) MISSING 3 aspect meta entries (`aspect_passe_compose_adverbs`, `aspect_imparfait_adverbs`, `aspect_choice_pedagogy`); bundled `extension/data/fr.json` has all 866 keys but `BUNDLED_LANGS = ['nb']` forced FR through API path. Fix: narrow defensive backfill in `vocab-seam.js#buildAndApply` overlays missing meta entries from bundled fr.json before calling buildIndexes. The 38-01.1 BRANCH C fix (nb-typo-fuzzy elision strip) was real-but-symptomatic and stays in tree. Status reverts to `open` if walker re-walk of UAT-EXT-01 Steps 1-4 against v2.9.20 fails. See `.planning/uat/findings/F38-1.md` Resolution v2 section. Regression artifact: `scripts/check-fr-bundle-completeness.js`.
- **Sidecar-pipeline gap (deferred to 38-01.2 candidate):** freq-{lang}.json, pitfalls-{lang}.json, bigrams-{lang}.json (FR/DE/ES) + pitfalls-nb.json all 404. loadBundledSidecar handles 404 gracefully so absence is not a blocker. Sidecar generation is upstream Papertek-API/sync-vocab territory per data-logic separation philosophy.
- **F38-2 (minor, deferred):** NN locale partial — popover button labels translate but explanation body stays in NB. NOT a Phase 38 blocker per walker classification; Phase 38-04 will accumulate more NN signal. See `.planning/uat/findings/F38-2.md`.

## Session Continuity

Last session: 2026-05-01
Stopped at: Plan 38-04 closed cleanly. UAT-EXT-02 final walkthrough log committed (commits cc0ea5e / 7c60a7b / c2e2e9c). Walker (Geir) signed off all 6 walks in real Chrome 147.0.7727.117 arm64 against v2.9.19 — Steps 1-4 (DE NB-locale: de-prep-case acc/dat + Wechselpräpositionen movement/location + full 9-prep table render) ✅ pass; Steps 5-6 (NN + EN locale on DE pedagogy) ✅ pass. Phase 35 F7 deferred carry-over (NN/EN locale Lær mer never walked in real browser) explicitly CLOSED. F38-2 (FR-aspect-hint-pedagogy-specific NN gap from Plan 38-01) remains open as a separate, narrower scope — DE pedagogy NN render verified healthy here. Zero F38-N findings filed. Locked Phase 38 walk sequence COMPLETE: warm-up ✅ → canonical ✅ → highest-stakes ✅ → final ✅. SUMMARY at `.planning/phases/38-extension-uat-batch-bug-fix-loop-regr/38-04-SUMMARY.md`. UAT-EXT-02 marked complete in REQUIREMENTS.md; ROADMAP plan-progress updated for Phase 38 (5/6 SUMMARY files now present).
Next: **Orchestrator decision point — do NOT auto-advance to Plan 38-05.** Two paths: (1) Spin Plan 38-01.2 for actual F38-1 closure (deep aspect-adverb data-load gap; root cause identified as API/IDB stripping `generalbank.aspect_*_adverbs`), THEN Plan 38-05 ships clean. (2) Ship v2.9.19 with F38-1 partially open (Branch C nb-typo-fuzzy fix in; fr-aspect-hint silence pushed to next phase), proceed straight to Plan 38-05. Open work: (a) Plan 38-01.1 Task 4 walker re-walk to close F38-1 first branch (REOPENED); (b) Plan 38-05 release asset (still BLOCKED on F38-1 closure); (c) candidate 38-01.2 sidecar-pipeline regeneration; (d) F38-2 future NN coverage phase (post-Phase-38).
Follow-up candidates (post-Phase-38, surfaced by Plan 38-02): vocab-updates banner manual-trigger affordance for QA OR staging-env API drift procedure, so future walks can exercise the banner without a service-worker-only path.
Next: Walker re-walks UAT-EXT-01 Steps 1-4 against v2.9.19 zip:
1. Install v2.9.19 from GitHub draft release (or reload dev extension on the new commit at chrome://extensions).
2. Set popup foreign-language=French, NB locale.
3. Type the F38-1 repro `Pendant que je marchais, j'ai vu un chien.` in a French input.
4. Verify: fr-aspect-hint dot fires on `j'ai vu`; clicking shows popover + Lær mer; CRITICALLY no NB-typo "Jai står ikke i ordboken, kanskje du mente j'aime?" popover appears on `j'ai`.
5. Append re-walk evidence to `.planning/uat/UAT-EXT-01.md` under `## Re-walk after F38-1 fix (v2.9.19)` with Steps 1-4 ✅ + walker sign-off.
6. If ✅ → promote GitHub Release v2.9.19 from Draft to Latest; proceed to Plan 38-02.
7. If ❌ → revert F38-1 status to `open`, file follow-up plan.
Open candidate plans: 38-01.2 (sidecar-pipeline regeneration, OUT-OF-SCOPE deferral from this plan) and 38-02 (canonical popup view 9-step walkthrough — UAT-EXT-04). F38-2 explicitly deferred per walker.
