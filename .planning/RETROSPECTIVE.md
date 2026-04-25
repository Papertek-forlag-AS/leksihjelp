# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Spell-Check & Prediction Quality

**Shipped:** 2026-04-21
**Phases:** 8 (5 planned + 3 audit-driven decimal inserts: 02.1, 03.1, 05.1)
**Plans:** 29
**Duration:** 4 days (2026-04-18 → 2026-04-21), 133 commits

### What Was Built

- **Vocab seam + regression fixture** — `__lexiVocab` shared module; `scripts/check-fixtures.js` with 262 NB/NN cases, P/R/F1 gated per rule.
- **Data foundation** — NB N-gram 2021 Zipf tables, expanded bigrams, typo-bank growth in `papertek-vocabulary`; 20 MiB bundle-cap gate.
- **Plugin rule architecture + Zipf ranking** — `extension/content/spell-rules/*.js`; frequency-aware spell-check fuzzy matching + word-prediction ranking across 6 languages.
- **NB/NN false-positive reduction** — proper-noun guard, code-switching density window, cross-standard `nb-dialect-mix` rule, særskriving at P≥0.92/R≥0.95.
- **Student-facing polish** — `rule.explain` callable on 5 rules; NB/NN register badge; top-3 cap with Vis flere reveal; XSS-guard fixture.
- **8 release gates** — fixtures, explain-contract + self-test, rule-CSS wiring + self-test, feature-independent indexes, network silence, bundle size. All exit 0 on main.

### What Worked

- **Audit-driven decimal phases** — Phases 02.1, 03.1, and 05.1 were all inserted mid-milestone when audits caught specific gaps (bundle-size framing, SC-01 browser wiring, UX-01 smoke-test bugs). Each closed a concrete defect without renumbering planned work; decimal numbering made the "urgent insert vs. planned" distinction self-explanatory in commits and the roadmap.
- **Release gates as structural load-bearing** — by the end of v1.0, 8 gates fail loudly on regressions. Several of them were authored specifically because a bug got past all prior gates (`check-rule-css-wiring` exists because the dialect-mix dot painted transparent despite all other gates passing). Paired self-tests (`check-X.test.js`) ensure the gate itself doesn't go permissive.
- **Honest ground-truth fixtures** — every acceptance case authored before observing tool output. This was the reason fixture expansions caught rather than masked regressions.
- **Separation of "data" and "rules"** — data problems (NN -a/-e infinitive drift, `blåt` → `blått` adjective declension) routed to `papertek-vocabulary`. Rule problems stayed in the extension. The rule that tried to paper over a data problem became an anti-pattern detector.
- **Single-session Chrome smoke test** — 11 scenarios run in one go against the packaged `.zip` surfaced 4 bugs that fixture + gates did not catch (feature-gated lookup index bug, modal-verb bare-infinitive silence, dialect-mix fire-gate wrong source, dialect-mix transparent dot). The smoke test is now a mandatory pre-tag step.

### What Was Inefficient

- **SC-01 integration gap** — Phase 3 shipped Zipf tiebreaker with passing fixture, but `spell-check.js:runCheck` assembled a 5-field vocab object that omitted `freq`. The tiebreaker was dead in browser and passed in fixture because the fixture loaded the full `buildIndexes()` output. Root cause: fixture and browser used different vocab-object shapes. **Fix forward:** adapter-contract source-regex guard in `check-fixtures.js` that fires loud if the two shapes diverge. Cost: one decimal phase (03.1) to close + half a day.
- **Phase 5 smoke test after ship, not before** — UX-01 went complete on Phase 5 documentation, but Chrome smoke surfaced 4 defects (one data: `blå_adj`; three rule: modal-verb silent, dialect-mix wrong fire-gate, dialect-mix no CSS). **Fix forward:** smoke test *is* part of phase completion, not post-hoc. Applied immediately in Phase 05.1 plan.
- **SC-03 policy discovery late** — Phase 4 shipped the NB↔NN `sisterValidWords` rail under a "dialect tolerance" framing. Phase 5 smoke test was the first time the user articulated the flag-not-tolerate policy. Reversal cost one decimal phase plan (05.1-04). **Fix forward:** user memory `project_nb_nn_no_mixing.md` captures the policy permanently; future NB/NN rules consult it before shipping.
- **`gsd-tools milestone complete` accomplishment extraction** — CLI extracted 0 accomplishments from SUMMARY.md files because none had the `one_liner` frontmatter field. Fell back to manual curation from audit + ROADMAP. **Fix forward:** either populate `one_liner` in SUMMARY frontmatter going forward, or add an alternate extraction path (first bullet of the `provides:` list).
- **REQUIREMENTS.md body-checkbox drift** — two doc-only drifts (SC-03 body, SC-05 checkbox) survived until milestone-complete audit caught them. Phase-close wasn't tight enough about ticking the requirement checkbox as the *last* step. **Fix forward:** add "REQUIREMENTS.md checkbox + trace row updated" to the phase-close success criteria.

