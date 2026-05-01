# Project Research Summary

**Project:** leksihjelp v3.2 — UAT & Deploy Prep
**Domain:** Hardening / risk-reduction milestone (UAT execution + cross-repo sync + deploy-runbook authoring)
**Researched:** 2026-05-01
**Confidence:** HIGH

## Executive Summary

v3.2 is a hardening milestone for an already-shipped Chrome MV3 extension with two downstream consumers (lockdown webapp in production; skriveokt-zero deferred). It ships zero new features. The deliverables are: (1) execute six v3.1-deferred browser UAT walkthroughs (1 fr-aspect-hint, 6 DE Lær mer, 9-step exam-mode, 9-step popup views, 8-step lockdown sidepanel); (2) drain whatever bug fixes those walkthroughs surface through the canonical fix → release-gates → version-bump → lockdown-sync → re-test loop; (3) author production deploy runbooks for `firestore.rules`+Functions (EXAM-10) and papertek.app hosting (Phase 30 sidepanel) so the user-gated production deploys become checklist-driven and low-risk.

The recommended approach adds **no new runtime dependencies, no test frameworks, and no CI infrastructure**. Playwright/Cypress/Puppeteer are net-negative at 6-walkthrough scope and cannot exercise Vipps OIDC, Side Panel chrome, or visual rendering reliably. Instead: structured Markdown UAT templates with mandatory pre-flight evidence blocks, repo-local finding/runbook files at `.planning/uat/` and `.planning/runbooks/`, and lightweight conventions (commit-message tags, `verification_kind` frontmatter). The 14 existing release gates already encode the right "automate what's mechanical" decisions; v3.2 should add at most one or two more (`check-version-alignment` is mechanical and recurring; `check-synced-surface-version` is a strong candidate).

The dominant risks are not technical — they are process. v3.1 deferred all six walkthroughs precisely because verification logs were thin (no version strings, no screenshots, no defects-observed section). Without template discipline, v3.2 will repeat the failure. The other top risks: stale-build/stale-IDB UAT (verifier looks at the wrong artifact and reports PASS); fix lands in extension but lockdown's `node_modules/@papertek/leksihjelp` doesn't move; lockdown sync mirrors orphan working-tree changes (happened in v3.1 Phase 30-02); deploy runbook reads as "run this command" with no rollback/observability/smoke-test sections; production deploys linger forever because runbooks were never dry-run-walked end-to-end against staging.

## Key Findings

### Recommended Stack

No new dependencies. Three small Markdown templates plus an optional ~30 LOC bash convenience script. Existing toolchain (Vercel CLI, Firebase CLI 13.x, Chrome 114+, GitHub Releases, macOS `screencapture`, `gh`) covers everything in scope.

**Core technologies (existing — no changes):**
- Chrome MV3 vanilla JS extension — UAT subject; manual exercise of the shipped artifact
- Firebase CLI 13.x — selective `--only firestore:rules` / `--only functions` deploys for lockdown
- Vercel CLI — leksihjelp.no hosting deploys (out of v3.2 scope but documented in runbooks for completeness)
- GitHub Releases — extension zip distribution rhythm

**New artifacts (planning/docs only, not runtime):**
- `.planning/uat/TEMPLATE-walkthrough.md` — per-walkthrough script with pre-flight evidence + pass/fail/defects-observed
- `.planning/uat/TEMPLATE-finding.md` — per-finding artifact (F-id, severity, sync-status)
- `.planning/runbooks/*.md` — durable deploy runbooks (NOT scoped to milestone — they survive archive)
- Optionally: `scripts/uat-evidence.sh` (~30 LOC bash) for screen-recording capture

### Expected Features

This is a hardening milestone — the "table stakes" axis is *what kind of risk* an item reduces, not user-value differentiation. Five categories: Extension UAT execution, Lockdown UAT execution, Bug-fix loop & cross-repo sync, Deploy runbooks, and Regression capture (the value-add that distinguishes "polished" from "debt paid").

**Must have (table stakes — milestone cannot omit):**
- F36-1 fr-aspect-hint browser confirmation (smallest; warm-up)
- Phase 26: 6 DE Lær mer browser walks (4 default-locale + 2 NN/EN locale split)
- Phase 27: 9-step exam-mode walk (highest-stakes — school-deployment trust)
- Phase 30-01: 9-step extension popup view walk (canonical for lockdown)
- Phase 30-02: 8-step lockdown sidepanel staging UAT (after sync settles)
- Bug-fix triage protocol + leksihjelp→lockdown sync ritual
- Two production deploy runbooks (Firebase EXAM-10; papertek.app hosting)

