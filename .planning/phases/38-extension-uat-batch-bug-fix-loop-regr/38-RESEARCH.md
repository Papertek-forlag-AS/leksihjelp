# Phase 38: Extension UAT Batch + Bug-Fix Loop + REGR — Research

**Researched:** 2026-05-01
**Domain:** UAT walkthrough orchestration + canonical bug-fix loop + regression-artifact discipline (extension hardening, school-year readiness)
**Confidence:** HIGH

## Summary

Phase 38 is procedural, not algorithmic. Phase 37 already shipped every piece of infrastructure this phase needs: the walkthrough/finding templates (HYG-01/02), the `verification_kind: human-browser-walk` auto-pause convention (HYG-03), the `check-version-alignment` + `check-synced-surface-version` release gates (HYG-04/05), the `[lockdown-resync-needed]` commit marker (HYG-06), and `check-vocab-deployment.js` pre-flight (HYG-07). Phase 38's job is to **execute** four browser walkthroughs against that infrastructure, hot-loop the canonical 9-step Fix → Sync → Re-test pattern on whatever defects surface, and ship a regression artifact (fixture or benchmark expectation) for every fix. No new gates, no new templates, no new conventions — only invocation of what exists.

The phase has a fixed-but-conditional shape: 4 known walkthroughs (sequenced warm-up → canonical → highest-stakes → final), 1 known closure task (FIX-04 Phase 27 release-asset upload), and N unknown bug-fix loops where N is determined by what UAT surfaces. The plan structure must accommodate the conditional N without pre-allocating empty plan slots.

**Primary recommendation:** Five anchor plans (one per UAT walkthrough + one for FIX-04 release-asset upload), with bug-fix loops appended as decimal-insert plans (e.g. `38-02.1-PLAN.md`) **after** each walkthrough surfaces defects. Every plan declares `verification_kind: human-browser-walk` in frontmatter where a browser walk is the verification step; `/gsd:auto` will hard-pause on each, by design.

## User Constraints

No CONTEXT.md exists for this phase yet (this RESEARCH.md is the first artifact). The Phase 38 description in ROADMAP.md and the 5 success criteria function as locked decisions for planning purposes. There is no separate `## Decisions / ## Claude's Discretion / ## Deferred Ideas` carve-up to copy verbatim — the planner should treat the 5 SC items as the locked decision set and treat plan structure (count, sequencing, conditional-vs-pre-allocated fix plans) as Claude's discretion within the constraints below.

### Locked Decisions (from ROADMAP Phase 38 SC + STATE v3.2 entry decisions)

1. **Sequencing is fixed:** warm-up (F36-1 fr-aspect-hint) → canonical (Phase 30-01 popup view 9-step) → highest-stakes (Phase 27 exam-mode 9-step) → final (Phase 26 DE Lær mer 4 default-locale + 2 NN/EN locale closing F7). Per STATE: "context-switching wastes warm-up."
2. **Walkthroughs use `.planning/uat/TEMPLATE-walkthrough.md`** instantiated to `.planning/uat/UAT-EXT-XX.md` (instance, not template). Findings use `.planning/uat/TEMPLATE-finding.md` instantiated to `.planning/uat/findings/F38-N.md`.
3. **Bug-fix loop is canonical 9-step:** extension fix (never lockdown direct) → release gates green → version bump 3 places (manifest.json + package.json + backend/public/index.html) → `npm run package` → tag + Release asset. FIX-01 verbatim.
4. **REGR is HARD criterion, no exceptions** (FIX-02): every fix lands a `check-fixtures` fixture OR `benchmark-texts/expectations.json` entry in the same commit (or pre-fix commit). Per STATE: "school-year stakes."
5. **`buildIndexes` regression class defended via canary:** any new index added during a v3.2 fix must gain a population canary in `check-vocab-seam-coverage` (FIX-03 / INFRA-10 extension). Defends Phase 26-01 / 32-01 / 32-03 / F36-1 root cause class.
6. **Phase 27 release-asset upload (FIX-04) closes Release Workflow steps 13-15** for the 2.7.0+ line — concrete known closure task, not conditional.
7. **Production deploys explicitly OUT of scope** (deferred to v3.3 user-gated). This phase touches extension only — never lockdown direct, never Firebase deploy.
8. **`verification_kind: human-browser-walk` MUST appear in frontmatter** of every walkthrough plan. STATE Blockers/Concerns: HYG-03 is the auto-mode unblocker; without frontmatter discipline auto-mode will skip Phase 38 verification (Pitfall 2 root cause).

### Claude's Discretion

