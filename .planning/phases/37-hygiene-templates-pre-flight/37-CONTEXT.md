# Phase 37: Hygiene, Templates & Pre-flight - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

UAT discipline infrastructure exists and is enforceable BEFORE any Phase 38 walkthrough runs:
- Two UAT templates (walkthrough, finding) at `.planning/uat/`
- `verification_kind` frontmatter convention with orchestrator hard-pause hook
- Two new release gates (`check-version-alignment`, `check-synced-surface-version`) with paired `:test` self-tests
- Vocab-deployment-at-HEAD pre-flight verification (HYG-07)
- `[lockdown-resync-needed]` commit-message convention documented + retroactively cataloged

Out of scope: actually running walkthroughs (Phase 38), authoring runbooks (Phase 40), shipping fixes (Phase 38).

</domain>

<decisions>
## Implementation Decisions

### Templates (HYG-01, HYG-02)

- **Style**: Strict YAML frontmatter + filled numbered-checklist sections. Machine-readable so gates can lint them.
- **TEMPLATE-walkthrough.md mandatory frontmatter pre-flight fields**:
  - `ext_version` — from manifest.json (guards stale-zip walks)
  - `idb_revision` — IDB vocab revision from chrome.storage (guards stale-data walks)
  - `preset_profile` — `default | basic | full` (guards Phase 05.1 feature-gating regression class)
  - `browser_version` — browser+version string
  - `reload_ts` — `chrome://extensions` reload timestamp (paired with browser_version)
  - `target_browsers` — list of browsers in scope for the walk
  - `verification_kind` — set to `human-browser-walk` so /gsd:auto pauses
- **TEMPLATE-walkthrough.md body**: numbered step checklist + defects-observed section.
- **TEMPLATE-finding.md mandatory frontmatter fields**:
  - `f_id` — F-id pattern (F36-1, F1, F2, …) — formalizes v3.1 implicit convention
  - `severity` — `blocker | major | minor | trivial`
  - `sync_status` — `synced-upstream | needs-resync | extension-only`
  - `regression_fixture_id` — path to check-fixtures fixture or benchmark-texts/expectations.json entry (hard requirement, school-year stakes)

### verification_kind Hook (HYG-03)

- **Mechanism**: `gsd-tools.cjs` gets a frontmatter parser. The auto-advance step in workflows queries it and stops the chain when `verification_kind: human-browser-walk` is present in the active phase plan(s). Enforced centrally, not advisory.
- **Documentation**: convention recorded in CLAUDE.md (likely a new short subsection or extension to GSD references).

### check-synced-surface-version Gate (HYG-05)

- **Tag baseline**: `git describe --tags --abbrev=0` — most-recent annotated tag. Matches existing release-tag flow.
- **Triggers**: ANY git diff (modification, addition, deletion) inside synced paths — widest net. Whitespace/comment-only diffs count. Forces version discipline; we accept the noise on doc-style touch-ups as acceptable cost.
- **Synced paths**: `extension/content/`, `extension/popup/views/`, `extension/exam-registry.js`, `extension/styles/content.css`, `extension/data/`, `extension/i18n/` (matches CLAUDE.md downstream-consumer list).
- **Failure mode**: exit 1 with per-file diagnostic listing changed files, suggesting `npm version patch` AND including a copy-paste hint to add `[lockdown-resync-needed]` to the commit message (pulls HYG-06 nudge into the same surface).
- **Self-test (`:test`)**: plant-restore both directions — plant a synced-file edit without version bump (gate fires), restore (gate passes). Mirror `check-explain-contract:test` pattern exactly.

### check-version-alignment Gate (HYG-04)

- Asserts `extension/manifest.json`, `package.json`, `backend/public/index.html` versions all agree.
- Exit 1 with per-file diagnostic showing each file + its parsed version on drift.
- Paired `:test` self-test plants a drift in one file (gate fires), restores (gate passes).
- Inserted into CLAUDE.md Release Workflow numbered list (immediately before/around current step 13 "Update the version in all three places" — gate enforces what step 13 asks).

### HYG-07 Vocab Verification

