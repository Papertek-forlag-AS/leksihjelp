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

## Milestone: v2.1 — Compound Decomposition & Polish

**Shipped:** 2026-04-26
**Phases:** 4 code phases (Phase 20 browser verification deferred)
**Plans:** 13
**Duration:** 1 day (2026-04-25 → 2026-04-26), 70 commits

### What Was Built

- **Compound decomposition engine** — `decomposeCompound` splits unknown NB/NN/DE compounds at known noun boundaries with linking elements, recursive up to 4 components, 0% FP on full nounbank validation.
- **Dictionary + spell-check compound integration** — "Samansett ord" popup card with clickable components; compound acceptance in spell-check; NB/NN compound gender mismatch; sarskriving expansion then decomposition fallback removal.
- **Spell-check polish** — Manual trigger button with toast, demonstrative-gender rule, triple-letter typo rule.
- **NB/NN s-passive detection** — Papertek data enrichment (648 NB + 435 NN forms); vocab-seam sPassivForms index; NN finite s-passive rule; NB overuse hint; deponent recognition; algorithmic presens derivation.
- **Unit test suite** — 58 tests across 4 files, first formal test suite beyond regression fixtures.

### What Worked

- **Gap closure plans within phases** — Plans 17-04 through 17-06 and 19-03 were gap-closure plans added mid-phase rather than decimal-phase inserts. This kept phase count clean while still catching integration issues. The gap closure pattern has graduated from "audit-driven decimal insert" to "inline plan addition."
- **Both-sides validation as primary FP guard** — Requiring both split components to be known nouns eliminated phantom compounds entirely. The decision to validate strictly upfront meant downstream consumers (sarskriving, gender inference) never had to second-guess decomposition results.
- **Supplementary compounds over decomposition fallback** — When sarskriving's decomposition fallback produced 6 FP suites, instead of tuning the fallback, we removed it entirely and added 16 supplementary compounds to the stored list. Zero recall loss, zero FP. Simple beats clever.
- **Algorithmic derivation over data round-trip** — NN presens derivation (-ast → -est) was implemented algorithmically in `buildSPassivIndex` rather than waiting for Papertek API enrichment. Unblocked the phase in minutes.

### What Was Inefficient

- **Phase 20 never executed** — Browser visual verification was planned as the final phase but never started. VERIF-01 has now been deferred across two milestones (v2.0 → v2.1 → next). The pattern suggests browser verification should be embedded in each code phase rather than batched at the end.
- **`one_liner` frontmatter still missing from SUMMARYs** — Third milestone in a row where `gsd-tools milestone complete` extracted 0 accomplishments. Should either add `one_liner` to SUMMARY template or abandon the extraction approach entirely.

### Patterns Established

- **Gap closure as inline plans, not decimal phases** — When gaps are small (single rule fix, fixture expansion), add a plan within the existing phase rather than creating a decimal phase. Decimal phases are for cross-phase integration gaps found by audit.
- **Both-sides validation for any acceptance path** — When adding a new "accept as valid" path (compound decomposition, sarskriving expansion), require evidence from both sides of the split/match before accepting. This prevents phantom matches.
- **Unit test suite per phase** — v2.1 established the first per-phase unit test files (`test/phase-{N}-unit.test.js`). Plain Node.js + assert, no framework dependency.

### Key Lessons

1. **Browser verification shouldn't be a separate phase.** It keeps getting deferred because it has no code output and no clear owner. Next milestone should integrate browser checks into the code phase that introduces the visual change. (Learned: Phase 20 deferred twice.)
2. **Supplementary data beats algorithmic fallback for narrow scope.** When sarskriving needed 16 more compounds to preserve recall without the decomposition fallback, adding data was faster, safer, and more maintainable than tuning the algorithm. (Learned: Phase 17-06.)
3. **Inline gap closure is more efficient than decimal phases.** Plans 17-04 through 17-06 closed gaps without the overhead of a new phase directory, research, and planning cycle. Reserve decimal phases for gaps that span multiple phases. (Learned: Phase 17.)

### Cost Observations

- **Model mix:** Opus 4.6 for orchestration and execution, Sonnet 4.6 for research and plan-checking.
- **Sessions:** ~3 sessions across 1 day. High throughput from accumulated v1.0/v2.0 infrastructure.
- **Notable:** v2.1 shipped in 1 day (vs v2.0's 2 days, v1.0's 4 days). Velocity continues to increase as release gate infrastructure and fixture harness absorb more of the verification burden.

---

## Milestone: v2.2 — Student Language Intelligence

