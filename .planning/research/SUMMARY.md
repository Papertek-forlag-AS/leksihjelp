# Project Research Summary

**Project:** Leksihjelp — spell-check + word-prediction quality milestone
**Domain:** Heuristic offline NB/NN spell-check + multilingual word-prediction in a Chrome MV3 extension, dyslexia-first audience
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

This milestone upgrades an already-shipping extension from "v1 proof of concept" to "production-quality tool students reach for first." The product is a heuristic, offline, free-forever Norwegian spell-checker and word-prediction engine embedded in a Chrome extension. Experts building comparable tools (Harper, LanguageTool, Voikko, Lingdys) converge on a small set of clear architectural patterns: a shared runtime vocab layer consumed by separate analysis pipelines, a plugin-style rule registry where each error class is its own small file, an additive signal-scoring pipeline rather than a chain-of-responsibility, and a ground-truth regression fixture that drives quality metrics rather than locking in v1 bugs. All four patterns are compatible with the existing vanilla-JS, no-build-step codebase and can be introduced incrementally without rewrites.

The recommended approach is data-first, then architecture, then features. Frequency and bigram tables from NB N-gram 2021 (CC-0, safe to bundle) are the single highest-leverage data investment: they fix ranking bugs (the most visible failure mode), improve word-prediction ordering, and feed both pipelines simultaneously. Architecturally, extracting a shared `__lexiVocab` module out of `word-prediction.js` unlocks every subsequent improvement — rule extraction, signal scoring, fixture-driven testing — at low risk because it moves existing code without changing observable behavior. Feature additions ("Why flagged?" explanations, phonetic scoring, pronunciation path) are cheap once the data and architecture foundations are solid. Attempting the reverse order is the most common way heuristic tools stall.

The dominant risks are: (1) ranking bugs that confidently return a wrong-dialect word as the top suggestion, destroying user trust instantly; (2) false positives on correctly-spelled words — especially proper nouns and code-switched foreign-language text — which is fatal for a dyslexia-first audience that cannot easily verify whether the tool is right; (3) a regression fixture designed as a v1 snapshot rather than ground-truth, which locks in existing bugs instead of measuring improvement. All three are preventable with decisions made in the first phase. Frequency-based tie-breaking, a multi-layer proper-noun guard, a fail-silent threshold for low-confidence fuzzy matching, and ground-truth fixture structure must all be in place before any new error classes are added.

## Key Findings

### Recommended Stack

The correct stack for this milestone is zero new runtime dependencies. All candidate npm packages were evaluated and rejected: GPL-licensed Hunspell dictionaries contaminate the MIT extension; `spellchecker-wasm` adds 800 KB of wasm and requires CSP relaxation the Chrome Web Store flags; `nspell` depends on a Hunspell dictionary; phonetic libraries are unmaintained or recall-first in a precision-first task. The one genuine data dependency — unigram and bigram frequency — is met by NB N-gram 2021 from Nasjonalbiblioteket, which is CC-0 and safe to bundle. Frequency values are pre-computed as Zipf floats at build time, stored as a sidecar `data/freq-{lang}.json` file, and loaded as another signal at runtime.

**Core technologies:**
- **Vanilla JS (ES2022+) + inlined Damerau-Levenshtein (~60 LOC):** extends the existing `levenshtein` at `word-prediction.js:1480` with adjacent-transpose case and bounded early-exit; no external dep buys anything here
- **Hand-rolled SymSpell deletion index (~120 LOC):** 1000-1800x faster than BK-tree for 25k-word fuzzy lookup; eliminates current first-match-wins artefact; built once on language load
- **NB N-gram 2021 (CC-0) as Zipf frequency floats:** pre-computed via `scripts/build-frequencies.mjs`; stored as `data/freq-{lang}.json`; used as primary ranking tie-breaker; ~200 KB uncompressed per language
- **Existing bigram schema extended:** `{prev: {next: weight}}` with integer buckets already ships and already scored; grow coverage from the same CC-0 corpus
- **Plain Node script for regression testing:** `scripts/check-fixtures.js` loads vocab directly (bypassing Chrome APIs), runs the analysis pipeline, diffs against ground-truth JSONL; zero deps; upgrades to `node --test` when fixtures exceed ~200 cases