- **Mechanism**: automated script at `scripts/check-vocab-deployment.js`. Fetches `https://papertek-vocabulary.vercel.app/api/vocab/v1/revisions`, reads local `/Users/geirforbord/Papertek/papertek-vocabulary` git HEAD sha, compares. Exits 1 on drift.
- **Gate scope**: pre-flight only — invoked by Phase 38 walks at UAT start. NOT added to CLAUDE.md Release Workflow numbered list (extension releases shouldn't depend on Vercel + sibling-repo state on every release).
- **Side-patch reconciliation (e.g. es.json gustar/por-para per Phase 32-02)**: re-sync from upstream first — if papertek-vocabulary now contains the edit, run `npm run sync-vocab`. Upstream-first per CLAUDE.md data-logic separation philosophy. If upstream still missing the edit, that's a deferred carry-over, but the default action is sync.
- **Pre-flight invocation**: TEMPLATE-walkthrough.md pre-flight section instructs the walker to run the script and paste output before walking.

### HYG-06 Retroactive Scope

- **Approach**: doc-based catch-up list, no git history rewrite. Create `.planning/deferred/lockdown-resync-pending.md` listing v3.1 synced-surface commits that landed without the `[lockdown-resync-needed]` marker. Future commits use the convention going forward.
- **Doc location**: convention text lives in CLAUDE.md "Downstream consumers" section (already covers synced surfaces and version-bump rules — adjacent context).
- **Trigger set**: same synced-paths list as check-synced-surface-version gate. Single source of truth.
- **Gate hint coupling**: `check-synced-surface-version` exit-1 diagnostic prints copy-paste commit-message hint including the marker. Pulls HYG-06 into the gate nudge surface.

### Claude's Discretion

- Exact YAML key naming (snake_case assumed; bikeshed-able)
- TEMPLATE body structural details beyond mandatory fields
- Diagnostic output formatting for both gates (within "per-file diagnostic" envelope)
- Order in which sub-tasks land within the phase
- Whether `gsd-tools.cjs` frontmatter parser is a new file or inline addition
- Exact fetch shape / timeout / retry policy of `check-vocab-deployment.js`

</decisions>

<specifics>
## Specific Ideas

- Self-test pattern is mature in this repo — every new gate should mirror `check-explain-contract:test` / `check-popup-deps:test`: plant a violating state (gate fires, exit 1), plant a well-formed state (gate passes), restore. Use try/finally with backup-restore.
- The repo already documents 12 numbered release-workflow gates in CLAUDE.md — both new gates land as numbered insertions, with version-alignment placed near the existing "Update the version in three places" step (currently #13).
- Failure-mode diagnostics across the existing gate suite show file:line pointers and copy-paste fix lines (see `check-rule-css-wiring`, `check-vocab-seam-coverage`). New gates match this style.
- The `[lockdown-resync-needed]` doc-catch-up list is for the v3.1 commits that landed `extension/popup/views/`, `exam-registry.js`, etc. without an explicit marker — Plan 30, Plan 27/28 era. Inspect git log since v3.1 close to populate.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Existing gate scaffolding** — 12 release gates in `scripts/check-*.js` with paired `*.test.js`. Patterns to mirror: AST/file scan + exit-code + per-file diagnostic (e.g. `check-popup-deps.js`, `check-vocab-seam-coverage.js`).
- **`gsd-tools.cjs`** at `~/.claude/get-shit-done/bin/gsd-tools.cjs` — central tool already used by every workflow's `init phase-op`, `state record-session`, `commit`, `config-get/set`. Natural home for a frontmatter parser.
- **YAML/frontmatter parsing** — repo already parses CLAUDE.md and roadmap markdown; `gsd-tools.cjs` likely already has a parser or can use a small inline one.
- **`npm run sync-vocab`** — existing script in package.json that syncs from papertek-vocabulary API. Reused as the side-patch reconciliation action.

### Established Patterns

- **Gate pairs**: every gate has `scripts/check-X.js` + `scripts/check-X.test.js`, both registered in package.json `npm run check-X` / `check-X:test`. Tests mutate working tree under try/finally backup-restore.
- **Per-file diagnostic on failure**: gates exit 1 and print `<file>:<line> — <fix-suggestion>` style.
- **Frontmatter as machine-readable contract**: this repo doesn't currently use plan frontmatter heavily, but skill files in `~/.claude/` do — convention transfers cleanly.
- **CLAUDE.md as canonical doc**: workflows and gates point back to numbered Release Workflow steps. Both new gates land as numbered insertions there.

### Integration Points

- **CLAUDE.md Release Workflow numbered list** (currently 12 gates + version-bump steps) — both new gates inserted, numbering re-flowed.
- **CLAUDE.md "Downstream consumers" section** — `[lockdown-resync-needed]` convention text lands here.
- **`gsd-tools.cjs`** — frontmatter parser added as a new sub-command (e.g. `gsd-tools.cjs frontmatter-get <path> <key>`) or inlined into the auto-advance step's existing init output.
- **`/gsd:auto` orchestrator workflow** — auto-advance step queries the new frontmatter API and hard-pauses.
- **TEMPLATE files** — new directory `.planning/uat/` (does not exist yet — phase creates it).
- **Deferred-items directory** — `.planning/deferred/lockdown-resync-pending.md` (`.planning/deferred/` may not exist yet — phase creates if needed).
- **`scripts/check-vocab-deployment.js`** — new pre-flight script; not registered as a Release Workflow gate but is callable via `npm run`.

</code_context>

<deferred>
## Deferred Ideas

- Cross-repo PR to `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js` adding drift-detection — already scoped to Phase 39 (UAT-LOCK-03). No action here.
- Skriveokt-zero `--dry-run` verification — Phase 39 (UAT-LOCK-04).
- `/gsd:add-tests` run — Phase 41 milestone-end (per `project_test_suite_at_milestone_end.md` user memory).
- Promoting the vocab-deployment script to a hard release gate — explicitly deferred; pre-flight-only is the v3.2 decision. Reconsider if drift bites.
- Side-patches that don't have an upstream equivalent — case-by-case, document with reason; not a generic process to design here.
- Bikeshed of `check-version-alignment` exact field-name parsing in `backend/public/index.html` (CSS selector vs regex) — Claude's discretion during implementation.

</deferred>

---

*Phase: 37-hygiene-templates-pre-flight*
*Context gathered: 2026-05-01*