**Shipped:** 2026-04-27
**Phases:** 4 (2 planned + 2 audit-driven decimal inserts: 21.1, 21.2)
**Plans:** 5
**Duration:** 1 day (2026-04-26 → 2026-04-27), 28 commits

### What Was Built

- **False-friend warning banners** — `renderFalseFriends` in popup.js and floating-widget.js; ~56 curated NB→EN/DE/ES/FR pairs from Papertek API `falseFriends` field.
- **Sense-grouped translations** — `renderSenses` replaces flat translation list with expandable sense headers; prevents "grab first translation" errors.
- **Cross-language enrichment pipeline** — Reverse `linkedTo` index pattern: NB canonical source, Map-based O(1) in popup, linear scan in floating-widget.
- **Data pipeline fixes** — Two gap-closure phases (21.1, 21.2) fixed enrichment routing and missing `linkedTo` entries at Papertek API.
- **å/og confusion detection** — `nb-aa-og.js` (priority 15) with posture-verb exception set; 12 regression fixtures.
- **Unit test expansion** — 6 new tests for dictionary intelligence + å/og confusion.

### What Worked

- **NB-as-canonical-source pattern** — Using NB entries as the single source for `falseFriends` and `senses` data, with reverse `linkedTo` indexes at render time, meant only one API schema extension was needed. Target-language entries get enriched automatically.
- **Audit-driven gap closure continues to pay off** — Phase 21.1 caught that rendering functions existed but received wrong data (enrichment pipeline not wired). Phase 21.2 caught 2 missing `linkedTo` entries at Papertek API. Both were single-plan fixes caught before shipping.
- **Independent phases enable parallel progress** — Phases 21 and 22 had no dependency on each other. å/og detection shipped independently of dictionary intelligence, reducing critical path.
- **Posture-verb exception set was the right abstraction** — Rather than trying to parse progressive aspect generally, a closed set of 4 posture verbs (sitter/står/ligger/går) with explicit og+verb pattern matching eliminated all known false positives cleanly.

### What Was Inefficient

- **`one_liner` frontmatter still missing** — Fourth milestone in a row where SUMMARY files lack the `one_liner` field. This is now clearly a template issue, not a per-session oversight.
- **Version skew accumulated** — package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1 was flagged by audit but not fixed during the milestone. Version alignment should be a phase-zero housekeeping task.
- **VERIF-01 carried across 3 milestones** — 12 deferred browser visual tests have now accumulated across v2.0, v2.1, and v2.2. The pattern of deferring browser verification is a process smell.

### Patterns Established

- **Reverse enrichment index for cross-language data** — NB entries hold canonical data; target entries are enriched via reverse `linkedTo` lookup at render time. Popup uses Map for O(1); floating-widget uses linear scan for simplicity.
- **Dedicated rule for common errors** — å/og was extracted from the generic homophones rule to a dedicated `nb-aa-og.js` with its own exception logic. Common errors deserve dedicated treatment.
- **Data pipeline validation across API boundaries** — Gap-closure phases 21.1 and 21.2 validated that data round-trips (Papertek API → sync → bundled JSON → render pipeline) actually deliver visible output. Unit tests can't catch these integration seams.

### Key Lessons

1. **Enrichment pipelines need end-to-end validation.** Phase 21 shipped rendering functions that technically worked but received no data because the enrichment wasn't wired. Integration tests that verify "data reaches the UI" are worth the investment. (Learned: Phase 21.1.)
2. **Cross-API data fixes are cheap but non-obvious.** Phase 21.2 was a 1-plan fix for 2 missing `linkedTo` entries at Papertek. The fix itself was trivial, but discovering the gap required tracing the full data flow from API → sync → bundle → render. (Learned: Phase 21.2.)
3. **Deferred browser verification is tech debt, not a backlog item.** Three milestones of deferral means the pattern is broken. Next milestone should either embed browser checks in code phases or explicitly decide they're not needed.

### Cost Observations

- **Model mix:** Opus 4.6 for orchestration and execution.
- **Sessions:** ~2 sessions, 1 day. Smallest milestone yet by commit count.
- **Notable:** v2.2 was the most focused milestone — 12 requirements, 5 plans, all in one domain (dictionary intelligence + å/og). Tight scope enabled fast delivery.

---

## Milestone: v3.0 — Data-Source Migration

**Shipped:** 2026-04-27
**Phases:** 1 (consolidated — 8 plans in a single phase)
**Plans:** 8 (6 planned + 2 gap-closure)
**Duration:** 1 day (2026-04-27), 28 commits

### What Was Built