### Expected Features

**Must have (this milestone release bar):**
- Regression fixture with ground-truth structure — blocks safe iteration; without it, rule tuning is Russian roulette
- "Why flagged?" student-friendly explanation per error class — the brand differentiator; copy-heavy, not code-heavy
- Reduced false-positive rate on NB + NN — measured against fixture; false positives are the primary reason students abandon a spell-checker
- Word-prediction ranking improvement across all six languages — measurable via top-k accuracy on held-out set
- Expanded typo bank in `papertek-vocabulary` + sync — data-driven recall lift publicly committed on landing page
- `__lexiPrediction` interface preserved or upgraded to `__lexiVocab` — guards future extraction option

**Should have (competitive differentiators, ship after quality bar met):**
- Phonetic-hash scoring layer (Norwegian-tuned: ⟨kj/skj/sj⟩, double-consonant, å/o confusion) — catches dyslexic multi-letter errors that edit-distance misses
- Pronunciation-confirmation path from spell-check popover to TTS widget — Lingdys has this; Leksihjelp already bundles TTS; low integration cost
- More confused-word pairs beyond og/å (hjerne/gjerne, fot/fort) — data-driven expansion via typo bank
- Top-3 ranked suggestions with "show more" reveal — dyslexia UX: cognitive load of 10+ options causes abandonment
- Session-scoped "ignore this word" with 3-dismiss auto-ignore

**Defer to later milestones:**
- å/og detection — requires sentence-level parsing, not word-level; documented in user memory as out-of-scope; a 50% precision detector is worse than nothing
- Spell-check for DE/ES/FR/EN — different grammar, different error classes; separate milestone per language
- Anonymous opt-in data contribution — requires legal/privacy review first
- Teacher-facing dashboard, classroom pilot — different surface entirely

### Architecture Approach

The existing codebase has all the right pieces but they are coupled in the wrong direction: `word-prediction.js` owns all runtime indexes and spell-check borrows through a narrow interface. The key architectural move is extracting a shared `vocab-index.js` module exposing read-only handles (`self.__lexiVocab`) to both pipelines. Once that seam exists, four further improvements become routine: a rule-pack plugin registry (`self.__lexiSpellRules`, one file per error class), a signal-scoring table in `scoring.js` replacing the 150-line `applyBoosts()` chain, language tags on every rule (enabling DE spell-check later with zero runner changes), and a fixture-driven regression loop runnable in Node without Chrome APIs. None of these require rewriting existing logic — they move and re-expose it.

**Major components:**
1. **`vocab-index.js` (NEW)** — builds all runtime indexes once per language; exposes `self.__lexiVocab` with read-only getters and `onReady` lifecycle; decouples load-order dependency between spell-check and prediction
2. **`spell-rules/` directory (NEW)** — one IIFE file per error class, each exporting `{ id, languages, priority, explain, check(ctx) → Finding[] }`; adding rule #5 = new file, no core edits
3. **`scoring.js` (NEW)** — declared signal table `[{ id, weight, fn }]` replacing interleaved if-branches; pure functions callable from Node fixture runner; weighted-sum with veto escape hatch
4. **`fixtures/` directory (NEW)** — JSONL per language per error class with ground-truth `expected_errors` fields (not snapshots); runner exits non-zero on regression; false-positive sentences use `expected_errors: []`
5. **`data/freq-{lang}.json` sidecar (NEW)** — Zipf float per word, NB and NN only this milestone; kept separate from `{lang}.json` to avoid cross-app schema blast radius

### Critical Pitfalls

