---
phase: 05-student-experience-polish
plan: 01
subsystem: infra
tags: [spell-check, release-gates, i18n, explain-contract, xss, ux-01, ux-02]

# Dependency graph
requires:
  - phase: 03-rule-architecture-ranking-quality
    provides: "INFRA-03 plugin registry (spell-rules/ directory + self-registering IIFE files + __lexiSpellCore dual-export api)"
  - phase: 03-rule-architecture-ranking-quality
    provides: "scripts/check-network-silence.js pattern for self-tested release gates"
  - phase: 04-false-positive-reduction-nb-nn
    provides: "Plan 04-03 THRESHOLDS table pattern for fail-loud per-rule gates"
provides:
  - "escapeHtml exported on self.__lexiSpellCore — Node-safe, XSS-escape primitive for rule explain() builders"
  - "scripts/check-explain-contract.js — Phase 5 / UX-01 release gate asserting rule.explain is a callable returning {nb, nn} strings for the 5 popover-surfacing rules"
  - "scripts/check-explain-contract.test.js — paired self-test proving gate fires on broken explain + passes on well-formed explain"
  - "i18n keys settings_spellcheck_alternates_title/_toggle/_note (NB + NN) — Plan 05 consumes"
  - "i18n keys pred_vis_flere / pred_vis_faerre (NB + NN) — Plan 04 consumes"
  - "COPY-REVIEW.md scaffold — 5-row review table + tone-check checklist Plan 02 populates and Plan 03 reviews"
  - "spell-rules/README.md explain-contract section — Pitfall-1 priority-disambiguation doc, XSS-escape rule doc, suppression-rule exemption doc"
  - "CLAUDE.md Release Workflow step 2 — check-explain-contract + :test wired as must-exit-0 gates"
