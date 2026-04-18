---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-04-18T18:11:34.671Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 7
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.
**Current focus:** Phase 2 — Data Layer (Frequency + Bigrams + Typo Bank)

## Current Position

Phase: 2 of 5 — Data Layer (Frequency + Bigrams + Typo Bank) — 1 of 4 plans done
Plan: 2 of 4 in Phase 2 (next up: 02-02 bigrams)
Status: Plan 02-01 complete — NB N-gram 2021 → Zipf sidecar JSON shipping DATA-01
Last activity: 2026-04-18 — Plan 02-01 complete (build-frequencies.js + freq-nb.json 13,132 entries / 61 KB gz + freq-nn.json 11,013 entries / 52 KB gz)

Progress: [██▌░░░░░░░] 25%  (Phase 2, 1/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 11m 24s
- Total execution time: 45m 44s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 | 3 | 33m 36s | 11m 12s |
| Phase 02 | 1 | 12m 08s | 12m 08s |

**Recent Trend:**
- Last 5 plans: 4m 24s, 13m 47s, 15m 25s, 12m 08s
- Trend: stable at ~12–15 min per plan. Plan 02-01 (data-layer build script with 1 GB corpus download) on-pace at 12m despite deviations fixing CSV delimiter + Zipf floor estimates.

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 4m 24s | 2 tasks | 2 files |
| Phase 01 P02 | 13m 47s | 2 tasks | 6 files |
| Phase 01-foundation-vocab-seam-regression-fixture P03 | 15m 25s | 3 tasks | 14 files |
| Phase 02-data-layer-frequency-bigrams-typo-bank P01 | 12m 8s | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Project init: Spell-check stays free forever (landing-page promise)
- Project init: Heuristics only, no ML, no paid APIs
- Project init: Iterative releases — each phase independently shippable
- Project init: NB first, NN second for spell-check; all 6 languages for word-prediction
- Project init: Regression fixture is the quality-gate tool for this milestone
- [Phase 01]: vocab-seam surface: getBigrams() returns null (not empty object) when file missing — matches existing consumer null-handling
- [Phase 01]: vocab-seam default grammar predicate when enabledGrammarFeatures storage key missing: () => true (emit superset; consumers filter further)
- [Phase 01]: typoBank is a Map reference-alias of typoFix (same Map, zero memory cost)
- [Phase 01]: Finding contract locked — core emits `rule_id` (not `type`); DOM adapter shims `f.type = f.rule_id` post-call so legacy UI code works unchanged (consumed by Plan 03 fixture harness)
- [Phase 01]: Grammar-feature filtering is seam-level only — word-prediction consumes pre-filtered wordList as-is, single source of truth
- [Phase 01]: Consumer-local derived state (prefixIndex, tense sets) rebuilt via VOCAB.onReady(cb) re-registration on LANGUAGE_CHANGED / GRAMMAR_FEATURES_CHANGED — avoids stale captures without changing the seam API
- [Phase 01]: Fixture cases are hand-authored ground truth, not snapshots of current tool output (pitfall #4) — a case that fails today because of an imperfect rule stays in the fixture; fixing the rule is what flips the exit code back to 0
- [Phase 01]: Fixture exit-code semantics — non-zero on ANY hard mismatch (missing expected OR unexpected flag); P/R/F1 printed but not thresholded in Phase 1 (thresholds deferred to Phase 4 SC-05 per CONTEXT)
- [Phase 01]: Span convention in fixtures is end-EXCLUSIVE (end = start + word.length) and fixture filenames are ASCII-only (`saerskriving.jsonl`, not `særskriving.jsonl`)
- [Phase 01]: Live Chrome smoke test for Phase 1 deferred by user on 2026-04-18 ("I can't test now, but we shouldn't let that block progress — continue and we make the tests later") — to be picked up at release time or during `/gsd:verify-work`
- [Phase 01]: Three pre-existing data-source issues surfaced during fixture authoring (NN verb-infinitive pollution `lese → lese høyt`; NB noun `brev` tagged `m` instead of `n`; typos-in-validWords bypassing curated branch) — NOT rule bugs, data quality issues in `papertek-vocabulary`; natural fit for Phase 2 DATA-02
- [Phase 02-01]: NB N-gram 2021 digibok unigram CSV is **comma-separated** with schema `first,lang,freq,json` (not tab as the plan assumed). Rows where the first cell is CSV-quoted (starts with `"`) are always punctuation-only — fast-reject them. The 4th column is a quoted per-year JSON blob, parsed on first 3 comma positions only.
- [Phase 02-01]: Zipf floor of 3.0 (plan estimate) filters too aggressively for actual NB N-gram 2021 ↔ validWords overlap (~6K entries). Ship with Zipf floor 0.0 as the default — budget enforcer raises floor only if output exceeds 200 KB gzipped. Actual overlap is 13,132 NB / 11,013 NN entries at 61 KB / 52 KB gzipped (69% / 74% headroom).
- [Phase 02-01]: MIN_ENTRIES fail-loud floors are reality-based corruption guards, not ship-quality gates. ~4K of shipped validWords are multi-word phrases (cannot match unigram corpus); another ~2K are deliberate typos. Natural overlap is ~50% of validWords size. Set floors at 5K / 2K to catch true corruption (empty download, wrong lang) without false-alarming on real distribution.
- [Phase 02-01]: `corpus/` gitignore double-safety pattern — root `.gitignore` uses `corpus/*` + `!corpus/.gitignore` (negation so inner ignore tracks itself); inner `corpus/.gitignore` uses `*` + `!.gitignore` (self-exception). Together they guarantee the 1 GB corpus file stays out of git even if the inner file is ever deleted.

### Pending Todos

- Live Chrome smoke test for Phase 1 (deferred 2026-04-18): load `extension/` unpacked, type `en hus` in a textarea, confirm red dot + `et hus` popover, DevTools console clean. Pick up at release time or during `/gsd:verify-work`.

### Blockers/Concerns

- Phase 2 DATA-02 has cross-app blast radius — schema changes in `papertek-vocabulary` affect `papertek-webapps` and `papertek-nativeapps`; coordinate before landing.
- **Phase 2 DATA-02 cross-app rollback protocol (added 2026-04-18 revision 1):** if a sibling-repo push from Plan 02-03 causes a regression in `papertek-webapps` or `papertek-nativeapps` downstream consumers, the rollback sequence is documented inside Plan 02-03 Task 3 ("Rollback Protocol" subsection): `cd /Users/geirforbord/Papertek/papertek-vocabulary && git revert <sha> && git push origin main`, wait for API redeploy, then `cd /Users/geirforbord/Papertek/leksihjelp && npm run sync-vocab && git add extension/data/*.json && git commit -m "revert(02-03): roll back DATA-02 after sibling-repo regression"`. Leksihjelp's local data/*.json files can also be fast-reverted via `git revert` of the Plan 02-03 feat commit while waiting on the upstream.
- **Phase 2 bundle-size 10 MiB ceiling contingency (added 2026-04-18 revision 1):** Plan 02-04's JSON minification strategy may not by itself bring the packaged zip under 10 MiB given the pre-Phase-2 baseline of 10.26 MiB plus new data additions. If minification is insufficient after Plans 02-01 / 02-02 / 02-03 land, Phase 2 closes with success criteria #1-#3 satisfied but #4 **explicitly documented as a deferred Blocker** — a new Phase 2.1 (inserted, per ROADMAP numbering convention) opens to make the size-reduction product decision (e.g., strip bundled `audio/de/` and fetch on first use; trim rarely-used vocab entries; split-bundle the lexicon). The bundle-size gate script from Plan 02-04 still ships and still gates future releases; it just reports FAIL rather than PASS for the Phase-2 close if the ceiling is missed. DO NOT silently ship a release that violates the publicly-stated 10 MB ceiling — either fix it in Phase 2.1 first, or bump the ceiling explicitly with user sign-off.
- Phase 3 code-switching detection needs empirical calibration for Norwegian vs. close Germanic neighbors (Swedish, Danish, German) — research flag from SUMMARY.md.
- Phase 4 særskriving precision/recall thresholds depend on fixture sentences authored in Phase 1 — do not set thresholds until the fixture is in place.

## Session Continuity

Last session: 2026-04-18 — Executed Plan 02-01 (build-frequencies.js + NB/NN Zipf sidecar JSON). DATA-01 requirement shipped.
Stopped at: Completed 02-01-PLAN.md. Phase 2 Plan 02-01 (DATA-01 frequency tables) is complete; next up is Plan 02-02 (DATA-03 bigrams — note: scripts/build-bigrams.js file already appeared during this session, likely pre-scaffolded).
Resume file: Suggest `/gsd:execute-plan 02-02` (NB/NN bigram expansion via max-merge with hand-authored idioms).