1. **Wrong-dialect word as top suggestion (the `berde → berre` case)** — first-match-wins fuzzy matching with no frequency tie-breaker; fix with Zipf frequency as primary tie-breaker, dialect bias toward active UI language, and multi-candidate display when distance is tied; must be in place before first release
2. **False positives eroding trust, especially for dyslexic users** — over-flagging is the #1 spell-check complaint; dyslexic students cannot easily verify correctness; fix with layered proper-noun guard, fail-silent confidence threshold for fuzzy matching, and "stay silent when uncertain" default
3. **Curated typo entries colliding with valid words in the other dialect** — `papertek-vocabulary` typo bank not cross-validated against NN vocabulary; fix at source with a CI check; add client-side cross-dialect safety net; this pitfall is confirmed by user memory entries on NN data drift
4. **Code-switched text (DE/EN inside NB) flooding the document with dots** — language-learner students mix languages by definition; fix with per-span language detection heuristic, high-unknown-density kill-switch, and cross-language token allowlist
5. **Regression fixture designed as snapshot rather than ground-truth** — locks in existing bugs; every improvement that changes output becomes a test failure; fix by authoring entries with human-judged `expected_errors`, measuring precision/recall per release, and marking known-wrong v1 behaviors as failing TODOs

## Implications for Roadmap

The dependency chain from research is clear: data and architecture must precede feature additions, and the fixture must precede rule tuning. The five-phase structure below reflects this; Phases 1 and 2 are load-bearing for everything that follows.

### Phase 1: Foundation — Shared Vocab Layer + Fixture Infrastructure

**Rationale:** Extracting `__lexiVocab` is the single highest-leverage architectural change; every other improvement is cheaper after this seam exists. The fixture must precede rule tuning — without it, improvements are unverifiable. Both are structural, touch no user-visible behavior, and eliminate the risk of every subsequent PR.

**Delivers:** `vocab-index.js` with `self.__lexiVocab`; `spell-check.js` migrated to read from it; `fixtures/` with initial NB corpus (30-50 cases per existing rule + 20 false-positive sentences); Node regression runner; ground-truth fixture structure documented.

**Addresses:** Module separability requirement; regression fixture requirement (both in PROJECT.md:Active).

**Avoids:** Coupling spell-check lifecycle to prediction (Architecture Anti-Pattern 2); snapshot-based fixture calcification (Pitfall 6).

**Research flag:** Standard patterns — LanguageTool and Harper are direct references. No phase research needed.

### Phase 2: Data — Frequency Tables + Ranking Fix + Typo Bank

**Rationale:** Ranking bugs are the most visible failure mode and fastest trust-destroyer. Frequency data fixes them and simultaneously improves word-prediction ordering — data work that pays twice. Typo bank expansion at `papertek-vocabulary` is a public commitment with cross-app coordination overhead that benefits from being started early.

**Delivers:** `scripts/build-frequencies.mjs` generating `data/freq-nb.json` and `data/freq-nn.json` from NB N-gram 2021; `freqIndex` in `__lexiVocab`; fuzzy matcher upgraded to bounded Damerau-Levenshtein with Zipf tie-breaking; dialect-biased candidate selection; expanded typo bank in `papertek-vocabulary`; fixture cases for the berde/berre ranking bug class.

**Addresses:** Spell-check quality to production level; word-prediction ranking improvement.

**Avoids:** Ranking/wrong-suggestion pitfall (Pitfall 1); dialect typo collision (Pitfall 3); bundle-size creep (Pitfall 17) — Zipf floats are ~200 KB uncompressed per language.

**Research flag:** Cross-app coordination with `papertek-vocabulary` before adding new typo bank fields. Additive change is safe; confirm scope before starting. Also: NN infinitive drift (user memory `project_nn_infinitive_fix.md`) should be fixed at source in this phase.

### Phase 3: Rule Extraction + Signal Scoring + False-Positive Reduction

**Rationale:** With the fixture catching regressions and frequency data available, it is now safe to restructure the rule surface and scoring pipeline. Extracting the four existing rules into `spell-rules/nb-*.js` makes adding new rules in Phase 4 a one-file operation. The proper-noun guard and code-switching detection reduce false positives to a level where the tool can be shown to dyslexic students.