affects: [05-02, 05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-tested release-gate pattern continues: check-explain-contract.js + .test.js mirror check-network-silence.js + .test.js"
    - "Plant-both-broken-and-fixed self-test pattern — gate proves it distinguishes shape violations from shape-correct rules (stronger than plant-broken-only)"
    - "Node -e source injection pattern — self-test rewrites gate TARGETS + ROOT via regex to isolate scratch-file validation without touching the gate source"
    - "Explain callable contract — (finding) => ({nb, nn}) per-register strings with escapeHtml mandatory on interpolated tokens"

key-files:
  created:
    - "scripts/check-explain-contract.js"
    - "scripts/check-explain-contract.test.js"
    - ".planning/phases/05-student-experience-polish/COPY-REVIEW.md"
  modified:
    - "extension/content/spell-check-core.js"
    - "extension/content/spell-rules/README.md"
    - "extension/i18n/strings.js"
    - "package.json"
    - "CLAUDE.md"

key-decisions:
  - "Self-test uses 'plant broken + plant fixed' dual assertion (not the plant-broken-only check-network-silence.test.js pattern) — tighter belt-and-braces: catches both silently-permissive regex drift AND the opposite failure mode of gate becoming too strict."
  - "Self-test invokes gate via `node -e` with regex-rewritten TARGETS (isolated to scratch file only) + pinned ROOT — because the gate fails fast on first failure, and the 5 real target rules today all fail with string explain. Isolating the scratch via TARGETS-replacement lets the self-test specifically assert the gate's validation logic on the scratch file alone."
  - "escapeHtml in spell-check-core.js uses String.replace (not document.createElement) — dual-context compatible: runs in both Node fixture harness and browser content-script. spell-check.js has its own DOM-based escapeHtml at line 565 which stays in place (Plan 03 may consolidate; out of scope here)."
  - "Pitfall-1 priority disambiguation documented in spell-rules/README.md — because nb-typo-curated (priority 40) and nb-typo-fuzzy (priority 50) both emit rule_id='typo', Plan 05-02 findings MUST carry priority:<rule.priority> so the renderer can route to the correct explain() callable."
  - "Plan 05-01 lands infrastructure BEFORE any rule-file edit — intentional: Plans 02/03/04/05 can land concurrently in Wave 2 with commit-time contract enforcement from the check-explain-contract gate."

patterns-established:
  - "Contract-gate-before-upgrade pattern: when multiple plans will land shape changes concurrently, ship the gate first so the contract is enforced at commit time for every Wave-2 plan."
  - "Dual-scenario self-test: plant-broken + plant-fixed, both assertions required — catches silently-permissive AND overly-strict gate failure modes."
  - "Source-injection self-test technique: regex-rewrite gate TARGETS + ROOT via `node -e` to isolate scratch validation when the gate would otherwise fail-fast on pre-existing rules."

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 7 min
completed: 2026-04-20
---

# Phase 05 Plan 01: Foundation — explain contract + infrastructure Summary

**Phase 5 foundation plan — escapeHtml exported on core, check-explain-contract gate + self-test landed, i18n keys seeded for Plans 04/05, COPY-REVIEW scaffold + spell-rules/README.md contract docs + CLAUDE.md Release Workflow all shipped BEFORE any rule-file edit, so Wave-2 plans (02/03/04/05) land with commit-time contract enforcement.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-20T19:56:54Z
- **Completed:** 2026-04-20T20:04:40Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `escapeHtml` helper added to `extension/content/spell-check-core.js` and exported on `self.__lexiSpellCore` (dual-export: Node + browser content-script). Node-safe String.replace implementation; rule files can destructure in their IIFE preamble.
- `scripts/check-explain-contract.js` — Phase 5 / UX-01 release gate. Loads the 5 popover-surfacing rules (nb-gender, nb-modal-verb, nb-sarskriving, nb-typo-curated, nb-typo-fuzzy) and asserts `rule.explain` is a callable returning `{nb: string, nn: string}` with non-empty strings for both registers. Excludes suppression rules (nb-codeswitch, nb-propernoun-guard). Today exits 1 as designed (rules still carry legacy string explain); Plan 05-02 flips them to the callable shape so the gate exits 0.
- `scripts/check-explain-contract.test.js` — paired self-test. Plants a broken scratch rule (string explain), asserts gate exits 1 with EXPLAIN_NOT_CALLABLE diagnostic on scratch file; plants a well-formed scratch rule (`{nb, nn}` callable), asserts gate exits 0. Dual-scenario belt-and-braces against silently-permissive AND overly-strict failure modes.
- `package.json` — `check-explain-contract` + `check-explain-contract:test` npm scripts wired.
- `CLAUDE.md` Release Workflow — new step 2 (check-explain-contract + :test) inserted between check-fixtures (step 1) and check-network-silence (renumbered step 3); bundle-size → 4, version bump → 5, rebuild → 6, GitHub Release → 7.
- `extension/i18n/strings.js` — 10 new entries across both nb and nn locale blocks: `settings_spellcheck_alternates_title/_toggle/_note` (Plan 05 settings toggle) and `pred_vis_flere` / `pred_vis_faerre` (Plan 04 "Vis flere" link). NB uses NB morphology, NN uses NN morphology (gongen/staden/berre/fleire).
- `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` scaffold — 5-row Copy Table (one per popover-surfacing rule) + dyslexia-persona proxy tone-check checklist (≤15 words, second-person "du", no jargon, escapeHtml audit, NN morphology guard) + review log stub. Plan 02 populates; Plan 03 runs the proxy review.
- `extension/content/spell-rules/README.md` — new section documenting (a) the explain: `{nb, nn}` callable shape with concrete before/after example, (b) Pitfall-1 priority disambiguation rule for shared rule_id='typo' findings, (c) mandatory escapeHtml on any HTML-interpolated token with do/don't XSS example, (d) suppression-rule exemption (nb-codeswitch, nb-propernoun-guard stay on string explain since they never surface to the popover), (e) CI enforcement pointer to check-explain-contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose escapeHtml on __lexiSpellCore + document in spell-rules/README.md** — `1328317` (feat)
2. **Task 2: Author check-explain-contract gate + paired self-test + package.json wiring + CLAUDE.md Release Workflow** — `9a23d09` (feat)
3. **Task 3: Seed i18n keys + COPY-REVIEW.md scaffold** — `0f033f2` (feat)

## Files Created/Modified

- `extension/content/spell-check-core.js` — Added `escapeHtml(s)` helper (Node-safe String.replace escaping `& < > " '`); added `escapeHtml` to the dual-export `api` object so rule files can destructure via `host.__lexiSpellCore`. Line count 280 → 298.
- `extension/content/spell-rules/README.md` — Appended new "Explain contract" section covering callable shape, Pitfall-1 priority disambiguation, XSS-escape rule, suppression-rule exemption, CI enforcement.
- `scripts/check-explain-contract.js` — NEW. Zero-dep Phase 5 release gate. Iterates 5 target rules, resets globals/require-cache between loads, asserts callable-with-{nb,nn}-strings contract. Exit 0/1 with diagnostic line.
- `scripts/check-explain-contract.test.js` — NEW. Paired self-test planting broken-then-fixed scratch rules; confirms gate distinguishes the two cases.
- `package.json` — Added `check-explain-contract` + `check-explain-contract:test` npm scripts alongside existing `check-*` entries.
- `CLAUDE.md` — Release Workflow step 2 added (check-explain-contract + :test); steps 2-6 renumbered to 3-7.
- `extension/i18n/strings.js` — 10 new entries (3 settings keys + 2 pred keys, ×2 locales). NB + NN morphology handled per-locale.
- `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — NEW. Plan 02 populates copy cells; Plan 03 reviews via checklist.

## Decisions Made

- **Self-test uses dual-scenario (plant broken + plant fixed) instead of check-network-silence.test.js's single-scenario pattern.** check-network-silence works in a world where the real gate passes baseline; the self-test plants a failure and removes it. The explain-contract gate CANNOT pass baseline today (5 rules still have string explain, Plan 05-02 flips them). So the self-test isolates a scratch file via TARGETS-rewrite and proves the gate specifically accepts the well-formed shape AND specifically rejects the broken shape — both directions matter.
- **Source-injection via `node -e` for self-test invocation.** Rewriting the gate's `TARGETS` array and pinning `ROOT` via regex substitution in the gate source, then executing with `node -e <rewritten_source>`, preserves the real gate file byte-identical while letting the self-test isolate scratch-file validation. Alternative approaches considered: (a) adding an env-var escape hatch in the gate (adds production complexity for test-only use), (b) spawning the gate from a temp dir (harder to keep the gate resolving real relative paths), (c) monkey-patching require() (fragile across Node versions). Source injection is cleanest.
- **escapeHtml in core uses String.replace, not document.createElement.** Dual-context execution requirement: the helper must run in both the browser (DOM available) AND the Node fixture harness (no DOM). Plan 03 may consolidate with spell-check.js's own DOM-based escapeHtml but that's out of scope.
- **Pitfall-1 priority field addition deferred to Plan 05-02.** The new contract requires findings to carry `priority:<rule.priority>` for disambiguation. The gate's validateRule passes a fakeFinding including `priority`, but the emitted-finding update is a Plan 05-02 concern touching the rule `check()` bodies.
- **Contract-gate-before-upgrade ordering.** This plan lands the gate BEFORE Plan 05-02's rule-file upgrade by design — Plans 02/03/04/05 can then land concurrently in Wave 2 with commit-time contract enforcement. If the gate landed alongside the upgrade, Wave-2 would have no CI-enforced contract drift detection during its own landing window.

## Deviations from Plan

None - plan executed exactly as written.

The plan itself anticipated one wrinkle: the plan's suggested automated verify command for Task 1 used `grep -q "explain: { nb, nn }"` against README.md, which matched exactly because the new contract section heading is `## Explain contract — \`explain: { nb, nn }\` callable (Phase 5 / UX-01)`. No rewording needed.

One minor implementation refinement within Task 2 (not a deviation — just problem-solving during the task): the plan's suggested self-test pattern followed check-network-silence.test.js verbatim, which presumes a passing baseline. The explain-contract gate CANNOT pass baseline today (5 rules still have string explain — that's the whole point of this plan). The self-test therefore uses a TARGETS-injection approach to isolate a scratch rule's validation, keeping the test assertions shape-focused rather than exit-code-of-full-gate focused. This is documented in the self-test's file header.