**Should have (differentiators — converts one-time UAT into permanent infrastructure):**
- UAT-finding-to-fixture conversion (continues 14-gate culture; INFRA-10 precedent)
- UAT walkthrough scripts checked into repo (`.planning/uat-scripts/`) for v3.3+ re-runs
- Deploy runbook self-test (`:test` mirror of release-gate culture)
- Pre-flight Firestore-rules diff capture
- Post-deploy 60-second smoke-test checklist per runbook

**Defer (anti-features — explicitly NOT in scope):**
- Production Firebase + hosting deploys (user-gated; runbooks are the deliverable)
- Phase 28.1 skriveokt-zero exam-mode sync (EXAM-09 stays deferred until consumer ships)
- Any new v3.2 features beyond UAT/fix/sync
- New unit-test framework adoption; Playwright/Puppeteer/Cypress; CI infrastructure
- Major version bump (2.10.x is the right shape)
- Telemetry instrumentation
- `/gsd:add-tests` inside phases — runs once at milestone end per user convention

### Architecture Approach

Three-repo topology with leksihjelp as upstream source of truth. Lockdown (shipping) consumes via `file:../leksihjelp` postinstall sync; skriveokt-zero (deferred) has its own sync path. The architectural concern in v3.2 is **integration paths and version-skew risk**, not new components. Runbooks live at `.planning/runbooks/` (durable, top-of-planning) — NOT inside `milestones/v3.2/` — because they must survive the milestone archive and be referenced by future deploys.

**Major components:**
1. **`extension/` source tree** — canonical implementation of every shared surface; every UAT bug-fix lands here first
2. **14 release gates (`scripts/check-*.js`)** — re-run on every UAT fix; gate passes are pre-condition for `npm run package`
3. **`package.json` version** — sync signal to downstream consumers; bump on every synced-surface change
4. **Lockdown sync pipeline** — `scripts/sync-leksihjelp.js` pulls synced surfaces (content/, popup/views/, exam-registry.js, content.css, data/, i18n/) from `node_modules/@papertek/leksihjelp`
5. **Phase 30 dep-injection contract** — `mountXView(container, deps)` must stay additive; `audioEnabled: false` safeguard in lockdown must remain
6. **`.planning/runbooks/`** — new durable directory with deploy runbooks following a fixed 6-section structure

**Key patterns:**
- **Canonical Fix → Sync → Re-test (Pattern 1):** 9-step loop per UAT bug; never hot-fix lockdown directly
- **Batched UAT Drain (Pattern 2):** drain a walkthrough's findings into one extension version bump; ~1 phase = 1 walkthrough = 1 bump
- **Runbook-as-Code Pre-flight (Pattern 3):** copy-pasteable command blocks + verification step; "checked-in Bash transcript with prose between commands"
- **Dep-Injection Contract Stability (Pattern 4):** preserve, don't touch — `check-popup-deps` enforces no implicit globals but does NOT catch added required deps

### Critical Pitfalls

1. **Stale-build/stale-IDB UAT reports PASS (Pitfall 1)** — verifier looks at the wrong artifact. Mitigation: mandatory pre-flight evidence block (extension version string, `chrome://extensions` reload timestamp, IDB revision, default-preset profile) on every walkthrough.
2. **Auto-mode skips human verification (Pitfall 2)** — root cause of the v3.1 six-walkthrough deferral. Mitigation: `verification_kind: human-browser-walk` frontmatter excludes phases from auto-advance; orchestrator surfaces hard pause.
3. **Fix in extension; lockdown still ships the bug (Pitfall 5)** — sync didn't run. Mitigation: post-fix sync verification step in every bug-fix phase plan; new gate `check-synced-surface-version` to detect version-bump-skipped after synced-surface change.
4. **Lockdown sync mirrors orphan working-tree changes (Pitfall 7)** — happened in v3.1 Phase 30-02 (4 orphan files shipped). Mitigation: sync only against tagged versions; refuse if upstream `git status` dirty.
5. **Three-version-string skew (Pitfall 10)** — manifest.json + package.json + backend/public/index.html drift. v2.2 audit caught this. Mitigation: new `check-version-alignment` release gate (mechanical, recurring — exactly the right shape).
6. **Deploy runbook reads as "run this command" (Pitfall 13)** — no rollback / smoke-test / observability. Mitigation: fixed 6-section structure (pre-flight, deploy command, smoke test, observability, rollback, deferred-cleanup) — auditor flags any runbook missing a section.
7. **Wrong-project Firebase deploy (Pitfall 14)** — staging-vs-prod is purely procedural. Mitigation: `--project <id>` mandatory in every deploy command; `firebase use` pre-flight assertion.
8. **Production deploys linger forever (Pitfall 19)** — user-gated, agents skip. Mitigation: dry-run runbook end-to-end against staging with explicit user sign-off ("I would feel safe running this against production") as the milestone deliverable.

## Implications for Roadmap

