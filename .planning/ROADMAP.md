# Roadmap: Leksihjelp — Spell-Check & Prediction Quality Milestone

**Created:** 2026-04-17
**Depth:** standard
**Profile:** quality
**Parallelization:** enabled

## Overview

This milestone upgrades Leksihjelp's Norwegian spell-check (NB/NN) and word-prediction (all 6 languages) from "v1 proof of concept" to "production-quality tool students reach for first." The journey follows an explicit data-and-architecture-first build order: extract a shared vocab layer, lock behavior with a regression fixture, land frequency and typo-bank data (the ranking fix lever), restructure rules into pluggable files so ranking and scoring improvements are safe, drive down false positives on NB/NN, and finally add student-facing explanation copy and UX polish. Every phase is independently shippable — a GitHub Release can cut after any phase without leaving the product in a worse state than the previous release. No ML, no paid APIs, no premium gating. Spell-check stays free, offline, and extension-side.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation (Vocab Seam + Regression Fixture)** - Extract `__lexiVocab` and land a ground-truth fixture harness so all later work is safety-netted ✓ Complete 2026-04-18
- [ ] **Phase 2: Data Layer (Frequency, Bigrams, Typo Bank)** - Ship Zipf frequency tables, expanded bigrams, and coordinated typo-bank growth in `papertek-vocabulary`
- [ ] **Phase 3: Rule Architecture & Ranking Quality** - Rule-plugin refactor plus frequency-aware ranking for spell-check and word-prediction across all 6 languages
- [ ] **Phase 4: False-Positive Reduction on NB/NN** - Proper-noun guard, dialect tolerance, code-switching detection, and production-quality særskriving
- [ ] **Phase 5: Student Experience Polish** - Student-friendly "why flagged?" explanations and top-3 capped suggestions with "vis flere" reveal

## Phase Details

### Phase 1: Foundation (Vocab Seam + Regression Fixture)
**Goal**: Runtime vocab indexes move into a shared module that both spell-check and word-prediction consume, and a node-script regression harness locks current NB/NN behavior so every subsequent rule or weight change is measurable.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Spell-check no longer depends on word-prediction's load order — a developer can disable word-prediction and spell-check still initializes and flags errors correctly on a sample NB page
  2. A developer can run `node scripts/check-fixtures.js nb` and see pass/fail output plus precision/recall per error class for at least 4 rule classes (gender, modal-verb, særskriving, typo)
  3. Adding a known-failing test case to `fixtures/nb/*.jsonl` causes the script to exit non-zero; fixing the rule causes it to exit zero — verified by the developer in one commit cycle
  4. Grepping spell-check source confirms zero imports from `word-prediction.js` internals and zero references to premium/subscription state — the module is extractable to `skriv.papertek.app` in principle
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Build vocab-seam-core.js (pure index builder) + vocab-seam.js (browser IIFE owning vocab loading)
- [x] 01-02-PLAN.md — Extract spell-check-core.js, refactor consumers to read __lexiVocab, delete __lexiPrediction, reorder manifest
- [x] 01-03-PLAN.md — Author scripts/check-fixtures.js + 10 seed JSONL fixture files + README + CLAUDE.md release-workflow update (checkpoint)

### Phase 2: Data Layer (Frequency, Bigrams, Typo Bank)
**Goal**: The data foundations that pay twice — frequency tables and expanded bigrams for NB/NN plus additional typo-bank coverage in `papertek-vocabulary` — are bundled and synced, keeping the extension under the 10 MB budget.
**Depends on**: Phase 1 (fixture in place so data-driven regressions are detectable)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A developer can run `npm run build-frequencies` and produces `extension/data/freq-nb.json` and `extension/data/freq-nn.json`, each under 200 KB gzipped, from an NB N-gram 2021 source dataset
  2. Running `npm run sync-vocab` pulls a visibly larger typo bank from `papertek-vocabulary` into `extension/data/*.json`, and the regression fixture shows higher recall on NB typo test cases without new false positives on NN
  3. `extension/data/bigrams-nb.json` and `extension/data/bigrams-nn.json` contain materially more high-frequency pairs than before (verifiable in a diff), still in the existing `{prev: {next: weight}}` schema
  4. Total packaged extension zip size from `npm run package` stays within the 10 MB ceiling, verified in the release checklist
**Plans:** 4 plans
Plans:
- [x] 02-01-PLAN.md — DATA-01: build-frequencies.js streaming NB N-gram 2021 → extension/data/freq-{nb,nn}.json sidecars (Wave 1, autonomous) ✓ Complete 2026-04-18
- [x] 02-02-PLAN.md — DATA-03: build-bigrams.js regrowing extension/data/bigrams-{nb,nn}.json via max-merge with hand-authored idioms (Wave 1, autonomous) ✓ Complete 2026-04-18
- [x] 02-03-PLAN.md — DATA-02: typo-bank expansion in papertek-vocabulary + Phase-1 data-defect fixes + sync (Wave 1, human-verify checkpoint for cross-app push) ✓ Complete 2026-04-18
- [ ] 02-04-PLAN.md — Bundle-size gate: check-bundle-size.js + JSON minification in npm run package + CLAUDE.md Release Workflow step (Wave 2, autonomous)