**Delivers:** `spell-rules/` with `nb-gender.js`, `nb-modal-verb.js`, `nb-sarskriving.js`, `nb-typo-curated.js`, `nb-typo-fuzzy.js`; `spell-check.js` refactored to generic rule-pack runner; `scoring.js` with explicit signal table; layered proper-noun guard (consecutive capitalized spans + per-user allowlist); code-switching detection (per-span heuristic + density kill-switch); fixture extended with proper-noun and code-switching cases.

**Addresses:** False-positive rate reduction; word-prediction ranking via consolidated scoring signals.

**Avoids:** Piling new rules into one monolithic check loop (Architecture Anti-Pattern 1); false positive trust erosion (Pitfall 2); code-switched text flag-forest (Pitfall 4).

**Research flag:** Code-switching detection accuracy for Norwegian vs. Germanic neighbors (Swedish, Danish, German) needs empirical calibration. Plan a small test with sample sentences before committing to specific thresholds.

### Phase 4: Feature Polish — Explanations, UX, New Error Classes

**Rationale:** With ranking correct, false positives reduced, and rule infrastructure in place, additive feature work is low-risk. "Why flagged?" explanations require editorial copy more than engineering. New error classes are each a new file in `spell-rules/`. UX improvements require no architecture changes.

**Delivers:** Student-friendly explanation copy for all four error classes (NB and NN register); `rule.explain` field on every rule; density cap in overlay (max ~5 dots per viewport); session-scoped dismiss with 3-dismiss auto-ignore; additional confused-word pairs from typo bank; keyboard navigation (Tab/Enter/Escape); pronunciation path wired from popover to existing TTS widget.

**Addresses:** "Why flagged?" explanation (PROJECT.md:Active); dyslexia-hostile UI (Pitfall 5); dismiss-loop rage-quit (Pitfall 13); accessibility gaps (Pitfall 12).

**Avoids:** å/og detection — document as out-of-scope; requires sentence-level parsing per user memory; a 50% precision detector is worse than the current silence.

**Research flag:** Standard patterns — explanation copy and UX changes are well-understood. No phase research needed.

### Phase 5: Pre-Release Hardening

**Rationale:** Heuristic tools work on dev prose and break on real-student text and real editors. A dedicated hardening pass prevents shipping something that looks done but isn't.

**Delivers:** Fixture extended with student-sourced sentences (anonymized, multiple grade levels); third-party editor testing matrix (Gmail compose, Google Docs, Notion, Slack); performance audit (2000-char input, 16 ms budget, screen recording of dot stability); privacy audit (DevTools Network tab, CI grep for fetch in content scripts); bundle-size report; popup status indicator for spell-check initialization state.

**Addresses:** Performance jitter (Pitfall 7); privacy regression (Pitfall 8); silent init failure (Pitfall 14); non-representative fixtures (Pitfall 20); third-party editor positioning (Pitfall 15).

**Research flag:** Standard patterns. No phase research needed.

### Phase Ordering Rationale

- **Foundation before features:** Architecture research is explicit — extracting the shared vocab layer is the prerequisite for everything else; doing it after feature additions raises the cost significantly.
- **Data before rules:** Frequency is used by the ranking fix, SymSpell index, and word-prediction scoring simultaneously. Adding it after rule extraction misses compounding benefit.
- **Fixture before rule tuning:** Both PITFALLS.md and ARCHITECTURE.md identify this as non-negotiable. Weight changes without fixtures produce silent regressions.
- **Explanations in Phase 4, not Phase 1:** Copy for explanations depends on knowing which rules survive Phase 3 in their final form. Writing copy against unstable rule IDs creates rework.
- **å/og explicitly deferred:** User memory and FEATURES.md both identify this as requiring sentence-level parsing. Shipping a low-precision heuristic would be worse than current silence.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (code-switching detection):** Accuracy for Norwegian vs. close Germanic neighbors is unknown. Plan empirical test with sample sentences before committing to a specific heuristic threshold.
- **Phase 2 (papertek-vocabulary schema coordination):** Schema review with sibling apps before adding new typo-bank fields. Additive changes are safe; confirm scope before starting.