Based on combined research, the natural phase sequence is **A → B → C** (sequential by surface, NOT interleaved per fix). Context-switching between "do an extension UAT walk" and "author a deploy runbook" wastes warm-up; group like work. Per user's `feedback_fewer_phases.md`, consolidate into fewer larger phases — the rough mapping below collapses to ~5 phases.

### Phase 1: Hygiene & UAT Templates (Process Foundation)
**Rationale:** Without template discipline, v3.2 repeats v3.1's six-walkthrough deferral. Must come first so every downstream phase uses the new template.
**Delivers:** `.planning/uat/TEMPLATE-walkthrough.md` (with pre-flight evidence block + defects-observed section + target-browsers list), `.planning/uat/TEMPLATE-finding.md`, `verification_kind` frontmatter convention, `check-version-alignment` release gate (with paired `:test`), optional `scripts/uat-evidence.sh` and `scripts/uat-preflight.js`.
**Avoids:** Pitfalls 1, 2, 3, 4, 10, 17.

### Phase 2: Extension UAT Batch (drain all 5 extension walkthroughs)
**Rationale:** Everything else depends on extension code being UAT-confirmed. Authoring deploy runbooks for unstable code is wasted work. Sequence by warm-up → highest-stakes → canonical-for-lockdown.
**Delivers:** Verification logs for F36-1 fr-aspect-hint, Phase 27 exam-mode (9 steps), Phase 30-01 popup views (9 steps), Phase 26 DE Lær mer (4 default-locale + 2 NN/EN locale walks). Each log instantiates the new template.
**Implements:** Canonical Fix → Sync → Re-test loop (Pattern 1) for any surfaced bugs; batched-drain (Pattern 2) — ONE version bump per walkthrough that surfaced fixes.
**Avoids:** Pitfalls 1, 3, 4, 6, 11, 17.
**Note:** Bug fixes within this phase trigger version bumps (per ritual); REGR captures (fixture or benchmark-texts entry) accompany every fix.

### Phase 3: Lockdown Sync + Staging UAT
**Rationale:** Lockdown sync must consume the post-Phase-2 version. Syncing mid-Phase-2 means re-syncing later anyway. Tagged-version sync (not working-tree) prevents Pitfall 7.
**Delivers:** `cd lockdown && npm install` against tagged leksihjelp v3.2; Phase 30-02 sidepanel 8-step staging UAT verification log; lockdown-stb confirmed at parity with extension HEAD; one-time skriveokt-zero sync dry-run output captured.
**Avoids:** Pitfalls 5, 7, 8, 9, 11, 12.
**Carve-out:** If a critical bug surfaces, hot-loop back to Phase 2's Pattern 1 (extension fix → re-package → re-sync); don't fix lockdown directly.

### Phase 4: Deploy Runbooks (authoring + dry-run + sign-off)
**Rationale:** Authoring cold (without recent staging-deploy experience) loses fidelity. Phase 3's staging deploy IS the runbook draft — capture it live.
**Delivers:** `.planning/runbooks/README.md` (index), `lockdown-staging-deploy.md` (transcript of Phase 3), `lockdown-prod-deploy.md` (firestore.rules + Functions for EXAM-10 — 6-section structure), `papertek-app-sidepanel-deploy.md` (Phase 30 hosting), `extension-uat-fix-loop.md` (codifies Pattern 1). Each runbook dry-run-walked against staging with explicit user sign-off. CLAUDE.md gets a one-line pointer in Release Workflow.
**Avoids:** Pitfalls 13, 14, 15, 16, 19.
**Note:** Production deploys themselves remain user-gated post-milestone — sign-off ("I would feel safe running this") is the deliverable.

### Phase 5: Milestone Archive (close hygiene)
**Rationale:** v3.1 carry-over pattern shows un-classified deferrals accumulate; v3.2 must break the cycle.
**Delivers:** `/gsd:add-tests` run once (per user convention `project_test_suite_at_milestone_end.md`); `v3.2-MILESTONE-AUDIT.md` with explicit deferral classification (hard / time / backlog) for every carry-over; version-string alignment check; EXAM-09 / skriveokt-zero status statement updated; `/gsd:complete-milestone`.
**Avoids:** Pitfalls 18, 19.

### Phase Ordering Rationale

- **Phase 1 first** because UAT discipline must exist before UAT runs; templates and the version-alignment gate are infrastructure for everything else
- **Phase 2 before Phase 3** because lockdown sync must consume a stable extension head — Pattern 1's "tagged-version sync" rule depends on this
- **Phase 3 before Phase 4** because the staging-deploy runbook is a literal transcript of Phase 3's lockdown sync experience; authoring it cold loses fidelity
- **Phase 4 before Phase 5** because runbook sign-off is a milestone-close criterion that Phase 5 must verify
- **No interleaving** because UAT walkthroughs are slow and cognitively expensive; context-switching wastes warm-up

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (deploy runbooks):** Firebase CLI 13.x exact command shapes for rules diff (`--dry-run` semantics; `firebase firestore:rules:get` for snapshot comparison) need verification at write-time. Cloud Functions rollback path needs explicit documentation (no `firebase functions:rollback` command; actual path is re-deploy from previous-good git SHA).
- **Phase 3 (lockdown sync):** Drift-detection enhancement to lockdown's `scripts/sync-leksihjelp.js` (refuse to overwrite divergent files without confirmation) is a lockdown-side change — needs cross-repo coordination during plan.

