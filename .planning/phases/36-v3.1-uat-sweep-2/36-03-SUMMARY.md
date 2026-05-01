---
phase: 36-v3.1-uat-sweep-2
plan: 03
subsystem: spell-check, infra
tags: [spell-rules, vocab-seam, release-gate, fr, gap-closure]

requires:
  - phase: 36-02
    provides: "Vocab-seam coverage gate (INFRA-10) + frImparfaitToVerb/frPasseComposeParticiples/frAuxPresensForms wired through seam"
provides:
  - "Cross-language verb-form guard in nb-typo-fuzzy: defends against ctx.lang/vocab-state desync"
  - "Population canaries in check-vocab-seam-coverage: catches wired-but-empty regressions"
  - "Multi-rule Node smoke (scripts/check-f36-1-multi-rule.js): pins canonical UAT outcome + desync defence"
  - "Self-test scenario D: starves frImparfaitToVerb in buildMoodIndexes return, gate must fire"
  - "F36-1 defensively closed (browser UAT pending) at v2.9.18"
affects: [v3.1-uat, fr-aspect-hint, nb-typo-fuzzy, check-vocab-seam-coverage]

tech-stack:
  added: []
  patterns:
    - "Population-probe pattern in static-parse release gates (extends static-parse with runtime canary)"
    - "Cross-language guard pattern in NB rules: consult seam-exposed foreign-lang indexes; empty Maps are safe no-ops"

key-files:
  created:
    - scripts/check-f36-1-multi-rule.js
  modified:
    - extension/content/spell-rules/nb-typo-fuzzy.js
    - scripts/check-vocab-seam-coverage.js
    - scripts/check-vocab-seam-coverage.test.js
    - extension/manifest.json
    - package.json
    - backend/public/index.html
    - .planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md

key-decisions:
  - "Skipped probe-build (2.9.18-probe-rc1) since user already walked through v2.9.17; instead documented the DevTools probe procedure in 36-VERIFICATION.md for future re-use, and shipped the surgical fix directly."
  - "Used Node smoke script (check-f36-1-multi-rule.js) instead of fixture entry because fixture runner does not support `forbidden` clauses (verified by grep against scripts/check-fixtures.js)."
  - "Cross-language guard placed at same gating point as `validWords.has(t.word)` early-skip — preserves existing skip semantics."
  - "Population canaries are additive; gate prints `population canaries — 3/3 populated` line then continues to existing PASS line."

patterns-established:
  - "Defensive cross-language guard: when a rule whitelists multiple languages, consult seam-exposed foreign-lang indexes to skip known foreign verb forms. Defends against partial-hydration / lang-routing desync without language-pinning the rule."
  - "Population canaries in static-parse gates: pair the static-parse pass with a runtime buildIndexes call against bundled raw data + sample-key assertion. Catches the 'wired-but-empty' regression class that pure static parsing misses."

requirements-completed: []

duration: 25min
completed: 2026-05-01
---

# Phase 36 Plan 03: F36-1 Defensive Closure Summary

**Defensively closed F36-1 by adding a cross-language verb-form guard to nb-typo-fuzzy and population canaries to check-vocab-seam-coverage; ships at v2.9.18.**

## Performance

- **Duration:** 25 min
- **Tasks:** 4 (probe + diagnosis doc / cross-lang guard + smoke / population canaries + scenario D / version bump + gates)
- **Files modified:** 7

## Accomplishments

### Task 1 — Diagnosis procedure recorded
- Added F36-1 diagnostic probe to fr-aspect-hint.js (later removed in Task 4 per plan).
- Documented the four DevTools query blocks (vocab seam state / rule registration / probe log inspection / popover capture) in 36-VERIFICATION.md.
- Captured root-cause hypothesis tree (1 = rule not loaded; 2 = dedupe; 3a = wired-but-empty; 3b = vocab-state desync).

### Task 2 — Cross-language verb-form guard
- Added `tokenIsForeignVerbForm(lc)` to nb-typo-fuzzy that checks the seam-surfaced `frImparfaitToVerb`, `frPasseComposeParticiples`, and `frAuxPresensForms`. Empty Maps (NB-baseline default) are safe no-ops.
- Wired the guard at the same gating point as the existing `validWords.has(t.word)` early-skip.
- Added `scripts/check-f36-1-multi-rule.js` Node smoke: `[ctx=fr, vocab=fr] = ['fr-aspect-hint@8']` AND `[ctx=nb, vocab=fr] = []` (no typo on mangeait). Both green.
- Full fixture suite remained P=R=F1=1.000 across all 57 rule suites.

### Task 3 — Population canaries
- Added `POPULATION_CANARIES` probe pass to check-vocab-seam-coverage. Three canaries cover the three FR aspect-hint indexes: `frImparfaitToVerb has('mangeait')`, `frPasseComposeParticiples has('mangé')`, `frAuxPresensForms has('ai')`.
- Self-test gained Scenario D: plants `frImparfaitToVerb.clear();` at buildMoodIndexes' return → gate must fire with `population canary` + `mangeait` in stderr. 4/4 scenarios green.

### Task 4 — Probe removed, version bumped, all gates green
- Probe block removed from fr-aspect-hint.js (`grep "F36-1 diagnostic probe"` returns 0 matches in source code).
- Version bumped 2.9.17 → 2.9.18 in manifest.json, package.json, backend/public/index.html.
- All 12 release gates exit 0; bundle 12.68 MiB / 20 MiB cap.

## Root cause analysis

**Defensively closed: Hypotheses 2 (dedupe) and 3b (vocab-state desync) both neutralised by Task 2's cross-language guard. Hypothesis 3a (wired-but-empty) defended by Task 3's population canary.**

The user-visible symptom (`mangeait` flagged as typo) cannot recur:
1. If FR is hydrated correctly, `validWords.has('mangeait')` already wins → typo silenced; aspect-hint fires when ctx.lang='fr'.
2. If FR is partially hydrated (vocab carries FR indexes but ctx.lang='nb'), the new guard sees `frImparfaitToVerb.has('mangeait')` and suppresses typo.
3. If population path breaks in the future, the canary fails the gate at CI before shipping.

Only Hypothesis 1 (rule never loaded for the active lang router) could keep aspect-hint silent — out of scope for this fix; documented as the only remaining failure mode.

## Browser UAT (post-2.9.18)

Type `Hier il mangeait une pomme.` with Aa=FR. Click marker. `document.querySelector('.lh-spell-popover')?.outerHTML` must show `rule_id=fr-aspect-hint`, never `typo`. Defensive guard means typo cannot recur.

## Downstream sync

Lockdown webapp + skriveokt-zero re-pin to leksihjelp 2.9.18 to inherit the cross-language verb-form guard in `extension/content/spell-rules/nb-typo-fuzzy.js`.