Phases with standard patterns (skip research):
- **Phase 1 (vocab layer extraction):** Well-documented refactor pattern; LanguageTool and Harper are direct references.
- **Phase 4 (explanations + UX):** Editorial copy and DOM changes; no novel technical ground.
- **Phase 5 (hardening):** Standard pre-release audit process, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero-new-dependency recommendation is unusually clear; all candidates evaluated and rejected with specific technical reasons; NB N-gram 2021 CC-0 status verified; existing code inspected at line-number precision |
| Features | MEDIUM-HIGH | Competitor analysis solid (Lingdys, IntoWords, LanguageTool verified); dyslexia UX research is multi-source; Norwegian-specific learner error distribution data is not available in published research |
| Architecture | HIGH | Grounded directly in repo code at concrete line numbers; patterns verified against Harper, LanguageTool, Voikko; build order argued from explicit dependency analysis |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls multi-source verified; code-switching accuracy thresholds and density cap numbers are product-testing questions without published answers for this specific domain |

**Overall confidence:** HIGH

### Gaps to Address

- **Norwegian-learner error distribution data:** No published research quantifies error rates by class for Norwegian students specifically. Fixture design should prioritize sourcing real anonymized student sentences over dev-authored test cases.
- **Code-switching accuracy thresholds:** The 40% unknown-token density kill-switch and per-span language detection heuristics need empirical calibration before committing to specific values.
- **Dyslexia-specific density cap:** Research confirms large option lists cause abandonment but does not specify a "max dots per viewport" number. Start at 5, test with real users, adjust.
- **NN infinitive drift:** User memory (`project_nn_infinitive_fix.md`) flags that NN data mixes -a/-e infinitives. This directly impacts NN spell-check recall. Schedule fix in Phase 2 alongside other vocab data work.
- **Bigram coverage ceiling:** Current `bigrams-nb.json` is 2.6 KB. Expansion to 50-200 KB stays in plain-object format; verify byte-cap enforcement is in the build script before generating a large corpus.

## Sources

### Primary (HIGH confidence)
- NB N-gram 2021 — Nasjonalbiblioteket Språkbanken (CC-0) — frequency and bigram data source; 580k books + 3.4M newspapers
- SymSpell — wolfgarbe/SymSpell GitHub — deletion-index algorithm; 1870x vs BK-tree benchmark (SeekStorm)
- LanguageTool development overview and rule source — rule-pack architecture patterns; rule-per-file, language-tagged
- Harper (Automattic/harper) — per-language module structure and stats signal module
- Lingit / Lingdys Pluss product page — dyslexia-tuned spell-check, word prediction, TTS feature set
- IntoWords Cloud Chrome Web Store listing — NB/NN coverage, og/å toggle, context-based prediction
- International Dyslexia Association 2025 Definition — dyslexia UX framing authority
- Dark Reading / Bleeping Computer — spelljacking 2022 disclosure — privacy pitfall grounding
- Existing codebase: `spell-check.js` (898 LOC), `word-prediction.js` (1845 LOC), `vocab-store.js` (557 LOC), `.planning/PROJECT.md`, `.planning/codebase/` docs — direct inspection

### Secondary (MEDIUM confidence)
- wordfreq (rspeer) — Zipf scheme reference; NB supported, NN not
- Korrekturavdelingen — særskriving as the #1 Norwegian writing-advice topic
- Dysleksi Norge skrivehjelpemidler — canonical Norwegian dyslexia tool inventory
- Ghotit Dyslexia — phonetic + contextual spell-check; reference for heuristic ceiling
- Springer: Spelling errors made by people with dyslexia — 39% of errors differ by >1 letter
- UX research on dyslexia UI — Taylor & Francis follow-up (2022), UX Collective, Smart Interface Design Patterns
- Voikko general architecture — comparable Nordic spell-checker for architecture pattern reference
- Apertium regression test framework — closest NLP analogue for ground-truth fixture structure

### Tertiary (LOW confidence)
- Trie vs hash table benchmark (Loup Vaillant) — bigram storage decision support
- Signal Scoring Pipeline post (Blake Crosley) — weighted composite score rationale

---
*Research completed: 2026-04-17*
*Ready for roadmap: yes*