### Patterns Established

- **Decimal phase numbering for audit-driven inserts** (02.1, 03.1, 05.1). Plans within the decimal phase are numbered `02.1-01`, `02.1-02`, etc. Roadmap preserves integer-phase numbering for planned work.
- **Paired self-test for release gates** — every `check-X.js` script ships with `check-X.test.js` that plants a scratch broken-shape fixture and asserts the gate fires, plus a well-formed fixture and asserts the gate passes. Prevents the gate going silently permissive via regex/shape drift.
- **Adapter-contract source-regex guards** — when the same data crosses a runtime boundary (Node fixture vs. browser extension), a source-regex guard in the gate asserts both sides read the same shape. Prevents "passes in fixture, dies in browser" drift.
- **Data fixes at `papertek-vocabulary`, rule fixes in extension** — cross-repo discipline. Extension never hand-edits `extension/data/*.json`; it syncs. The data source is single-truth for three consumers.
- **User memories as domain-policy anchors** — `project_nb_nn_no_mixing.md`, `project_data_source_architecture.md`, `project_phase5_manual_spellcheck_button.md` capture policy that isn't derivable from code. Planning consults them before scoping.
- **Honest ground-truth fixtures** — hand-author acceptance cases *before* observing tool output. Applied in Phases 1, 3, 4 fixture expansions.

### Key Lessons

1. **Fixture passing ≠ browser working.** Fixture and browser runtime must share the same vocab-object shape; add a guard that asserts it, or they will drift. (Learned: Phase 03.1.)
2. **Smoke test is part of phase completion.** Not post-ship, not optional. A 15-minute live Chrome test catches defects that 262 fixture cases and 8 release gates miss. (Learned: Phase 05.1.)
3. **Policy calls belong in user memory before they belong in code.** The NB↔NN tolerate-vs-flag question is not a technical decision; it's a domain-policy one. Writing the memory first would have avoided a Phase 4 → Phase 05.1 reversal. (Learned: Phase 05.1 Gap D.)
4. **Every release gate needs a self-test.** A gate without a paired self-test can go permissive silently and you won't know until a smoke test hurts you. (Learned: Phase 05.1 Gap D → `check-rule-css-wiring:test`.)
5. **Decimal phases are a feature, not a mess.** Audits surface integration gaps; decimal phases close them cleanly. Treat decimal-phase count as a signal the audit system is working, not as scope creep.
6. **The fixture is the release-gate backbone.** 262 hand-authored cases caught every committed regression. Without the fixture, the 8 gates would all be trust-me claims. Invest in the fixture before investing in anything else.

### Cost Observations

- **Model mix:** predominantly Opus 4.7 (quality profile) with some Sonnet 4.6 for deterministic edits. No Haiku usage of note.
- **Sessions:** roughly one per phase, occasionally two for Phases 4 + 5 + 05.1 (research → plan → execute → verify).
- **Notable:** The `yolo` config mode (auto-approve scope, auto-approve plan, run verifier) kept throughput high. Audit was run separately and caught the 2 doc-drift items before tag. The combination (yolo + audit) produced a lower confirmation-interrupt rate than interactive mode with higher gap-catch than plain yolo.

---

## Milestone: v2.0 — Depth of Coverage: Grammar Governance Beyond Tokens

**Shipped:** 2026-04-25
**Phases:** 12 (10 planned + 2 audit-driven decimal inserts: 14.1, 15.1)
**Plans:** 31
**Duration:** 2 days (2026-04-24 → 2026-04-25), ~140 commits

