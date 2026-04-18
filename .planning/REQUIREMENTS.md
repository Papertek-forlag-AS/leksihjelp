# Requirements: Leksihjelp — Spell-Check & Prediction Quality Milestone

**Defined:** 2026-04-17
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase. All "user"
references are Norwegian students (with or without dyslexia) typing in any
text input on the web.

### Infrastructure (foundation)

- [x] **INFRA-01**: Shared `window.__lexiVocab` module exposes wordList, frequency tables, bigrams, and lookup helpers, replacing the narrow `__lexiPrediction` seam so spell-check no longer depends on word-prediction's load order
- [ ] **INFRA-02**: Node-script regression fixture harness under `scripts/` runs a JSONL corpus of NB/NN sentences, asserts expected flagged spans + suggested fixes, and reports precision/recall per error class
- [ ] **INFRA-03**: Rule-plugin architecture under `extension/content/spell-rules/` — each error class is a self-contained file tagged with supported languages, registered via a global array; adding a new class does not require edits to `spell-check.js`
- [x] **INFRA-04**: Spell-check remains structurally separable — no imports from word-prediction internals, no premium/policy coupling; the module could later be extracted to `skriv.papertek.app` without touching prediction code

### Data (vocabulary + frequency tables)

- [ ] **DATA-01**: Build-time script ingests the NB N-gram 2021 corpus (Språkbanken, CC-0) and emits sidecar `extension/data/freq-{lang}.json` with Zipf-scored unigram frequencies for NB and NN, under 200 KB gzipped each
- [ ] **DATA-02**: Typo-bank expansion in `papertek-vocabulary` — coordinated cross-app review, additive schema only, synced into the extension via existing `npm run sync-vocab`
- [ ] **DATA-03**: Extend bundled bigram data for NB and NN with high-frequency pairs derived from NB N-gram 2021; same schema as the existing `bigrams-{lang}.json` files; respect the bundle-size budget (~10 MB ceiling)

### Spell-Check Quality (NB/NN)

- [ ] **SC-01**: Fuzzy-match scoring ranks candidates using frequency (Zipf) as a tiebreaker after shared-prefix/suffix, so `berde` suggests `bedre` over `berre` in NB
- [ ] **SC-02**: Expanded proper-noun and loan-word guard reduces false positives — capitalized words outside sentence-start, known loan-word list, common proper-noun patterns do not get flagged
- [ ] **SC-03**: NB↔NN dialect tolerance — a word valid in the other variant (e.g., `ikkje` typed inside an NB document) is not flagged as a typo; tolerant matching uses cross-variant lookup
- [ ] **SC-04**: Code-switching tolerance — when a contiguous span of tokens matches a non-Norwegian language pattern (German/English/Spanish/French), the span is excluded from flagging via density heuristic, preventing false-positive storms inside mixed-language documents
- [ ] **SC-05**: Production-quality særskriving detection — the `sarskriving` rule passes the regression fixture's target precision/recall thresholds (thresholds set during INFRA-02)
- [ ] **SC-06**: Spell-check honors existing PROJECT.md constraints — stays free, offline, NB/NN only in v1 of this milestone, no new external API dependencies

### Word-Prediction Quality (all 6 languages)

- [ ] **WP-01**: Ranking integrates Zipf-style unigram frequency alongside existing POS, gender, case, tense, and bigram signals (uses the same `freq-{lang}.json` sidecars from DATA-01, extended to DE/ES/FR/EN where CC-0 data exists)
- [ ] **WP-02**: Expanded bigram coverage (from DATA-03 for NB/NN; researcher decides source for DE/ES/FR/EN in the planning phase)
- [ ] **WP-03**: Improved tiebreaking — when multiple candidates share the same edit distance or score, the ranker prefers same-length matches, shared-suffix matches, and higher-frequency words over arbitrary iteration order
- [ ] **WP-04**: Stricter filtering — irrelevant suggestions (wrong POS for the context, very low frequency, unrelated proper nouns) are demoted so the top-3 suggestions feel useful in at least 80 % of sampled scenarios (measurement method set during planning)

### User Experience (student-facing polish)

- [ ] **UX-01**: Spell-check popover shows student-friendly "why it's flagged" copy per error class (at least 4 error classes × NB and NN), replacing bare labels like "Skrivefeil"; copy is reviewed for learner voice (avoids jargon, explains the rule briefly)
- [ ] **UX-02**: Suggestions capped at top-3 with a "vis flere" / "show more" reveal (word-prediction dropdown and spell-check popover both honor this) — reduces cognitive load, aligns with dyslexia-UX research

## v2 Requirements

Deferred to a future milestone. Tracked to prevent loss.