### Phase 3: Rule Architecture & Ranking Quality
**Goal**: Spell-check rules are refactored into `extension/content/spell-rules/` as a plugin registry, and the frequency signal plus tiebreaking improvements land for both spell-check fuzzy matching and word-prediction across all six languages — turning the Zipf data into visible ranking wins.
**Depends on**: Phase 1 (vocab seam + fixture), Phase 2 (frequency data available)
**Requirements**: INFRA-03, SC-01, SC-06, WP-01, WP-02, WP-03, WP-04
**Success Criteria** (what must be TRUE):
  1. A developer can add a new error class by creating one file under `extension/content/spell-rules/` (with `{ id, languages, priority, check, explain }`) without editing `spell-check.js` — demonstrated by a scratch rule that lights up in a test page
  2. Typing `berde` in an NB document shows `bedre` as the top spell-check suggestion, not `berre` — verified via a regression fixture case
  3. In word-prediction across DE/ES/FR/NB/NN/EN, the top-3 suggestions for a shared-prefix query (e.g., typing "ber" in NB) are visibly ranked by frequency and bigram context rather than by arbitrary insertion order — verified by manual inspection in at least 3 of the 6 languages
  4. DevTools Network tab shows zero outbound requests from spell-check or word-prediction code paths during a 30-second typing session (SC-06 constraint: no new external dependencies, stays free and offline)
  5. Sampled top-3 word-prediction suggestions feel useful to a developer reviewer in at least 80% of test scenarios (measurement method: review at least 20 sampled contexts per language against a simple yes/no "would a learner find this useful?" judgment)
**Plans**: TBD

### Phase 4: False-Positive Reduction on NB/NN
**Goal**: Proper-noun guard, dialect tolerance, code-switching detection, and particularly særskriving all pass the regression fixture's precision/recall thresholds — so the tool stays quiet on correct Norwegian text, tolerates mixed-language documents, and only fires særskriving when it's genuinely wrong.
**Depends on**: Phase 1 (fixture), Phase 3 (rule architecture + frequency signals)
**Requirements**: SC-02, SC-03, SC-04, SC-05
**Success Criteria** (what must be TRUE):
  1. A sample Norwegian news article (at least 500 words) pasted into a `<textarea>` produces no false positives on proper nouns, loan words, or capitalized names — verified by manual inspection
  2. Typing `ikkje` in an NB document does not produce a spell-check flag, and typing `ikke` in an NN document does not produce a spell-check flag — verified via fixture cases in both directions
  3. A paragraph of English or German quoted inside an NB document produces no forest of flags — at most 1 flag per paragraph, not per word — verified via fixture case with ≥3 contiguous non-Norwegian tokens
  4. The særskriving rule's precision and recall, measured against the regression fixture, meet thresholds set during Phase 1 — verified by the fixture script output in the release notes
**Plans**: TBD

### Phase 5: Student Experience Polish
**Goal**: The spell-check popover explains errors in student-friendly Norwegian instead of bare class labels, and both spell-check popovers and word-prediction dropdowns cap visible suggestions at top-3 with a "vis flere" reveal — reducing cognitive load for dyslexic learners.
**Depends on**: Phase 4 (rule IDs stable, so explanation copy does not need rework)
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Clicking any of the four NB/NN spell-check error classes (gender, modal-verb, særskriving, typo) shows a short student-friendly rationale in the popover — not the bare class label "Skrivefeil" or "Kjønn"
  2. When there are more than 3 spell-check suggestions or word-prediction candidates, the UI shows only the top 3 with a "vis flere" / "show more" control; clicking reveals the rest
  3. A dyslexic-persona reviewer (or a proxy reviewer using the dyslexia persona criteria from PROJECT.md) confirms that the popover copy avoids jargon, explains the rule in one short sentence, and does not read as accusatory
  4. Explanation copy is present for both NB and NN register for each of the four error classes — verified by a one-screen copy review document alongside the release
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

**Parallelization notes:**
- Phase 2's DATA-02 (papertek-vocabulary typo-bank work) has cross-app lead time and can start as soon as Phase 1's fixture lands, in parallel with DATA-01 and DATA-03.
- Phase 3's WP-01..WP-04 (word-prediction ranking, all 6 languages) and SC-01 (Zipf tiebreaker, NB/NN) can execute as parallel plans once INFRA-03 lands.
- Phase 4's SC-02, SC-03, SC-04 are independent rule files under the Phase 3 plugin architecture and can execute as parallel plans.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation (Vocab Seam + Regression Fixture) | 3/3 | Complete | 2026-04-18 |
| 2. Data Layer (Frequency, Bigrams, Typo Bank) | 2/4 | In Progress | - |
| 3. Rule Architecture & Ranking Quality | 0/TBD | Not started | - |
| 4. False-Positive Reduction on NB/NN | 0/TBD | Not started | - |
| 5. Student Experience Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-17*