Phases with standard patterns (skip research-phase):
- **Phase 1 (hygiene & templates):** Mechanical; templates synthesised in this research file.
- **Phase 2 (extension UAT batch):** Walkthrough steps already documented in v3.1 phase plans being carried forward.
- **Phase 5 (milestone archive):** Established pattern; v3.1's archive is the template.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Project's own CLAUDE.md + PROJECT.md are authoritative; "no new deps" is enforceable from PROJECT.md constraints |
| Features | HIGH | Categories derived directly from STATE.md Pending Todos + v3.1 audit's 14-item tech-debt list |
| Architecture | HIGH | Three-repo topology + sync mechanics fully documented in CLAUDE.md "Downstream consumers" + lockdown-adapter-contract.md |
| Pitfalls | HIGH | Drawn from this project's own incident history (INFRA-10 root cause, v2.2 version-skew, v3.1 six-walkthrough deferral, Phase 30-02 orphan-mirror) — not generic best practice |

**Overall confidence:** HIGH

### Gaps to Address

- **Firebase CLI exact semantics:** `--dry-run` support varies by surface (rules vs. functions vs. hosting). The `lockdown-prod-deploy.md` runbook must verify exact command shapes against `firebase --help` at write-time, not assume vendor-doc patterns hold. *Address: during Phase 4 plan, run a one-shot CLI exploration step before runbook authoring.*
- **Lockdown sync drift-detection:** The recommended sync-script enhancement (refuse to overwrite divergent files; print resolved leksihjelp version + HEAD commit) is a lockdown-side change. Whether it lands in v3.2 or as a coordinated cross-repo deferral is a Phase 3 plan-time decision. *Address: flag in Phase 3 plan body; if not in v3.2, log as Phase 5 deferral with classification.*
- **EXAM-10 rollback semantics:** Removing the `LEKSIHJELP_EXAM` enum after Firestore data uses it is destructive. The `lockdown-prod-deploy.md` runbook needs an explicit "what to do if EXAM-10 needs to be reverted after data has been written" section — likely "page Geir, do not auto-rollback." *Address: Phase 4 runbook authoring includes this as a mandatory section.*
- **Cache-busting strategy for synced leksihjelp assets in papertek.app:** If filename hashing isn't yet wired, that's tech-debt to surface explicitly during Phase 4 hosting-runbook authoring. *Address: Phase 4 includes a `firebase.json` headers audit; surface gap as Phase 5 deferral if not in scope.*

## Sources

### Primary (HIGH confidence)
- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` — Release Workflow steps 1-15, 14 release gate descriptions, Downstream consumer contracts (synced-surface enumeration, version-bump ritual, exam-registry load-order requirement)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/PROJECT.md` — v3.2 milestone scope, constraints (no new runtime deps, MIT/free-tier promise), Out of Scope, Deferred, Key Decisions table (especially INFRA-10)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/STATE.md` — Pending Todos enumerating the 6 UAT items + 2 deploys verbatim
- `/Users/geirforbord/Papertek/leksihjelp/.planning/MILESTONES.md` — v3.1 closing audit; six-walkthrough deferral provenance
- `/Users/geirforbord/Papertek/leksihjelp/.planning/lockdown-adapter-contract.md` — sync contract surface area; informs which findings need lockdown re-validation
- v3.1 archived phase decisions (Phase 30, 33, 36) — dep-injection contract and INFRA-10 seam-coverage gate
- v2.2 milestone audit — version-skew incident (`package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1`)

### Secondary (MEDIUM confidence)
- Firebase CLI documentation patterns for selective deploy and rules-state inspection — well-known but exact command shapes need write-time verification
- Chrome `chrome.sidePanel` API support matrix per Chrome 114+ release notes

### User memory (HIGH confidence — workflow constraints)
- `feedback_fewer_phases.md` — consolidate into fewer larger phases (1M context, GSD designed for 200k)
- `project_test_suite_at_milestone_end.md` — `/gsd:add-tests` runs once at milestone end before `/gsd:complete-milestone`
- `project_phase30_04_sso_status.md` — auto-mode but no-prod-deploy precedent
- `project_sidepanel_fest_macos.md` — cross-platform browser-quirks evidence

---
*Research completed: 2026-05-01*
*Ready for roadmap: yes*
