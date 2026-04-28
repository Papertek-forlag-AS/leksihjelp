---
phase: 26-laer-mer-pedagogy-ui
plan: 02
subsystem: release-gates
tags: [pedagogy, contract, release-gate, ped-06]
requires:
  - extension/content/spell-rules/*.js (target rule loader)
  - extension/content/spell-check-core.js (core helpers)
provides:
  - npm run check-pedagogy-shape (release-time pedagogy contract enforcement)
  - npm run check-pedagogy-shape:test (paired self-test of the gate)
affects:
  - Release workflow (CLAUDE.md will gain a step entry once this gate is hooked into the release checklist; out-of-scope for plan 26-02)
tech-stack:
  added: []
  patterns:
    - Mirrors check-explain-contract.js TARGETS list, helpers, fail() format
    - Uses env-var injection (LEXI_PEDAGOGY_GATE_EXTRA_TARGETS) instead of source mutation for self-test target injection
key-files:
  created:
    - scripts/check-pedagogy-shape.js
    - scripts/check-pedagogy-shape.test.js
  modified:
    - package.json
decisions:
  - Use env-var injection rather than regex-replace of TARGETS source (avoids the explain-contract test's fragility)
  - Keep gate informational (exit 0 with explicit message) when no rule emits pedagogy yet, so it can land before plan 26-01 wires de-prep-case
  - Drive rule.check() with a synthetic ctx; treat thrown rules as out-of-scope (check-fixtures owns runtime safety)
metrics:
  duration: ~15min
  completed: 2026-04-28
---

# Phase 26 Plan 02: check-pedagogy-shape Release Gate Summary

Adds a structural release gate enforcing the pedagogy block contract on rule findings, paired with a self-test that proves the gate isn't silently permissive.

## What shipped

- **`scripts/check-pedagogy-shape.js`** (361 lines) — loads each rule in TARGETS, drives `rule.check(ctx)` with a synthetic ctx whose `vocab.prepPedagogy` Map carries a known-valid block, and validates every `pedagogy` field on findings against the contract: case enum (`akkusativ | dativ | wechsel | genitiv`), `summary.{nb,nn,en}`, `explanation.{nb,nn,en}`, optional `examples[]`, conditional `wechsel_pair`, optional `colloquial_note`, optional `contraction`. Mirrors `check-explain-contract.js` style.
- **`scripts/check-pedagogy-shape.test.js`** (192 lines) — paired self-test that plants four scratch rule shapes (bad case, bad summary, wechsel-without-pair, well-formed) and asserts the gate fires/passes correctly. Uses the `LEXI_PEDAGOGY_GATE_EXTRA_TARGETS` env hook to inject the scratch path.
- **`package.json`** — adds `check-pedagogy-shape` and `check-pedagogy-shape:test` adjacent to the existing explain-contract entries.

## Gate behavior

| State | Exit | Output |
|-------|------|--------|
| Pre-26-01 (no rule emits pedagogy) | 0 | `[check-pedagogy-shape] PASS: no rules emit pedagogy yet — informational` |
| Post-26-01, all blocks valid | 0 | `[check-pedagogy-shape] PASS: validated N pedagogy blocks across M rules` |
| Any block invalid | 1 | `[check-pedagogy-shape] FAIL: <CODE> <rule-id> <path> :: <detail>` |

Today (plan 26-01 not yet complete) the gate is in the informational state.

## Test-plant strategy

The check-explain-contract self-test injects scratch targets by regex-replacing the gate source and re-running via `node -e`. That works but is fragile (any TARGETS-format drift breaks the regex).

For check-pedagogy-shape we exposed a small env hook on the gate itself:

```js
const extra = (process.env.LEXI_PEDAGOGY_GATE_EXTRA_TARGETS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
return TARGETS.concat(extra);
```

The self-test sets that env var to point at the planted scratch file and runs the gate as a child process — no source mutation, no regex fragility. Belt-and-braces still preserved: the test asserts the SPECIFIC error code (`PEDAGOGY_BAD_CASE`, `PEDAGOGY_BAD_SUMMARY`, `PEDAGOGY_MISSING_WECHSEL_PAIR`) appears in stderr for each broken shape, and that exit code 0 fires for the well-formed shape.

## Malformed-shape errors caught during dev

None — the gate landed clean. The four scratch shapes used by the self-test are intentional fixtures:

1. `case: 'wechselpräposition'` (typo enum value) → `PEDAGOGY_BAD_CASE`
2. `summary.nn: ''` (empty string in register triple) → `PEDAGOGY_BAD_SUMMARY`
3. `case: 'wechsel'` without `wechsel_pair` → `PEDAGOGY_MISSING_WECHSEL_PAIR`
4. Well-formed akkusativ block + examples → exit 0

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `scripts/check-pedagogy-shape.js` exists ✓
- `scripts/check-pedagogy-shape.test.js` exists ✓
- `package.json` contains `check-pedagogy-shape` ✓
- Commits `551b087`, `309969d`, `d1e43aa` exist ✓
- Working tree clean (no `_test-scratch-*.js` files) ✓
- `npm run check-pedagogy-shape` exits 0 ✓
- `npm run check-pedagogy-shape:test` exits 0 ✓
