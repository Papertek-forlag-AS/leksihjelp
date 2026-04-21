---
phase: 03-rule-architecture-ranking-quality
plan: 03
subsystem: spell-check
tags: [zipf-frequency, fuzzy-matching, fixture-suite, ranking, sc-01, infra-03]

# Dependency graph
requires:
  - phase: 03-rule-architecture-ranking-quality
    provides: "Plan 03-01: vocab.freq Map hydrated from freq-{lang}.json sidecar end-to-end (NB 13,132 / NN 11,013 entries)"
  - phase: 03-rule-architecture-ranking-quality
    provides: "Plan 03-02: nb-typo-fuzzy.js exists as a standalone IIFE rule file under extension/content/spell-rules/, registers itself onto self.__lexiSpellRules"
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: "freq-nb.json + freq-nn.json sidecars built from NB N-gram 2021 digibok corpus"
provides:
  - "Zipf-aware scoreCandidate inside extension/content/spell-rules/nb-typo-fuzzy.js (vocab.freq.get(cand) × ZIPF_MULT=10)"
  - "findFuzzyNeighbor lifted local to the fuzzy rule file (passes vocab through, reads validWords + freq from it)"
  - "Two new SC-01 fixture cases (nb-typo-zipf-001 hagde→hadde, nb-typo-zipf-002 hatde→hadde) that load-bearing exercise the Zipf path — defence-in-depth verified"
  - "scripts/find-zipf-tiebreak-candidate.js — dev-only finder that surfaces NB/NN typo triples where Zipf alone decides the winner"