### What Was Built

- **Structural infrastructure** — Sentence segmenter (`Intl.Segmenter`), tagged-token POS view, priority bands (P1/P2/P3), severity contract, quotation-span suppression, document-state two-pass runner.
- **Word-order rules** — NB V2 inversion, DE main-clause V2 + subordinate verb-final, FR BAGS adjective placement.
- **DE case & agreement** — Preposition-case, separable-verb split, perfekt auxiliary, compound-noun gender; shared `grammar-tables.js`.
- **ES structural rules** — ser/estar, por/para trigger tree, personal "a", subjuntivo triggers, pretérito/imperfecto hints, pro-drop, gustar-class syntax.
- **FR structural rules** — Élision, être/avoir auxiliary, PP agreement (10.3a), subjonctif triggers, clitic-cluster ordering.
- **Document-level analysis** — Register drift (DE du/Sie, FR tu/vous, NB bokmål/riksmål, NN infinitive mixing).
- **Morphology & collocations** — EN irregular overgeneration, ES/FR opaque-noun gender, EN word-family POS confusion, cross-language collocation errors (97 seed entries).
- **9 release gates** — added `check-benchmark-coverage`, `check-governance-data`, `check-stateful-rule-invalidation` to the v1.0 base of 8.

### What Worked

- **Research-first phase planning** — Every phase got a dedicated research agent before planning. This caught API constraints (e.g., `Intl.Segmenter` handles all languages, no dependency needed) and surfaced the right data-vs-logic split before code was written.
- **Shared infrastructure pays dividends** — Phase 6's segmenter + Phase 7's tagged-token view were consumed by every subsequent phase. Investment in core infrastructure early meant Phases 8–15 were mostly data-driven rule additions with minimal core changes.
- **`grammar-tables.js` as single data primitive** — One file consumed by DE, ES, FR rules across 6 phases. No rule duplicated trigger-table data.
- **Benchmark-driven validation** — `benchmark-texts/<lang>.txt` + `expectations.json` provided a second axis of correctness beyond fixtures. The benchmark gate caught a Phase 15 regression that fixture-only testing would have missed (the nn/clean false positive).
- **Gap closure pattern matured** — Phase 14.1 (9 missing browser indexes) and Phase 15.1 (27 fixture failures) were both caught by milestone audit and closed cleanly. The audit → gap-plan → execute → re-audit cycle took less than 30 minutes each.
- **Velocity from accumulated patterns** — v2.0 shipped 12 phases in 2 days vs v1.0's 8 phases in 4 days. The release gate infrastructure, fixture harness, and plugin architecture from v1.0 made v2.0 phases mostly additive.

### What Was Inefficient

- **Vocab-seam browser wiring gap (Phase 14.1)** — 9 rules were silently dead in the browser because `vocab-seam.js` lacked getters for indexes built by `vocab-seam-core.js`. Fixtures passed because the fixture runner calls `buildIndexes()` directly, bypassing the browser's getter layer. Root cause: same as v1.0's SC-01 — fixture and browser use different vocab-object assembly paths. **Fix forward:** a future `check-vocab-seam-parity` gate that asserts every `buildIndexes()` key has a matching `vocab-seam.js` getter.
- **`doc-drift-de-address.js` deleted and not noticed** — An executor agent deleted the file during Phase 14 execution. It wasn't caught until Phase 14.1 audit. Root cause: agent made a destructive edit without verifying the file existed post-commit. **Fix forward:** SUMMARY.md spot-check should verify `key-files.created` exist on disk.
- **Fixture co-fire expectations accumulate silently** — As rules from later phases (es-pro-drop, es-gustar, de-v2) started co-firing on fixture cases authored in earlier phases, the expected arrays became stale. 20 of the 27 fixture failures in Phase 15.1 were missing co-fire expectations, not actual logic bugs. **Fix forward:** when adding a new rule, run `check-fixtures --verbose` on all fixture suites for that language and update any cases that now co-fire.
- **`one_liner` frontmatter missing from all SUMMARYs** — Same issue as v1.0. The `gsd-tools milestone complete` accomplishment extraction found 0 one-liners. Fell back to manual curation.

