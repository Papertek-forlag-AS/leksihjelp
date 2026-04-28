---
phase: 27-exam-mode
plan: 02
subsystem: release gates
tags: [exam-mode, ci-gate, release-workflow]
requires:
  - Plan 27-01 outputs: rule.exam markers on every spell-rule, extension/exam-registry.js with 10 entries
  - existing release-gate idioms from check-explain-contract.js + check-explain-contract.test.js
provides:
  - scripts/check-exam-marker.js — release gate validating exam markers
  - scripts/check-exam-marker.test.js — paired self-test (4 scenarios)
  - npm scripts: check-exam-marker, check-exam-marker:test
  - CLAUDE.md Release Workflow step 6 (renumbered 6-12 → 7-13)
affects:
  - any future feature added without an exam marker now fails CI hard
  - Plan 27-03 (runtime suppression) can rely on the marker contract being enforced
tech-stack:
  added: []
  patterns:
    - "LEXI_EXAM_MARKER_EXTRA_TARGETS env-var injection seam (matches Phase 26-02 LEXI_PEDAGOGY_GATE_EXTRA_TARGETS)"
    - "os.tmpdir() scratch files for self-test (no repo pollution)"
    - "spawnSync child-process pattern with try/finally cleanup"
key-files:
  created:
    - scripts/check-exam-marker.js
    - scripts/check-exam-marker.test.js
  modified:
    - package.json
    - CLAUDE.md
decisions:
  - "Registry entries require category; rules accept it as optional (but validated against closed set when present). Mirrors the rule-side decision in CONTEXT.md that lookup-shaped rules don't always carry a category yet, while non-rule surfaces in the registry are the strict surface."
  - "Hard-fail by default — no permissive escape hatch (per CONTEXT.md). Missing marker = fail, not skip."
  - "Per-surface markers: rule.explain.exam validated when present, with same shape rules. de-prep-case is the only rule with this today, but the validation generalises."
metrics:
  duration: 2
  completed: "2026-04-28"
  files_created: 2
  files_modified: 2
  scenarios_in_self_test: 4
---

# Phase 27 Plan 02: check-exam-marker Release Gate Summary

Adds the `check-exam-marker` release gate + paired self-test, mirroring the proven `check-explain-contract` + `check-explain-contract:test` pattern. The gate validates that every spell-rule and every entry in `extension/exam-registry.js` carries a well-formed `exam: { safe, reason, category }` marker. The self-test plants malformed/missing/invalid-category scratch rules to prove the gate is not silently permissive, and a well-formed scratch to prove it is not always-failing.

## Final Gate

- **Path:** `scripts/check-exam-marker.js`
- **Exit codes:**
  - `0` — all rules + all registry entries pass.
  - `1` — any rule or registry entry fails. Per-failure diagnostic on stderr in `[FAIL] <rel-path> rule=<rule.id> :: <detail>` format.
- **Current state:** PASS — 62 rules + 10 registry entries validated.
- **Injection seam:** `LEXI_EXAM_MARKER_EXTRA_TARGETS=<comma-separated absolute paths>` appends additional rule files for self-test use. Registry path is fixed (the registry is a single source of truth).

## Self-Test Scenarios

`scripts/check-exam-marker.test.js` plants four scratch rule files in `os.tmpdir()` and spawns the real gate four times via `spawnSync`:

| # | Scenario | Marker shape planted | Gate must |
|---|---|---|---|
| 1 | Malformed marker | `{ safe: 'yes', reason: '' }` (safe is string, reason is empty) | exit 1 + mention `scratch-bad-malformed` |
| 2 | Missing marker entirely | (no `exam` field at all) | exit 1 + mention `scratch-bad-missing` |
| 3 | Invalid category | `{ safe: false, reason: 'x', category: 'made-up-category' }` | exit 1 + mention both `scratch-bad-category` and the offending category value |
| 4 | Well-formed | `{ safe: true, reason: 'scratch-test', category: 'spellcheck' }` | exit 0 |

All four assertions pass. The self-test is its own exit-1 gate when any scenario disagrees with expectations, with stderr diagnostics showing the actual exit code, stderr, and stdout of the offending child process.

## CLAUDE.md Release Workflow

Inserted as step 6 (between `check-network-silence` step 5 and the previous `check-bundle-size` step 6). Subsequent steps renumbered:

- Step count went from 12 to 13.
- Renumbering: 6→7 (bundle-size), 7→8 (baseline-bundle-size), 8→9 (benchmark-coverage), 9→10 (governance-data), 10→11 (version bump), 11→12 (rebuild zip), 12→13 (upload).
- Sequential 1–13 verified via `awk` extraction post-edit.

## Deviations from Plan

None. Plan executed exactly as written.

## Verification

- `node scripts/check-exam-marker.js` → exit 0, "62 rules + 10 registry entries validated"
- `node scripts/check-exam-marker.test.js` → exit 0, "gate fires on malformed/missing/invalid-category, passes on well-formed"
- `npm run check-explain-contract` → PASS 59/59 (no regression in sibling gate)
- `npm run check-rule-css-wiring` → PASS 59/59 (no regression in sibling gate)
- CLAUDE.md numbered list extraction confirms sequential 1–13

## Self-Check: PASSED

- scripts/check-exam-marker.js: FOUND
- scripts/check-exam-marker.test.js: FOUND
- package.json updated with both npm scripts: FOUND
- CLAUDE.md step 6 inserted, downstream renumbered to 13: FOUND
- Commit 89b2201 (gate): FOUND
- Commit dbf6b44 (self-test + registration): FOUND
