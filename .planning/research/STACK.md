# Stack Research — v3.2 UAT & Deploy Prep

**Domain:** Hardening / risk-reduction milestone (manual UAT execution + cross-repo sync + deploy-runbook authoring)
**Researched:** 2026-05-01
**Confidence:** HIGH

## TL;DR — Opinionated Bottom Line

**Add no new runtime dependencies. Add no test frameworks. Add three small Markdown templates and one shell script.**

For a 6-walkthrough scope on a project whose CLAUDE.md culture is explicitly "open Chrome, click through, observe," Playwright/Cypress/Puppeteer are net-negative: they cost more to author + maintain than the walkthroughs they would replace, they cannot exercise Vipps OIDC redirects or the Side Panel surface that two of the six walkthroughs target, and they would compete with the 14 existing release gates for "trust budget" without adding incremental coverage. The right answer is structured-by-template manual walkthroughs, lightweight evidence capture (existing macOS screen tools), and prose-first deploy runbooks tuned for a non-engineer operator.

The only genuine new tooling investment that pays off in this milestone is **deploy runbook scaffolding** — because (a) two production deploys are user-gated and outstanding, (b) they touch shared Firebase infrastructure that affects the lockdown app, and (c) confidence-to-execute is the literal in-scope deliverable per PROJECT.md.

---

## Recommended Stack

### Core Technologies (existing — no changes)

| Technology | Version | Purpose | Why Keep As-Is |
|------------|---------|---------|----------------|
| Chrome MV3 vanilla JS extension | n/a | UAT subject | UAT is a manual exercise of the shipped artifact; no test-framework integration required |
| Vercel CLI | latest | leksihjelp.no hosting deploys | Already in use; deploy runbook documents existing flow, no new tool |
| Firebase CLI | 13.x | firestore.rules + Cloud Functions deploys (lockdown side) | Standard for `firebase deploy --only` selective deploys; underpins runbook patterns |
| GitHub Releases | n/a | Extension zip distribution | Existing rhythm; v3.2 walkthroughs target the in-flight `2.9.18` artifact |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | This milestone adds zero runtime dependencies. The constraint section of PROJECT.md explicitly forbids new runtime deps without justification, and UAT/deploy-prep does not justify any. |

### Development Tools (new — three Markdown templates + one shell script)

| Tool | Purpose | Notes |
|------|---------|-------|
| `.planning/uat/TEMPLATE-walkthrough.md` | Per-walkthrough script: preconditions, numbered steps, expected vs observed, pass/fail/blocker verdict, evidence-asset filenames | One file per walkthrough (6 total in v3.2); commits with the milestone for reproducibility on future regressions |
| `.planning/uat/TEMPLATE-finding.md` | Per-finding artifact: F-id (e.g., `F32-1`), title, severity, repro steps, root-cause hypothesis, fix-plan link, sync-status (extension fixed → lockdown synced → lockdown-staging verified) | Mirrors the F1..F7 / F36-1..F36-5 pattern already used in Phase 34/35/36; formalizes the implicit convention |
| `.planning/deploy/RUNBOOK-{firebase,hosting}.md` | Step-by-step deploy procedure with copy-paste commands, dry-run patterns, expected output, rollback decision tree, smoke-test checklist | Two runbooks: one for firestore.rules + Cloud Functions (EXAM-10), one for papertek.app sidepanel host. Written for a non-engineer operator. |
| `scripts/uat-evidence.sh` | Convenience wrapper: timestamps screen recordings, drops them in `.planning/uat/evidence/{walkthrough-id}/`, reminds operator to redact PII | ~30 LOC bash; calls macOS `screencapture` and `screencapture -v` (built-in); zero new dependencies |

**Existing tooling that already covers what would otherwise tempt new investment:**

- The 14 release gates (per CLAUDE.md) already enforce the *deterministic* properties (fixtures, network silence, bundle size, seam coverage, popup deps, exam markers). UAT covers what gates structurally cannot: visual layout, keyboard focus management, popover positioning, locale rendering, Side Panel chrome behavior on macOS, lockdown sidepanel visual integration. There is no overlap, and no automation tool will close UAT's domain without becoming the project's largest dependency.
- `gh` CLI (already in use per Release Workflow step 15) handles release-asset uploads and issue/PR creation if findings need to spawn issues.
- macOS `screencapture` (built-in) and QuickTime Player handle screen recording. The `leksiscreenshots/` directory convention already exists.

## Installation

```bash
# Zero new npm packages required.
# Verify Firebase CLI is up-to-date for the deploy runbook:
firebase --version  # expect >=13.x

# Verify Vercel CLI is logged in (used by leksihjelp.no deploys, not in scope this milestone but noted for runbook completeness):
vercel whoami

# Create the new directories the templates will live in:
mkdir -p .planning/uat/evidence .planning/deploy
```