- **Plan count and partitioning:** one plan per walkthrough vs one plan for all walkthroughs vs hybrid. Recommendation in Architecture Patterns below.
- **Whether bug-fix plans are pre-allocated or appended after walkthroughs.** Recommendation: append decimal-insert plans (`38-02.1-PLAN.md`) post-walkthrough; do not pre-allocate.
- **FIX-04 plan placement:** discrete plan vs folded into a sweep. Recommendation: discrete plan (it's a known closure task with a clear deliverable, not a conditional outcome).
- **How walker is identified** (frontmatter `walker: TBD` field — fill with "Geir" since user is sole walker per CLAUDE.md userEmail).
- **Whether to wave-parallelise walkthroughs.** Recommendation: NO — walks are sequential by design (sequencing locked above).

### Deferred Ideas (OUT OF SCOPE for Phase 38)

- Lockdown re-pin and sidepanel staging UAT (UAT-LOCK-01..04) → Phase 39
- Production Firebase + hosting deploys (PROD-01/PROD-02) → v3.3 user-gated
- Skriveokt-zero EXAM-09 sync execution → un-defer when consumer ships
- Deploy runbook authoring → Phase 40
- Milestone archive (`/gsd:add-tests`, audit) → Phase 41
- Adding Playwright/Cypress/Puppeteer (REQUIREMENTS Out of Scope: "net-negative at 6-walkthrough scope; can't drive Vipps OIDC or Side Panel; competes with 14-gate trust budget")

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UAT-EXT-01 | F36-1 fr-aspect-hint browser confirm | Walkthrough plan instantiates TEMPLATE-walkthrough.md → `.planning/uat/UAT-EXT-01.md`; warm-up sequence position; verifies passé-composé vs imparfait soft-hint dot + Lær mer panel render in real Chrome |
| UAT-EXT-02 | Phase 26 DE Lær mer (4 default-locale + 2 NN/EN locale) | Walkthrough plan with 6 sub-walks; closes F7 (NN/EN locale Lær mer) carried from Phase 35; final-position by sequencing lock |
| UAT-EXT-03 | Phase 27 exam-mode 9-step walk | Walkthrough plan with locked 9-step shape (toggle on/off, EKSAMENMODUS badge, amber widget border, suppression behavior across rules, lockdown teacher-lock dual mode); highest-stakes position |
| UAT-EXT-04 | Phase 30-01 popup view 9-step walk | Walkthrough plan with locked 9-step shape (load extension, search, lang switch, direction toggle, compound suggestion, Lær mer popover, settings, account section, pause, vocab-updates banner); canonical position |
| FIX-01 | Canonical 9-step Fix → Sync → Re-test loop | Hot-loop pattern in bug-fix decimal-insert plans; sequence locked in Code Examples below |
| FIX-02 | Per-fix regression artifact (HARD) | Each bug-fix plan's must_haves must include a regression artifact assertion; choice tree below (Code Examples → Regression artifact selection) |
| FIX-03 | INFRA-10 canary extension for new buildIndexes | If any v3.2 fix adds a new `buildIndexes` index, that fix's plan must include a canary entry in `scripts/check-vocab-seam-coverage.js` per the Phase 26-01 root-cause class |
| FIX-04 | Phase 27 release-asset upload (2.7.0+ line) | Discrete plan: rebuild zip via `npm run package` at v3.2-head version, upload as GitHub Release asset, close Release Workflow steps 13-15 |

## Standard Stack

### Core (everything already in repo, nothing to install)

| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `.planning/uat/TEMPLATE-walkthrough.md` | Walkthrough instance scaffold | Phase 37-01 deliverable; HYG-01 |
| `.planning/uat/TEMPLATE-finding.md` | Finding instance scaffold | Phase 37-01 deliverable; HYG-02 |
| `gsd-tools.cjs frontmatter get <file> --field verification_kind` | Detect human-browser-walk plans | Phase 37-01 / HYG-03 — auto-mode hard-pause query |
| `npm run check-vocab-deployment` | UAT pre-flight (defends stale-vocab walks) | Phase 37-03 / HYG-07 |
| `npm run check-fixtures` | Per-fix regression test suite | Pre-existing — fixture format under `extension/spell-fixtures/<lang>/<rule>.jsonl` |
| `npm run check-benchmark-coverage` | Alternative regression artifact target | Pre-existing — `benchmark-texts/expectations.json` schema visible at file head |
| `npm run check-vocab-seam-coverage` | Defends silent-empty-index class | Pre-existing — INFRA-10 gate; FIX-03 extends it |
| `npm run check-version-alignment` | Verifies 3-place version bump | Phase 37-02 / HYG-04 — release gate step 14 |
| `npm run check-synced-surface-version` | Forces version bump on synced-surface diffs | Phase 37-02 / HYG-05 — release gate step 15 |
| `npm run package` | Builds extension zip with minified data | Pre-existing — release artifact step 16 |
| `git tag` + GitHub Release | Tag + asset upload | Standard release workflow step 17 |

### Supporting

None. No new dependencies; no new npm scripts; no new templates. Phase 38 is execution against existing infrastructure.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Append decimal-insert bug-fix plans | Pre-allocate N empty fix slots | Pre-allocation forces guessing N; appending matches the conditional nature of UAT-driven fixes. STATE Phase 30/34/35/36 history shows decimal-insert pattern works. |
| Discrete FIX-04 plan | Fold FIX-04 into final-walkthrough plan | Discrete plan is honest about what FIX-04 is — a known closure task, not contingent on UAT outcomes. Folding muddies traceability. |
| One plan per walkthrough (4 plans) | One plan covering all 4 walkthroughs | Per-walkthrough plans match the `verification_kind` frontmatter pattern from Phase 37 (each plan declares its own verification kind). One mega-plan would defeat the auto-pause discipline. |
| `walker: Geir` in frontmatter | `walker: TBD` placeholder | User is sole walker (CLAUDE.md userEmail = geirjr@gmail.com); fill the field. |

## Architecture Patterns

### Recommended Plan Structure for Phase 38

```
.planning/phases/38-extension-uat-batch-bug-fix-loop-regr/
├── 38-RESEARCH.md                  # this file
├── 38-CONTEXT.md                   # (planner emits if needed)
├── 38-01-PLAN.md                   # UAT-EXT-01 (F36-1 fr-aspect-hint warm-up)  → verification_kind: human-browser-walk
├── 38-02-PLAN.md                   # UAT-EXT-04 (Phase 30-01 popup canonical 9-step) → human-browser-walk
├── 38-03-PLAN.md                   # UAT-EXT-03 (Phase 27 exam-mode 9-step highest-stakes) → human-browser-walk
├── 38-04-PLAN.md                   # UAT-EXT-02 (Phase 26 DE Lær mer 4+2 final) → human-browser-walk
├── 38-05-PLAN.md                   # FIX-04 (Phase 27 release-asset upload) → verification_kind: release-asset
└── 38-NN.M-PLAN.md                 # decimal-insert bug-fix plans (appended post-walk)
```

**Five anchor plans = 4 walkthroughs (sequenced) + 1 closure task.** Decimal-insert plans (e.g. `38-02.1`, `38-03.1`) appended only after their parent walkthrough surfaces a defect. Plan numbering reflects sequencing order, NOT requirement-ID order — UAT-EXT-01 maps to plan 01 by happy accident; UAT-EXT-04 (Phase 30-01) maps to plan 02 because canonical is second.

### Pattern 1: Walkthrough plan frontmatter

**What:** Each UAT walkthrough plan declares `verification_kind: human-browser-walk` so `/gsd:auto` hard-pauses.

**When to use:** Every UAT-EXT-* plan in this phase.

**Example (annotated frontmatter shape):**
```yaml
---
phase: 38-extension-uat-batch-bug-fix-loop-regr
plan: 01
type: verify                                # not "execute" — verification IS the plan
wave: 1
depends_on: []                              # walkthroughs are sequenced via plan number, not depends_on
files_modified:
  - .planning/uat/UAT-EXT-01.md             # the instantiated walkthrough log
  - .planning/uat/findings/F38-N.md         # any findings filed (variable count)
autonomous: false                           # human walker required
verification_kind: human-browser-walk       # CRITICAL — HYG-03 auto-pause trigger
requirements: [UAT-EXT-01]
must_haves:
  truths:
    - ".planning/uat/UAT-EXT-01.md exists, instantiated from TEMPLATE-walkthrough.md, with all pre-flight evidence captured (ext_version, idb_revision, preset_profile, browser_version, reload_ts) AND every step records BOTH expected AND observed (empty observed = walk-not-completed)"
    - "If defects observed, F38-N findings filed with regression_fixture_id placeholder set to TBD; the plan terminates without resolving the fixture (decimal-insert fix plan handles that)"
    - "If no defects, walkthrough Outcome section signed off with walker name + ISO-8601 date"
  artifacts:
    - path: ".planning/uat/UAT-EXT-01.md"
      provides: "Walkthrough verification log"
      contains: "Walker signs off:"
---
```

### Pattern 2: Bug-fix decimal-insert plan frontmatter

**What:** Each bug-fix plan addresses one finding via the canonical 9-step loop with a regression artifact.

**When to use:** Appended after any UAT plan surfaces a defect.

**Example shape:**
```yaml
---
phase: 38-extension-uat-batch-bug-fix-loop-regr
plan: 02.1                                   # decimal-insert under parent walkthrough plan
type: execute
wave: 2                                      # later wave than walkthroughs
depends_on: [38-02]                          # parent walkthrough surfaced the finding
files_modified:
  - extension/content/spell-rules/<rule>.js  # the actual fix
  - extension/spell-fixtures/<lang>/<rule>.jsonl  # the regression artifact (fixture path)
  - extension/manifest.json                  # version bump
  - package.json                             # version bump
  - backend/public/index.html                # version bump
  - .planning/uat/findings/F38-N.md          # status: closed + regression_fixture_id resolved
autonomous: true
verification_kind: release-gate-suite        # NOT human-browser-walk — gates auto-verify
requirements: [FIX-01, FIX-02, FIX-03]      # FIX-03 only if buildIndexes touched
must_haves:
  truths:
    - "F38-N finding's regression_fixture_id field resolves to a real, asserting test that fails on un-fixed extension and passes after the fix (or a benchmark-texts/expectations.json entry doing the same)"
    - "All 14 release gates exit 0 (npm run check-fixtures + 13 others per CLAUDE.md Release Workflow)"
    - "extension/manifest.json + package.json + backend/public/index.html versions agree (HYG-04 enforces)"
    - "If a new index was added to buildIndexes during the fix, scripts/check-vocab-seam-coverage.js was extended with a population canary (FIX-03)"
    - "Commit message includes [lockdown-resync-needed] marker if any synced-surface path was touched (HYG-06 convention)"
  artifacts:
    - path: ".planning/uat/findings/F38-N.md"
      provides: "Finding closed, regression_fixture_id resolved"
      contains: "status: closed"
---
```

### Pattern 3: FIX-04 release-asset plan frontmatter

**What:** Closure plan for outstanding Phase 27 release-asset upload — closes Release Workflow steps 13-15 for the 2.7.0+ line.

**Example shape:**
```yaml
---
phase: 38-extension-uat-batch-bug-fix-loop-regr
plan: 05
type: execute
wave: 3                                     # last — depends on all walkthroughs + fixes
depends_on: [38-01, 38-02, 38-03, 38-04]   # plus any 02.1/03.1/etc decimal-inserts
files_modified:
  - dist/leksihjelp-<version>.zip           # rebuilt artifact (gitignored, GitHub Release asset)
  - extension/manifest.json                 # version bump if not already at v3.2-head
  - package.json
  - backend/public/index.html
autonomous: true
verification_kind: release-asset
requirements: [FIX-04]
must_haves:
  truths:
    - "All 14 release gates exit 0"
    - "npm run package produces a zip at the v3.2-head version under the 20 MiB cap (check-bundle-size verifies)"
    - "git tag v<version> exists and points at HEAD"
    - "GitHub Release asset uploaded for v<version> tag (verifiable via gh release view <tag>)"
  artifacts:
    - path: "GitHub Release v<version>"
      provides: "Public release asset"
      contains: "leksihjelp-<version>.zip"
---
```

### Anti-Patterns to Avoid

- **Pre-allocating empty bug-fix plan slots.** Counts depend on walkthrough outcomes; pre-allocation invents work or leaves orphan plans. Use decimal-insert appending instead — the v3.1 Phase 30/34/35/36 history validates the pattern.
- **Folding FIX-04 into a walkthrough plan.** FIX-04 is a known closure task with a measurable outcome (zip on GitHub Releases); it deserves its own plan and traceability row. Folding muddies the milestone audit.
- **Walking without `npm run check-vocab-deployment` first.** Phase 37-03 shipped the script specifically because stale vocab is the #1 v3.1 walkthrough failure mode. Pre-flight section in TEMPLATE-walkthrough.md already enforces this; do not skip.
- **Committing a fix without a regression artifact.** Hard rule, no exceptions (FIX-02 / school-year stakes per STATE). The plan checker should refuse `must_haves` without a regression assertion.
- **Skipping the canary when adding a new `buildIndexes` index.** Phase 26-01 / 32-01 / 32-03 / F36-1 silent-empty-index class — defending the next instance is FIX-03 verbatim.
- **Auto-advancing past a `verification_kind: human-browser-walk` plan.** STATE Blockers/Concerns flags this as the v3.1 deferral root cause. Auto-mode MUST hard-pause; the plan-checker MUST surface the walkthrough requirement.
- **Lockdown direct hot-fixes.** Violates canonical loop (Pitfall 5 per REQUIREMENTS Out of Scope). Always upstream-first; lockdown re-syncs in Phase 39.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser walkthrough automation | Playwright / Cypress / Puppeteer scaffold | Human walker + `.planning/uat/TEMPLATE-walkthrough.md` | REQUIREMENTS Out of Scope: "net-negative at 6-walkthrough scope; can't drive Vipps OIDC or Side Panel; competes with 14-gate trust budget" |
| Walkthrough/finding scaffolds | New template under `.planning/` | `.planning/uat/TEMPLATE-walkthrough.md` + `.planning/uat/TEMPLATE-finding.md` | Phase 37-01 already shipped these (HYG-01/02). Reuse, don't recreate. |
| Auto-pause detection | New convention or signal | `verification_kind: human-browser-walk` frontmatter | Phase 37-01 documented this in CLAUDE.md (HYG-03). Reuse. |
| Stale-vocab pre-flight | Bespoke check in walkthrough notes | `npm run check-vocab-deployment` | Phase 37-03 (HYG-07). Already invoked from TEMPLATE-walkthrough.md pre-flight block. |
| Per-fix regression artifact | Bespoke smoke test | `extension/spell-fixtures/<lang>/<rule>.jsonl` (preferred) OR `benchmark-texts/expectations.json` entry | Existing infrastructure has `npm run check-fixtures` + `npm run check-benchmark-coverage` gates that re-run on every release. Bespoke tests rot. |
| Index population canary | Inline assertion in fix | `scripts/check-vocab-seam-coverage.js` extension | Already gates `buildIndexes` shape; extending it for population checks is INFRA-10's intended evolution per FIX-03. |
| Version-bump enforcement | Manual checklist review | `npm run check-version-alignment` (HYG-04) + `npm run check-synced-surface-version` (HYG-05) | Phase 37-02 release gates fail the build if any of the 3 places drift, or if a synced-surface change ships without a bump. Mechanical enforcement beats prose. |
| Lockdown-resync nudge | Email/ticket | `[lockdown-resync-needed]` commit-message marker (HYG-06) | Documented convention, surfaced as fix-line in HYG-05 failure diagnostic. |

**Key insight:** Phase 38 ships zero new infrastructure. Every problem the phase encounters has a tool already shipped in Phase 37 (or earlier). The planner's job is to wire those tools into plan frontmatter and `must_haves` blocks — nothing else.

## Common Pitfalls

### Pitfall 1: Auto-mode advancing past human-browser-walk plans
**What goes wrong:** `/gsd:auto` runs the plan-checker, sees release gates green, advances to next plan without ever pausing for the actual browser walk. Walkthrough log gets fabricated or skipped entirely.
**Why it happens:** v3.1 root cause — auto-mode had no signal to hard-pause on human verification. STATE Pitfall 2 documents this as the cause of v3.1's six-walkthrough deferral.
**How to avoid:** Every UAT plan MUST declare `verification_kind: human-browser-walk` in frontmatter. The orchestrator queries `gsd-tools.cjs frontmatter get <plan> --field verification_kind` BEFORE advancing and halts on `human-browser-walk`. CLAUDE.md "Auto-mode pause convention" section is the canonical reference.
**Warning signs:** Walkthrough log file timestamps cluster within seconds of each other (real walks take minutes); pre-flight evidence fields are TBD or default values; "observed" lines are empty or copy-pasted from "expected".

### Pitfall 2: Stale vocab data in walkthroughs
**What goes wrong:** Walker tests against extension data files that lag the papertek-vocabulary HEAD; defects look like extension bugs but are actually data gaps already fixed upstream.
**Why it happens:** STATE v3.2 entry decision: HYG-07 vocab pre-flight is hard pre-condition for UAT specifically because of this class.
**How to avoid:** TEMPLATE-walkthrough.md's pre-flight section requires `node scripts/check-vocab-deployment.js` exit 0 before the walk starts. The walker pastes script output into the log. Skipping pre-flight = walk-not-completed.
**Warning signs:** Defects map to known papertek-vocabulary issues already closed; `extension/data/<lang>.json` mtime older than upstream vocab HEAD commit.

### Pitfall 3: Bug fix lands without regression artifact
**What goes wrong:** Walker observes defect, developer ships fix, commit goes green on existing gates, but no test asserts the regression. Future refactor silently re-introduces the bug.
**Why it happens:** Time pressure; assumption that "the fix is obvious" makes a regression test feel redundant.
**How to avoid:** FIX-02 is HARD criterion (school-year stakes per STATE). Each bug-fix plan's `must_haves.truths` MUST include the regression-artifact assertion (see Code Examples → Regression artifact selection). The finding's `regression_fixture_id` frontmatter field MUST resolve to a real path.
**Warning signs:** Finding file's `regression_fixture_id` stays as `TBD` after the fix is committed; commit diff modifies a rule file but does not modify any `*.jsonl` under `extension/spell-fixtures/` or `benchmark-texts/expectations.json`.

### Pitfall 4: New buildIndexes index added without canary
**What goes wrong:** Fix adds a new index to `buildIndexes` (e.g. `frPasseComposeForms`), seam wires it through, but `check-vocab-seam-coverage` doesn't assert population — index ships empty, rule silently passes fixtures (Node test stub) but fails in browser.
**Why it happens:** Phase 26-01 / 32-01 / 32-03 / F36-1 root-cause class. v2.9.15 fixed the seam shape but didn't add population canaries.
**How to avoid:** FIX-03 / INFRA-10 extension. Any plan touching `buildIndexes` MUST extend `scripts/check-vocab-seam-coverage.js` with a population canary for the new index — not just shape coverage.
**Warning signs:** New `*Forms` / `*Pedagogy` / `*Index` map added to vocab-seam-core.js without a corresponding diff in `scripts/check-vocab-seam-coverage.js`.

### Pitfall 5: Direct lockdown hot-fix
**What goes wrong:** Walker observes defect in lockdown sidepanel, fixes `lockdown/public/leksihjelp/*.js` directly, never ports upstream. Next `npm install` over there silently reverts the fix.
**Why it happens:** Lockdown sidepanel is the visible surface; it's tempting to fix where the bug shows.
**How to avoid:** REQUIREMENTS Out of Scope explicitly forbids this. Every UAT-surfaced fix lands in `extension/`, ships through the canonical 9-step loop, then Phase 39 re-syncs lockdown.
**Warning signs:** Commit modifies `lockdown/public/leksihjelp/` paths from inside this repo (impossible — they're in a sibling repo) — but the equivalent shape is a fix that bypasses `extension/content/` and lands somewhere downstream-only. Phase 38 only touches `extension/`.

### Pitfall 6: Sequencing inversion
**What goes wrong:** Planner orders walkthroughs by requirement-ID number (UAT-EXT-01 → 02 → 03 → 04) instead of warm-up → canonical → highest-stakes → final.
**Why it happens:** Requirement IDs look authoritative; numerical order feels natural.
**How to avoid:** STATE v3.2 entry decision locks the sequence as F36-1 fr-aspect-hint (UAT-EXT-01) → Phase 30-01 popup view (UAT-EXT-04) → Phase 27 exam-mode (UAT-EXT-03) → Phase 26 DE Lær mer (UAT-EXT-02). Plan numbers follow sequence order; requirement IDs do NOT determine plan numbers.
**Warning signs:** Plan 01 is anything other than fr-aspect-hint; plan 04 is anything other than DE Lær mer.

## Code Examples

### Detecting verification_kind in auto-mode (HYG-03 query mechanism)

```bash
# Source: CLAUDE.md "Auto-mode pause convention: verification_kind: human-browser-walk"
node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get \
  .planning/phases/38-extension-uat-batch-bug-fix-loop-regr/38-01-PLAN.md \
  --field verification_kind
# Returns: "human-browser-walk"  → orchestrator halts
# Returns: null                    → orchestrator advances
```

### Walkthrough instantiation (planner step, before walker starts)

```bash
# Copy template to instance — never edit the template directly
cp .planning/uat/TEMPLATE-walkthrough.md .planning/uat/UAT-EXT-01.md
# Walker fills frontmatter: ext_version, idb_revision, preset_profile,
# browser_version, reload_ts, walker (= "Geir"), date (= ISO-8601 today).
```

### Finding instantiation (walker step, on defect observation)

```bash
# F38-N where N is next sequence number (F38-1, F38-2, …) per HYG-02
mkdir -p .planning/uat/findings
cp .planning/uat/TEMPLATE-finding.md .planning/uat/findings/F38-1.md
# Fill: f_id (F38-1), severity, sync_status, walkthrough_id, discovered.
# regression_fixture_id stays TBD until the fix plan resolves it.
```

### Canonical 9-step Fix → Sync → Re-test loop (FIX-01 verbatim)

```bash
# Step 1: Land the extension fix
$EDITOR extension/content/spell-rules/<rule>.js
# Step 2: Land the regression artifact in the SAME commit
$EDITOR extension/spell-fixtures/<lang>/<rule>.jsonl  # add failing case (or)
$EDITOR benchmark-texts/expectations.json             # add expectation entry

# Step 3: Run all 14 release gates (CLAUDE.md Release Workflow)
npm run check-fixtures && \
npm run check-explain-contract && \
npm run check-rule-css-wiring && \
npm run check-spellcheck-features && \
npm run check-network-silence && \
npm run check-exam-marker && \
npm run check-popup-deps && \
npm run check-bundle-size && \
npm run check-baseline-bundle-size && \
npm run check-benchmark-coverage && \
npm run check-governance-data && \
npm run check-vocab-seam-coverage && \
npm run check-version-alignment && \
npm run check-synced-surface-version

# Step 4: Bump version in 3 places (HYG-04 will fail the gate if you forget one)
npm version patch  # bumps package.json + creates git tag
$EDITOR extension/manifest.json     # bump "version"
$EDITOR backend/public/index.html   # bump "Versjon X.Y.Z"

# Step 5: Re-run alignment gate
npm run check-version-alignment

# Step 6: Build the package
npm run package

# Step 7: Commit (include [lockdown-resync-needed] if synced surface touched)
git commit -am "fix(<rule>): <one-line>

[lockdown-resync-needed]   # only if extension/content/, popup/views/, exam-registry.js,
                            # styles/content.css, data/, or i18n/ touched

Closes F38-N."

# Step 8: Tag (npm version already did this, but re-tag if needed)
git tag -a v<version> -m "v<version>"
git push origin main --tags

# Step 9: Upload zip as GitHub Release asset
gh release create v<version> dist/leksihjelp-<version>.zip --notes "<release notes>"
```

### Regression artifact selection (FIX-02 decision tree)

```
Is the bug a token-level mistake on a specific input string?
├── YES → Add a fixture row to extension/spell-fixtures/<lang>/<rule>.jsonl
│         Format: {"in":"<input>","expect":[{"id":"<rule-id>","range":[s,e]}]}
│         Verified by: npm run check-fixtures
└── NO → Is it a benchmark-text-paragraph-level expectation?
          ├── YES → Add entry to benchmark-texts/expectations.json
          │         Format: "<lang>.<line>": {"rule_id":"<rule>","severity":"warning|hint|error","priority_band":"P1|P2|P3"}
          │         Verified by: npm run check-benchmark-coverage
          └── NO → Pause. If neither tool fits, the bug class is novel.
                   Surface it to the user — do NOT ship the fix without REGR.
                   FIX-02 is HARD; "I couldn't find a fit" is a planning failure,
                   not a license to skip the artifact.
```

### Adding a population canary for a new buildIndexes index (FIX-03)

```javascript
// Source: scripts/check-vocab-seam-coverage.js (existing structure)
// Pattern: when a fix adds a new index (e.g. `frConditionnelForms`),
// extend the canary list to assert non-empty population in the seam-wrapped object.
// Reference: Phase 26-01 / 32-01 / 32-03 / F36-1 silent-empty-index root-cause class.

const POPULATION_CANARIES = [
  // existing entries…
  {
    index: 'frConditionnelForms',          // the new buildIndexes key
    seamGetter: 'getFrConditionnelForms',  // the vocab-seam.js getter (PascalCase, FIX-03 GETTER_OVERRIDES if non-default)
    minSize: 5,                             // smallest reasonable population
    sampleKey: 'aurais',                    // a known-present key
    sourceFix: 'F38-N',                     // back-reference to the finding that prompted this canary
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-mode advances past human verification | `verification_kind: human-browser-walk` hard-pauses orchestrator | Phase 37-01 (2026-05-01) | v3.2 walkthroughs cannot be silently skipped |
| Walkthroughs ad-hoc, no template | TEMPLATE-walkthrough.md + TEMPLATE-finding.md | Phase 37-01 (2026-05-01) | Pre-flight evidence + numbered observables + finding traceability locked as repo standard |
| Stale-vocab walks blamed on "extension bug" | `npm run check-vocab-deployment` pre-flight | Phase 37-03 (2026-05-01) | Stale-data class caught before the walk |
| Version drift across 3 places shipped silently | `check-version-alignment` (HYG-04) | Phase 37-02 (2026-05-01) | Mechanical enforcement, no prose checklist |
| Synced-surface change ships without lockdown signal | `check-synced-surface-version` (HYG-05) + `[lockdown-resync-needed]` marker (HYG-06) | Phase 37-02/04 (2026-05-01) | Downstream consumers (lockdown webapp, skriveokt-zero) get a deterministic re-sync trigger |
| `buildIndexes` regressions caught only in-browser | `check-vocab-seam-coverage` shape gate | Phase 26-01 + v2.9.15 + Phase 36-02 | Three more silent-empty-index classes caught on first run; FIX-03 extends to population canaries |

**Deprecated/outdated:**
- Pre-Phase-37 walkthrough patterns (informal step lists, no pre-flight, no `verification_kind` frontmatter) — superseded by HYG-01/02/03 templates.
- Pre-HYG-04 manual version-bump verification — superseded by `check-version-alignment` release gate.
- Pre-HYG-06 informal "remember to bump for lockdown" — superseded by `[lockdown-resync-needed]` commit-message marker enforced via HYG-05.

## Open Questions

1. **Plan-numbering for decimal inserts when multiple defects surface in one walkthrough.**
   - What we know: Phase 30/34/35/36 used decimal-insert pattern for follow-up plans.
   - What's unclear: If walkthrough 38-02 surfaces 3 defects, are they 38-02.1 / 38-02.2 / 38-02.3 (parallel siblings under parent), or 38-02.1 / 38-02.1.1 / 38-02.1.2 (nested)?
   - Recommendation: Parallel siblings (38-02.1, 38-02.2, 38-02.3) — simpler dependency graph, easier traceability. Nested only if a fix transitively spawns another finding.

2. **Plan-checker behaviour when `verification_kind: human-browser-walk` is encountered with `autonomous: false`.**
   - What we know: HYG-03 documented in CLAUDE.md says auto-mode hard-pauses.
   - What's unclear: Does the plan-checker also run release gates against the walkthrough plan (which doesn't ship code), or does it skip gates and only verify artifact presence (UAT-EXT-XX.md exists, frontmatter complete)?
   - Recommendation: For walkthrough plans, the plan-checker verifies (a) instantiated walkthrough log exists, (b) every step has both expected AND observed filled, (c) any ❌ has a corresponding F38-N file, (d) Walker signs off with name + date. Release gates do NOT need to run on a plan that ships zero extension code.

3. **Wave numbering when fix plans depend on walkthroughs.**
   - What we know: Walkthroughs in wave 1; fixes in wave 2; FIX-04 closure in wave 3.
   - What's unclear: Whether mid-walkthrough fixes (e.g. fix discovered during 38-02 needs to land before 38-03 starts to avoid contaminating exam-mode walk) require finer wave granularity.
   - Recommendation: Default to 3-wave model. If a defect is severity:blocker AND inter-walkthrough-blocking (e.g. exam-mode-breaking fix found during 38-02 popup walk would block 38-03 exam-mode walk), promote that fix to wave 1.5 with explicit `depends_on` + sequenced before the next walkthrough's wave.

4. **Whether `verification_kind: release-asset` is a real value or invented for this RESEARCH.**
   - What we know: HYG-03 documents `human-browser-walk` as a value; Phase 37-01 didn't enumerate other values.
   - What's unclear: Is FIX-04's release-asset-upload plan also a special verification kind, or is it just `verification_kind: null` (regular execute plan)?
   - Recommendation: Treat FIX-04 as a regular execute plan — `verification_kind` field omitted (null). The 14 release gates plus `gh release view <tag>` smoke is sufficient verification; no new kind needed. (Adjust the FIX-04 frontmatter example above accordingly.)

## Validation Architecture

> Skipped per `.planning/config.json` — `workflow.nyquist_validation` is not set / not enabled. The release-gate suite (14 entries) IS the validation architecture for this project; per-plan Nyquist mapping is not in use.

## Sources

### Primary (HIGH confidence)
- `.planning/STATE.md` (read in full) — v3.2 entry decisions, sequencing lock, Pitfall 2 root cause
- `.planning/ROADMAP.md` (read in full) — Phase 38 SC items 1-5, requirements coverage table
- `.planning/REQUIREMENTS.md` (read in full) — UAT-EXT-01..04, FIX-01..04 verbatim, Out of Scope, traceability
- `.planning/uat/TEMPLATE-walkthrough.md` (read in full) — frontmatter shape, pre-flight block, step shape
- `.planning/uat/TEMPLATE-finding.md` (read in full) — F-id pattern, regression_fixture_id HARD requirement
- `CLAUDE.md` (loaded via system-reminder) — Release Workflow 14 gates verbatim, Auto-mode pause convention, synced-surface convention, downstream consumers
- `.planning/deferred/lockdown-resync-pending.md` (read in full) — retroactive scan empty as of 2026-05-01; convention starts clean for v3.2
- `.planning/phases/37-hygiene-templates-pre-flight/37-01-PLAN.md` (head 40 lines) — frontmatter pattern reference
- `benchmark-texts/expectations.json` (head) — schema for FIX-02 alternative artifact path

### Secondary (MEDIUM confidence)
- Phase numbering convention inferred from `.planning/phases/` directory listing — decimal-insert pattern (`02.1`, `05.1`, `15.1`, `21.1`, `21.2`, `28.1`, `30-01..04`, `30-02`) consistent across 37 phases
- Auto-memory `feedback_fewer_phases.md` referenced via STATE — single-phase consolidation justified

### Tertiary (LOW confidence)
- None. Every claim in this RESEARCH is grounded in repo files or CLAUDE.md.

## Metadata

**Confidence breakdown:**
- Plan structure recommendation: HIGH — directly derived from STATE sequencing lock + Phase 30/34/35/36 decimal-insert pattern history
- Frontmatter shapes: HIGH — Phase 37-01 plan and TEMPLATE files are explicit; `verification_kind` enumeration documented
- Canonical 9-step loop: HIGH — FIX-01 + Release Workflow steps verbatim from CLAUDE.md and REQUIREMENTS.md
- Regression artifact decision tree: HIGH — `extension/spell-fixtures/` + `benchmark-texts/expectations.json` are the only two existing regression-test surfaces with active gates
- Open Question 4 (release-asset verification_kind): MEDIUM — recommendation is to omit the field; if HYG-03 enumerates additional kinds in the future, adjust

**Research date:** 2026-05-01
**Valid until:** Phase 38 plan files emitted (this RESEARCH directly supplies CONTEXT.md inputs and per-plan must_haves; no separate decay window — consume immediately).
