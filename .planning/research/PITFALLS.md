# Pitfalls Research — v3.2 UAT & Deploy Prep

**Domain:** Hardening / UAT / cross-repo-sync / deploy-runbook milestone for a Chrome MV3 extension with two downstream consumers (lockdown webapp shipped, skriveokt-zero deferred) and a Firebase + Vercel backend.
**Researched:** 2026-05-01
**Confidence:** HIGH (drawn from this project's own v1.0–v3.1 incident history; not generalised testing-best-practice)

A hardening cycle is its own pitfall genre. The failure modes are not "we built feature X wrong" — they are "we claimed we tested when we didn't," "we fixed one thing and broke another via downstream sync," and "we wrote a deploy runbook that misses the production-only failure mode." This file catalogues the specific shapes those failures take in **this** project, with a `gate` vs `process step` recommendation per pitfall for the roadmapper downstream consumer.

---

## Critical Pitfalls

### Pitfall 1: Verifier walks a stale build, stale data, or wrong browser profile and reports PASS

**What goes wrong:** A UAT walkthrough completes with a green checkmark in the verification log, but the human verifier was looking at:
- the **previous** unpacked extension (Chrome doesn't reload the manifest automatically — the verifier opened a tab before re-loading the extension);
- **stale IndexedDB** vocab from a v3.0 install (Phase 23 migrated v2→v3 silently; the user never cleared `lexi-vocab` v3 since the bug was fixed);
- the **wrong Chrome profile** (the dev profile has every grammar feature toggled on, masking the default-preset bug class that INFRA-10 was created to defend against);
- a **previous lockdown sync** of leksihjelp (the webapp's `node_modules/@papertek/leksihjelp` is from before the fix landed).

**Why it happens:** Browser-extension UAT has no equivalent of "fresh CI VM per run." Chrome holds onto unpacked extensions, IndexedDB caches survive reloads, and the lockdown sync is a postinstall hook — not a `git pull`. Phase 26-01 / 32-01 / 32-03 each shipped seam regressions that passed every Node-side gate green; the seam was empty in browser, but the tester's profile happened to have feature flags that masked the empty index. INFRA-10 + population canaries (Phase 36) is the structural defence against the data side. The build/profile/cache side has no such defence yet.

**How to avoid:** Every browser UAT walkthrough header must include a **pre-flight evidence block** asserting:
- Extension version string visible in `chrome://extensions` matches the in-scope version
- `chrome://extensions` shows "Reloaded" timestamp **after** the fix commit's timestamp
- Browser profile is the **default-preset profile** (no grammar features toggled — the first-run state) for at least one walk; the dev-toggled profile only for completeness walks
- IndexedDB `lexi-vocab` `revision` column matches what the API currently serves (or has been wiped; the popup `Oppdater ordlister nå` button is the supported reset)
- For lockdown walks: the lockdown sidepanel header shows the `@papertek/leksihjelp` version pinned in `lockdown/package.json`, and the postinstall sync ran after the leksihjelp version landed

**Warning signs:** A verification log that just says "walked steps 1-9, all PASS" with no version strings, screenshots, or DevTools snapshots. Phase 27 / 30-01 / 30-02 verification logs from v3.1 are exactly this shape — that's why all six walks deferred to v3.2.

**Phase to address:** First UAT execution phase of v3.2 — make the pre-flight evidence block a **template** that every `*-VERIFICATION.md` must instantiate. **Recommendation: process step + lightweight scratch helper script**, not a release gate. A script `scripts/uat-preflight.js` that prints version strings + IDB revision + `chrome://extensions` reload timestamp gives the human verifier a one-shot "paste this into the verification log" capability without imposing CI overhead. Pure release-gate is wrong here because the failure mode is at human verification time, not at fixture time.

---

### Pitfall 2: `workflow.auto_advance=true` skips human verification on a phase that needs it

**What goes wrong:** GSD's auto-mode silently advances past a phase whose verification requires a human in front of a browser. The phase is marked complete; the deferred-todo grows; nobody notices until the next milestone-archive audit asks "where is the verification log for Phase X?"

**Why it happens:** This project's auto-mode is correctly configured to **never run production deploys** (per memory `project_phase30_04_sso_status.md`'s implicit precedent), but auto-mode does **not** know which phases need a human. Six v3.1 walkthroughs got deferred this way. The user's "auto but no-prod-deploy" rule exists *because* agents skipped them and left them as todos.

**How to avoid:** Phases whose verification is browser-walk-shaped must declare it explicitly in the phase frontmatter. Conventions:
- A phase frontmatter field `verification_kind: human-browser-walk | fixture-only | runbook-dry-run` (or similar)
- Phase plans with `verification_kind: human-browser-walk` are **excluded** from auto-advance — the orchestrator must surface them as a hard pause and wait for explicit user sign-off before marking complete
- The pause message includes the verification step list inline (so the user can copy-paste into a browser session)

**Warning signs:** A milestone audit that finds "Phase X complete, but VERIFICATION.md is empty / missing / says 'deferred to next milestone.'" v3.1's six-walkthrough backlog is exactly this signal.

**Phase to address:** A v3.2 hygiene/process phase early in the milestone (before the UAT batch starts) — establish the convention, retrofit the v3.2 phase headers, and treat any deferred walkthrough as a milestone-blocker (i.e. it becomes a hard gate at `gsd:complete-milestone`). **Recommendation: process step in roadmap + frontmatter convention**. Not a script gate; this is a roadmap-discipline issue.

---

### Pitfall 3: Status-quo bias in UAT notes — only what passed gets recorded

**What goes wrong:** The verifier writes "Step 3: clicked the Lær mer panel — appeared correctly with case badges and example pairs ✓" but does **not** record that the panel took 2.3 seconds to render, that the close-X had no hover state, that the keyboard escape didn't dismiss it, or that the panel rendered behind the spell-check popover on a 1280px viewport. None of these are bugs that block the walk, but each one is a real defect that the next milestone will discover and a future student will hit.

**Why it happens:** Verification templates ask "did step N pass?" and reward green checkmarks. They do not ask "what felt off?" Time pressure encourages binary answers.

**How to avoid:** Every walkthrough template must have an explicit **"Defects observed (non-blocking)"** section, separate from pass/fail. The orchestrator surfaces these at milestone close as candidate v3.3 backlog. Specifically:
- Three free-form prompts at the foot of every UAT template: "What was slower than expected?", "What needed a second click to discover?", "What looked out-of-place?"
- A "screenshots that capture surprise, not just success" instruction — the existing `leksiscreenshots/` workflow already does this informally; formalise it as part of the UAT template

**Warning signs:** A UAT log with only checkmarks and zero free-form notes. A verification log shorter than 20 lines for a 9-step walk.

**Phase to address:** Same hygiene phase as Pitfall 2. **Recommendation: process step + verification-log template change**. Not a gate.

---

### Pitfall 4: Single-browser UAT misses Edge / Brave / Chromium-incognito differences

**What goes wrong:** The walkthrough is performed in Chrome stable on macOS. Bugs that surface only in Edge (different `chrome.identity` redirect-URI handling), Brave (more aggressive resource-blocker that may drop ElevenLabs requests), or Chromium incognito (more restricted IndexedDB quotas; no `chrome.storage.sync` propagation) ship to users.

**Why it happens:** The extension is shipped as one zip across all three Chromium variants and on three platforms (Mac, Windows, Linux). UAT on one configuration does not exercise the others. The Side Panel for "Fest" already needed a macOS-specific fix in 2.5.0 (memory `project_sidepanel_fest_macos.md`).

**How to avoid:** UAT walkthroughs that touch any of these surfaces must run on **at least two Chromium variants**:
- TTS / ElevenLabs path: Chrome + Brave (Brave's shields)
- Side Panel / popup window: Chrome + Edge (Edge has its own side-panel quirks) on macOS
- IndexedDB / vocab cache: Chrome stable + Chrome incognito (incognito has stricter quota and the cache may be evicted between walks)
- Vipps OIDC: Chrome + Edge (`launchWebAuthFlow` redirect-URI shape differs)

The pragmatic minimum is to declare in each verification template which **target browsers** the walk applies to, and require at least one walk per target.

**Warning signs:** A user bug report that says "doesn't work on my school PC" where the school PC runs Edge on Windows. The exam-mode rollout is exam-mode-in-Edge-on-Windows; that's the actual deployment target.

**Phase to address:** v3.2 UAT batch phase plans must list target-browsers per walk. **Recommendation: process step in phase plans**, not a gate (CI cannot run human walks across browser variants without a substantial new infrastructure investment that's out of scope for v3.2).

---

### Pitfall 5: Fix lands in extension only — lockdown still ships the bug because sync didn't run

**What goes wrong:** A v3.2 bug-fix lands in `extension/content/spell-rules/foo.js`, the release zip is rebuilt, the version is bumped, and the change ships to extension users. Lockdown's `node_modules/@papertek/leksihjelp` does not move because `lockdown/package.json` pins `file:../leksihjelp` and lockdown's CI hasn't been run. Lockdown users keep hitting the bug for weeks.

**Why it happens:** The leksihjelp release process documented in CLAUDE.md ends at "upload zip as GitHub Release asset." Nothing in that process triggers lockdown's postinstall sync. The dependency model is `file:../leksihjelp` (per CLAUDE.md note "once published to GitHub Packages it'll be a versioned `npm install`") — there's no version bump to detect. Phase 30-02 of v3.1 was the last time the sync ran successfully, and even then it mirrored four orphan working-tree changes upstream wasn't ready to ship (see Pitfall 7).

**How to avoid:** Every v3.2 bug-fix phase plan that touches a synced file must include a **post-fix sync verification step**:
1. Identify whether the fix touches a synced surface (the CLAUDE.md "Downstream consumers" section enumerates them: `extension/content/*`, `extension/styles/content.css`, `extension/data/*`, `extension/i18n/*`, `extension/popup/views/*`, `extension/exam-registry.js`)
2. If yes, the phase plan's success criteria must include "lockdown sync re-run; lockdown-staging walk verifies fix present"
3. Bump `package.json` version on every synced-file change (CLAUDE.md already says this — enforce it)

**Warning signs:** A fix commit that touches a synced surface with no corresponding lockdown sync commit within 24h. A lockdown bug report that's already-fixed upstream.

**Phase to address:** Every bug-fix phase plan in v3.2. **Recommendation: a release gate** — this is mechanical and will recur. Specifically: `npm run check-synced-surface-version` that diffs the last-tagged version's synced surfaces against `HEAD`; if they differ, asserts `package.json` version has been bumped since the last tag. Catches the "fix landed, version not bumped, lockdown won't notice" class. Companion process step: a v3.2 bug-fix phase plan template that explicitly enumerates synced-surface impact in success criteria.

---

### Pitfall 6: Add a regression fixture that doesn't actually exercise the bug path (Node-runner masks browser truth)

**What goes wrong:** A v3.2 fix lands with a new fixture in `tests/fixtures/spell-check/` that asserts the rule fires on the bug input. `npm run check-fixtures` exits 0. The fix ships. Browser users still see the bug because the fixture's vocab-loading path uses the unfiltered, fully-populated Node-side build, which is **never** what the browser presents at runtime under default presets.

**Why it happens:** This is the INFRA-10 root cause. Phase 26-01, 32-01, and 32-03 all shipped indexes through the Node fixture-runner green; the seam was empty in browser. INFRA-10 (Phase 36) added static-parse + population canaries to defend against the seam shape. But INFRA-10 does not — and cannot — assert that **a new fixture meaningfully exercises a bug path the user actually hits.** A fixture that calls a rule directly with a hand-built `vocab` literal is just unit-testing the rule, not regressing the bug.

**How to avoid:** v3.2 bug-fix phase plans that add a fixture must answer two questions in the plan body:
1. **What was the user-visible symptom?** (e.g. "fr-aspect-hint did not fire on `je mangeait` in browser")
2. **Does the new fixture exercise the same code path as the user-visible symptom, or does it shortcut around the seam?** (the answer must be "same path" — and ideally the fixture is added to `benchmark-texts/expectations.json` so INFRA-08 also covers it, which is closer to "what the browser actually runs")

For seam-shaped bugs specifically: the fix is incomplete without a population canary in INFRA-10's gate (the Phase 36 pattern). INFRA-10 is extensible — every new index added to `buildIndexes` should also get a canary asserting non-empty population under default preset.

**Warning signs:** A fixture-add commit with no benchmark-texts/expectations.json entry. A bug-fix PR whose fixture passes the same runner that originally let the bug ship.

**Phase to address:** Every bug-fix phase plan in v3.2. **Recommendation: process step in plan template** (not a gate — too hard to mechanically distinguish "good" from "shortcut" fixtures). Companion gate change: extend INFRA-10's canary list whenever a new seam-shaped bug surfaces in v3.2. The gate is the existing one; the discipline is "every new index gets a canary."

---

### Pitfall 7: Lockdown sync mirrors orphan working-tree changes upstream wasn't ready to ship

**What goes wrong:** Phase 30-02 of v3.1 ran `node scripts/sync-leksihjelp.js` from lockdown. The script mirrored 18 files faithfully, including 4 orphan upstream working-tree changes that weren't part of the in-scope v3.1 work and that the user had been actively considering reverting. Those orphan changes are now in production lockdown.

**Why it happens:** The sync script reads from the upstream working tree, not from a tagged release. There is no filter; the script trusts that whatever's in `extension/` is intended to ship.

**How to avoid:** Every lockdown sync in v3.2 must run **against a tagged leksihjelp version**, not against the working tree. Concrete process:
1. Before sync, check `git status` in leksihjelp working dir is clean (no unstaged changes to synced surfaces)
2. Sync runs against the tagged commit corresponding to the leksihjelp version pinned in lockdown's `package.json`
3. After sync, lockdown's `git diff` should match the diff of the leksihjelp tag-to-tag range — any deviation means the sync mirrored uncommitted state

**Warning signs:** A sync that produces a lockdown-side diff including files the leksihjelp release notes don't mention. A leksihjelp working tree with uncommitted changes to `extension/content/` or `extension/popup/views/` at sync time.

**Phase to address:** v3.2 sync phase. **Recommendation: a release gate on the sync side** — `lockdown/scripts/sync-leksihjelp.js` should refuse to run if the upstream working tree is dirty (or if the upstream HEAD is not a tagged commit), with an `--allow-untagged` escape hatch for emergencies. This is a lockdown-side gate, not a leksihjelp-side gate, but the v3.2 plan should specify it as the contract.

---

### Pitfall 8: `exam-registry.js` load-order regression after sync (must load BEFORE content scripts)

**What goes wrong:** Sync to lockdown re-orders `LEKSI_BUNDLE` array in the loader, or a new lockdown-side script is inserted before `exam-registry.js`, with the result that `__lexiExamRegistry` is undefined when `spell-check-core.js` initialises. Spell-check silently classifies every rule as unclassified — the worst failure mode for an exam-compliance feature, since teachers can't trust suppression is happening.

**Why it happens:** CLAUDE.md flags this explicitly: "must be loaded BEFORE `spell-check-core.js` so `__lexiExamRegistry` exists when consumers initialise." But the sync script doesn't enforce ordering — it copies files; the lockdown loader's `LEKSI_BUNDLE` array enforces the order, and that array is hand-maintained.

**How to avoid:** Lockdown loader (`lockdown/public/js/leksihjelp-loader.js`) needs a runtime assertion: after `LEKSI_BUNDLE` loads, check `typeof window.__lexiExamRegistry === 'object'` before initialising spell-check; if missing, fail loudly with a console error and short-circuit spell-check (so misclassification cannot ship silently). On the leksihjelp side, the `check-exam-marker` gate should add a self-test that asserts `exam-registry.js` is the first file in the documented `LEKSI_BUNDLE` ordering snippet (which we'd codify as a comment in `extension/exam-registry.js`).

**Warning signs:** A lockdown UAT walk where spell-check fires inside EKSAMENMODUS for rules it shouldn't. Console error "exam registry not loaded" in lockdown dev tools.

**Phase to address:** v3.2 lockdown-staging UAT phase + sync phase. **Recommendation: runtime assertion in lockdown loader (process step in lockdown-side change) + extend `check-exam-marker` gate** to assert load-order documentation correctness on the leksihjelp side.

---

### Pitfall 9: skriveokt-zero falls behind silently (deferred consumer)

**What goes wrong:** v3.2 ships exam-mode fixes / view-module changes / new exam-registry entries. skriveokt-zero is "deferred consumer — un-defer when ships to schools" (CLAUDE.md). Six months later the user signs a school deployment for skriveokt-zero. The desktop app is several leksihjelp versions behind, the sync script in `skriveokt-zero/scripts/sync-leksihjelp.js` may have bit-rotted, and the `rules/` rename from `spell-rules/` may collide with a new `extension/content/spell-rules/` subdirectory introduced in v3.2.

**Why it happens:** Deferred consumers don't run their sync. The contract (CLAUDE.md "Downstream consumers" → "skriveokt-zero / lockdown-zero") is documented but not exercised in v3.2.

**How to avoid:** v3.2 should include a single "sync dry-run for skriveokt-zero" step — execute the sync script in dry-run mode against the current leksihjelp working tree to detect breakage before it bites at unfreeze time. If the sync script lives in skriveokt-zero, ask the user to run a one-shot `node scripts/sync-leksihjelp.js --dry-run` and capture the output. If breakage is detected, file the diff as a v3.2 deferred-consumer item, not a milestone-blocker.

**Warning signs:** A new directory under `extension/content/` whose name collides with skriveokt-zero's rename targets. A new file in a synced surface that the skriveokt-zero sync script doesn't enumerate.

**Phase to address:** v3.2 sync phase, as a single low-cost step. **Recommendation: process step (one-time check)**. Not a gate — a hard CI gate against a deferred consumer is over-investment.

---

### Pitfall 10: Bump version in 1 of 3 places (manifest.json + package.json + backend/public/index.html)

**What goes wrong:** A v3.2 fix lands. `extension/manifest.json` bumped to 2.10.0. `package.json` still says 2.9.18. `backend/public/index.html` still says 2.9.18. The landing page advertises the wrong version; the lockdown sync doesn't see a version change (it reads `package.json`); the GitHub Release tag races with the unbumped strings. v2.2's milestone audit literally caught this (`package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1`).

**Why it happens:** Three sources of truth, no single command to bump them, no gate to assert agreement.

**How to avoid:** A new release gate, `check-version-alignment`, that asserts the three strings are equal. Paired self-test plants a divergent version (gate fires) and a coherent version (gate passes). This is mechanical, recurring, and exactly what a release gate exists to prevent.

**Warning signs:** A milestone audit that mentions "version skew." Lockdown sync that doesn't pick up a freshly-shipped fix.

**Phase to address:** v3.2 hygiene phase, early. **Recommendation: a release gate**. Mechanical and recurring — gate is correct.

---

### Pitfall 11: Fix in lockdown directly without porting upstream — silent revert on next sync

**What goes wrong:** During lockdown-staging UAT, a bug shows up that's quick to fix in lockdown's `public/leksihjelp/` tree. The lockdown developer fixes it there to unblock the walkthrough. The fix is never ported to leksihjelp upstream. Next `npm install` in lockdown re-runs the postinstall sync and silently reverts the fix.

**Why it happens:** Time pressure during UAT. CLAUDE.md documents the contract ("Downstream-only quick fixes ... over there are fine for testing, but the canonical change still belongs *here*") but enforcement relies on developer discipline.

**How to avoid:** Two-pronged:
1. The lockdown sync script should detect drift — for each synced file, compare lockdown's current copy against the freshly-synced copy; if they differ, log a loud warning ("you are about to overwrite N files that diverge from upstream"). Force confirmation.
2. The v3.2 lockdown UAT phase plan must explicitly forbid in-tree lockdown fixes during the walk; surfaced bugs go into a "port back to leksihjelp" todo before next sync.

**Warning signs:** A lockdown commit that touches `public/leksihjelp/` files and is not paired with a leksihjelp commit. A re-sync that produces a large diff because previous fixes are being reverted.

**Phase to address:** v3.2 lockdown UAT phase + sync phase. **Recommendation: process step in phase plan + lockdown-side enhancement to sync script**. Not a leksihjelp-side gate (the leksihjelp repo can't see lockdown's tree).

---

### Pitfall 12: Lockdown re-pin to wrong leksihjelp version (`file:../leksihjelp` vs versioned)

**What goes wrong:** During v3.2, lockdown's `package.json` still pins `file:../leksihjelp`. The contributor on lockdown checks out their lockdown branch with a **different** leksihjelp working tree alongside it (e.g. they were working on v3.3 prep in another worktree). The relative-path resolution silently picks up the wrong version. Lockdown-staging is now running a leksihjelp build that's not the tagged v3.2.

**Why it happens:** `file:` deps trust the directory layout. Worktrees and side-by-side checkouts are common in this user's workflow (`/Users/geirforbord/papertek/leksihjelp` exists alongside `/Users/geirforbord/Papertek/leksihjelp` per the env block).

**How to avoid:** Lockdown's postinstall sync should print **the resolved leksihjelp version** (read from upstream `package.json`) and **the upstream HEAD commit hash**. The lockdown deploy runbook should require the deployer to confirm both before proceeding to a staging or production deploy.

**Warning signs:** Two leksihjelp directories on disk. A lockdown sync that resolves to a leksihjelp version different from what was tagged for the v3.2 release.

**Phase to address:** v3.2 deploy-runbook phase. **Recommendation: process step in runbook + lockdown-side sync-script enhancement**. The "publish to GitHub Packages and pin a version" migration is the long-term fix but is out of scope for v3.2.

---

### Pitfall 13: Deploy runbook reads as "run this command" without rollback / observability / smoke-test

**What goes wrong:** A v3.2 deliverable is the deploy runbook for `firestore.rules` + Cloud Functions (EXAM-10) + `papertek.app` hosting (Phase 30 sidepanel host). The runbook is written as: "1. Run `firebase deploy --only firestore:rules`. 2. Run `firebase deploy --only functions`. 3. Done." There is no rollback step, no smoke-test step ("how do I know it worked?"), no observability step ("what dashboards do I check?"), no pre-flight ("is the staging deploy green?"). When the production deploy fails or, worse, succeeds-but-breaks, the operator has no playbook.

**Why it happens:** Runbooks are written by the person who just executed the deploy in their head; they leave out everything they consider obvious. The original deploy author moves on; six months later a different person has to deploy and is missing the unwritten knowledge.

**How to avoid:** Every deploy runbook in v3.2 must follow a **fixed structure**:
1. **Pre-flight** — what state must staging / source repo / environment be in
2. **Deploy command** — exact command + project/environment flag
3. **Smoke test** — 2–5 specific assertions to verify the deploy works (e.g. "open student account in staging classroom, toggle exam-mode profile, confirm spell-check rules suppress as expected")
4. **Observability** — exact dashboard URLs / log queries / metrics to watch for the first 30 minutes
5. **Rollback** — exact command to revert + how to verify revert worked
6. **Deferred-cleanup** — anything that needs follow-up after success (e.g. clear a cache, notify a stakeholder)

The roadmapper should treat any runbook missing one of these six sections as incomplete (auditor-flag).

**Warning signs:** A runbook shorter than 50 lines for a multi-service deploy. A runbook with no rollback section. A runbook that doesn't name the dashboard URL or the log query.

**Phase to address:** v3.2 deploy-runbook phase. **Recommendation: process step in phase plan + runbook template**. A release gate could enforce structural presence (does the runbook file have all six section headers?) but the value-add is small relative to the cost — process discipline is correct here.

---

### Pitfall 14: Firebase rules deploy cascades to wrong project (`--project` flag forgotten on a staging branch)

**What goes wrong:** Deployer is on `lockdown-stb` staging branch. Their muscle memory says `firebase deploy --only firestore:rules`. Firebase CLI's "active project" defaults to whatever was last set globally — which might be production. The staging-intended deploy hits production Firestore. Production rules diverge from production code; reads start failing for live students.

**Why it happens:** `firebase deploy` uses the active project from `~/.config/configstore/firebase-tools.json`, which is global. The `--project` flag is the safety override but is easy to forget. The staging-vs-production distinction is purely procedural.

**How to avoid:** Every Firebase deploy command in every v3.2 runbook must include `--project <explicit-project-id>`. Add a pre-flight assertion: `firebase use` returns the expected project before running deploy. Document in the runbook: "if `firebase use` shows anything other than `<expected>`, STOP — run `firebase use <expected>` first." Consider adding a wrapper script in lockdown that refuses to run `firebase deploy` without a `--project` flag.

**Warning signs:** A runbook command that doesn't include `--project`. A `firebase use` output mismatched to the deploy target.

**Phase to address:** v3.2 deploy-runbook phase. **Recommendation: process step in runbook + deploy-wrapper script in lockdown**. This is a lockdown-side concern primarily.

---

### Pitfall 15: Cloud Functions cold-start failure (works in deploy log; fails on first invocation)

**What goes wrong:** `firebase deploy --only functions` exits 0. Deploy log says "✔ functions[applyExamModeLock]". Five hours later a teacher tries to apply the exam-mode profile to a classroom; the function cold-starts and crashes because a runtime env var was set in staging but not promoted to production, or because a dependency moved between Node 18 and Node 20 and the function's runtime is pinned wrong.

**Why it happens:** Functions deploy validates package upload, not runtime. The first invocation happens whenever a real user triggers it.

**How to avoid:** Runbook must include a **post-deploy synthetic invocation** — a script that calls the function (against a test fixture user/classroom in production, or a "ping" no-op variant of the function) immediately after deploy and asserts a 2xx response. EXAM-10's `applyExamModeLock` is a good candidate for a no-op variant: "apply profile NONE to test classroom, assert response, revert." Without this, the deploy is "done" but unverified.

**Warning signs:** A Functions deploy runbook with no smoke-invocation step. A Cloud Functions error log that shows the first error of the day at the deploy time + cold-start delay.

**Phase to address:** v3.2 deploy-runbook phase. **Recommendation: process step in runbook + dedicated synthetic-invocation script**. The script lives in lockdown.

---

### Pitfall 16: Hosting deploy succeeds but cached CDN serves stale leksihjelp bundle for hours

**What goes wrong:** `firebase deploy --only hosting` for papertek.app succeeds. New `leksihjelp-sidepanel-host.js` and synced `public/leksihjelp/*` are uploaded. Some users get the new bundle; others get the old bundle from CloudFlare or a browser cache. Bug reports are inconsistent: half say it's fixed, half say it's broken.

**Why it happens:** Firebase Hosting + browser caches + intermediate CDNs all have independent TTLs. Cache-busting on synced leksihjelp files relies on filename hashing or version-stamped URLs, neither of which is documented in the current sync flow.

**How to avoid:** Runbook must specify cache-headers configuration in `firebase.json` (long max-age for hashed assets, short max-age for entry-point HTML). Smoke test must include a fresh-incognito visit + a "force-refresh existing tab" check. If filename hashing isn't yet wired for synced leksihjelp assets, that's a v3.2 (or v3.3 deferred) tech-debt item to surface explicitly.

**Warning signs:** Inconsistent bug reports after a hosting deploy. A `firebase.json` with no `headers` configuration for the leksihjelp paths.

**Phase to address:** v3.2 deploy-runbook phase + papertek.app sidepanel-host runbook specifically. **Recommendation: process step in runbook + cache-header audit during runbook authoring**.

---

### Pitfall 17: "UAT walked, looked fine" with no artifacts — milestone auditor can't verify

**What goes wrong:** v3.2 closes. Six UAT walkthroughs are marked complete with verification logs that say "walked, all PASS." No screenshots, no version-string evidence, no DevTools snapshots. Three months later a regression surfaces; the team tries to reconstruct "what state was UAT actually in?" and cannot.

**Why it happens:** This is the v3.1 v3.2-deferred-walkthrough story rewritten. Verification logs were thin enough that the user (correctly) declined to mark them complete and pushed them to v3.2. v3.2 will repeat the failure if templates don't change.

**How to avoid:** UAT verification template must require:
- Pre-flight evidence block (Pitfall 1)
- Per-step screenshot or DevTools snapshot of the **observed result** (not just "passed")
- "Defects observed (non-blocking)" section (Pitfall 3)
- Final summary listing what was verified, what was deferred, and what was found

Auditor at milestone close treats any walkthrough log without these four pieces as incomplete and refuses to archive.

**Warning signs:** A verification log that's text-only, has no screenshot references, and is shorter than the step list it's verifying.

**Phase to address:** v3.2 milestone-archive phase. **Recommendation: process step + verification template + auditor checklist**. Not a gate — gates can't assess artifact quality.

---

### Pitfall 18: Tech-debt re-deferred to v3.3 without explicit gate on what justifies deferral

**What goes wrong:** v3.2 close approaches. Two of the six UAT walkthroughs surfaced bugs that are non-trivial to fix. The instinct is to defer them to v3.3. Without a structured "what justifies deferral" decision, the deferred-todo grows unboundedly. v3.1 carried 6 walkthroughs; v3.2 might carry 8; v3.3 might carry 12.

**Why it happens:** No defined deferral criteria. Time pressure at milestone close.

**How to avoid:** Establish v3.2 milestone-close convention: any deferred item must be classified as one of:
1. **Hard-deferred** — depends on a sibling project state change (e.g. skriveokt-zero shipping)
2. **Time-deferred** — sized + scheduled into the next milestone with explicit phase plan
3. **Backlog-deferred** — explicitly added to "Future candidates" in PROJECT.md with a "won't ship unless…" condition

Anything that doesn't fit one of the three categories must ship in v3.2.

**Warning signs:** A milestone-archive section "Known Tech Debt" longer than 5 items. A v3.3 milestone start that opens with the same 6 deferred walkthroughs.

**Phase to address:** v3.2 milestone-archive phase. **Recommendation: process step + milestone-archive template field**. Not a gate.

---

### Pitfall 19: Production deploy todos linger forever (deploy is user-gated, agents skip)

**What goes wrong:** Per memory `project_phase30_04_sso_status.md`, "auto-mode but no-prod-deploy" is the rule. Lockdown-stb production Firebase deploy and papertek.app production hosting deploy are explicitly user-gated. They will sit in the todo list until the user runs them. v3.1 closed with both still open. v3.2 will close the same way unless the runbook is so good that the user **wants** to execute it.

**Why it happens:** User-gated deploys require user time + confidence. Confidence comes from a runbook that's been dry-run-walked and a green staging deploy. Both are v3.2 deliverables — the milestone has a real chance to close this loop.

**How to avoid:** v3.2 runbook phase must include a **dry-run** of each runbook against staging — not the actual production deploy, but a walk-through where every command is explained, every smoke-test is performed against staging, and the user signs off "yes, I would feel safe running this against production." That sign-off is the milestone deliverable, not the production deploy itself. Then the production deploys remain user-gated but are *unblocked* — the only remaining barrier is calendar time.

**Warning signs:** A v3.2 close with the same two production-deploy todos still open. A runbook that's never been walked end-to-end against staging.

**Phase to address:** v3.2 deploy-runbook phase, last sub-phase. **Recommendation: process step + explicit user-sign-off success criterion**. Not a gate.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Walk UAT in dev profile only | Faster — features already toggled | Misses default-preset bugs (INFRA-10 root cause class) | Never for popover-surfacing rules; OK for setting-screen visual checks |
| Defer browser walkthrough to next milestone | Unblocks code merge | Walks accumulate; eventually become unverifiable due to drift | Only with explicit GSD-templated deferral classification (Pitfall 18) |
| Quick-fix in lockdown tree only | Unblocks UAT same-day | Silent revert on next sync (Pitfall 11) | Never — port upstream same day or revert the lockdown fix |
| Skip `--project` flag because "I'm already on the right one" | One less character to type | Cross-project deploy disaster (Pitfall 14) | Never |
| Skip post-deploy synthetic invocation | Saves 5 minutes | Cold-start failure surfaces hours later (Pitfall 15) | Never on Functions; OK on rules-only deploys (no runtime to fail) |
| Use `file:` dep instead of versioned package | Zero ceremony for cross-repo work | Wrong-version pickup on side-by-side checkouts (Pitfall 12) | Until the GitHub Packages migration ships; document the risk |
| Bump only `manifest.json` for a quick fix | Faster | Version-skew detection downstream (Pitfall 10) | Never — `check-version-alignment` gate should enforce |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Lockdown sync script | Run from dirty leksihjelp working tree | Refuse to sync if upstream has uncommitted changes to synced surfaces (Pitfall 7) |
| `chrome.identity.launchWebAuthFlow` (Vipps OIDC) | Test only on Chrome stable | Test on Edge too — redirect-URI shape differs (Pitfall 4) |
| ElevenLabs TTS in lockdown | Forget to pass `audioEnabled: false` | Three independent safeguards per CLAUDE.md must remain (host arg + view check + sync-exclusion) |
| Cloud Functions deploy | Trust deploy log, skip cold-start invoke | Synthetic invocation against staging-equivalent test fixture (Pitfall 15) |
| Firebase Hosting deploy | Assume CDN clears immediately | Verify with incognito + cache-header audit (Pitfall 16) |
| `exam-registry.js` load order | Trust sync to preserve order | Runtime assertion in lockdown loader + ordering comment in registry file (Pitfall 8) |

---

## Performance Traps

This milestone is hardening, not perf-sensitive — only one trap is in scope:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Lær mer panel renders synchronously on click | Visible delay (~0.5–2s) on first open after rule fires | Pre-warm panel data when popover opens, not when "Lær mer" clicked | When pedagogy data grows (DE Wechselpräps already non-trivial; FR/ES will compound) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Wrong-project Firestore deploy | Production rules overwritten by staging rules → student PII exposure | `--project` flag mandatory + `firebase use` pre-flight (Pitfall 14) |
| Cloud Functions exposed without auth check | Random callers can `applyExamModeLock` to arbitrary classrooms | Verify EXAM-10 functions have auth predicate; runbook smoke-test with unauthenticated call asserting 401/403 |
| Lockdown sync mirrors a leksihjelp `.env` accidentally placed in synced tree | Backend secrets ship to public lockdown bundle | Sync script's allowlist (already in place per CLAUDE.md) + runtime assertion that synced files have no `.env*` patterns |
| Stale CDN serves outdated leksihjelp bundle that contains a since-fixed XSS in renderSenses | Window of vulnerability extends beyond deploy time | Cache-header strategy + smoke-test (Pitfall 16) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| EKSAMENMODUS badge missing after upgrade due to localStorage clear | Student thinks exam-mode is off, panics during exam | Persist exam-mode toggle outside `chrome.storage.local`-only — also write to `chrome.storage.sync` if user account is linked, with a visible reassurance toast on toggle |
| Lockdown sidepanel ordbok tab visible but search returns empty (Phase 33 fix) | Student loses trust in tool — "looks broken" | Phase 33 already fixed; v3.2 UAT must verify the fix in lockdown-staging end-to-end |
| Lær mer panel scrolls behind spell-check popover on small viewport | Student can't read explanation | UAT walks must include a 1280px viewport check |
| Popup view module renders before vocab hydration in lockdown | Search shows "no results" briefly before populating | Hydration loading state must be explicit, not "empty results" — lockdown sidepanel host should pass an `isHydrating` dep |

---

## "Looks Done But Isn't" Checklist

- [ ] **UAT walkthrough:** verification log has version strings, screenshots, defects-observed section, and at least one default-preset profile walk — not just step checkmarks
- [ ] **Bug fix:** synced-surface impact documented, lockdown re-sync run, version bumped in all 3 places, fixture exercises real bug path (not shortcut), regression added to benchmark-texts/expectations.json if appropriate
- [ ] **Lockdown sync:** ran against tagged leksihjelp version (not working tree), upstream `git status` was clean, lockdown loader load-order verified at runtime, in-tree fixes ported back upstream
- [ ] **Deploy runbook:** has all six sections (pre-flight + command + smoke + observability + rollback + deferred-cleanup), `--project` flag explicit, synthetic invocation step for Functions, cache-header strategy for Hosting
- [ ] **Production deploy readiness:** runbook walked end-to-end against staging, user signed off "I would feel safe running this against production" — actual production deploy is allowed to remain user-gated
- [ ] **Milestone archive:** every deferred item classified (hard / time / backlog), no thin-walk verification logs, EXAM-09 / skriveokt-zero status statement updated, version-string alignment checked

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| UAT walked stale build (Pitfall 1) | LOW | Re-run with pre-flight evidence; cost is the verifier's time |
| Fix shipped to extension but not lockdown (Pitfall 5) | LOW–MEDIUM | Run lockdown sync, bump lockdown's leksihjelp pin, re-deploy lockdown staging; cost is staging-deploy time |
| Lockdown sync mirrored orphan changes (Pitfall 7) | MEDIUM | Identify orphan files via leksihjelp tag-to-tag diff; revert in lockdown; document in lockdown release notes |
| `exam-registry.js` load-order broken (Pitfall 8) | LOW | Restore order in lockdown loader; emergency-deploy lockdown staging; runtime-assertion would have caught early |
| Wrong-project Firebase deploy (Pitfall 14) | HIGH | Restore production rules from git; if rules tightened, no harm; if rules loosened, audit Firestore for window-of-exposure access |
| Cloud Functions cold-start failure (Pitfall 15) | MEDIUM | Identify env var or runtime issue; redeploy with fix; user-impact bounded by deploy-to-detection delay |
| Stale CDN bundle (Pitfall 16) | MEDIUM | Bust CDN cache (CloudFlare purge or Firebase Hosting redeploy with header changes); communicate "force-refresh" to affected users |
| Tech-debt re-deferred unboundedly (Pitfall 18) | HIGH | Recovery is a dedicated debt-burn-down milestone — expensive |

---

## Pitfall-to-Phase Mapping

Suggested v3.2 phase structure with pitfall coverage. Roadmapper should consolidate phases per the user's "fewer larger phases" preference (memory `feedback_fewer_phases.md`).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1, 2, 3, 4, 17 (UAT discipline) | v3.2 hygiene-and-templates phase (early) | Verification template review; one walkthrough exercises new template |
| 5, 6, 11 (bug-fix loop) | Each v3.2 bug-fix phase plan | Fix has lockdown-sync step + benchmark-texts entry; INFRA-10 canary if seam-shaped |
| 7, 8, 9, 12 (sync hygiene) | v3.2 sync phase | Sync runs from clean tagged version; lockdown loader runtime-asserts exam-registry presence; skriveokt-zero dry-run captured |
| 10 (version alignment) | v3.2 hygiene phase + new release gate | `check-version-alignment` gate exits 0; paired self-test passes |
| 13, 14, 15, 16 (deploy runbook) | v3.2 deploy-runbook phase | Runbook follows 6-section structure; staging dry-run walked; user sign-off captured |
| 18, 19 (milestone close) | v3.2 milestone-archive phase | Every deferred item classified; production-deploy runbooks unblocked-but-user-gated |

**Recommended gate additions for roadmapper:**
1. **`check-version-alignment`** (Pitfall 10) — mechanical, recurring, exactly the right shape for a release gate. High priority.
2. **`check-synced-surface-version`** (Pitfall 5) — diff-based; recurring; modest complexity. Medium priority.
3. **Extend `check-exam-marker`** (Pitfall 8) — assert load-order documentation in `exam-registry.js`. Low cost.
4. **Extend INFRA-10 canaries** (Pitfall 6) — every new index gets a canary; not a new gate but a discipline change. Document as a v3.2 convention.

**Recommended process steps (not gates):**
- Pre-flight evidence block in UAT templates (Pitfall 1)
- `verification_kind` frontmatter field + auto-mode pause for human walks (Pitfall 2)
- "Defects observed" section in UAT templates (Pitfall 3)
- Target-browsers list per walk (Pitfall 4)
- 6-section runbook structure (Pitfall 13)
- Deferral classification at milestone close (Pitfall 18)
- Staging dry-run with user sign-off (Pitfall 19)

---

## Sources

- This project's own incident history: PROJECT.md Key Decisions table (especially INFRA-10 entries and Phase 26-01 / 32-01 / 32-03 references), MILESTONES.md v3.1 "Known Tech Debt" section, STATE.md Pending Todos
- CLAUDE.md "Downstream consumers" section — synced-surface enumeration, exam-registry load-order requirement, sync contract
- `.planning/lockdown-adapter-contract.md` — vocab seam shape, three lockdown-implementation options, coordination notes
- v2.2 milestone audit — version-skew incident (`package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1`)
- v3.0 audit — SCHEMA-01 dormant subscriber, BUNDLED_LANGS staleness (representative "looks done but isn't" cases)
- User memories: `project_phase30_04_sso_status.md` (auto-mode no-prod-deploy precedent), `feedback_fewer_phases.md` (consolidation preference), `project_test_suite_at_milestone_end.md` (run /gsd:add-tests once at end), `project_sidepanel_fest_macos.md` (cross-platform browser-quirks evidence)

---
*Pitfalls research for: leksihjelp v3.2 UAT & Deploy Prep milestone*
*Researched: 2026-05-01*
