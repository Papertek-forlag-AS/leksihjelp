---
phase: 04-false-positive-reduction-nb-nn
plan: 03
subsystem: testing
tags: [fixtures, regression-gate, threshold-gate, nb-nn, codeswitch, saerskriving, loan-words, proper-noun, dialect-tolerance, sc-02, sc-03, sc-04, sc-05]

# Dependency graph
requires:
  - phase: 04-false-positive-reduction-nb-nn
    provides: "Plan 04-01 sisterValidWords seam rail + SC-03 adapter-contract guard — consumed by the Plan 04-03 fixture runner's Task-1 data loader; Plan 04-02 nb-codeswitch + nb-propernoun-guard pre-pass rules + ctx.suppressed convention — exercised by the new Plan 04-03 codeswitch.jsonl + expanded proper-noun/loan clean fixtures"
  - phase: 03-rule-architecture-ranking-quality
    provides: "INFRA-03 rule-registry plugin architecture — nb-sarskriving.js blocklist is edited inline in the rule file, no core edits"
  - phase: 01-foundation-vocab-seam-regression-fixture
    provides: "Fixture runner + honest-ground-truth policy — every acceptance case in the Plan 04-03 expansion was hand-authored BEFORE observing tool output"
provides:
  - "fixtures/nb/codeswitch.jsonl + fixtures/nn/codeswitch.jsonl: NEW SC-04 fixture files, 13 cases each, DE/EN/FR code-switched spans + short-input non-activation + proper-noun-density guard + threshold-margin case"
  - "fixtures/{nb,nn}/clean.jsonl: expanded with loan-word acceptance + proper-noun acceptance + 500-word real NB/NN article case (SC-02)"
  - "fixtures/{nb,nn}/typo.jsonl: expanded with >=5 dialect-tolerance cases per direction + Pitfall-5 anti-leakage guard case (SC-03)"
  - "fixtures/{nb,nn}/saerskriving.jsonl: expanded to >=30 positive + >=15 acceptance per language (55 NB / 46 NN total) for SC-05"
  - "scripts/check-fixtures.js: THRESHOLDS table + per-rule P/R gate — saerskriving nb/nn locked at P>=0.92, R>=0.95"
  - "extension/content/spell-rules/nb-sarskriving.js: blocklist widened with `stor` adjective to clear adjective+noun acceptance FP"
  - "scripts/check-fixtures.js + vocab-seam fixture path: loads sister-dialect raw vocab (fix(04-03) 8ea74c5) so sisterValidWords is populated in the Node runner, mirroring the browser adapter"
  - "extension/content/spell-rules/nb-typo-curated.js: sister-validWords early-exit (fix(04-03) 383552c) — closes SC-03 gap in the curated typo branch that nb-typo-fuzzy already covered in Plan 04-02"
  - "fixtures/README.md: Code-switching corpus + P/R threshold gate sections (Phase 4 convention doc for future fixture authors)"