### Spell-Check v2

- **SC-07**: Norwegian-tuned phonetic-hash scoring layer (catches multi-letter dyslexic errors that edit-distance misses — e.g., `skjåle` → `skåle`)
- **SC-08**: Extended homophone / confused-word pairs beyond the v1 set (`hjerne/gjerne`, `fot/fort`, `da/når`, `som`/relative pronoun distinction)
- **SC-09**: Per-student class-level silence toggles (parallel to the existing grammar-feature toggles)
- **SC-10**: Spell-check support for non-Norwegian languages (requires language-specific rule sets; each language = its own milestone-scale effort)

### UX v2

- **UX-03**: Pronunciation-confirmation path from spell-check popover into the TTS widget (free `speechSynthesis` for non-subscribers; ElevenLabs for subscribers)
- **UX-04**: Optional OpenDyslexic / dyslexia-friendly font inside Leksihjelp popovers and dropdowns
- **UX-05**: Session-scoped "ignore this word" with smarter scope (persists beyond a single dismissal but not globally)
- **UX-06**: "Gratis. Åpen kildekode." trust micro-copy in popover footer

### Infrastructure v2

- **INFRA-05**: Migrate from Node-script runner to `node --test` built-in runner once the fixture outgrows ~200 cases
- **INFRA-06**: Pilot program with a small group of students/teachers feeding real error patterns back into the typo bank (requires opt-in data-contribution flow — see PROJECT.md "Veien videre" note + privacy review)

## Out of Scope

Explicit exclusions — documented to prevent scope creep or accidental re-adding.

| Feature | Reason |
|---------|--------|
| ML-based grammar rewrites / full Grammarly parity | Forces external API costs — contradicts free-forever promise; requires online connectivity — contradicts offline constraint; explicit PROJECT.md exclusion |
| Premium gating of any extension-side feature | Landing page publicly commits all extension features stay free; breaking the promise destroys trust and Vipps subscription narrative |
| Generative AI "rewrite this sentence" | External-API cost + contradicts heuristic-only rule + pedagogical downside (denies noticing-hypothesis learning) |
| Plagiarism detection | Server-side corpus requirement + philosophically mismatched with assistive-tech positioning |
| Real-time server-side spell-checking | Violates offline constraint + privacy risk (student writing to server) + latency on classroom WiFi |
| Auto-correct without user confirmation | Dyslexia research: silent fixes compound errors because the "fix" is often wrong; accessibility anti-pattern |
| Flagging NB↔NN dialect words as errors | Training a punitive tool that teachers reject; NB and NN coexist officially in Norwegian education |
| Paragraph / cross-sentence grammar analysis | Heuristic feasibility ceiling; bundle-size impact; most learner errors are word- or clause-scoped |
| Style / tone / register suggestions | English-market feature; subjective; risks teaching register mismatches; STYLE library is an anti-feature for learner tools |
| Personal dictionary sync across devices | Requires account + backend; contradicts offline; per-device `chrome.storage.local` ignore is sufficient |
| Telemetry on student writing content | GDPR/Schrems-II complexity; breaks landing-page trust; "anonymous opt-in" is a future feature with legal review, not a default |
| New runtime dependencies (Hunspell, spellchecker-wasm, ML libs) | All mature Norwegian Hunspell dictionaries are GPL-2.0 (incompatible with MIT promise); ML libs violate heuristic constraint; roll-own is ~180 LOC |
| NN infinitive -a/-e standardization at the client side | Per memory + CLAUDE.md policy: data-quality issues fix at the `papertek-vocabulary` source; client-side workarounds are forbidden |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| SC-01 | Phase 3 | Pending |
| SC-02 | Phase 4 | Pending |
| SC-03 | Phase 4 | Pending |
| SC-04 | Phase 4 | Pending |
| SC-05 | Phase 4 | Pending |
| SC-06 | Phase 3 | Pending |
| WP-01 | Phase 3 | Pending |
| WP-02 | Phase 3 | Pending |
| WP-03 | Phase 3 | Pending |
| WP-04 | Phase 3 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0

**Phase Distribution:**
- Phase 1 (Foundation): 3 requirements — INFRA-01, INFRA-02, INFRA-04
- Phase 2 (Data Layer): 3 requirements — DATA-01, DATA-02, DATA-03
- Phase 3 (Rule Architecture & Ranking): 7 requirements — INFRA-03, SC-01, SC-06, WP-01, WP-02, WP-03, WP-04
- Phase 4 (False-Positive Reduction): 4 requirements — SC-02, SC-03, SC-04, SC-05
- Phase 5 (Student Experience Polish): 2 requirements — UX-01, UX-02

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after roadmap creation (traceability filled)*