## Issues Encountered

- **Initial self-test iteration failed due to gate fail-fast behavior on pre-existing rules.** First self-test draft appended scratch file to TARGETS via regex injection. But when run, the gate hit `nb-gender.js` first (string explain) and failed-fast before ever reaching the scratch — the planted failure was real, just invisible behind an earlier failure. Resolution: replaced TARGETS entirely (scratch as sole target) so the self-test specifically exercises the gate's validation logic on the scratch file alone. Self-test now correctly asserts both broken (exit 1) and fixed (exit 0) scenarios. Not a deviation — this was expected iteration during a new-gate authoring task.
- **`node -e` ROOT pinning needed.** The injection approach spawns the gate via `node -e <rewritten_source>`, where `__dirname` resolves to cwd (project root) rather than `scripts/`. The original gate computes `ROOT = path.join(__dirname, '..')` which becomes the parent of project root — wrong. Fix: the self-test also regex-rewrites `ROOT` to an explicit absolute path via `JSON.stringify`. Documented inline in the self-test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 5 Wave 2 is fully unblocked.** Every Wave-2 plan (05-02, 05-03, 05-04, 05-05) has:
- The `escapeHtml` primitive to XSS-safely interpolate user-typed tokens inside `<em>` (UX-01 requirement).
- The `check-explain-contract` gate catching shape drift at commit time — a Wave-2 plan that ships a half-upgraded rule will fail the release gate immediately.
- The `i18n` keys it references already seeded in both registers (05's settings toggle, 04's "Vis flere" link).
- The `COPY-REVIEW.md` scaffold awaiting Plan 02's copy cells and Plan 03's proxy review.
- The `spell-rules/README.md` documentation for the contract — Wave-2 rule authors can reference the do/don't XSS example and the priority-disambiguation rule directly.
- The `CLAUDE.md` Release Workflow listing check-explain-contract as step 2, so release time automatically enforces the contract.

