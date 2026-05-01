# Feature Landscape — v3.2 UAT & Deploy Prep

**Domain:** Hardening / risk-reduction milestone (UAT-execution + bug-fix loop + cross-repo sync + deploy-runbook readiness)
**Researched:** 2026-05-01
**Mode:** Ecosystem (project-internal — derived from v3.1 carry-over backlog and audit findings)

---

## Overview & Framing

A hardening milestone behaves differently from a feature milestone: there is no "differentiator" axis in the user-value sense — every shipped item is risk-reduction. The meaningful axis is **what kind of risk** an item reduces:

1. **Direct UAT execution** — confirm code-complete features actually work for a human
2. **Bug-fix loop** — surface→fix→verify discipline, with bidirectional surfacing into the loop
3. **Cross-repo propagation** — leksihjelp fix → lockdown-leksihjelp sync → lockdown re-validation
4. **Deploy readiness** — turn the deferred prod deploys from "scary one-off" into "runnable from a checklist"
5. **Permanent regression defense** — turn UAT findings into release-gate fixtures so the same bug cannot recur

This re-frames the "table-stakes vs differentiator" split: items 1–4 are table-stakes for any hardening milestone; item 5 (regression capture) is the value-add that distinguishes a polished milestone from a debt-paydown milestone. **The user should treat item 5 as in scope** — see Differentiators below.

---

## Categories (the milestone REQUIREMENTS shape)

The milestone's REQUIREMENTS should be grouped under five categories:

| # | Category | Code prefix | Why this exists | Item count |
|---|----------|-------------|-----------------|------------|
| 1 | Extension UAT Execution | UAT-EXT-NN | Walk the 5 in-extension v3.1 features in real Chrome (not Node fixtures) | 5 walkthroughs |
| 2 | Lockdown UAT Execution | UAT-LOCK-NN | Walk Phase 30 sidepanel host in lockdown-staging after sync | 1 walkthrough (8-step) |
| 3 | Bug-Fix Loop & Cross-Repo Sync | FIX-NN | Container for whatever UAT surfaces + the leksihjelp→lockdown sync mechanics | 2-N (size-of-bugs unknown until UAT runs) |
| 4 | Deploy Runbooks | DEPLOY-NN | Turn the 2 deferred deploys into checklist-driven, low-risk operations | 2 runbooks |
| 5 | Regression Capture (the value-add) | REGR-NN | For each UAT finding, write a fixture / release gate that prevents recurrence | 1 framework + per-bug fixtures |

Why these specifically:

