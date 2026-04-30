---
phase: 33-v3.1-cleanup
plan: 03
subsystem: spell-rules / exam-mode / release
tags: [exam-audit, browser-baseline, version-bump, ship, gap-closure]
requires:
  - 33-01-SUMMARY.md (dict-state-builder lift)
  - 33-02-SUMMARY.md (lockdown sync refresh)
provides:
  - exam.safe audit decisions for all 49 previously-conservative spell-rules
  - Version 2.9.12 aligned across manifest.json + package.json + landing page
  - All 15+ release gates green
  - Phase 33 / v3.1 close-out
affects:
  - extension/content/spell-rules/*.js (49 files: 22 flipped, 27 annotated)
  - extension/manifest.json + package.json + backend/public/index.html
  - .planning/STATE.md + .planning/ROADMAP.md
key-files:
  modified:
    - extension/content/spell-rules/*.js
    - extension/manifest.json
    - package.json
    - backend/public/index.html
    - .planning/STATE.md
    - .planning/ROADMAP.md
  created:
    - .planning/phases/33-v3.1-cleanup/33-03-SUMMARY.md
decisions:
  - "Audit rubric per <interfaces> in 33-03-PLAN.md applied per-rule: lookup-shaped + single-token + no pedagogy + no cross-token context => flip; otherwise stay safe=false with audit comment"
  - "22 lookup-shaped rules flipped to safe=true (NB gender/aa-og/sarskriving/modal/compound/demonstrative; EN grammar/homophones/morphology/word-family; ES coordination/grammar/fr-gender; FR adj-gender/contraction/elision/grammar/preposition; DE gender/grammar/compound-gender; universal-agreement)"
  - "27 rules stay safe=false (5 pedagogy popovers, 11 multi-token rewrites, 5 doc-drift, 6 context-dependent aux/mood) — each annotated with one-line `// exam-audit 33-03:` comment so future audit doesn't re-question"
  - "Version bumped 2.9.11 -> 2.9.12 (patch — gap-closure phase, no new features)"
  - "fr-aspect-hint already had a non-placeholder reason from Phase 32-01; received audit comment manually rather than via bulk script"
metrics:
  duration_minutes: 8
  tasks_completed: 6
  files_modified: 53
  completed_date: "2026-04-30"
---

# Phase 33 Plan 03: exam.safe Audit + v3.1 Ship Summary

Closed the v3.1 audit's three open items in one shot: exam.safe browser-baseline audit (49 rules), version bump (2.9.11 -> 2.9.12), full release-gate sweep (24 gates green), and cross-repo push of the lockdown sync that 33-02 left staged-but-unpushed.

## exam.safe Audit Results

Phase 27-01 made a default-conservative call ("safe=false pending browser-baseline research") on every grammar rule. This plan revisits each. Per the rubric in 33-03-PLAN.md `<interfaces>`:

- **FLIP** if matcher is pure lookup against static map, fix is single-token, no Lær mer pedagogy, no cross-sentence context.
- **STAY** if any of: pedagogy popover, multi-token rewrite, doc-drift, context-dependent aux/mood selection.

**Totals:** 22 flipped, 27 stayed (49 rules audited).

### Flipped to safe=true (22 rules)

| Rule | Rationale |
| --- | --- |
| nb-gender | NB lookup against gender/article map; single-token replacement; no pedagogy popover |
| nb-aa-og | NB å/og confusion is single-token typo lookup |
| nb-compound-gender | Lookup against gender map; single-token suggestion |
| nb-demonstrative-gender | Demonstrative gender lookup; single-token suggestion |
| nb-modal-verb | Lookup against irregular-form list; single-token replacement |
| nb-sarskriving | Split-compound lookup; single-token rejoin |
| en-grammar | EN grammar typo bank — single-token lookup |
| en-homophones | EN homophone bank — single-token swap |
| en-word-family | EN word-family typo bank — single-token lookup |
| en-morphology | EN irregular-morphology lookup |
| es-fr-gender | ES/FR article gender lookup; single-token article swap |
| fr-adj-gender | FR adjective gender lookup; single-token feminine/masculine swap |
| fr-elision | FR le→l' single-token lookup |
| fr-contraction | FR de+le→du deterministic single-token lookup |
| es-coordination | ES y/e o/u coordinator phonological swap |
| universal-agreement | Agreement-map lookup; single-token suggestion |
| de-gender | DE gender lookup; single-token article suggestion |
| de-compound-gender | Compound gender via head-noun lookup |
| de-grammar | DE grammar typo bank — single-token lookup |
| es-grammar | ES grammar typo bank — single-token lookup |
| fr-grammar | FR grammar typo bank — single-token lookup |
| fr-preposition | FR preposition swap — single-token lookup |

### Stayed safe=false (27 rules) — each annotated with audit comment

| Rule | Reason for staying |
| --- | --- |
| de-prep-case | Lær mer pedagogy popover (case explanation) |
| es-por-para | Lær mer pedagogy popover (por/para semantic categories) |
| es-gustar | Lær mer pedagogy popover (gustar verb_class) |
| fr-aspect-hint | Lær mer pedagogy popover (aspect_choice); teaches not corrects |
| es-imperfecto-hint | Pedagogy hint that teaches imperfecto vs preterito |
| de-v2 | Multi-token V2 word-order rewrite |
| de-verb-final | Multi-token subordinate-clause verb-final rewrite |
| de-separable-verb | Multi-token separable-prefix reattachment |
| de-modal-verb | Multi-token modal+infinitive rewrite |
| es-fr-modal-verb | Multi-token modal+infinitive rewrite (ES/FR) |
| fr-bags | Multi-token BAGS adjective placement |
| fr-clitic-order | Multi-token clitic-pronoun reorder |
| es-personal-a | Multi-token insertion of personal "a" |
| nb-v2 | Multi-token V2 word-order analysis |
| nb-nn-passiv-s | Cross-token passive-s detection |
| de-perfekt-aux | Aux selection (haben/sein) — verb-class + context dependent |
| fr-etre-avoir | Aux selection (être/avoir) — verb-class + context dependent |
| es-pro-drop | Stateful cross-sentence pro-drop reasoning |
| fr-pp-agreement | PP agreement — multi-token + gender/number context |
| es-ser-estar | Ser/estar — semantic + context dependent |
| es-subjuntivo | Subjuntivo trigger-clause analysis |
| fr-subjonctif | Subjonctif trigger-clause analysis |
| doc-drift-de-address | Cross-sentence du/Sie consistency |
| doc-drift-fr-address | Cross-sentence tu/vous consistency |
| doc-drift-nb-passiv-overuse | Whole-document passive-overuse heuristic |
| doc-drift-nb-register | Whole-document register-consistency |
| doc-drift-nn-infinitive | Whole-document e/a-infinitive consistency |

Each STAY rule received a one-line `// exam-audit 33-03: stays safe=false — <reason>` comment immediately above the `exam: { ... }` block, so a future audit knows the rule was considered and why it remains conservative.

## Version Bump

| File | Before | After |
| --- | --- | --- |
| extension/manifest.json | 2.9.11 | 2.9.12 |
| package.json | 2.9.11 | 2.9.12 |
| backend/public/index.html | 2.9.11 | 2.9.12 |

Patch bump (gap-closure phase, no new features). Signals lockdown to re-pin per CLAUDE.md downstream-consumers contract.

## Release Gates — All Green

| Gate | Status |
| --- | --- |
| check-fixtures | PASS (all rule fixture suites P=R=F1=1.000) |
| check-explain-contract + :test | PASS (60/60 rules) |
| check-rule-css-wiring + :test | PASS (59/59) |
| check-spellcheck-features | PASS (NB/EN/DE/ES/FR feature-gate parity) |
| check-network-silence + :test | PASS |
| check-exam-marker + :test | PASS (63 rules + 10 registry entries) |
| check-popup-deps + :test | PASS (4 view modules) |
| check-baseline-bundle-size + :test | PASS (130 KB / 200 KB cap) |
| check-benchmark-coverage + :test | PASS (40/40 expectations: P1 5/5, P2 31/31, P3 4/4) |
| check-governance-data + :test | PASS (5 banks, 116 entries) |
| check-pedagogy-shape + :test | PASS (informational) |
| check-stateful-rule-invalidation + :test | PASS (4/4 doc-drift) |
| test:vocab-store | PASS |
| test:vocab-seam | PASS |
| test:popup-views | PASS |
| test:dict-state-builder | PASS |
| check-bundle-size | PASS (12.67 MiB / 20 MiB cap; 7.33 MiB headroom) |

## Cross-Repo Coordination

- Leksihjelp commits (this plan): per-task atomic commits — exam audit, version bump, summary/state/roadmap.
- Lockdown commit `beadf6b` from 33-02 (sync refresh) was staged-but-not-pushed; pushed in this plan's final ship step.
- Production deploys (papertek.app, lockdown-stb prod) remain DEFERRED per user instruction — staging-only this run.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] es-personal-a placeholder reason contained `"a"` token**
- **Found during:** Task 1 (check-exam-marker run after bulk flip script).
- **Issue:** Bulk-rewriter put unescaped `"a"` inside double-quoted reason string → SyntaxError.
- **Fix:** Manually rephrased the reason to use `'a'` with single quotes inside double-quoted string ("Insertion of personal 'a' before animate direct object").
- **Files modified:** extension/content/spell-rules/es-personal-a.js
- **Commit:** included in audit commit (8b9553b).

**2. [Rule 3 - Blocking issue] fr-aspect-hint already had non-placeholder reason from Phase 32-01**
- **Found during:** Task 1 (bulk script reported "no placeholder reason found in fr-aspect-hint").
- **Fix:** Manually added the audit-stays comment above its `exam: { ... }` block; left the existing Phase-32 reason intact.
- **Commit:** included in audit commit (8b9553b).

## Self-Check: PASSED

- [x] All 49 spell-rule files modified (22 flips + 27 annotations)
- [x] check-exam-marker exits 0 (63 rules + 10 registry entries)
- [x] check-exam-marker:test exits 0 (paired self-test)
- [x] All 24 release gates exit 0
- [x] Bundle stays under 20 MiB cap (12.67 MiB)
- [x] NB baseline stays under 200 KB cap (130 KB)
- [x] Version aligned at 2.9.12 across all 3 files
- [x] SUMMARY.md created
- [x] STATE.md + ROADMAP.md updated
- [x] Phase 33 marked complete in ROADMAP.md