- **Papertek API vocabulary endpoints** — Bundle + revisions endpoints in sibling repo with CORS, ETag/304, pre-gzip compression (DE wire size 4.45 MB → ~795 KB).
- **IndexedDB cache adapter + baseline-first hydration** — `vocab-store.js` IDB adapter; `vocab-seam.js` loads NB baseline synchronously, swaps to full indexes asynchronously; schema_version gating.
- **NB baseline + service-worker bootstrap** — `build-nb-baseline.js` filters to top-2k Zipf + pronouns/articles/typos (~130 KB); auto-download on install; popup status pills with offline error differentiation.
- **Update detection + manual refresh** — Startup revision check; "Nye ordlister tilgjengelig" notice; atomic cache replacement via IndexedDB transaction.
- **Silent v2→v3 migration** — `onInstalled` migration trigger; 20 bundled data files removed; test fixtures migrated to `tests/fixtures/vocab/`.
- **Release gates** — SC-06 carve-out for sanctioned bootstrap fetch + `check-baseline-bundle-size` (200 KB cap) with paired self-test.

### What Worked

- **Consolidated single phase with wave ordering** — Used 1M context window to run all 8 plans in one phase with natural wave dependencies (API first → cache adapter → bootstrap/updater → migration → gates → gap closure). Eliminated inter-phase coordination overhead.
- **Pre-gzip as targeted fix** — When DE bundle hit 4.45 MB (30 KB under Vercel's 4.5 MB cap), module-cached pre-gzip compression was a surgical fix that dropped wire size to ~795 KB without changing the bundle contract. Plans 23-03/04 inherited comfortable headroom.
- **IDB clean break over dual-shape support** — Renaming from `leksihjelp-vocab` v2 to `lexi-vocab` v3 meant no dual-shape support code. Old DB sits inert; new data downloads fresh. Simple and debuggable.
- **Gate-first development for new infra** — Plan 23-06 shipped the baseline cap gate and SC-06 carve-out *before* Plan 23-03 built the baseline and Plan 23-05 removed bundled data. The gate was ready to catch regressions from the moment the artifacts appeared.
- **Gap closure plans within the phase** — Plans 23-07 (REQUIREMENTS checkbox fix + nn/clean fixture) and 23-08 (offline install browser verification) closed verification gaps without needing a decimal phase.

### What Was Inefficient

- **SCHEMA-01 developer-view UX not delivered** — Plan 23-02 emitted `lexi:schema-mismatch` via `chrome.runtime.sendMessage` but plans 23-04/05 (which were supposed to subscribe and surface "Versjonskonflikt") never implemented the popup subscriber. User gets generic error pill instead. The gap is dormant (schema_version=1 on both sides) but is a known debt.
- **`one_liner` frontmatter still absent** — Fifth milestone in a row. At this point the extraction approach is confirmed broken.
- **check-fixtures exits 1 from pre-existing failures** — 5 suites outside Phase 23 scope (de/doc-drift, nb/homophone, nb/saerskriving, nn/typo, de/verb-final) have been failing since v2.0/v2.1. The verification report overstated gate status. These should be triaged or the fixture should split clean-exit from regression tracking.
- **Stale BUNDLED_LANGS list** — `vocab-seam.js` still lists nn/en as bundled after plan 23-05 deleted those files. Cosmetic but symptomatic of incomplete cleanup after data removal.

### Patterns Established

- **Consolidated mega-phases for 1M context** — With 1M context, a single phase with 8 wave-ordered plans is more efficient than 3-4 smaller phases with inter-phase coordination. Reserve multi-phase milestones for genuinely independent work streams.
- **Gate-first development** — Ship the release gate before the artifact it guards. The gate catches regressions from the moment the artifact lands, and paired self-tests validate the gate itself.
- **Sanctioned exception documentation** — When an architectural constraint (SC-06 network silence) needs an exception, document the exception *and* add a self-test that asserts the exception path stays green. Belt-and-braces.
- **Test fixture migration with resolveDataFile()** — When bundled data files are deleted, fixtures need an independent data source. The `resolveDataFile()` pattern (fixtures/vocab/ first, extension/data/ second) keeps gates green across the deletion boundary.

### Key Lessons

1. **Cross-plan promise tracking needs enforcement.** Plan 23-02 promised "Plan 04/05 will subscribe to `lexi:schema-mismatch`" but nobody tracked the promise. A "provides/requires" contract in plan frontmatter could catch these — the provides side emits a message, the requires side subscribes. (Learned: SCHEMA-01 gap.)
2. **Consolidated phases are faster but harder to verify.** One phase with 8 plans shipped in 1 day, but the verification report had to check 8 plan-to-plan integration paths rather than just inter-phase boundaries. The wave structure helped, but verification effort scales with plan count, not phase count. (Learned: 23-VERIFICATION.md.)
3. **Pre-existing fixture failures are tech debt that compounds.** The 5 failing suites from v2.0/v2.1 weren't triaged, so the check-fixtures gate became a "known-fail" gate. When the verification report claimed "exits 0," it was wrong. Known failures should be addressed or quarantined between milestones.
4. **Bundle size drops are dramatic when data moves to API.** 12.59 MiB → 7.61 MiB by removing bundled vocab. The NB baseline at 130 KB is <2% of the original data footprint. This validates the data-source architecture memory from v1.0.

### Cost Observations

- **Model mix:** Opus 4.6 for orchestration and execution, Sonnet 4.6 for integration checking and verification.
- **Sessions:** ~2 sessions, 1 day. Sibling-repo API work (plan 23-01) was the longest single plan.
- **Notable:** The consolidated single-phase approach eliminated all inter-phase context switches. Total execution time (excluding API deployment) was under 1 hour for 7 plans. This is the highest velocity per plan of any milestone.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Decimal Inserts | Release Gates | Key Change |
|-----------|--------|-----------------|---------------|------------|
| v1.0 | 5 planned | 3 (02.1, 03.1, 05.1) | 8 | Established regression fixture + 8-gate release checklist + decimal-phase pattern for audit-driven inserts |
| v2.0 | 10 planned | 2 (14.1, 15.1) | 9 | Structural grammar engine + 5-language coverage + benchmark-driven validation + document-state two-pass runner |
| v2.1 | 4 code + 1 deferred | 0 (gaps closed as inline plans) | 9 | Compound decomposition + spell-check polish + s-passive detection + first unit test suite |
| v2.2 | 2 planned | 2 (21.1, 21.2) | 9 | Dictionary intelligence (false-friends + sense-grouped translations) + å/og confusion detection |
| v3.0 | 1 consolidated | 0 (gaps closed as inline plans) | 10 | Data-source migration: bundled vocab → API + IndexedDB cache; bundle 12.59→7.61 MiB |

### Cumulative Quality

| Milestone | Fixture Cases | Release Gates | Unit Tests | Zero-Dep Additions |
|-----------|---------------|---------------|------------|---------------------|
| v1.0 | 262 | 8 | 0 | 1 (fixture + gates are pure Node scripts — no npm deps added) |
| v2.0 | 3,326 | 9 | 0 | 0 (all structural rules use `Intl.Segmenter` — browser built-in, no deps) |
| v2.1 | 3,326+ | 9 | 58 (phases 16-19) | 0 (compound decomposition + s-passive = pure heuristic, no deps) |
| v2.2 | 3,326+ (12 new å/og) | 9 | 64 (+6 v2.2) | 0 (enrichment pipeline + å/og rule = pure heuristic, no deps) |
| v3.0 | 3,326+ (nn/clean narrowed) | 10 | 64 | 1 (fake-indexeddb devDep for vocab-store tests) |

### Recurring Themes

- **Fixture ≠ browser** — v1.0: SC-01 vocab shape divergence. v2.0: 9 missing vocab-seam getters. Same root cause, same fix pattern. A parity gate would prevent recurrence.
- **Gap closure evolving** — v1.0/v2.0: decimal phases (5 total). v2.1: inline plans within existing phases (17-04 through 17-06, 19-03). The pattern is maturing — small gaps get inline plans, cross-phase gaps get decimal phases.
- **Data-logic separation compounds** — v1.0 established it for typo banks; v2.0 extended it to trigger tables; v2.1 extended it to s-passive forms and deponent marking. Every phase benefited.
- **Browser verification keeps slipping** — deferred from v2.0 to v2.1 to next milestone. Need to embed visual checks in code phases rather than batching.
- **Velocity increases with infrastructure** — v1.0: 8 phases / 4 days. v2.0: 12 phases / 2 days. v2.1: 4 phases / 1 day. v2.2: 4 phases / 1 day. v3.0: 1 phase (8 plans) / 1 day. Release gates, fixture harness, and plugin architecture are compounding investments.
- **SUMMARY `one_liner` extraction never works** — 5/5 milestones have needed manual accomplishment curation. The template approach is confirmed broken.
- **Version skew accumulates silently** — package.json/manifest.json/index.html diverge between milestones because version bumps are a release-time step, not a per-phase step.
- **Pre-existing fixture failures compound** — check-fixtures has been "known-fail" since v2.0; 5 suites outside active scope keep failing. Need triage or quarantine.
- **Consolidated phases suit 1M context** — v3.0 proved that a single 8-plan phase with wave ordering is more efficient than 3-4 smaller phases when the context window is large enough.

---
*Retrospective updated: 2026-04-27 after v3.0 Data-Source Migration milestone*