- **EXT vs LOCK is real, not pedantic.** The extension runs under real `chrome.*` APIs; lockdown runs under a chrome-shim with limited surface. Bug classes diverge (e.g., `chrome.tabs` works in extension, doesn't in lockdown). Splitting the categories means the milestone can ship Extension UAT and Bug-Fix Loop wins even if lockdown-staging access is gated on Geir's availability.
- **FIX is its own category, not folded into UAT.** UAT findings can produce 0 bugs or 30 bugs; the count isn't predictable at planning time. A separate category means the milestone can size the Fix-Loop phases adaptively without reopening the UAT phases. This is also where leksihjelp-version-bump → lockdown-sync-script-rerun lives.
- **DEPLOY is artifacts, not deploys.** User explicitly chose "make them easy to execute correctly after the milestone." Runbook = deliverable; production deploy = post-milestone user action.
- **REGR is the milestone's signature.** v3.1 audit shows 12 release gates; the project culture already treats fixture-capture as first-class engineering. Continuing that into v3.2 preserves the "every UAT finding becomes a permanent guard" pattern.

---

## Table Stakes (must ship for v3.2 to count as "done")

Features the milestone cannot omit without missing its stated goal.

| Feature | Category | Why required | Complexity | Notes |
|---------|----------|--------------|------------|-------|
| **F36-1 fr-aspect-hint browser confirmation** | UAT-EXT | Defensively closed via INFRA-10 + cross-language guard; rule-fires confirmation outstanding. Smallest UAT item — good warm-up. | Low (1 test) | Rule was the trigger for INFRA-10; closure formalises the v3.1 → v3.2 handoff. |
| **Phase 26: 6 DE Lær mer browser walks** | UAT-EXT | de-prep-case + Wechselpräpositionen pedagogy panel — six discrete walks (dativ badge colour, Wechsel pair rendering, Esc collapse, NN locale, EN locale, Tab nav state reset). F6 already closed in Phase 35. F7 (NN+EN locale) explicitly carried into v3.2. | Med (4 + 2 split) | Split rationale: 4 default-locale walks first (no UI-language switch needed); 2 locale walks bundled separately because they require resetting UI language and re-walking. |
| **Phase 26 follow-up: NN + EN locale walks (F7)** | UAT-EXT | Verifies pedagogy renders correctly under non-default UI language — the highest-risk locale class because i18n strings are loaded async after first paint. | Low (2 walks) | Should run AFTER the 4 default-locale walks confirm baseline rendering. |
| **Phase 27: 9-step exam-mode walk** | UAT-EXT | Exam Mode is a school-deployment feature; "auto-approved per auto-mode" closure is acceptable for code complete but unacceptable for a feature whose entire value proposition is teacher trust. Toggle on/off, EKSAMENMODUS badge, amber border, suppression behaviour across rules — every step matters. | Med (9 steps, 1 sitting) | Highest-stakes UAT in milestone. Capture screenshots for the deploy runbook. |
| **Phase 30-01: 9-step extension popup view walk** | UAT-EXT | View modules are a synced surface for lockdown; bugs here propagate. Dictionary view, settings view, pause, report, lang switch, direction toggle, compound suggestion, vocab-update banner. | Med (9 steps, 1 sitting) | Should run BEFORE Phase 30-02 lockdown UAT — extension is canonical. |
| **Phase 30-02: 8-step lockdown sidepanel staging UAT** | UAT-LOCK | First end-to-end test of view-module sync into lockdown-staging. Create leksihjelp-enabled test, join as student, verify no audio buttons, verify EKSAMENMODUS profile rendering. | Med-High (8 steps + lockdown setup) | DEPENDS ON: Phase 30-01 closure + leksihjelp re-sync + version bump. Don't run UAT-LOCK if any UAT-EXT bug fix landed and hasn't been synced. |
| **Bug-fix triage protocol** | FIX | Per-finding severity classification (block-release / fix-and-ship / defer-to-v3.3) so UAT findings don't open-endedly extend the milestone. | Low | Lightweight playbook; documented once, applied per-finding. |
| **leksihjelp → lockdown sync script execution** | FIX | After every leksihjelp version bump within milestone, re-run `lockdown/scripts/sync-leksihjelp.js`, commit in lockdown-staging, validate sidepanel still mounts. The sync mechanics are documented in CLAUDE.md but the milestone needs an explicit "sync was run after fix N" record. | Low (per sync) | Synced surfaces: `extension/content/*.js`, `extension/exam-registry.js`, `extension/popup/views/*.js`, `extension/styles/content.css`, `extension/data/*`, `extension/i18n/*`. |
| **Lockdown-stb production Firebase deploy runbook** | DEPLOY | Covers `firestore.rules + functions` deploy for EXAM-10 enum. Staging-lockdown deployed 2026-04-28; production user-gated. | Med | See "Deploy Runbook Anatomy" below for required contents. |
| **Lockdown papertek.app production hosting deploy runbook** | DEPLOY | Covers Phase 30 sidepanel host. Same shape as Firebase runbook but `--only hosting`. | Med | Can share template with Firebase runbook. |

---

## Differentiators (value-add — what distinguishes "polished" from "debt paid")

Items the milestone could omit and still claim its stated goal — but shouldn't, because they convert one-time UAT into permanent infrastructure.

| Feature | Category | Why valuable | Complexity | Notes |
|---------|----------|--------------|------------|-------|
| **UAT-finding-to-fixture conversion** | REGR | Every UAT bug surfaced → captured as a fixture in `scripts/check-fixtures.js` (or a new browser-walk-driven gate where fixture isn't a fit). The project's 12-gate culture justifies the discipline; v3.1 INFRA-10 came directly from this pattern. | Low per finding | The REGR category exists precisely because v3.1 retrospective shows: every release gate caught a regression class that previous releases shipped. |
| **UAT walkthrough scripts checked into repo** | REGR | The 9-step exam-mode walk and 9-step popup view walk are valuable IP. Saving them as `.planning/uat-scripts/exam-mode.md` etc. means v3.3 can re-run them in 30 minutes instead of re-deriving from PLAN.md. | Low | Lockdown CLAUDE.md notes "manual UAT" without checked-in scripts; this fixes the same gap on the leksihjelp side. |
| **Deploy runbook self-test** | DEPLOY | A 5-minute "dry run" pass that walks the runbook against staging without firing the actual prod deploy command — catches stale URLs / wrong project IDs / missing env vars. | Low | Mirrors the `:test` self-test pattern of release gates (e.g., `check-explain-contract:test`). |
| **Pre-flight Firestore-rules diff capture** | DEPLOY | `firebase deploy --only firestore:rules --dry-run` (if supported) or manual `firestore.rules` diff against deployed snapshot, captured into the runbook artifact at deploy-time. Catches "rules drifted from main" before the deploy lands. | Med | Especially valuable for EXAM-10 because the Cloud Functions enum and rules co-evolve. |
| **Post-deploy smoke-test checklist** | DEPLOY | Per runbook: a 3-5 item "what to check in prod within 60 seconds of deploy" list. For Firebase: enum loads, no Cloud Functions cold-start error, exam-mode toggle in admin UI works. For hosting: sidepanel route loads, view modules render, no console errors. | Low | Goes into the runbook itself; doesn't ship as separate artifact. |

---

## Anti-Features (explicitly NOT in scope — preventing scope creep)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Production Firebase + hosting deploys** | User explicitly deferred. Running them inside the milestone removes the user's "I'll do this when ready" optionality and turns the milestone into release-orchestration. | Ship the runbooks; let user execute post-milestone with the runbook in hand. |
| **Phase 28.1 skriveokt-zero exam-mode sync** | EXAM-09 deferred by design — skriveokt-zero not yet shipping to consumers. Doing this work now races ahead of the consumer. | Leave deferred in PROJECT.md until skriveokt-zero starts shipping. |
| **New v3.2 features beyond UAT/fix/sync** | Adding feature work blurs the milestone identity. v3.2 = "everything v3.1 shipped, validated and locked-in." | Park new features in `### Deferred` for v3.3+ planning. |
| **Reopening v3.1 audit findings beyond the 14 listed** | Open-ended re-audit would expand scope unbounded. | Trust the 2026-05-01 v3.1 audit; if a new finding surfaces during v3.2 UAT, route it through the FIX category triage protocol. |
| **Bundled major version bump (e.g., v3.2 → v4.0)** | Hardening milestones don't justify major version bumps. Patch/minor bumps from bug fixes are the right shape. | Increment minor (2.10.x) for bug-fix releases as needed; defer major-bump justification to v4.0 planning. |
| **Test-suite expansion via /gsd:add-tests beyond REGR captures** | The user's memory `project_test_suite_at_milestone_end.md` indicates `/gsd:add-tests` runs once at end-of-milestone before `/gsd:complete-milestone`. Don't pre-empt it inside phases. | Run `/gsd:add-tests` once after the last phase; treat REGR captures as in-phase work. |
| **Telemetry instrumentation to "measure" UAT findings** | GDPR/Schrems-II + landing-page trust commitment — already in Out of Scope at PROJECT.md. | Track findings manually in the milestone audit. |

---

## Feature Dependencies

```
UAT-EXT (extension walkthroughs, parallelisable)
  ├── F36-1 fr-aspect-hint                       (smallest; warm-up)
  ├── Phase 26 default-locale (4 walks)
  ├── Phase 26 NN+EN locale (2 walks, F7)        ← after default-locale walks
  ├── Phase 27 exam-mode (9 steps)
  └── Phase 30-01 popup views (9 steps)          ← canonical for lockdown
        │
        ▼
FIX (per finding from UAT-EXT)
  ├── triage (block / fix / defer)
  ├── fix in extension
  ├── REGR capture (fixture / gate / walkthrough script)
  ├── version bump (manifest.json + package.json + index.html)
  ├── package + release zip
  └── leksihjelp → lockdown sync (script + commit)
        │
        ▼
UAT-LOCK
  └── Phase 30-02 sidepanel (8 steps in lockdown-staging)  ← only after sync settles
        │
        ▼
FIX (round 2 if lockdown UAT surfaces lockdown-only bugs)
        │
        ▼
DEPLOY (runbooks — independent of UAT outcomes once both UAT rounds close)
  ├── Lockdown-stb Firebase runbook
  ├── Lockdown papertek.app hosting runbook
  └── Self-test (dry-run each runbook against staging)
        │
        ▼
/gsd:add-tests + /gsd:complete-milestone
```

**Critical path:** UAT-EXT → FIX → sync → UAT-LOCK. Don't UAT lockdown with stale code.

**Parallelisable:** Within UAT-EXT, the 5 walkthroughs are independent. Within DEPLOY, the two runbooks share a template but otherwise run independently.

---

## MVP Recommendation (if scope must compress)

Prioritise (in order):

1. **F36-1** (15 min) — closes the only v3.1 phase still in `closed-pending-browser-uat` state
2. **Phase 27 exam-mode 9-step walk** (60 min) — highest-stakes feature; school-deployment trust depends on it
3. **Phase 30-01 popup view walk** (60 min) — must precede any lockdown UAT
4. **Phase 30-02 lockdown sidepanel UAT** (90 min + setup) — confirms the cross-repo sync path actually delivers the user-visible feature
5. **Both deploy runbooks** (90 min each) — turn the deferred prod deploys from latent risk into routine

Defer (acceptable to slip into v3.3 if v3.2 runs long):

- **Phase 26 NN+EN locale walks** — locale rendering is lower-risk than exam-mode trust; baseline (default-locale) walks already partially closed in Phase 35
- **REGR captures for low-severity findings** — capture the high-severity ones; let the rest accumulate into a v3.3 sweep

---

## Deploy Runbook Anatomy (what makes a good runbook vs. a one-line shell command)

The user's question called this out specifically. A good runbook for the two outstanding deploys contains:

| Section | Purpose | Example for `firebase deploy --only firestore:rules,functions --project lockdown-stb` |
|---------|---------|--------------------------------------------------------------------------------------|
| **Pre-flight environment check** | Confirm shell is in the right state | `firebase --version` ≥ X; `firebase projects:list` shows lockdown-stb; `node --version` matches lockdown's `.nvmrc`; `gcloud auth list` shows the right account |
| **Pre-flight code check** | Confirm the right commit is being deployed | `git status` clean in `/Users/geirforbord/Papertek/lockdown`; `git log -1` matches expected commit; staging-lockdown branch is rebased onto main |
| **Pre-flight diff capture** | Show what's actually changing | `firebase deploy --only firestore:rules --dry-run` (or manual diff) saved to artifact; `git diff main..HEAD -- functions/` for functions-side review |
| **Deploy command** | The actual one-liner | `cd /Users/geirforbord/Papertek/lockdown && firebase deploy --only firestore:rules,functions --project lockdown-stb` |
| **Expected output checkpoints** | What success looks like (so partial failure is recognisable) | "✔ Deploy complete!" line; functions list shows expected functions, no "removed" warnings; rules version timestamp newer than previous deploy |
| **Post-deploy smoke test** | Within-60-seconds validation | Open lockdown admin UI → exam-mode toggle exists for LEKSIHJELP_EXAM profile; create test resource with profile; no console errors in functions logs (`firebase functions:log --limit 20`) |
| **Observability checks (next 10 min)** | What to keep an eye on | Firebase console error rate; Cloud Functions cold-start metrics; Firestore rules-deny rate spike |
| **Rollback procedure** | If the smoke test fails | `firebase deploy --only firestore:rules,functions --project lockdown-stb` from previous-good commit; for rules specifically: Firestore console → Rules → version history → rollback. Document the previous-good commit SHA at the top of the runbook before deploy. |
| **Communication step** | Who to tell, how | Post in #lockdown-deploys (or equivalent) with deploy commit SHA, smoke-test result, link to functions log. |
| **Sign-off checkbox** | Audit trail | Date, deployer, smoke-test pass/fail, observability all-clear after 10 min. |

**The hosting runbook (`firebase deploy --only hosting`) follows the same template** with hosting-specific smoke tests (sidepanel route loads, view modules render, no 404 on synced assets, audio buttons absent in lockdown context).

---

## What's Commonly Missed in a UAT-Cleanup Milestone (the "you'll regret deferring" list)

Based on v3.1 audit + the project's own retrospective patterns:

1. **Screenshots of the actual UAT surfaces.** A 9-step walkthrough that ships without screenshots becomes un-redoable in 6 months. Even a single screenshot per UAT step is gold for v3.3+ regression-spotting.
2. **REGR capture for the bugs UAT *didn't* find.** When UAT passes a step cleanly, that's a signal the rule is robust enough to deserve a permanent fixture asserting the same behaviour. Don't only capture failures.
3. **The leksihjelp version-bump-and-sync ritual.** Easy to fix a bug, run check-fixtures, and forget that lockdown's `node_modules/@papertek/leksihjelp` won't auto-pick up the change. CLAUDE.md documents the rule; v3.2 should treat each in-milestone version bump as a discrete REGR-capturable event.
4. **Runbook *self-test*.** A runbook nobody dry-runs is a runbook with stale URLs. Mirror the project's own `:test` gate culture — every runbook gets a paired dry-run script.
5. **The "what's the rollback story for EXAM-10 specifically" question.** Firestore rules rollback is well-known; but EXAM-10 introduced enum values that existing data depends on. Removing the enum after data uses it is destructive. The runbook needs an explicit "what to do if EXAM-10 needs to be reverted after data has been written" section, even if that section is just "page Geir, do not auto-rollback."
6. **REQUIREMENTS.md hygiene that isn't in scope but should be.** v3.1 audit flagged EXAM-01..EXAM-07 still labelled "Planned" despite verification passing. v3.2 is the natural moment to also flip-and-archive the Phase 31 orphan if it wasn't fully cleaned in the v3.1 quick task. Worth a single hygiene plan inside the milestone.
7. **The "lockdown's CLAUDE.md says 'mirror fixes upstream'" reverse-sync check.** Before running v3.2 lockdown UAT, confirm there's nothing in `lockdown/public/leksihjelp/**` that diverges from the synced source. If lockdown has accumulated fixes downstream that never made it back, the v3.2 sync will silently revert them.
8. **A clean v3.2 → v3.3 handoff.** The milestone audit pattern is mature; v3.2 should produce its own MILESTONE-AUDIT.md at close and explicitly enumerate "what's deferred to v3.3" — including any UAT findings classified as `defer-to-v3.3` during the FIX triage.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Category structure (5 categories) | HIGH | Derived directly from the 6 UAT items + 2 deploys + sync mechanics in PROJECT.md & STATE.md |
| Dependency graph | HIGH | Cross-repo sync requirement documented in CLAUDE.md; UAT-EXT before UAT-LOCK is forced by the sync direction |
| Deploy runbook anatomy | MEDIUM | Best-practice synthesis; project has no prior runbook to template from. The `:test` self-test mirror is project-grounded. |
| "Commonly missed" list | MEDIUM-HIGH | Items 1, 3, 4, 6, 7, 8 are project-grounded (audit + CLAUDE.md). Items 2, 5 are best-practice synthesis. |
| Anti-features | HIGH | All grounded in user-stated milestone scope or PROJECT.md "Out of Scope" / "Deferred" |

---

## Sources

- `/Users/geirforbord/Papertek/leksihjelp/.planning/PROJECT.md` (v3.2 milestone definition, Out of Scope, Deferred)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/STATE.md` (Pending Todos — the 6 UAT items + 2 deploys, verbatim)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/milestones/v3.1-MILESTONE-AUDIT.md` (Tech Debt Aggregation — 14 items across 8 phases)
- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` (synced-surface list, lockdown sync mechanics, version-bump ritual, downstream fix-mirror agreement)
- User memory `project_test_suite_at_milestone_end.md` (informs anti-feature on /gsd:add-tests)