## Alternatives Considered

| Recommended | Alternative | When the Alternative Would Be Better |
|-------------|-------------|--------------------------------------|
| Manual walkthroughs from `.md` templates | **Playwright** for browser automation | If the UAT scope crossed ~30 walkthroughs OR if the same walkthroughs needed to run on every PR. Neither holds: scope is 6, and walkthroughs target visual/UX correctness that Playwright assertions struggle to express (popover layout, Side Panel chrome, focus rings). Playwright also cannot drive Vipps OIDC consent (Phase 27 exam-mode walk touches subscription state) or `chrome.windows.create` Side Panel surfaces without significant per-test scaffolding. |
| Manual walkthroughs | **Puppeteer** | Same logic as Playwright, with worse MV3 extension support. Reject. |
| Manual walkthroughs | **Cypress** | Cypress is even less appropriate for MV3 extension contexts and content-script injection. Reject. |
| Markdown finding templates | **GitHub Issue templates (`.github/ISSUE_TEMPLATE/`)** | If findings needed cross-team triage or external contributors. Single-operator + AI-pair workflow makes file-based artifacts faster: they live next to the milestone, get committed atomically, and don't require GitHub round-trips. Switch to issue templates if/when contributors join. |
| Prose-first runbooks | **Terraform / IaC for Firebase** | If Firebase config drift were a real risk across multiple environments. With one staging + one prod and infrequent changes, IaC is a 10x complexity tax for a marginal benefit. `firebase deploy --only` with selective flags + a documented rollback procedure is right-sized. |
| `.planning/uat/` markdown | **Notion / Linear / Jira** | If the operator preferred a hosted UAT tool. Repo-local Markdown wins because (a) it's diffable, (b) it commits with the code under test, (c) it survives tool churn, (d) it matches the existing `.planning/` convention. |
| `screencapture` + QuickTime | **Loom / asciinema** | If walkthroughs needed sharing externally. For internal evidence-of-execution, native macOS tools produce smaller files and don't introduce account dependencies. |
| Existing 14 release gates | **Adding a 15th UAT-completion gate** | Tempting but wrong: a gate that asserts "UAT walkthroughs complete" is either a paperwork ratchet (scripts checking file presence) or a meaningless rubber-stamp. UAT completion is a milestone-close criterion, not a per-PR gate. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Playwright / Puppeteer / Cypress | Cost > benefit at 6-walkthrough scope; cannot exercise Vipps OIDC, Side Panel chrome, or content-script visual rendering reliably; would compete with existing 14 gates for trust budget without adding coverage | Markdown walkthrough templates + manual execution + screen-recording evidence |
| New unit-test framework adoption | Project already has unit tests (58 tests across phases 16-19, 6 in v2.2); adding a new framework now is unrelated to UAT/deploy goals | Stay on existing Node test setup; add unit tests during regular dev cycles, not this milestone |
| Hunspell / spellchecker-wasm / ML libraries | Already explicitly forbidden by PROJECT.md "Out of Scope" — GPL incompatibility + heuristic constraint | Existing rule architecture |
| `firebase deploy` without `--only` flags | Whole-project deploys risk pushing untested config (e.g., shipping unrelated functions) | `firebase deploy --only firestore:rules` and `firebase deploy --only functions:applyExamModeLock` selective patterns |
| `firebase deploy --force` | Bypasses CLI prompts that exist as last-line safeguards | Standard interactive deploy; if a prompt is wrong, fix the underlying issue |
| Service-account JSON keys checked into repo or pasted into chat | Per CLAUDE.md `.gitignore` already excludes them; and per Auto Mode constraint #6 secrets must not be exfiltrated | Operator runs `firebase login` once; CLI manages credentials |
| Modifying existing 14 release gates to gate-on-UAT | Conflates per-commit signals with per-milestone signals; gates would become rubber-stamps | Track UAT completion in `.planning/uat/STATUS.md` (one file per milestone), assert manually at milestone close |

## Stack Patterns by Variant