### Patterns Established

- **Phase 6 infrastructure → Phase 7+ consumers** — structural rules should land infrastructure first (segmenter, POS view, shared tables), then language-specific rules consume it. This prevents each rule from re-inventing sentence iteration.
- **`kind: 'document'` two-pass rules** — Document-level analysis (register drift) runs as a post-pass after all token rules, with explicit invalidation protocol.
- **Benchmark expectations as second correctness axis** — Fixtures test rule logic; benchmarks test the end-to-end pipeline on realistic student text.
- **Co-fire awareness** — When a new rule fires on text that an existing fixture covers, update the fixture's expected array. Don't wait for the gate to catch it.
- **FR PP 10.3b pattern: defer complexity, ship the tractable subset** — Adjacent-window PP agreement ships; full corner cases (distance, pronominal reflexive DO) wait for better infrastructure in v3.0.

### Key Lessons

1. **Browser wiring gaps will keep recurring until there's a parity gate.** The vocab-seam getter layer is a manual step that's easy to forget. A `check-vocab-seam-parity` gate would catch it. (Learned: Phase 14.1.)
2. **Co-fire expectations are a maintenance burden that grows quadratically.** Every new rule can co-fire with every existing fixture. Either automate co-fire detection in `check-fixtures`, or accept periodic triage phases. (Learned: Phase 15.1.)
3. **Structural rules are mostly data-driven.** The code for DE preposition-case, ES subjuntivo, FR élision, etc. is ~50-100 LOC wrapper over a trigger table. The hard work is authoring correct trigger data — favor `papertek-vocabulary` enrichment over clever rule logic.
4. **Two days for 42 requirements is achievable when infrastructure exists.** v1.0's 4-day investment in plugin architecture, release gates, and fixture harness made v2.0's throughput possible. Infrastructure investment compounds.
5. **Milestone audit → gap closure → re-audit is a tight loop.** The full cycle (audit → plan gaps → execute → re-audit) took ~1 hour for both 14.1 and 15.1. This is cheap insurance against shipping with broken gates.

### Cost Observations

- **Model mix:** Opus 4.6 for orchestration and execution, Sonnet 4.6 for verification and plan-checking. No Haiku usage.
- **Sessions:** ~5 sessions across 2 days. Multiple phases executed per session.
- **Notable:** The accumulated context from v1.0 (CLAUDE.md, release gates, fixture harness) meant v2.0 phases could be planned and executed with minimal re-orientation. Gap closure phases (14.1, 15.1) were the most efficient — clear scope from audit, no research needed, execute in <30 min each.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Decimal Inserts | Release Gates | Key Change |
|-----------|--------|-----------------|---------------|------------|
| v1.0 | 5 planned | 3 (02.1, 03.1, 05.1) | 8 | Established regression fixture + 8-gate release checklist + decimal-phase pattern for audit-driven inserts |
| v2.0 | 10 planned | 2 (14.1, 15.1) | 9 | Structural grammar engine + 5-language coverage + benchmark-driven validation + document-state two-pass runner |

### Cumulative Quality

| Milestone | Fixture Cases | Release Gates | Smoke-Test Scenarios | Zero-Dep Additions |
|-----------|---------------|---------------|----------------------|--------------------|
| v1.0 | 262 | 8 | 11/11 PASS | 1 (fixture + gates are pure Node scripts — no npm deps added) |
| v2.0 | 3,326 | 9 | Pending (Phases 6/7 browser visuals) | 0 (all structural rules use `Intl.Segmenter` — browser built-in, no deps) |

### Recurring Themes

- **Fixture ≠ browser** — v1.0: SC-01 vocab shape divergence. v2.0: 9 missing vocab-seam getters. Same root cause, same fix pattern. A parity gate would prevent recurrence.
- **Decimal phases close audit gaps cleanly** — 5 across two milestones, all < 1 hour each. The pattern is load-bearing infrastructure, not overhead.
- **Data-logic separation compounds** — v1.0 established it for typo banks; v2.0 extended it to trigger tables, preposition-case maps, and closed-class sets. Every phase benefited.

---
*Retrospective updated: 2026-04-25 after v2.0 Depth of Coverage milestone*
