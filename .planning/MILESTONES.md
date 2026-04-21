# Milestones

## v1.0 Spell-Check & Prediction Quality (Shipped: 2026-04-21)

**Phases completed:** 8 phases (1, 2, 02.1, 3, 03.1, 4, 5, 05.1), 29 plans, 19/19 v1 requirements satisfied.

**Timeline:** 2026-04-18 → 2026-04-21 (4 days, 133 commits)
**Code delta:** 150 files changed, +162,913 / -95,958 lines
**Shipped artifact:** `leksihjelp-2.3.1.zip` (~10.25 MiB / 20 MiB cap)

**Delivered (one sentence):** Norwegian spell-check and word-prediction promoted from v1 proof-of-concept to production quality — Zipf-ranked fuzzy matching, particular-særskriving gated at P≥0.92/R≥0.95, NB↔NN cross-standard detection, student-friendly explain popover — all offline, all free, all extension-side.

**Key accomplishments:**

1. **Vocab seam + regression fixture** (Phase 1) — `__lexiVocab` shared module replaces `__lexiPrediction`; `scripts/check-fixtures.js` runner with 262 hand-authored NB/NN cases across 5 rule classes; P/R/F1 gated per rule; new release-workflow gate.
2. **Data foundation** (Phase 2 + 02.1) — NB N-gram 2021 Zipf frequency tables (`freq-{nb,nn}.json`), expanded bigrams, typo-bank growth in sibling `papertek-vocabulary`; bundle-size release gate at 20 MiB internal engineering ceiling (zip 10.25 MiB, 9.75 MiB headroom).
3. **Plugin rule architecture + Zipf ranking** (Phase 3 + 03.1) — `extension/content/spell-rules/` registry (add a rule = add one file); `nb-typo-fuzzy` + word-prediction ranking both consume frequency signal; SC-01 closed end-to-end after audit caught browser wiring gap (`VOCAB.getFreq()` + `runCheck` vocab literal + adapter-contract guard); `check-network-silence` gate enforces SC-06.
4. **NB/NN false-positive reduction** (Phase 4) — `nb-propernoun-guard` (priority 5, name/loan layers), `nb-codeswitch` (priority 1, density window with `ctx.suppressed`), `sisterValidWords` cross-standard rail, særskriving fixture expanded to 55 NB + 46 NN with THRESHOLDS gate (observed P=1.000 R=1.000).
5. **Student-facing polish** (Phase 5 + 05.1) — `rule.explain: (finding) => ({nb, nn})` callable on 5 popover-surfacing rules; renderExplain 3-way lookup; top-3 suggestions cap with "Vis flere ⌄" reveal; NB/NN register badge in popover header; `check-explain-contract` + `check-rule-css-wiring` release gates.
6. **SC-03 policy reversal — flag cross-standard tokens** (Phase 05.1 Gap D) — reversed earlier NB↔NN dialect tolerance per user domain policy (two distinct official standards): new `nb-dialect-mix.js` (priority 35) with `CROSS_DIALECT_MAP` authoritative fire-gate; typo rules no longer early-exit into sister-valid lookup.
7. **Chrome smoke test + 8-gate release checklist** (Phase 05.1) — 11/11 smoke-test scenarios PASS on `leksihjelp-2.3.1`; 4 inline-discovered browser bugs resolved (feature-gated lookup decouple, modal-verb bare-infinitive silent, dialect-mix CROSS_DIALECT_MAP fire-gate, dialect-mix dot CSS missing); all 8 release gates (fixtures, explain-contract + self-test, rule-CSS wiring + self-test, feature-independent indexes, network silence, bundle size) exit 0.

**See:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase-by-phase roadmap
- `.planning/milestones/v1.0-REQUIREMENTS.md` — final traceability (19/19)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — audit report (passed 19/19, 2 doc-drift items resolved pre-tag)

---