affects: [phase-04-spell-check-precision-recall, phase-05-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rule-local scoring surface — fuzzy rule owns scoreCandidate + findFuzzyNeighbor; spell-check-core.js exports them only for back-compat"
    - "Bounded additive frequency tiebreaker — Zipf × 10 (max ~70 points) strictly under 100-point distance penalty"
    - "Defence-in-depth fixture verification — temporarily zero out the new term, confirm new fixtures regress with the exact pre-change diagnostic"

key-files:
  created:
    - "scripts/find-zipf-tiebreak-candidate.js — dev finder, NOT shipped, NOT wired into npm scripts"
  modified:
    - "extension/content/spell-rules/nb-typo-fuzzy.js — local scoreCandidate + findFuzzyNeighbor with vocab.freq tiebreaker (ZIPF_MULT=10)"
    - "fixtures/nb/typo.jsonl — +2 SC-01 Zipf-tiebreaker cases"

key-decisions:
  - "ZIPF_MULT = 10, not 15 as the plan first proposed — 15 caused nb-typo-likr-001 to regress (likr's neighbors 'liker' Zipf 4.99 and 'like' Zipf 5.76 had a 0.77 Zipf gap × 15 = 11.55 pts, which overshoots the 10-pt distance/length gap and flipped the winner to 'like'). Multiplier 10 keeps the boost at 7.7 pts — too small to override length-penalty, so 'liker' stays the winner. The two new SC-01 cases (Zipf gaps 3.39, 3.09) still flip correctly because their boosts (33.9 / 30.9 pts) comfortably exceed the 5-pt today-score gap."
  - "scoreCandidate moved local to nb-typo-fuzzy.js — rather than imported from __lexiSpellCore. Keeps the fuzzy rule's scoring surface single-file (Plan 02's INFRA-03 win) and demonstrates the contract: a scoring change is one-file. core's scoreCandidate stayed exported (for back-compat with anything that still depends on it) but the rule no longer reads it."
  - "Fixture sentence for nb-typo-zipf-002 changed mid-execution from 'De hatde det fint.' to 'De hatde ferie da.' — 'fint' is the neuter form of the missing-from-validWords adjective 'fin' (known data gap from Plan 02-03 STATE.md blocker); the fuzzy matcher reaches 'finn' at d=1 and adds an unrelated finding that breaks the test. Picked 'ferie' (valid in NB validWords) + 'da' (valid) for a clean sentence with only the intended typo."
  - "scripts/find-zipf-tiebreak-candidate.js stays dev-only (not wired into npm scripts, not in CLAUDE.md Release Workflow). Surfaces 40,012 raw triples / 4,612 clean triples (both Zipf >= 3.0, gap >= 1.5) on the current NB validWords + freq-nb.json — plenty of headroom for Phase 4 to author more SC-01 fixture cases without re-engineering the finder."

patterns-established:
  - "Rule-local scoring (extends INFRA-03): a scoring change lives entirely in one rule file. Future ranker tuning (any rule) follows this same pattern — extract whatever the rule needs, pass `ctx.vocab` through, no edits to spell-check-core.js."
  - "Bounded-multiplier discipline for any additive scoring boost: the boost MUST be smaller than the smallest meaningful signal it could override. For Zipf vs distance, that means Zipf×mult < 100 (one edit) — and we picked a tighter constraint (Zipf×mult < 10) so it can't override length-penalty differences either. Calibrate by replaying the existing fixture corpus, not by theory."
  - "Defence-in-depth fixture verification: when a fixture case targets a new code path, prove it load-bearing by temporarily disabling the path and confirming the case fails with the exact pre-change diagnostic. Implemented inline as a Node `child_process.execSync` patch + restore. Pattern reusable any time a new fixture targets a new heuristic."

requirements-completed: [SC-01]

# Metrics
duration: 12m
completed: 2026-04-19
---

# Phase 03 Plan 03: SC-01 Zipf Tiebreaker Summary

**Bounded Zipf frequency tiebreaker (vocab.freq × 10) added to fuzzy typo ranker inside extension/content/spell-rules/nb-typo-fuzzy.js with two new fixture cases that load-bearing exercise the new code path. Zero edits to spell-check-core.js.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-19T09:47:58Z
- **Completed:** 2026-04-19T09:59:39Z (approx — measured via per-task commits)
- **Tasks:** 2
- **Files modified:** 2 (created: 1 dev script + 0 release files; modified: 1 rule file + 1 fixture file)

## Accomplishments

- **scoreCandidate now reads vocab.freq.** The Zipf term (cand frequency × 10) is added inside `extension/content/spell-rules/nb-typo-fuzzy.js`, bounded so it can never override a distance difference. Tied candidates: the more common NB/NN word wins.
- **Two new SC-01 fixture cases land in fixtures/nb/typo.jsonl** (`nb-typo-zipf-001` `hagde→hadde`, `nb-typo-zipf-002` `hatde→hadde`) that exercise the Zipf path SPECIFICALLY — both candidates are at d=1, neither is an adjacent transposition, only the Zipf term decides. Defence-in-depth verified: with the Zipf line zeroed out, both cases fail with the today-picks diagnostic.
- **138 pre-existing fixtures + 2 new = 140/140 still pass.** No regressions. Zero changes to `extension/content/spell-check-core.js` — INFRA-03's "scoring changes are one-file" contract holds.
- **Dev finder ships in scripts/** (not wired into release): walks NB validWords producing single-character mutations and surfaces typo triples where Zipf alone decides. Found 40,012 raw triples / 4,612 clean triples on the current corpus — plenty of headroom for Phase 4 SC-01 fixture growth.

## Task Commits

Each task was committed atomically:

1. **Task 1: Find a clean Zipf-tiebreaker candidate pair (dev script)** — `b046e2d` (chore)
2. **Task 2: Add Zipf term to scoreCandidate + author the new fixture case** — `1eea234` (feat)

## Files Created/Modified

- `scripts/find-zipf-tiebreak-candidate.js` — created. Dev-only finder: iterates NB (or NN) validWords, mutates one character at internal positions, finds d=1 neighbors, emits TRIPLE lines where Zipf gap > 1.0 and today's score ties or picks the lower-Zipf candidate. Sorted by gap descending, top 20 printed.
- `extension/content/spell-rules/nb-typo-fuzzy.js` — modified. `scoreCandidate` and `findFuzzyNeighbor` now live local to this file (rather than imported from `__lexiSpellCore`). Added `ZIPF_MULT = 10` and `s += z * ZIPF_MULT` when `vocab.freq.get(cand)` is a number. Pitfall 4 guardrail documented inline with the multiplier-tuning rationale.
- `fixtures/nb/typo.jsonl` — modified. Appended 2 SC-01 Zipf-tiebreaker cases under a comment header. Fixture count: 17 → 19 NB typo cases.

## Decisions Made

See frontmatter `key-decisions` for the four substantive decisions:

1. **ZIPF_MULT = 10**, not the plan's first-proposed 15 (15 regressed `nb-typo-likr-001`).
2. **scoreCandidate moved local to nb-typo-fuzzy.js** — not imported from core — to preserve the INFRA-03 single-file ownership contract.
3. **Fixture sentence for nb-typo-zipf-002 changed mid-execution** to avoid the `fint` data gap (known blocker from Plan 02-03).
4. **find-zipf-tiebreak-candidate.js stays dev-only** — not in npm scripts, not in Release Workflow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ZIPF_MULT lowered from 15 to 10 to prevent fixture regression**
- **Found during:** Task 2 (running fixtures after the first scoreCandidate edit)
- **Issue:** With `s += z * 15` (the plan's proposed multiplier), the existing fixture `nb-typo-likr-001` (`likr → liker`) regressed: today picks `liker` (-45) over `like` (-55), but with Zipf added, `like` (Zipf 5.76) at -55+86.4 = +31.4 beats `liker` (Zipf 4.99) at -45+74.85 = +29.85. The 0.77 Zipf gap × 15 = 11.55 points overshoots the 10-point distance/length-penalty gap.
- **Fix:** Lowered `ZIPF_MULT` to 10 (boost capped at ~70 points). Re-verified all four affected cases:
  - `likr` → `liker` ✓ (4.90 > 2.60)
  - `hagde` → `hadde` ✓ (17.10 > -11.80)
  - `hatde` → `hadde` ✓ (17.10 > -8.80)
  - `berde` → `bedre` ✓ (still wins via the existing transposition bonus)
- **Files modified:** `extension/content/spell-rules/nb-typo-fuzzy.js` (multiplier constant + comment block documenting the calibration)
- **Verification:** `npm run check-fixtures` passes 140/140 (was 138/138 + 2 → 138/140 with mult=15, then 140/140 with mult=10).
- **Committed in:** `1eea234` (Task 2 commit)
- **Plan note:** The plan EXPLICITLY anticipated this in Task 2 step 4 (`temporarily lower the multiplier from 15 to 10 or 8`) — the deviation is operating within the plan's contingency, not against it. Worth flagging because the plan's frontmatter says "zipf * 15" is the chosen formula; the shipped reality is "zipf * 10".

**2. [Rule 1 - Bug] nb-typo-zipf-002 sentence changed from "De hatde det fint." to "De hatde ferie da." to avoid the fint data gap**
- **Found during:** Task 2 (running fixtures after authoring the second case)
- **Issue:** `fint` is the neuter singular form of the adjective `fin` ("nice"), which is missing from NB validWords (known blocker from Plan 02-03 STATE.md — the same data gap surfaced via the NN `nn-clean-003` fixture). The fuzzy matcher reaches `finn` at d=1 from `fint`, adding an unrelated finding (`fint → finn`) that breaks the case.
- **Fix:** Picked a sentence using only valid-in-validWords words: "De hatde ferie da." (`De`, `ferie`, `da` all valid; only `hatde` is the typo).
- **Files modified:** `fixtures/nb/typo.jsonl`
- **Verification:** No `extra` findings in the verbose fixture output for `nb-typo-zipf-002`.
- **Committed in:** `1eea234` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — bugs in plan's first-proposed approach surfaced by running the fixture suite)
**Impact on plan:** Both deviations were anticipated by the plan's contingency text. Multiplier tuning was explicitly listed as a Pitfall-4 mitigation. Sentence change for the data gap is a fixture-authoring detail, not a behavior change. No scope creep — exactly the same files modified, same code paths exercised.

## Issues Encountered

- **Pitfall 4 surfaced exactly as predicted.** RESEARCH.md:420-432 warned that an unbounded Zipf multiplier would override edit-distance and named `skirver → skriver` as a regression target. The actual regression hit a different case (`likr → liker`) at the boundary of length-penalty + tiny Zipf gap rather than the named distance-dominant case. Lowering the multiplier from 15 to 10 fixed it on first try. The Pitfall-4 anchor case (`skirver → skriver`) stayed green throughout — verified mid-execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **SC-01 closed** for the cases the new fixtures cover. The Zipf code path is shipped and CI-protected.
- **Headroom for Phase 4 SC-01 expansion:** 4,612 clean Zipf-tiebreaker triples surfaced from the current corpus (NB only, conservative filter Zipf >= 3.0 + gap >= 1.5). Phase 4 can author more SC-01 fixture cases by re-running `node scripts/find-zipf-tiebreak-candidate.js` and picking from the top of the list.
- **Plan 03-04 (WP-01 word-prediction freq signal) is the natural next step** — it lives on a different consumer surface (word-prediction.js, not spell-rules/) but uses the same `vocab.freq` Map hydrated by Plan 03-01. No coordination needed; Plan 03-04 can be picked up immediately.
- **No blockers introduced.** The known `fin_adj` data gap was navigated around (sentence choice), not aggravated.

---

## Self-Check: PASSED

- `scripts/find-zipf-tiebreak-candidate.js` — FOUND
- `extension/content/spell-rules/nb-typo-fuzzy.js` (modified, contains `vocab.freq`) — FOUND
- `fixtures/nb/typo.jsonl` (contains `nb-typo-zipf-`) — FOUND
- Commit `b046e2d` (Task 1 chore) — FOUND in git log
- Commit `1eea234` (Task 2 feat) — FOUND in git log
- `extension/content/spell-check-core.js` UNCHANGED (INFRA-03 contract) — VERIFIED via `git diff --stat extension/content/spell-check-core.js` (empty)
- `npm run check-fixtures` exits 0 with 140/140 cases pass — VERIFIED

---
*Phase: 03-rule-architecture-ranking-quality*
*Completed: 2026-04-19*