**Plan 05-02 starts from:** check-explain-contract today exits 1 because rules still have string explain. Plan 05-02 upgrades nb-gender, nb-modal-verb, nb-sarskriving, nb-typo-curated, nb-typo-fuzzy to `(finding) => ({nb, nn})` shape AND adds `priority:<rule.priority>` to emitted findings. At end of Plan 05-02 the gate flips to exit 0 — the acceptance signal.

**No blockers or concerns.** The 3 release gates (check-fixtures, check-network-silence, check-bundle-size) all still exit 0. The new check-explain-contract gate exits 1 by design today and will flip to 0 when Plan 05-02 lands.

---
*Phase: 05-student-experience-polish*
*Completed: 2026-04-20*

## Self-Check: PASSED

Files verified on disk:
- FOUND: extension/content/spell-check-core.js (298 lines, `escapeHtml` in api object)
- FOUND: extension/content/spell-rules/README.md (contains "Explain contract" section + 9 escapeHtml mentions)
- FOUND: scripts/check-explain-contract.js (gate exits 1 today, correctly flagging pre-Plan-05-02 string explains)
- FOUND: scripts/check-explain-contract.test.js (self-test exits 0, dual broken+fixed scratch assertions)
- FOUND: package.json (check-explain-contract + :test scripts wired)
- FOUND: CLAUDE.md (check-explain-contract mentioned 2x in Release Workflow)
- FOUND: extension/i18n/strings.js (6 settings_spellcheck_alternates entries + 2 each pred_vis_flere/pred_vis_faerre)
- FOUND: .planning/phases/05-student-experience-polish/COPY-REVIEW.md (Copy Table + Tone-check checklist)

Commits verified:
- FOUND: 1328317 (Task 1)
- FOUND: 9a23d09 (Task 2)
- FOUND: 0f033f2 (Task 3)

Release gates verified:
- PASS: `npm run check-fixtures` — 280/280 (no fixture regression)
- EXIT 1 (expected): `node scripts/check-explain-contract.js` — rules still have string explain today; Plan 05-02 flips to exit 0
- PASS: `npm run check-explain-contract:test` — self-test correctly distinguishes broken vs fixed scratch
- PASS: `npm run check-network-silence` — no network surface added
- VERIFIED: `escapeHtml` wired through dual-export (`&lt;` → `&amp;lt;`, `a<b>c` → `a&lt;b&gt;c`)
