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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Decimal Inserts | Release Gates | Key Change |
|-----------|--------|-----------------|---------------|------------|
| v1.0 | 5 planned | 3 (02.1, 03.1, 05.1) | 8 | Established regression fixture + 8-gate release checklist + decimal-phase pattern for audit-driven inserts |

### Cumulative Quality

| Milestone | Fixture Cases | Release Gates | Smoke-Test Scenarios | Zero-Dep Additions |
|-----------|---------------|---------------|----------------------|--------------------|
| v1.0 | 262 | 8 | 11/11 PASS | 1 (fixture + gates are pure Node scripts — no npm deps added) |

---
*Retrospective created: 2026-04-21 after v1.0 Spell-Check & Prediction Quality milestone*