affects: [phase-04-close, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "THRESHOLDS gate in fixture runner: declared at top of check-fixtures.js (next to imports), per-rule gate check injected inside per-lang/per-file loop AFTER hardFail-from-mismatches but BEFORE diagnostic print. Adding a new gate = adding a table entry; no runner-loop edit"
    - "Pitfall-4 safety margin (04-RESEARCH.md): observed P/R - 0.05, 2dp-rounded, same value both languages when observed is comparable. Product decision locked at checkpoint, not mechanically derived post-fix"
    - "Blocklist as FP absorber: nb-sarskriving.js SARSKRIVING_BLOCKLIST now serves two classes (function words + adjective collisions). Structured by comment block so future adjective FPs have an obvious home without re-designing the rule"
    - "Key-vs-rule_id distinction documented: fixture runner buckets results by filename basename (`saerskriving`), THRESHOLDS table mirrors that spelling — NOT the finding-side rule_id (`sarskriving`, no 'ae')"

key-files:
  created:
    - fixtures/nb/codeswitch.jsonl
    - fixtures/nn/codeswitch.jsonl
  modified:
    - fixtures/nb/clean.jsonl
    - fixtures/nn/clean.jsonl
    - fixtures/nb/typo.jsonl
    - fixtures/nn/typo.jsonl
    - fixtures/nb/saerskriving.jsonl
    - fixtures/nn/saerskriving.jsonl
    - fixtures/README.md
    - scripts/check-fixtures.js
    - extension/content/spell-rules/nb-sarskriving.js
    - extension/content/spell-rules/nb-typo-curated.js

key-decisions:
  - "SC-05 thresholds locked at P>=0.92, R>=0.95 for both NB and NN saerskriving (option-a at Plan 04-03 checkpoint). Mechanically derived from Pitfall-4 `observed - 0.05` on the pre-fix corpus (NB observed P=0.974, NN P=0.968). NN observed P was the binding number; both languages rounded to the same 0.92 floor for simplicity. Paper floor from 04-RESEARCH was P>=0.90, R>=0.60 — locked values comfortably exceed it."
  - "THRESHOLDS key uses fixture-filename basename (`saerskriving`) not finding-side rule_id (`sarskriving`). The runner's per-rule loop buckets by filename stem, so the table must mirror that spelling. A mismatch silently no-ops the gate. Documented in-place in both the comment block and fixtures/README.md so future threshold additions don't repeat this trap."
  - "Rule-1 auto-fix during Task 3 verification: added `stor` to nb-sarskriving.js SARSKRIVING_BLOCKLIST. Task 1's expanded acceptance fixture included `Hun bor i en stor by` (NB) + `Ho bur i ein stor by` (NN) — both tripped the rule because `stor+by=storby` IS a real compound noun. Fix is surgical (only `stor` added; probed 16 other adjective+noun acceptance pairs in the fixture, none collide with compoundNouns). After fix, observed P/R on saerskriving became 1.000/1.000 both languages."
  - "Scope of threshold gating: saerskriving only. Other rules (clean, codeswitch, gender, modal, typo) report P/R but are NOT gated in Phase 4. SC-05 is explicit about saerskriving being the rule with numeric targets; gating other rules would block Phase 5 UX work for unrelated ranking noise."
  - "Honest-ground-truth policy held throughout: every new fixture case's `expected` was drafted from the plan's ground-truth design (SC-02 loan-word clean cases per Plan 04-02's LOAN_WORDS, SC-03 dialect-tolerance per validWords semantics, SC-04 >=3-non-Norwegian-token density, SC-05 compoundNoun-probe-verified positive pairs). The single case that failed at Task 1 commit time (stor by FP) was left as a hard-failure signal per Phase 1 policy; fixed via blocklist in Task 3 rather than re-writing the expected to match tool output."
  - "Defence-in-depth probe validated the threshold gate is load-bearing: temporarily mutated both locked thresholds to 0.99/0.99 BEFORE the nb-sarskriving fix, ran the suite, confirmed gate fires with `[nb/saerskriving] THRESHOLD FAIL: P=0.974 < 0.99` + `[nn/saerskriving] THRESHOLD FAIL: P=0.968 < 0.99` diagnostics + exit 1. Restored to locked 0.92/0.95. Matches the Phase 03.1 + Plan 04-01 probe pattern for adapter-contract guards."

patterns-established:
  - "Rule-bugs-as-deferred-issues workflow: when Task 1 expands a fixture and a hand-authored acceptance case tails to fail the rule, the failure is the signal (Phase 1 honest-ground-truth policy). Options at that point: (a) fix the rule inline if surgical and within-plan-scope, (b) narrow the fixture if the expected was wrong (never back-fit to tool output), (c) escalate to a later phase if the fix is architectural. Plan 04-03 used option (a) for the `stor by` adjective+noun FP — surgical blocklist addition, committed as a Rule-1 auto-fix separate from the THRESHOLDS landing commit."
  - "Paired fixture-and-threshold commit pattern: when a new numeric gate ships (SC-05 saerskriving P/R), the commits land in a fixed order: (1) fixture expansion that moves observed P/R (the data the gate is picked from), (2) any rule-bug fixes surfaced by the expansion, (3) the gate itself with both observed and locked values recorded in the commit body, (4) README documentation of the gate's diagnostic format + key-vs-rule_id semantics. Each commit atomic, each independently revertable."

requirements-completed: []

# Metrics
duration: 6 min
completed: 2026-04-20
---

# Phase 04 Plan 03: False-Positive Reduction Fixtures + SC-05 Threshold Gate Summary

**Expanded fixture corpus (loan-word + proper-noun + real-article SC-02 acceptance, dialect-tolerance SC-03 with Pitfall-5 anti-leakage guard, 13 codeswitch cases per language for SC-04, saerskriving at 55 NB / 46 NN = >=30 positive + >=15 acceptance SC-05) + locked saerskriving threshold gate at P>=0.92 R>=0.95 both languages + surgical `stor` blocklist fix that clears the adjective+noun acceptance false-positive.**

## Performance

- **Duration:** 6 min (resumed portion of Plan 04-03 after user's option-a checkpoint decision — not including Task 1 authoring time from the prior session)
- **Started:** 2026-04-20T13:54:51Z (post-checkpoint resume)
- **Completed:** 2026-04-20T14:01:36Z
- **Tasks:** 3 (Task 1 from prior session: fixture expansion; Task 2: checkpoint decision captured; Task 3 post-resume: inline Rule-1 fix + THRESHOLDS gate + README docs)
- **Files modified:** 11 across the two sessions (6 existing fixture files expanded + 2 new fixture files + 1 README + 1 runner script + 2 rule files)

## Accomplishments

- **SC-02 fixtures authored end-to-end.** clean.jsonl per language now covers: the 500-word NRK-style NB news article clean case, >=3 loan-word clean cases using Plan 04-02's curated LOAN_WORDS (smoothie, deadline, gamer), >=3 proper-noun clean cases (single mid-sentence cap, consecutive-cap span like "Anne Grethe", all-caps acronym like NATO). NN mirror with register-correct NN-clean content (eg, ikkje, berre). Runner exits 0 on all 19 NB + 19 NN clean cases.
- **SC-03 fixtures authored both directions.** typo.jsonl per language adds >=5 dialect-tolerance cases asserting expected:[] on NN-valid words in NB documents (ikkje, eg, berre, nokon, me) + NB-valid words in NN documents (jeg, ikke, bare, noen, hjem). Plus one Pitfall-5 anti-leakage assertion: `Han komer snart hjem` expects a finding on `komer→kommer` even though `komer` happens to exist in NN's typoFix. All 26 NB + 15 NN typo cases pass.
- **SC-04 NEW fixture files shipped.** codeswitch.jsonl × 2 langs, 13 cases each — DE code-switching (Ich will, Guten Morgen), EN code-switching (The quick brown fox, Senior Software Engineer), FR code-switching (Bonjour mes amis), mixed-register (codeswitched span + real Norwegian typo nearby), short-input non-activation (Pitfall 8 MIN_TOKENS=8 gate), proper-noun density guard (Pitfall 2 — three consecutive cap names shouldn't over-suppress), threshold-margin case (exactly 3 unknowns in 5-window). All 13+13 cases pass with shipped MIN_TOKENS=8 + UNKNOWN_THRESHOLD=3 parameters — no retuning needed from Plan 04-02's honest-best-guess baseline.
- **SC-05 fixture expansion + threshold gate locked.** saerskriving.jsonl per language expanded to 55 NB / 46 NN total cases (>=30 positive + >=15 acceptance spec). Positives drawn from Korrekturavdelingen.no "Særskriving" class (arbeidsdag, skolegård, datamaskin, pengeseddel, ryggsekk, helsesenter, foreldremøte, kjernefamilie, toppidrett, etc.), each compoundNoun-probed before committing. Acceptance cases cover grammatically-adjacent non-compound pairs (god bok, lang tur, fin dag, god venn, ny bil, god kaffe, snill mann, tom flaske, ren kjole, rød ball, blå bluse, kald morgen, god lunsj, hyggelig hund, flink kokk, stor by). Threshold gate installed at P>=0.92, R>=0.95 both languages per Plan 04-03 checkpoint option-a.
- **Rule-1 auto-fix: adjective+noun FP resolved surgically.** Task 1 surfaced that `stor+by=storby` IS a real compound, so the default blocklist (function words only) didn't suppress `Hun bor i en stor by`. Added `stor` to SARSKRIVING_BLOCKLIST with a documented two-class comment (function words + adjective collisions). Probed all 16 other adjective+noun acceptance pairs — none collide with compoundNouns, so the fix stayed surgical. Post-fix observed P/R: 1.000/1.000 both languages — gate clears with 0.08 P-margin and 0.05 R-margin.
- **Defence-in-depth probe validated the threshold gate.** Temporarily mutated THRESHOLDS to 0.99/0.99, ran suite, confirmed `[nb/saerskriving] THRESHOLD FAIL: P=0.974 < 0.99` + `[nn/saerskriving] THRESHOLD FAIL: P=0.968 < 0.99` diagnostics + exit 1. Restored to locked 0.92/0.95. Matches Phase 03.1 and Plan 04-01 probe pattern.
- **README.md sweep completes the convention documentation.** Two new sections document the codeswitch corpus convention + the SC-05 threshold gate semantics + the key-vs-rule_id spelling gotcha + the three-step workflow for locking future thresholds.
- **All three release gates exit 0:** check-fixtures (280 cases, 12 files, P/R=1.000 on saerskriving), check-network-silence (no new fetch patterns), check-bundle-size (10.13 MiB / 20 MiB cap, 9.87 MiB headroom — zip size unchanged by fixture + script + README edits, as expected).

## Task Commits

Plan 04-03 spans two sessions; all commits listed in execution order:

**Prior session (pre-checkpoint):**
1. **Pre-plan fix 1: SC-03 gap in curated typo rule** — `383552c` (fix) — added sister-validWords early-exit to nb-typo-curated.js matching nb-typo-fuzzy.js's Plan 04-02 addition. Rule-1 auto-fix surfaced during Task 1 fixture authoring when NN-valid words leaked through curated-typo in NB document.
2. **Pre-plan fix 2: Load sisterRaw in fixture runner** — `8ea74c5` (fix) — scripts/check-fixtures.js now mirrors the browser adapter by reading the sister-dialect raw vocab and passing it into buildIndexes. Rule-1 auto-fix: without this, sisterValidWords was empty in the Node runner and cross-dialect tolerance was a fixture-invisible no-op.
3. **Task 1: Fixture expansion for SC-02/03/04/05** — `5023c97` (test) — expanded 6 existing fixture files, created 2 new codeswitch.jsonl files.

**This session (post-checkpoint resume with user's option-a decision):**

4. **Task 3 Rule-1 auto-fix: `stor` blocklist addition** — `a9d1314` (fix) — nb-sarskriving.js SARSKRIVING_BLOCKLIST grows from function-words-only to function-words + adjective-collisions class; `stor` is the only adjective added (probed-verified as the only adj+noun acceptance-fixture pair that collides with compoundNouns).
5. **Task 3 feat: THRESHOLDS gate in check-fixtures** — `21201c7` (feat) — THRESHOLDS table + per-rule gate block wired into scripts/check-fixtures.js. Key is `saerskriving` (filename basename), not `sarskriving` (finding-side rule_id); comment documents this trap for future editors.
6. **Task 3 docs: Code-switching corpus + threshold gate README sections** — `55eb757` (docs) — fixtures/README.md appended with two new sections documenting Phase 4 conventions.

_Plan metadata commit (SUMMARY + STATE + ROADMAP): added after this file via the final docs commit._

## Files Created/Modified

**Created (2):**
- `fixtures/nb/codeswitch.jsonl` — 13 SC-04 cases covering DE/EN/FR code-switching + short-input + proper-noun density guard + margin case
- `fixtures/nn/codeswitch.jsonl` — 13 SC-04 cases in NN register (eg, ikkje, berre surrounding text)

**Modified (11):**
- `fixtures/nb/clean.jsonl` — expanded from 8 to 19 cases: real NB news article, loan-word acceptance (smoothie, deadline, gamer), proper-noun acceptance (Oslo+Bergen, Anne Grethe, NATO)
- `fixtures/nn/clean.jsonl` — expanded to 19 cases with NN-register content
- `fixtures/nb/typo.jsonl` — expanded with 5 dialect-tolerance NN-words-in-NB cases + 1 Pitfall-5 anti-leakage guard
- `fixtures/nn/typo.jsonl` — mirror with NB-words-in-NN cases
- `fixtures/nb/saerskriving.jsonl` — expanded from 16 to 55 cases (>=30 positive + >=15 acceptance spec)
- `fixtures/nn/saerskriving.jsonl` — expanded to 46 cases (symmetric expansion)
- `fixtures/README.md` — two new sections (Code-switching corpus + P/R threshold gate) appended after Clean corpus
- `scripts/check-fixtures.js` — THRESHOLDS table declared top-of-file; per-rule gate block in per-lang/per-file loop; documents key-vs-rule_id distinction; loads sister-dialect raw vocab (from prior session's fix)
- `extension/content/spell-rules/nb-sarskriving.js` — SARSKRIVING_BLOCKLIST grows with `stor`; comment block documents the two-class structure (function words + adjective collisions)
- `extension/content/spell-rules/nb-typo-curated.js` — sister-validWords early-exit (prior session's fix) — closes SC-03 gap in curated branch

## Decisions Made

See frontmatter `key-decisions` — six locked decisions covering the checkpoint option-a threshold numbers, the THRESHOLDS-key vs finding-rule_id spelling distinction, the Rule-1 blocklist auto-fix, the saerskriving-only scope of gating, the honest-ground-truth policy discipline, and the defence-in-depth probe confirmation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `stor by` adjective+noun FP on saerskriving rule**
- **Found during:** Task 3 verification (pre-commit npm run check-fixtures probe)
- **Issue:** Task 1's expanded saerskriving acceptance fixture included `nb-saer-accept-017: "Hun bor i en stor by"` and `nn-saer-accept-016: "Ho bur i ein stor by"` per the plan's explicit acceptance-case enumeration (plan line: `stor by (adjective+noun — storby exists; rule must not fire because of blocklist/adjective)`). The rule fired on both cases because `storby` IS a real Norwegian compound noun in compoundNouns AND neither `stor` nor `by` was in SARSKRIVING_BLOCKLIST. Exit 1, 2 hard failures, blocking the Task 3 threshold-gate-on-clean-corpus done-criterion.
- **Fix:** Added `stor` to SARSKRIVING_BLOCKLIST in extension/content/spell-rules/nb-sarskriving.js with a restructured comment block documenting the two-class blocklist (function words + adjective collisions). Probed all other adjective+noun acceptance pairs in the fixture; only `stor` collides with compoundNouns, so the fix stayed surgical (no preemptive adjective additions).
- **Files modified:** extension/content/spell-rules/nb-sarskriving.js
- **Verification:** npm run check-fixtures exit 0 post-fix; saerskriving P/R moves from (NB 0.974/1.000, NN 0.968/1.000) to (1.000/1.000 both langs). Locked threshold 0.92/0.95 clears with extra headroom.
- **Commit:** a9d1314 (fix(04-03))

---

**Total deviations:** 1 auto-fixed (Rule-1 Bug; pre-plan-commit deviations from the prior session are counted in the prior session's context and listed in Task Commits above for continuity)

**Impact on plan:** Auto-fix was necessary for Task 3's done-criterion (`npm run check-fixtures exits 0`). The plan's own acceptance-case spec explicitly listed `stor by` as a test for the "blocklist/adjective" gate, so the fix implemented exactly what the plan's acceptance-design called for. No scope creep. Observed P/R shift from pre-fix 0.974/0.968 to 1.000/1.000 widens the regression headroom on the locked threshold gate.

## Authentication Gates

None — Plan 04-03 was a pure code + fixture + documentation plan. No external services, no CLI auth, no deployment flow.

## Issues Encountered

**Threshold-key spelling trap (caught inline during probe, not deferred):** The fixture-filename basename is `saerskriving` (ASCII-safe per fixtures/README.md span convention) while the finding-side `rule_id` emitted by spell-check-core.check() is `sarskriving` (no 'ae'). The THRESHOLDS table key must mirror the filename basename because the runner buckets by `path.basename(file, '.jsonl')`. An initial draft used `sarskriving` and the gate silently no-op'd at 0.99/0.99 probe values. Caught by the defence-in-depth probe (no diagnostic message fired even though values were obviously out of range). Documented in both the THRESHOLDS comment block and fixtures/README.md so future editors don't repeat the trap.

No other issues. All three release gates passed on first attempt after the inline fix + threshold-key correction.

## User Setup Required

None — no environment variables, no external services, no dashboard changes. Pure fixture + script + rule-file + documentation edits.

## Next Phase Readiness

- **Phase 4 closes end-to-end at the plan-execution layer.** All four success criteria (SC-02 proper-noun + loan-word guard, SC-03 NB↔NN dialect tolerance, SC-04 code-switching density, SC-05 saerskriving threshold gate) now have concrete fixture coverage + locked numeric gates. `/gsd:verify-work phase 04` is the next step — verifier owns marking SC-02/03/04/05 complete in REQUIREMENTS.md after confirming fixture coverage + threshold-gate locking behaviours are exactly as the spec asks. This plan intentionally did NOT preemptively call `gsd-tools requirements mark-complete` — that's the verifier's job at phase close (pattern learned from Plan 04-01 where the executor incorrectly pre-marked SC-03 complete).
- **No blockers for Phase 5 UX work.** The false-positive architecture (ctx.suppressed convention, four-layer proper-noun guard, density-window codeswitch, sister-validWords rule-layer tolerance, saerskriving blocklist widened) is stable. Phase 5 can proceed against a clean fixture baseline.
- **Known ragged edge:** The SARSKRIVING_BLOCKLIST "adjective collisions" class currently contains exactly one entry (`stor`). Future adjective FPs will be rare (probe confirms the rest of A1-level adjectives don't collide with compoundNouns), but when they surface, the add-to-blocklist pattern is in place and documented. Longer-term: if the blocklist grows past ~10 adjective entries, consider adding an adjective-bank Set to the seam (parallel to compoundNouns) and gating with `!adjectiveBank.has(prev.word)` in the rule. Out of scope for Phase 4; candidate for a Phase 5 opportunistic cleanup if the collision count grows.
- **Honest ground truth stayed honest.** Every acceptance case was hand-authored against plan ground-truth design, not tool output. The single case that tripped the rule was fixed at the rule layer, not by back-fitting the expected. Phase 4's fixture corpus is now a reliable regression sensor for Phase 5 UX work.

---
*Phase: 04-false-positive-reduction-nb-nn*
*Completed: 2026-04-20*

## Self-Check: PASSED

- All 13 claimed modified/created files exist on disk (2 new codeswitch.jsonl + 6 existing fixture files + fixtures/README.md + scripts/check-fixtures.js + 2 rule files; pre-plan fix-commit files nb-typo-curated.js and scripts/check-fixtures.js mentioned in Task Commits also still exist)
- All 6 atomic task/fix commits present in git log --oneline --all: 383552c (fix), 8ea74c5 (fix), 5023c97 (test), a9d1314 (fix), 21201c7 (feat), 55eb757 (docs)
- SUMMARY.md exists at canonical .planning/phases/04-false-positive-reduction-nb-nn/04-03-SUMMARY.md
- All three release gates verified PASS: check-fixtures exits 0 (280 cases, 12 files, saerskriving P/R=1.000/1.000 both langs clears locked 0.92/0.95 gate with headroom), check-network-silence PASS, check-bundle-size 10.13 MiB / 20 MiB cap PASS with 9.87 MiB headroom
- Defence-in-depth probe on the THRESHOLDS gate: mutated to 0.99/0.99, confirmed exit 1 + diagnostic messages fire, restored to locked 0.92/0.95 byte-identical
- No preemptive `gsd-tools requirements mark-complete` — verifier owns phase-close requirement marking (correct behaviour per the prompt's explicit instruction)
