# Phase 37: Hygiene, Templates & Pre-flight - Research

**Researched:** 2026-05-01
**Domain:** GSD discipline infrastructure — UAT templates, frontmatter convention, two release gates, vocab-deployment pre-flight, lockdown re-sync convention
**Confidence:** HIGH (everything is in-tree inspection or documented sibling conventions; no external library claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Templates (HYG-01, HYG-02)**
- Style: strict YAML frontmatter + filled numbered-checklist sections. Machine-readable so gates can lint them.
- TEMPLATE-walkthrough.md mandatory frontmatter pre-flight fields:
  - `ext_version` — from manifest.json (guards stale-zip walks)
  - `idb_revision` — IDB vocab revision from chrome.storage (guards stale-data walks)
  - `preset_profile` — `default | basic | full` (guards Phase 05.1 feature-gating regression class)
  - `browser_version` — browser+version string
  - `reload_ts` — `chrome://extensions` reload timestamp (paired with browser_version)
  - `target_browsers` — list of browsers in scope for the walk
  - `verification_kind` — set to `human-browser-walk` so /gsd:auto pauses
- TEMPLATE-walkthrough.md body: numbered step checklist + defects-observed section.
- TEMPLATE-finding.md mandatory frontmatter fields:
  - `f_id` — F-id pattern (F36-1, F1, F2, …) — formalizes v3.1 implicit convention
  - `severity` — `blocker | major | minor | trivial`
  - `sync_status` — `synced-upstream | needs-resync | extension-only`
  - `regression_fixture_id` — path to check-fixtures fixture or benchmark-texts/expectations.json entry (hard requirement, school-year stakes)

**verification_kind Hook (HYG-03)**
- Mechanism: `gsd-tools.cjs` gets a frontmatter parser. The auto-advance step in workflows queries it and stops the chain when `verification_kind: human-browser-walk` is present in the active phase plan(s). Enforced centrally, not advisory.
- Documentation: convention recorded in CLAUDE.md (likely a new short subsection or extension to GSD references).

**check-synced-surface-version Gate (HYG-05)**
- Tag baseline: `git describe --tags --abbrev=0` — most-recent annotated tag. Matches existing release-tag flow.
- Triggers: ANY git diff (modification, addition, deletion) inside synced paths — widest net. Whitespace/comment-only diffs count. Forces version discipline; we accept the noise on doc-style touch-ups as acceptable cost.
- Synced paths: `extension/content/`, `extension/popup/views/`, `extension/exam-registry.js`, `extension/styles/content.css`, `extension/data/`, `extension/i18n/` (matches CLAUDE.md downstream-consumer list).
- Failure mode: exit 1 with per-file diagnostic listing changed files, suggesting `npm version patch` AND including a copy-paste hint to add `[lockdown-resync-needed]` to the commit message (pulls HYG-06 nudge into the same surface).
- Self-test (`:test`): plant-restore both directions — plant a synced-file edit without version bump (gate fires), restore (gate passes). Mirror `check-explain-contract:test` pattern exactly.

**check-version-alignment Gate (HYG-04)**
- Asserts `extension/manifest.json`, `package.json`, `backend/public/index.html` versions all agree.
- Exit 1 with per-file diagnostic showing each file + its parsed version on drift.
- Paired `:test` self-test plants a drift in one file (gate fires), restores (gate passes).
- Inserted into CLAUDE.md Release Workflow numbered list (immediately before/around current step 13 "Update the version in all three places" — gate enforces what step 13 asks).

**HYG-07 Vocab Verification**
- Mechanism: automated script at `scripts/check-vocab-deployment.js`. Fetches `https://papertek-vocabulary.vercel.app/api/vocab/v1/revisions`, reads local `/Users/geirforbord/Papertek/papertek-vocabulary` git HEAD sha, compares. Exits 1 on drift.
- Gate scope: pre-flight only — invoked by Phase 38 walks at UAT start. NOT added to CLAUDE.md Release Workflow numbered list (extension releases shouldn't depend on Vercel + sibling-repo state on every release).
- Side-patch reconciliation (e.g. es.json gustar/por-para per Phase 32-02): re-sync from upstream first — if papertek-vocabulary now contains the edit, run `npm run sync-vocab`. Upstream-first per CLAUDE.md data-logic separation philosophy. If upstream still missing the edit, that's a deferred carry-over, but the default action is sync.
- Pre-flight invocation: TEMPLATE-walkthrough.md pre-flight section instructs the walker to run the script and paste output before walking.

**HYG-06 Retroactive Scope**
- Approach: doc-based catch-up list, no git history rewrite. Create `.planning/deferred/lockdown-resync-pending.md` listing v3.1 synced-surface commits that landed without the `[lockdown-resync-needed]` marker. Future commits use the convention going forward.
- Doc location: convention text lives in CLAUDE.md "Downstream consumers" section (already covers synced surfaces and version-bump rules — adjacent context).
- Trigger set: same synced-paths list as check-synced-surface-version gate. Single source of truth.
- Gate hint coupling: `check-synced-surface-version` exit-1 diagnostic prints copy-paste commit-message hint including the marker. Pulls HYG-06 into the gate nudge surface.

### Claude's Discretion
- Exact YAML key naming (snake_case assumed; bikeshed-able)
- TEMPLATE body structural details beyond mandatory fields
- Diagnostic output formatting for both gates (within "per-file diagnostic" envelope)
- Order in which sub-tasks land within the phase
- Whether `gsd-tools.cjs` frontmatter parser is a new file or inline addition
- Exact fetch shape / timeout / retry policy of `check-vocab-deployment.js`

### Deferred Ideas (OUT OF SCOPE)
- Cross-repo PR to `lockdown/scripts/sync-leksihjelp.js` adding drift-detection — Phase 39 (UAT-LOCK-03)
- Skriveokt-zero `--dry-run` verification — Phase 39 (UAT-LOCK-04)
- `/gsd:add-tests` run — Phase 41 milestone-end
- Promoting the vocab-deployment script to a hard release gate — explicitly deferred; pre-flight-only is the v3.2 decision
- Side-patches that don't have an upstream equivalent — case-by-case
- Bikeshed of `check-version-alignment` exact field-name parsing in `backend/public/index.html`
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HYG-01 | UAT walkthrough template at `.planning/uat/TEMPLATE-walkthrough.md` with mandatory pre-flight, defects-observed, target-browsers | F36-1 verification log structure (`.planning/phases/36-*/36-VERIFICATION.md`) is the closest existing artifact — reuse its frontmatter style + numbered-step body. Directory `.planning/uat/` does NOT exist yet — phase creates it. |
| HYG-02 | Finding template at `.planning/uat/TEMPLATE-finding.md` formalising F-id, severity, sync-status, regression-fixture-id | The F36-1 convention is the implicit precedent (see 36-VERIFICATION.md `gaps:` block). Promote to repo standard. |
| HYG-03 | `verification_kind: human-browser-walk` orchestrator hard-pause; documented in CLAUDE.md | `gsd-tools.cjs` already has `frontmatter get/set/merge/validate` subcommands (lib at `~/.claude/get-shit-done/bin/lib/frontmatter.cjs`). No new parser needed — wire a new `frontmatter check-pause <file> --field verification_kind --value human-browser-walk` subcommand or use existing `frontmatter get` from auto-advance code path. |
| HYG-04 | `check-version-alignment` release gate + paired `:test` | Three sources: `extension/manifest.json` JSON `version` field; `package.json` JSON `version` field; `backend/public/index.html` HTML `<p class="version">…Versjon X.Y.Z</p>` regex. Currently all three align at `2.9.18`. Mirror `check-popup-deps.js` plant/restore self-test pattern. |
| HYG-05 | `check-synced-surface-version` release gate + paired `:test` | Use `git describe --tags --abbrev=0` (returns `v3.1` today) to get baseline. `git diff --name-only <tag>..HEAD -- <synced-paths>` returns changed files. Compare `git show <tag>:package.json` version field vs current `package.json` version. Today this returns 0 changed synced files since v3.1 (only `.planning/` doc churn) — gate currently exits 0. |
| HYG-06 | `[lockdown-resync-needed]` commit-message convention documented; retroactively cataloged | `git log v3.1..HEAD -- <synced-paths>` returns ZERO synced-surface commits since v3.1 (verified: only docs churn). The retroactive list is therefore EMPTY for v3.2-entry — but the deferred file should still be created with the documented header so future commits have a place to land. |
| HYG-07 | Papertek API vocab deployment verified at-HEAD; v3.1 side-patches reconciled | Side-patches identified: (1) `extension/data/es.json` por/para pedagogy (Phase 32-02 commit `04e0573`); (2) `extension/data/es.json` gustar_class markers (Phase 32-03; mirrored from papertek-vocabulary commit `9d7b2608`). Both should now be in upstream papertek-vocabulary; `npm run sync-vocab:es` is the no-op verification. |
</phase_requirements>

## Summary

This is a discipline-infrastructure phase, not a code-feature phase. Every deliverable is a small, in-repo addition that uses patterns already established 12+ times in the existing release-gate suite. No new runtime dependencies; no library research required. The single most-mature reference pattern in the repo is the gate-pair (`scripts/check-X.js` + `scripts/check-X.test.js` registered as `npm run check-X` / `check-X:test` in `package.json`), with plant-restore self-tests guarded by try/finally cleanup. The two new gates (HYG-04, HYG-05) clone this shape exactly.

The UAT templates have a single best-precedent in-tree: the Phase 36 verification log (`.planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md`), which already uses YAML frontmatter with `gaps:`/`human_verification:` blocks and numbered-checklist truths in the body. Templates should distill this proven shape into reusable scaffolds. The `verification_kind` hook leverages `gsd-tools.cjs frontmatter get/set/merge/validate` subcommands that already exist (verified in `~/.claude/get-shit-done/bin/gsd-tools.cjs` lines 304-321 backed by `lib/frontmatter.cjs`) — no parser to author.

The vocab-pre-flight script (HYG-07) is the only piece that touches a remote (papertek-vocabulary.vercel.app + sibling git repo at `/Users/geirforbord/Papertek/papertek-vocabulary`). It is intentionally a soft pre-flight, not a release gate — the v3.2 decision is explicit on this point.

**Primary recommendation:** Mirror `scripts/check-popup-deps.js` + `check-popup-deps.test.js` line-for-line for both new gates. Mirror Phase 36-VERIFICATION.md frontmatter style for both UAT templates. Wire `verification_kind` via the existing `gsd-tools.cjs frontmatter` API.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js stdlib | ≥18 (CommonJS) | All gate scripts | Zero runtime deps is enforced across the existing 12-gate suite (see `scripts/check-popup-deps.js` header comment) |
| `child_process.spawnSync` | stdlib | `:test` scripts re-invoke the gate they cover | Established pattern in every `check-*.test.js` |
| `fs` | stdlib | File I/O, plant/restore | Established |
| `path` | stdlib | Cross-platform paths from ROOT = `path.join(__dirname, '..')` | Established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gsd-tools.cjs frontmatter` | as-is at `~/.claude/get-shit-done/bin/gsd-tools.cjs` | Read/set YAML frontmatter on plan files | HYG-03 verification_kind hook |
| `node:https` (or built-in `fetch` on Node ≥18) | stdlib | `check-vocab-deployment.js` Vercel API GET | HYG-07 only |
| `child_process.execSync('git …')` | stdlib | `git describe`, `git diff --name-only`, `git show <tag>:file` | HYG-05 + HYG-06 retroactive scan |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in `fetch` (Node ≥18) for HYG-07 | `node:https` low-level | `fetch` is cleaner; Node 18 is already required (see `engines` in repo + Brave search docs). Use `fetch`. |
| Hand-rolled YAML parser | Reuse `gsd-tools.cjs frontmatter get` via `execSync` | The gsd-tools subcommand already exists and is tested; calling it via execSync from inside an orchestrator step is the lower-friction path. Inside scripts/check-*.js we don't need YAML at all (only HYG-03 touches frontmatter). |

**Installation:** None. Zero npm deps for all four new scripts.

## Architecture Patterns

### Recommended File Layout
```
.planning/
├── uat/                                   # NEW directory (HYG-01 + HYG-02)
│   ├── TEMPLATE-walkthrough.md            # HYG-01
│   └── TEMPLATE-finding.md                # HYG-02
└── deferred/                              # NEW directory (HYG-06)
    └── lockdown-resync-pending.md         # HYG-06 catch-up list

scripts/
├── check-version-alignment.js             # HYG-04 gate
├── check-version-alignment.test.js        # HYG-04 self-test
├── check-synced-surface-version.js        # HYG-05 gate
├── check-synced-surface-version.test.js   # HYG-05 self-test
└── check-vocab-deployment.js              # HYG-07 pre-flight (NOT a release gate)

CLAUDE.md                                  # MODIFIED — gates inserted at #13 + #14, version-bump renumbered to #15+, "Downstream consumers" section gets [lockdown-resync-needed] convention block

package.json                               # MODIFIED — 4 new npm scripts (check-version-alignment, :test, check-synced-surface-version, :test) + 1 (check-vocab-deployment, no :test)
```

### Pattern 1: Gate Script (mirror `check-popup-deps.js`)
**What:** Self-contained Node CommonJS script. Loads files, scans, accumulates findings, prints `[gate-name] FAIL: <count> …` to stderr with file:line + fix suggestion, exits 1. Otherwise prints `[gate-name] PASS: <details>` to stdout, exits 0.
**When to use:** All HYG-04, HYG-05, HYG-07 gate scripts.
**Example skeleton (verbatim from `check-popup-deps.js` shape):**
```javascript
// Source: /Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
// ... scan logic ...
function main() {
  // accumulate findings[]
  if (findings.length > 0) {
    for (const f of findings) {
      process.stderr.write(`[gate-name] ${path.relative(ROOT, f.file)} — ${f.token}\n  fix: ${f.hint}\n`);
    }
    process.stderr.write(`[gate-name] FAIL: ${findings.length} issue(s)\n`);
    process.exit(1);
  }
  console.log(`[gate-name] PASS: …`);
  process.exit(0);
}
main();
```

### Pattern 2: Self-test (mirror `check-popup-deps.test.js`)
**What:** Three-step plant-restore. (1) Baseline run — gate must exit 0. (2) Plant violating state, run gate — must exit 1 AND stderr must mention plant filename + key token. (3) Plant well-formed state, run gate — must exit 0. All file mutations guarded by try/finally + `process.on('exit')` cleanup.
**When to use:** All `:test` files (HYG-04, HYG-05).
**Example skeleton:**
```javascript
// Source: /Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.test.js
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-X.js');

let cleanedUp = false;
function cleanup() { /* delete planted files */ }
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

// Step 1: baseline must pass
const baseline = runGate();
if (baseline.status !== 0) { console.error('FAIL: baseline'); process.exit(1); }

// Step 2: plant bad → must exit 1
fs.writeFileSync(BAD_PATH, BAD_BODY);
const badRun = runGate();
if (badRun.status !== 1 || !badRun.stderr.includes('expected-token')) {
  console.error('FAIL: gate did not fire on bad plant'); cleanup(); process.exit(1);
}
fs.unlinkSync(BAD_PATH);

// Step 3: plant good → must exit 0
fs.writeFileSync(GOOD_PATH, GOOD_BODY);
const goodRun = runGate();
if (goodRun.status !== 0) {
  console.error('FAIL: gate too strict'); cleanup(); process.exit(1);
}
fs.unlinkSync(GOOD_PATH);

console.log('PASS');
process.exit(0);
```

### Pattern 3: Frontmatter on plan files (HYG-03)
**What:** Plans currently don't carry `verification_kind` frontmatter. Phase 38 plans will declare it. The orchestrator's auto-advance code path queries `gsd-tools.cjs frontmatter get <plan-file> --field verification_kind` and halts when the value is `human-browser-walk`.
**When to use:** HYG-03 implementation; Phase 38 plan authoring (downstream).
**Example invocation:**
```bash
# Source: ~/.claude/get-shit-done/bin/gsd-tools.cjs (lines 304-321)
node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get ".planning/phases/38-*/38-01-PLAN.md" --field verification_kind
# → "human-browser-walk" or null
```

### Pattern 4: UAT Template Frontmatter (HYG-01, HYG-02)
**What:** YAML frontmatter for machine-lintability. Phase 36-VERIFICATION.md is the in-tree precedent.
**Walkthrough template frontmatter (exact key set, locked):**
```yaml
---
walkthrough_id: UAT-EXT-XX               # matches REQUIREMENTS.md ID
phase: 38-extension-uat-batch
verification_kind: human-browser-walk    # HYG-03 hook trigger
ext_version: 2.9.18                      # from manifest.json — pre-flight evidence
idb_revision: <fill-from-DevTools>       # IDB vocab revision via __lexiVocabStore.listCachedLanguages() or similar
preset_profile: default                  # default | basic | full
browser_version: <fill>                  # e.g. "Chrome 138.0.6962.42"
reload_ts: <ISO-8601>                    # chrome://extensions reload timestamp
target_browsers: [chrome, edge, brave]   # list
walker: Geir
date: <ISO-8601>
---
```
**Walkthrough template body (numbered checklist + defects-observed):**
```markdown
# UAT-EXT-XX: <Feature> Walkthrough

## Pre-flight evidence (paste before walking)
- [ ] `node scripts/check-vocab-deployment.js` exit code: …
- [ ] manifest.json version matches frontmatter `ext_version`: …
- [ ] IDB revision captured: …
- [ ] Reload timestamp recorded: …
- [ ] Browser+version recorded: …

## Steps
1. <step>  → expected: …  → observed: …  → ✅/❌
2. …
N. …

## Defects observed
- F<phase>-<seq>: <one-line> → see `.planning/uat/findings/<id>.md`

## Outcome
- [ ] All steps pass
- [ ] Findings filed: <list>
```

**Finding template frontmatter (exact key set, locked):**
```yaml
---
f_id: F38-1                              # F<phase>-<seq>; formalises F36-1 precedent
severity: blocker                        # blocker | major | minor | trivial
sync_status: extension-only              # synced-upstream | needs-resync | extension-only
regression_fixture_id: fixtures/de/grammar.jsonl#de-gender-kein-fem-1
                                         # OR benchmark-texts/expectations.json#<id>
walkthrough_id: UAT-EXT-XX
discovered: <ISO-8601>
status: open                             # open | fixing | closed
---
```

### Anti-Patterns to Avoid
- **Hand-rolling a YAML parser** in `check-*.js` — none of the new gates need YAML parsing; only the orchestrator hook does, and `gsd-tools.cjs` already provides it.
- **Writing the version-alignment regex against the bare string `2.9.18`** — instead, parse manifest.json + package.json as JSON, and use a regex against the HTML that matches `Versjon (\d+\.\d+\.\d+)` (current shape: `<p class="version">Chrome, Edge og Brave &bull; Versjon 2.9.18</p>`).
- **Promoting `check-vocab-deployment.js` to a release gate** — explicit deferred decision; never call it from CLAUDE.md Release Workflow numbered list.
- **Modifying git history to backfill `[lockdown-resync-needed]`** — explicit decision: doc-based catch-up only.
- **Including pretty-printing `extension/data/*.json`** in `check-synced-surface-version` exclusion list — the gate fires on `extension/data/` changes by design; the data-file regression-detection cost is acceptable per CONTEXT.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | New parser inline | `node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get …` | Already exists, lines 304-321 |
| Plant/restore self-test scaffolding | New helper | Copy `check-popup-deps.test.js` shape line-for-line | Established 12-gate-deep convention |
| Diff-since-last-tag detection | Custom traversal | `git describe --tags --abbrev=0` then `git diff --name-only <tag>..HEAD -- <paths>` | Two execSync calls, zero parsing complexity |
| Version-alignment HTML parsing | DOM library / cheerio | Single regex `/Versjon\s+(\d+\.\d+\.\d+)/` against the HTML file | The single source-line shape is stable; regex is sufficient |
| HTTP fetch for HYG-07 | axios / node-fetch | Built-in `fetch` (Node ≥18) | Zero deps; matches the existing zero-deps gate posture |

**Key insight:** Every primitive needed already exists either in the Node stdlib, in `gsd-tools.cjs`, or as a copy-paste skeleton from an existing `check-*.js` script. The phase is wiring, not invention.

## Common Pitfalls

### Pitfall 1: `git describe --tags --abbrev=0` returns the wrong tag during phase-37 development
**What goes wrong:** While Phase 37 is in progress, `--abbrev=0` returns `v3.1` (current state). After Phase 37 ships and the v3.2 first version-bump-tag lands (e.g. `v3.2.0`), the gate switches to comparing against the new tag. Mid-phase, every commit looks like a synced-surface change.
**Why it happens:** Tag-based baselines are non-monotonic at the first post-tag commit.
**How to avoid:** Document expected behavior — gate fires on any synced-surface change since last release tag, even if it's a Phase 37 sub-task. The fix during Phase 37 is to bump `package.json` version when synced surfaces are touched, OR explicitly make synced-surface-free phase-37 commits (templates + deferred + scripts only — none of those paths are in the synced-surfaces glob, so HYG-05 is naturally satisfied during Phase 37 itself).
**Warning signs:** `npm run check-synced-surface-version` exits 1 during Phase 37 with no obvious synced-surface change → check whether your commit touched anything in `extension/`.

### Pitfall 2: HYG-05 self-test polluting working tree
**What goes wrong:** The self-test plants a synced-surface file (e.g. a tweaked `extension/i18n/test.json`) without bumping `package.json` version. If cleanup fails (process killed, crash), the planted file remains and pollutes git status.
**Why it happens:** Plant-restore is racy under signals.
**How to avoid:** Mirror the `check-popup-deps.test.js` cleanup harness exactly — `process.on('exit')`, `SIGINT`, `uncaughtException` all wired to `cleanup()`. Use a clearly-marked filename (`__scratch-…`) so accidental retention is visually obvious in `git status`.
**Warning signs:** `__scratch-*` files appearing in `git status`.

### Pitfall 3: Plant for HYG-04 self-test must touch ONE of the three version files only
**What goes wrong:** If the plant modifies `package.json` but the cleanup writes a stale value back, the self-test "fixes" something that wasn't broken (or worse, breaks the live version).
**Why it happens:** package.json is a shared, frequently-touched file.
**How to avoid:** The plant target should be `backend/public/index.html` (lowest-risk file — display only, not consumed by build/test pipeline). Read original content into a variable, write modified content (e.g. `Versjon 9.9.9`), restore from variable in finally.
**Warning signs:** package.json or manifest.json appearing in `git diff` after a self-test run.

### Pitfall 4: HYG-07 fetch hangs forever if Vercel is down
**What goes wrong:** Pre-flight invocation blocks indefinitely.
**Why it happens:** Default `fetch` has no timeout.
**How to avoid:** Wrap in `AbortController` with a 10-second `setTimeout`. Print a clear "Vercel API unreachable — confirm manually before proceeding" message and exit non-zero (so the walker knows to investigate, not silently bypass).
**Warning signs:** Walker reports "script never returns".

### Pitfall 5: `extension/data/es.json` side-patches reverted by `npm run sync-vocab:es`
**What goes wrong:** The sync script pulls from the deployed Vercel API. If the Vercel deploy lags `papertek-vocabulary` HEAD, syncing reverts the side-patch (Phase 32-02's exact root cause for the side-patch).
**Why it happens:** Vercel deploys are not in lockstep with the sibling repo's git push.
**How to avoid:** HYG-07 verifies Vercel-deploy-at-HEAD BEFORE recommending sync. Sequence: (a) confirm `papertek-vocabulary` git is clean and remote up-to-date; (b) confirm Vercel deploy revision matches local HEAD; (c) only THEN run `npm run sync-vocab:es`; (d) `git diff extension/data/es.json` — if non-empty, investigate (probably an upstream gap). The script should print the recommended command sequence, not run it.
**Warning signs:** `git diff extension/data/es.json` shows pedagogy or gustar_class fields disappearing after a sync.

### Pitfall 6: Auto-mode bypasses verification_kind hook because the hook isn't wired into the auto-advance code path
**What goes wrong:** HYG-03 ships the convention + parser, but the orchestrator never queries it, so auto-mode steamrolls past Phase 38 walkthroughs.
**Why it happens:** The convention is documented but not enforced at the only point it matters.
**How to avoid:** The "orchestrator hard-pause" wiring needs to live SOMEWHERE concrete. Two viable placements: (a) inside the `/gsd:execute-phase` and `/gsd:plan-phase` command files at `~/.claude/commands/gsd/` — these are the auto-mode entry points; (b) inside `gsd-tools.cjs` as a new `phase-can-auto-advance <phase-dir>` subcommand returning a boolean, called from those commands. **NOTE:** No `~/.claude/commands/gsd/auto.md` exists today — auto-mode is a Claude Code agent mode (per the system reminder we received). The hook therefore lives in the per-command auto-advance step inside `execute-phase.md` / `plan-phase.md`. Plan must include explicit step adding documentation to those command files (or to CLAUDE.md GSD-references section).
**Warning signs:** Phase 38 plans declare `verification_kind: human-browser-walk` in frontmatter; auto-mode advances past them anyway.

## Code Examples

### check-version-alignment.js skeleton
```javascript
// Source: pattern from /Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const SOURCES = [
  { file: 'extension/manifest.json', extract: (raw) => JSON.parse(raw).version },
  { file: 'package.json',            extract: (raw) => JSON.parse(raw).version },
  { file: 'backend/public/index.html', extract: (raw) => {
      const m = raw.match(/Versjon\s+(\d+\.\d+\.\d+)/);
      if (!m) throw new Error('no Versjon X.Y.Z line found');
      return m[1];
  } },
];

function main() {
  const observed = SOURCES.map(s => {
    const abs = path.join(ROOT, s.file);
    const raw = fs.readFileSync(abs, 'utf8');
    return { file: s.file, version: s.extract(raw) };
  });
  const versions = new Set(observed.map(o => o.version));
  if (versions.size === 1) {
    console.log(`[check-version-alignment] PASS: all three sources at ${[...versions][0]}`);
    process.exit(0);
  }
  process.stderr.write('[check-version-alignment] FAIL: version drift across release artifacts.\n');
  for (const o of observed) {
    process.stderr.write(`  ${o.file}: ${o.version}\n`);
  }
  process.stderr.write('  fix: run `npm version <new>` then update backend/public/index.html "Versjon" line + extension/manifest.json "version" field by hand if needed.\n');
  process.exit(1);
}
main();
```

### check-synced-surface-version.js skeleton
```javascript
// Source: pattern from /Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.js
'use strict';
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const SYNCED_PATHS = [
  'extension/content/',
  'extension/popup/views/',
  'extension/exam-registry.js',
  'extension/styles/content.css',
  'extension/data/',
  'extension/i18n/',
];

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main() {
  let lastTag;
  try { lastTag = git('describe --tags --abbrev=0'); }
  catch (e) {
    console.log('[check-synced-surface-version] PASS (informational): no tags exist yet — gate is meaningful from first tag onward.');
    process.exit(0);
  }

  const changedRaw = git(`diff --name-only ${lastTag}..HEAD -- ${SYNCED_PATHS.join(' ')}`);
  const changed = changedRaw ? changedRaw.split('\n').filter(Boolean) : [];

  if (changed.length === 0) {
    console.log(`[check-synced-surface-version] PASS: no synced-surface changes since ${lastTag}.`);
    process.exit(0);
  }

  // Compare package.json version at tag vs HEAD.
  const versionAtTag = JSON.parse(git(`show ${lastTag}:package.json`)).version;
  const versionNow = require(path.join(ROOT, 'package.json')).version;

  if (versionAtTag !== versionNow) {
    console.log(`[check-synced-surface-version] PASS: ${changed.length} synced file(s) changed since ${lastTag}, but package.json bumped (${versionAtTag} → ${versionNow}).`);
    process.exit(0);
  }

  process.stderr.write(`[check-synced-surface-version] FAIL: ${changed.length} synced-surface file(s) changed since ${lastTag} (${versionAtTag}) without a package.json version bump.\n`);
  for (const f of changed) process.stderr.write(`  ${f}\n`);
  process.stderr.write('  fix: run `npm version patch` (or minor/major) and bump extension/manifest.json + backend/public/index.html to match.\n');
  process.stderr.write('  fix: include `[lockdown-resync-needed]` in the commit message so the downstream sync trigger is recorded.\n');
  process.exit(1);
}
main();
```

### check-vocab-deployment.js skeleton (HYG-07 — pre-flight only)
```javascript
// Source: zero-deps Node stdlib; mirrors gate style but is NOT a release gate
'use strict';
const path = require('path');
const { execSync } = require('child_process');
const PAPERTEK_REPO = '/Users/geirforbord/Papertek/papertek-vocabulary';
const REVISIONS_URL = 'https://papertek-vocabulary.vercel.app/api/vocab/v1/revisions';
const TIMEOUT_MS = 10000;

async function main() {
  // 1. Sibling repo clean + up-to-date with origin?
  let localHead, status, behindAhead;
  try {
    localHead = execSync('git rev-parse HEAD', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
    status = execSync('git status --porcelain', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
    execSync('git fetch --quiet', { cwd: PAPERTEK_REPO });
    behindAhead = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('[check-vocab-deployment] FAIL: cannot read sibling repo at ' + PAPERTEK_REPO);
    console.error('  ' + e.message);
    process.exit(1);
  }
  if (status) {
    console.error('[check-vocab-deployment] FAIL: papertek-vocabulary has uncommitted changes:');
    console.error(status);
    process.exit(1);
  }
  const [ahead, behind] = behindAhead.split('\t').map(Number);
  if (ahead || behind) {
    console.error(`[check-vocab-deployment] FAIL: papertek-vocabulary diverged from origin (ahead=${ahead}, behind=${behind})`);
    process.exit(1);
  }

  // 2. Vercel API revision matches local HEAD?
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(REVISIONS_URL, { signal: ctrl.signal });
  } catch (e) {
    console.error('[check-vocab-deployment] FAIL: Vercel API unreachable: ' + e.message);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    console.error(`[check-vocab-deployment] FAIL: Vercel API returned ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  // Shape assumed: { revision: '<sha>', languages: { de: '<sha>', es: '<sha>', … } }
  // Adjust based on actual response — verify shape on first run.
  const apiHead = body.revision || body.head || body.sha;
  if (!apiHead) {
    console.error('[check-vocab-deployment] FAIL: API response shape unexpected:');
    console.error(JSON.stringify(body, null, 2).slice(0, 400));
    process.exit(1);
  }
  if (apiHead !== localHead) {
    console.error(`[check-vocab-deployment] FAIL: drift detected.`);
    console.error(`  papertek-vocabulary HEAD: ${localHead}`);
    console.error(`  Vercel API revision:      ${apiHead}`);
    console.error('  fix: wait for Vercel deploy to finish, or trigger a redeploy.');
    process.exit(1);
  }

  console.log('[check-vocab-deployment] PASS: local HEAD = Vercel revision = ' + localHead.slice(0, 8));
  console.log('  Next: `npm run sync-vocab` to refresh extension/data/*.json from upstream.');
  console.log('  Then: `git diff extension/data/` — empty means side-patches are reconciled.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

### lockdown-resync-pending.md skeleton (HYG-06)
```markdown
# Lockdown Re-Sync Pending

Tracks synced-surface commits that landed without the `[lockdown-resync-needed]` commit-message marker, before the convention was adopted in Phase 37 (HYG-06).

## Convention (going forward)

When a commit modifies any of:
- `extension/content/`
- `extension/popup/views/`
- `extension/exam-registry.js`
- `extension/styles/content.css`
- `extension/data/`
- `extension/i18n/`

…include `[lockdown-resync-needed]` in the commit message body. Downstream consumers (lockdown webapp, skriveokt-zero) use this marker to scope their re-sync windows. Enforced by `npm run check-synced-surface-version` (which prints the marker as a copy-paste hint on failure).

## Retroactive catch-up (v3.1 → v3.2)

`git log v3.1..HEAD -- extension/content/ extension/popup/views/ extension/exam-registry.js extension/styles/content.css extension/data/ extension/i18n/`

Result on 2026-05-01: **EMPTY** — no synced-surface commits since v3.1; only docs churn. Convention starts clean for v3.2.

## v3.1 commits to retroactively flag

(populate from `git log v3.0..v3.1 -- <synced-paths>` if downstream re-sync still owes for v3.1; otherwise leave as-is and start fresh from v3.2.)

| Commit | Date | Synced files | Re-sync status |
|--------|------|--------------|----------------|
| (TBD per phase scan) | | | |
```

### TEMPLATE-walkthrough.md skeleton (HYG-01) — see Pattern 4 above for the full body.

### TEMPLATE-finding.md skeleton (HYG-02) — see Pattern 4 above for the frontmatter; body is free-form Markdown with sections "Reproduction", "Root cause hypothesis", "Fix tracking" (mirror Phase 36-VERIFICATION.md's F36-1 narrative shape).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit F-id convention (F1, F2, F36-1 invented per-phase) | Formal `f_id` frontmatter field on every finding (HYG-02) | Phase 37 | Findings become machine-listable across milestones |
| Doc-only synced-surface convention | `check-synced-surface-version` enforces it via gate (HYG-05) | Phase 37 | Lockdown re-sync trigger is no longer a discipline question |
| Three-place version bumps tracked by Release Workflow step #13 prose only | `check-version-alignment` enforces it (HYG-04) | Phase 37 | Drift cannot ship |
| UAT walkthrough log was an ad-hoc Markdown file (Phase 36 style) | Lintable YAML-frontmatter template (HYG-01/02) | Phase 37 | UAT discipline becomes auditable / repeatable |
| Auto-mode never asked about human-walk requirements | `verification_kind` hard-pause (HYG-03) | Phase 37 | Pitfall-2 root cause for v3.1's six-walkthrough deferral closed |

**Deprecated/outdated:**
- Manual three-place version-bump checklists in code review — replaced by HYG-04 gate.

## Open Questions

1. **Exact shape of `papertek-vocabulary.vercel.app/api/vocab/v1/revisions` response**
   - What we know: the endpoint exists per CLAUDE.md (Papertek API endpoints section).
   - What's unclear: response shape — is it `{ revision: '<sha>' }` (single global), `{ languages: { de: '<sha>', … } }` (per-language), or something else? The HYG-07 script must accommodate the actual shape.
   - Recommendation: First task in HYG-07 plan is `curl https://papertek-vocabulary.vercel.app/api/vocab/v1/revisions | jq` and freeze the parser against that exact shape. Build the script around the observed shape; do not speculate.

2. **Where exactly does `/gsd:auto` live?**
   - What we know: Auto-mode is a Claude Code agent mode (per the system reminder we received this session). No `~/.claude/commands/gsd/auto.md` exists. Auto-advance happens inside `/gsd:execute-phase` and `/gsd:plan-phase` (which iterate plans/phases without user input).
   - What's unclear: Whether the user expects HYG-03 to wire a hard-pause into `execute-phase.md` and `plan-phase.md` markdown command files, OR a documentation-only convention that the user manually honors (i.e. document in CLAUDE.md "auto-mode pauses on `verification_kind: human-browser-walk`" and rely on the LLM running auto-mode to read the frontmatter and self-pause).
   - Recommendation: Ship the `gsd-tools.cjs` query path as the mechanism (machine-readable), AND document the convention in CLAUDE.md so any agent running auto-mode picks it up. Open a sub-task to optionally wire it into `~/.claude/commands/gsd/execute-phase.md` and `plan-phase.md` if those command files are user-editable in this session — confirm in plan.

3. **Should HYG-05 exclude `extension/data/*.json` pretty-printing churn?**
   - What we know: CONTEXT locks "ANY git diff … widest net. Whitespace/comment-only diffs count" — so no exclusion.
   - What's unclear: The first `npm run sync-vocab` after Phase 37 lands will rewrite `extension/data/*.json` from upstream and trigger HYG-05 on every sync. This may be noisy.
   - Recommendation: Honor the locked decision — no exclusion. Mitigation: bundle vocab sync with version bump in same commit (the canonical pattern anyway). Document this in HYG-05 gate header comment.

4. **HYG-06 retroactive scan for v3.1-and-earlier synced-surface commits**
   - What we know: `git log v3.1..HEAD` returns no synced-surface commits (verified). Earlier scans (`git log v3.0..v3.1`) would surface dozens of commits across Phases 24-36.
   - What's unclear: Does "retroactive" in CONTEXT mean "all v3.1-shipped commits" or just "any since the last lockdown re-sync"?
   - Recommendation: Read CLAUDE.md downstream-consumers section for "last lockdown re-sync" reference. Per CONTEXT, scope is "v3.1 synced-surface commits that landed without the marker" — likely means Phases 24-36 commits. Plan should include a one-time `git log v3.0..v3.1 -- <synced-paths>` scan and tabulate results in `lockdown-resync-pending.md`.

## Sources

### Primary (HIGH confidence)
- `/Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.js` — canonical gate skeleton
- `/Users/geirforbord/Papertek/leksihjelp/scripts/check-popup-deps.test.js` — canonical self-test skeleton
- `/Users/geirforbord/Papertek/leksihjelp/scripts/check-explain-contract.js` + `.test.js` — second exemplar (referenced repeatedly in CLAUDE.md)
- `/Users/geirforbord/Papertek/leksihjelp/scripts/check-vocab-seam-coverage.js` + `.test.js` — most-recent exemplar (Phase 36 / INFRA-10)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md` — closest precedent for HYG-01 / HYG-02 template shape
- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` — Release Workflow numbered list (12 gates), Downstream Consumers section, Papertek API endpoint reference
- `~/.claude/get-shit-done/bin/gsd-tools.cjs` lines 304-321 — frontmatter get/set/merge/validate API (already exists; no parser to author)
- `~/.claude/get-shit-done/bin/lib/frontmatter.cjs` — frontmatter implementation
- `/Users/geirforbord/Papertek/leksihjelp/extension/manifest.json` — version source #1 (currently `2.9.18`)
- `/Users/geirforbord/Papertek/leksihjelp/package.json` — version source #2 (currently `2.9.18`), npm scripts registry
- `/Users/geirforbord/Papertek/leksihjelp/backend/public/index.html` — version source #3 (`Versjon 2.9.18` in `<p class="version">`)
- `git log v3.1..HEAD -- <synced-paths>` — empty (verified live this session); confirms HYG-06 retroactive list for v3.1→HEAD is empty
- `git log -S "gustar"`/`-S "por_para" -- extension/data/es.json` — confirms Phase 32-02 commit `04e0573` is the por/para side-patch; Phase 32-03 SUMMARY confirms gustar_class side-patch

### Secondary (MEDIUM confidence)
- Phase 32-02 SUMMARY — documents that side-patches are mirrored from papertek-vocabulary commits; future sync should be no-op
- Phase 32-03 SUMMARY — documents gustar_class lexical marker landed in papertek-vocabulary commit `9d7b2608`; mirror script `scripts/_apply-gustar-class.js` exists for offline reapplication

### Tertiary (LOW confidence)
- Exact response shape of `papertek-vocabulary.vercel.app/api/vocab/v1/revisions` — not verified by curl this session; HYG-07 script must adapt to observed shape on first run

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; everything is Node stdlib + repo-internal tooling
- Architecture: HIGH — three concrete in-tree exemplars (check-popup-deps, check-explain-contract, check-vocab-seam-coverage)
- Pitfalls: HIGH — drawn from actual repo history (Phase 32 side-patches, Phase 05.1 feature-gating, Phase 30 dep-injection)
- HYG-07 implementation: MEDIUM — Vercel API response shape unverified

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days; in-tree patterns are stable, only HYG-07 external dependency could shift)