**If a UAT walkthrough finds a bug → fix-loop pattern:**
- Reproduce locally with extension reloaded from `extension/` directory unpacked
- Author fix in extension code (NOT in lockdown's synced copy — per CLAUDE.md "downstream-only quick fixes... canonical change still belongs here")
- Re-run all relevant release gates: minimum `npm run check-fixtures` + the gate(s) closest to the touched surface (e.g., `check-explain-contract` if the fix touches a popover-surfacing rule)
- Bump `extension/manifest.json` + `package.json` + `backend/public/index.html` versions per Release Workflow step 13
- Re-package and re-test the same walkthrough
- Cross-sync to lockdown via `cd /Users/geirforbord/Papertek/lockdown && npm install` (triggers postinstall sync); re-validate in lockdown-staging
- Mark finding artifact `synced: true` and `lockdown-validated: true`

**If a finding is lockdown-only (extension behaves correctly, lockdown sidepanel host doesn't):**
- Investigate `lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js` first (Phase 30 host code, lockdown-side)
- If root cause is in synced view-module dep contract: fix belongs here in `extension/popup/views/*.js` with additive deps (per Phase 30 dep-injection rule)
- If root cause is in lockdown's host-side dep wiring: fix belongs in lockdown repo, no extension change

**If preparing the Firebase production deploy:**
- Pre-flight in runbook: `firebase use papertek-lockdown-prod` (verify project), `firebase deploy --only firestore:rules --dry-run` (Firebase CLI does not have `--dry-run` for rules — runbook must call this out and substitute `firebase firestore:rules:get` to confirm current state pre-deploy and post-deploy comparison)
- Cloud Functions: `firebase deploy --only functions:applyExamModeLock` (function-scoped, not whole-functions)
- Rollback: `firebase functions:rollback applyExamModeLock` is NOT a real command — runbook must document the actual rollback path (re-deploy previous git SHA from a clean checkout) and warn against assuming roll-back-button safety

**If preparing the papertek.app hosting deploy:**
- Lockdown deploys via its own pipeline; runbook in this milestone documents the leksihjelp-side preconditions (sync-script ran, version bumped, view-module dep contracts unchanged or additive) and points at lockdown's deploy doc for the actual push

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Firebase CLI 13.x | Cloud Functions Node 20 runtime | Lockdown's functions are Node 20 per `lockdown/functions/package.json` engines field; CLI 13.x supports Node 20 deploys natively |
| `chrome.sidePanel` API | Chrome 114+ | Side Panel walkthrough (Phase 30-01) requires Chrome 114+; Edge equivalent shipped Edge 114; Brave from Brave 1.55. UAT must verify on the project's three target browsers. |
| Vipps OIDC redirect flow | `chrome.identity.launchWebAuthFlow` | Extension popup auth path; works in Chromium-based browsers only (no Firefox/Safari, per PROJECT.md platform constraint) |
| ElevenLabs Flash v2.5 | All ElevenLabs subscription tiers | Per CLAUDE.md, deliberate choice — UAT does not need to verify TTS endpoint, only the dual-auth + quota-fallback path |

## Integration with Existing 14 Release Gates

UAT findings that *should* trigger a gate (a regression that the gate failed to catch) imply a gate-extension follow-up, not a UAT-tooling follow-up. Pattern:

| Finding shape | Existing gate that should have caught it | Action |
|---------------|------------------------------------------|--------|
| Rule fires on wrong language token | `check-fixtures` (extend fixture set) | Add fixture, ensure gate fails pre-fix and passes post-fix |
| Pedagogy panel renders empty | `check-pedagogy-shape` + `check-vocab-seam-coverage` | Audit which one missed it; usually a seam issue |
| Popover dot wrong color | `check-rule-css-wiring` | Verify gate covers the rule; if rule isn't in TARGETS list, add it |
| Popup view leaks `chrome.*` | `check-popup-deps` | Verify scratch self-test still triggers; if not, paired-self-test rot |
| Bundle ballooned | `check-bundle-size` + `check-baseline-bundle-size` | Already covers; UAT shouldn't surface this |
| Visual layout broken (e.g., overlapping popover) | (none — no gate covers visual) | UAT is the right tool; no gate-side action |
| Lockdown sidepanel doesn't render | `check-popup-deps` (dep contract) + manual lockdown sync verification | Likely sync-script or dep-contract drift |

This means: **the v3.2 milestone may legitimately add gate-extension plans** when UAT surfaces a regression class that no gate covers, but it should *not* add a UAT-automation tool. The 14 gates already encode the "automate everything that can be automated cheaply" decisions correctly.

## Sources

- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` — Release Workflow steps 1-15, downstream consumer contracts, all 14 release gate descriptions (HIGH confidence — authoritative project doc)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/PROJECT.md` — Constraints section (no new runtime deps, MIT/free-tier promise, 20 MiB ceiling), v3.2 Active milestone scope (HIGH confidence)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/MILESTONES.md` — v3.1 closing audit and the 6 explicitly-deferred UAT walkthroughs that scope this milestone (HIGH confidence)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/lockdown-adapter-contract.md` — sync contract surface area; informs which findings need lockdown re-validation (HIGH confidence)
- Firebase CLI documentation patterns for selective deploy and rules-state inspection (MEDIUM confidence — well-known patterns; runbook authoring will verify exact command shapes against `firebase --help` at write-time)
- Chrome `chrome.sidePanel` API support matrix per Chrome 114+ release notes (HIGH confidence)

---
*Stack research for: leksihjelp v3.2 (UAT & Deploy Prep) — hardening / risk-reduction milestone*
*Researched: 2026-05-01*
