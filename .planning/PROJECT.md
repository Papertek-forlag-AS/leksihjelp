# Leksihjelp

## What This Is

Chrome/Edge browser extension for Norwegian students learning foreign languages
(German, Spanish, French, English). Provides dictionary lookup, pronunciation
(text-to-speech), context-aware word prediction in any text input, and a
production-quality spell-check surface covering Norwegian (NB + NN) token-level
rules and structural grammar governance across all five target languages — word-order
violations, case/agreement, aspect/mood, register drift, collocations, and å/og confusion.
Dictionary intelligence helps students choose the right word with false-friend warnings
and sense-grouped translations. Vocabulary data fetches from Papertek API on install and
caches in IndexedDB with a bundled NB baseline for instant offline-first startup.
Aimed especially at students with dyslexia. Distributed as a free, open-source
extension (MIT) with an optional premium subscription that funds the ElevenLabs
TTS calls. All non-TTS features are 100% offline and free.

## Core Value

Norwegian students write foreign languages better — with correct words,
correct form, and confidence in pronunciation — without leaving the page
they're working on.

## Requirements

### Validated

<!-- Shipped and confirmed in production. -->

- ✓ **Dictionary lookup** — popup search across DE/ES/FR/NB/NN/EN with bundled vocab, offline-first
- ✓ **Context-aware word prediction** — autocomplete in any text input, drawing on POS, gender, case, tense, bigrams, phonetic/typo matching
- ✓ **Inline TTS widget** — select text → pronunciation popup; ElevenLabs for subscribers, browser `speechSynthesis` fallback for free users
- ✓ **Vipps + Stripe subscription flow** — 29 kr/mnd monthly (Vipps Recurring) and 290 kr/år (Stripe Checkout); 50 000 chars/month quota with rollover
- ✓ **Norwegian adjective agreement** — gender + number + definiteness signals drive prediction scoring
- ✓ **First-run onboarding** — UI-language picker and target-language picker, gated on a dedicated flag
- ✓ **Pencil shortcut + detached "Fest" window** — pencil opens skriv.papertek.app; Fest opens a persistent floating popup window (`chrome.windows.create`)
- ✓ **Custom grammar settings per language** — students toggle which grammar features appear in the dictionary
- ✓ **Shared vocab seam (`__lexiVocab`)** — v1.0, replaces the narrow `__lexiPrediction` surface; spell-check and word-prediction both consume the same indexes (INFRA-01, INFRA-04)
- ✓ **Regression fixture harness** — v1.0, `scripts/check-fixtures.js` runs 262 hand-authored NB/NN cases across 5 rule classes; P/R/F1 per rule; must-exit-0 release gate (INFRA-02)
- ✓ **Plugin rule architecture** — v1.0, `extension/content/spell-rules/*.js`, adding a rule = adding one file, no edits to `spell-check.js` (INFRA-03)
- ✓ **Frequency-aware ranking** — v1.0, NB N-gram 2021 Zipf tables for NB/NN; word-prediction tiebreaks by frequency in all 6 languages; fuzzy spell-check tiebreaker (DATA-01, WP-01, WP-03, WP-04, SC-01)
- ✓ **Expanded bigrams + typo bank** — v1.0, cross-repo growth in `papertek-vocabulary` with additive schema (DATA-02, DATA-03, WP-02)
- ✓ **Proper-noun + code-switching guards** — v1.0, `nb-propernoun-guard` (priority 5) + `nb-codeswitch` (priority 1, density window); ≤1 flag per foreign-language paragraph (SC-02, SC-04)
- ✓ **NB↔NN cross-standard detection** — v1.0, `nb-dialect-mix` rule (priority 35) with `CROSS_DIALECT_MAP` flags tokens valid only in the sister standard (SC-03, reversed from initial "tolerance" framing per user domain policy)
- ✓ **Production-quality særskriving** — v1.0, `nb-sarskriving` gated at P≥0.92 / R≥0.95 in `check-fixtures.js` THRESHOLDS table (observed P=1.000 R=1.000 on 55 NB + 46 NN cases) (SC-05)
- ✓ **Offline release gate** — v1.0, `check-network-silence` scans spell-check + prediction for outbound I/O; must exit 0 (SC-06)
- ✓ **Bundle-size release gate** — v1.0, `check-bundle-size` enforces 20 MiB internal engineering ceiling; current zip 10.25 MiB (DATA-03)
- ✓ **Student-friendly explain popover** — v1.0, `rule.explain: (finding) => ({nb, nn})` callable on 5 popover-surfacing rules + renderExplain 3-way lookup + NB/NN register badge; `check-explain-contract` + `check-rule-css-wiring` release gates (UX-01)
- ✓ **Top-3 suggestions with "Vis flere" reveal** — v1.0, spell-check popover + word-prediction dropdown both honor top-3 cap with click or ArrowDown auto-reveal; user-toggleable via "Vis alternative skriveforslag" (UX-02)
- ✓ **Structural grammar infrastructure** — v2.0, sentence segmenter, tagged-token POS view, priority bands (P1/P2/P3), severity contract, quotation suppression, document-state two-pass runner
- ✓ **Word-order violations** — v2.0, NB V2 inversion, DE main-clause V2 + subordinate verb-final, FR BAGS adjective placement (WO-01 through WO-04)
- ✓ **DE case & agreement governance** — v2.0, preposition-case, separable-verb split, perfekt auxiliary, compound-noun gender (DE-01 through DE-04)
- ✓ **ES structural rules** — v2.0, ser/estar, por/para, personal "a", subjuntivo triggers, pretérito/imperfecto hints, pro-drop overuse, gustar-class syntax (ES-01 through ES-03, MOOD-01/02, PRON-01/02)
- ✓ **FR structural rules** — v2.0, élision, être/avoir auxiliary, PP agreement (10.3a), subjonctif triggers, clitic-cluster ordering (FR-01 through FR-03, MOOD-03, PRON-03)
- ✓ **Register drift detection** — v2.0, DE du/Sie, FR tu/vous, NB bokmål/riksmål, NN a-/e-infinitiv mixing (DOC-01 through DOC-04)
- ✓ **EN morphology** — v2.0, irregular overgeneration, word-family POS confusion (MORPH-01, MORPH-03)
- ✓ **ES/FR opaque-noun gender** — v2.0, article-noun gender mismatch for opaque nouns (MORPH-02)
- ✓ **Cross-language collocations** — v2.0, preposition-collocation errors in NB/DE/FR/ES with 97 seed entries (COLL-01 through COLL-04)
- ✓ **9 release gates** — v2.0, check-fixtures + check-explain-contract + check-rule-css-wiring + check-network-silence + check-bundle-size + check-benchmark-coverage + check-governance-data + check-spellcheck-features + check-stateful-rule-invalidation
- ✓ **Compound decomposition engine** — v2.1, `decomposeCompound` splits unknown NB/NN/DE compounds at known noun boundaries with linking elements (s, e, n, en, er, es), recursive up to 4 components, <2% FP rate
- ✓ **Dictionary popup for decomposed compounds** — v2.1, "Samansett ord" card with clickable components, gender badge from last component, floating-widget fallback
- ✓ **Spell-check compound acceptance + sarskriving expansion** — v2.1, decomposable compounds accepted as valid; sarskriving detects split compounds verified by decomposition
- ✓ **NB/NN compound gender inference** — v2.1, extends existing DE compound-gender to NB/NN via shared decomposeCompound engine
- ✓ **Manual spell-check button** — v2.1, visible trigger near textarea with toast feedback ("3 feil funnet" / "Ser bra ut!")
- ✓ **Demonstrative-mismatch rule** — v2.1, `nb-demonstrative-gender` (priority 12) for den/det/denne/dette + noun gender agreement
- ✓ **Triple-letter typo rule** — v2.1, `nb-triple-letter` (priority 45) for accidental triple-letter typos with compound-boundary awareness
- ✓ **NB/NN s-passive detection** — v2.1, NB overuse reminder (>3 s-passives), NN finite s-passive rule, st-verb/deponent recognition, algorithmic presens derivation
- ✓ **Unit test suite** — v2.1, 58 tests across phases 16-19 (decomposition, compound gender, demonstrative-gender, triple-letter, s-passive)
- ✓ **False-friend warning banners** — v2.2, ~56 curated NB→EN/DE/ES/FR pairs from Papertek API; popup + floating-widget rendering with prominent banner above translations
- ✓ **Sense-grouped translations** — v2.2, expandable sense headers (location/time/manner) replace flat translation list; popup + floating-widget parity
- ✓ **Cross-language enrichment pipeline** — v2.2, NB→target reverse `linkedTo` index; Map-based O(1) in popup, linear scan in floating-widget
- ✓ **å/og confusion detection** — v2.2, `nb-aa-og.js` (priority 15) with posture-verb exceptions; 12 regression fixtures; explain-contract compliant
- ✓ **Unit test suite expansion** — v2.2, 6 new tests (dictionary intelligence + å/og confusion)
- ✓ **Papertek API vocabulary endpoints** — v3.0, bundle + revisions endpoints with CORS + ETag/304 + pre-gzip compression
- ✓ **IndexedDB cache adapter + baseline-first hydration** — v3.0, vocab-store.js + vocab-seam.js async swap; schema_version gating
- ✓ **NB baseline (~130 KB) + service-worker bootstrap** — v3.0, instant offline startup; auto-download on install with popup status pills
- ✓ **Update detection + manual refresh** — v3.0, startup revision check; "Nye ordlister tilgjengelig" notice; atomic cache replacement
- ✓ **Silent v2→v3 migration** — v3.0, onInstalled trigger; bundled vocab removed (20 files); only NB baseline ships in zip
- ✓ **Release gates: SC-06 carve-out + baseline cap** — v3.0, sanctioned bootstrap fetch exception; 200 KB baseline cap with paired self-test
- ✓ **Compound Word Intelligence in popup** — v3.1, popup search suggests compounds from partial input (e.g., "chefsstu" → "Chefsstuhl"); compound card shows pedagogical "last component decides gender" note with clickable component navigation + "Tilbake til [compound]" back-link; qualified translation guess from component translations (COMP-01..04)
- ✓ **UX Polish & Tech Debt** — v3.1, NB/EN/NN language buttons, Chrome Side Panel for "Fest" (macOS fix), spell-check Tab marker navigation, ~20-char spell-check threshold, 3-char word-prediction floor, version alignment, fixture triage to exit-0, schema-mismatch banner, BUNDLED_LANGS cleanup (POPUP-01/02, SPELL-01..03, DEBT-01..05)
- ✓ **"Lær mer" pedagogy panel** — v3.1, expandable teaching panel in spell-check popover for DE preps + Wechselpräpositionen (motion-vs-location pairs) with case badges, summary, paragraph explanation, correct/incorrect example pairs, colloquial-note asides; trilingual (nb/nn/en) data sourced from papertek-vocabulary (PED-01..06)
- ✓ **FR/ES pedagogy via data-led pattern** — v3.1, `fr-aspect-hint` rule (first FR pedagogy block, passé-composé vs imparfait soft-hint), ES por/para data-migration, ES gustar-class extended 1 → 10 verbs (encantar/interesar/doler/etc); fixture extended ≥30 cases at ≥80% recall; `check-explain-contract` pedagogy-shape branch + paired self-test (PHASE-32-A/B/C)
- ✓ **Exam Mode** — v3.1, per-feature `exam: { safe, reason, category }` marker on every spell-rule + `extension/exam-registry.js` for non-rule UI surfaces; student popup toggle + EKSAMENMODUS badge + amber widget border + lockdown teacher-lock via new `RESOURCE_PROFILES.LEKSIHJELP_EXAM` profile (firestore + Cloud Functions enums + locales + classroom illustration); `check-exam-marker` release gate (EXAM-01..08, EXAM-10)
- ✓ **Shared popup view modules** — v3.1, extracted `extension/popup/popup.js` user-facing surfaces into `popup/views/{dictionary,settings,pause,report}-view.js` with explicit dep injection; lockdown stub sidepanel replaced with `leksihjelp-sidepanel-host.js` mounting synced view modules with limited deps (`audioEnabled: false`, no auth/payment, no exam-toggle); `check-popup-deps` release gate enforces no implicit globals
- ✓ **dict-state-builder + lockdown sync hygiene** — v3.1 (Phase 33), shared `dict-state-builder` module gives lockdown sidepanel full vocab state on first paint (full inflection index, NB enrichment, working language switcher, working direction toggle); ordbok tab visible inside EKSAMENMODUS envelope; lockdown sync re-run mirrors Phase 26/27 surfaces; `exam.safe` browser-baseline audit flipped lookup-shaped rules where appropriate
- ✓ **INFRA-10 vocab-seam-coverage release gate** — v3.1 (Phase 36), static-parses `buildIndexes` return literal (incl. recursive `...moodIndexes` resolution); asserts every non-exempt key has matching `getX()` getter on `vocab-seam.js` AND matching entry in `spell-check.js` `vocab` consumer composition; population canaries assert non-empty under default preset; paired `:test` self-test. Caught three additional seam-bug instances on first run (`frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms`) — long-term defense against the regression class that took down Phase 35 verification

### Active

(No active milestone — v3.1 shipped 2026-05-01. Run `/gsd:new-milestone` to define v3.2.)

### Deferred

**Carry-over tech-debt (post-v3.1):**

- v3.1 browser UAT backlog (6 walkthroughs deferred to v3.2): F36-1 fr-aspect-hint browser confirmation; F7 Phase 26 NN/EN locale Lær mer walks; Phase 30 lockdown sidepanel 8-step staging UAT; Phase 26 6 DE Lær mer browser walks; Phase 27 9-step exam-mode walk; Phase 30-01 9-step extension popup view walk
- Lockdown-stb production Firebase deploy (firestore.rules + Cloud Functions for EXAM-10) — staging-lockdown deployed 2026-04-28; user-gated production deploy outstanding
- Lockdown papertek.app production hosting deploy (Phase 30 sidepanel host) — staging-lockdown deployed; user-gated production deploy outstanding
- Phase 28.1 (skriveokt-zero exam-mode sync, EXAM-09) — un-defer when skriveokt-zero ships to consumers
- NN phrase-infinitive triage (~214 `papertek-vocabulary` verbbank entries)
- Leksi-in-skriv integration: embed spell-check/prediction as native feature inside `skriv.papertek.app` (memory `project_lexi_in_skriv_integration.md`)
- `papertek-vocabulary` data gaps: `markeres` s-passiv; `setningen` NB bestemt form; NN vocab gaps (ven, skin, heile, sykle, sy)
- Future promotion: move `CROSS_DIALECT_MAP` from `nb-dialect-mix.js` into `papertek-vocabulary` for cross-app reuse
- Pre-existing FR sidecar 404 console noise (bigrams-fr / freq-fr / pitfalls-fr) — gracefully handled, DevTools-only
- SCHEMA-01 developer-view UX: `lexi:schema-mismatch` popup subscriber missing (dormant while schema_version=1)

**Future candidates:**

- Tense harmony & discourse (TH-01 through TH-03) — unmotivated tense switches, anaphora ambiguity, long-distance SV agreement
- Idiomatic-literalism curated match (IDI-01) — ~20-idiom closed list, only if FP rate stays at zero
- FR participe passé full corner cases (FR-04) — distance > adjacent window, pronominal reflexive DO, elided DO
- Verb/adjective compound decomposition (COMP-09) — overtale, langvarig; different patterns from noun compounds
- Definite-form compound lookup (COMP-10) — strip -en/-et/-a before decomposition
- Per-noun fuge data in papertek-vocabulary (COMP-11) — lexical exceptions
- Context-aware sense selection (DICT-01) — popup reads surrounding sentence, highlights likely sense
- Foreign-side false-friend entries (DICT-02) — EN→NB, DE→NB direction
- Lockdown bootstrap implementation — documented adapter contract from v3.0; lockdown's own concern

### Out of Scope

<!-- Explicit exclusions with reasoning. Prevents re-adding later. -->

- **Premium-gating for spell-check or other extension-side features** — landing page (`backend/public/index.html:681-683`) publicly commits all extension features stay free/open. Gating contradicts the promise and breaks user trust.
- **Spell-check for non-Norwegian languages beyond v2.0 structural rules** — v2.0 extended coverage to DE/ES/FR/EN structural grammar; further language-specific depth = its own milestone-scale effort.
- **ML-based grammar rewrites / Grammarly parity** — forces external API costs + online connectivity + pedagogical downside (silent fixes compound errors).
- **Bundle-size growth beyond 20 MiB** — enforced by `check-bundle-size` release gate. Growth needs justification in a new phase.
- **Auto-correct without user confirmation** — dyslexia research: silent fixes compound errors. Show candidate, never silently rewrite.
- **Dialect-tolerance framing for NB↔NN** (retracted v1.0) — initial SC-03 framing allowed "ikkje in NB" as valid; user domain policy reversed this — NB and NN are two distinct official standards, and cross-standard tokens are student errors (memory `project_nb_nn_no_mixing.md`).
- **NN infinitive -a/-e standardization at the client side** — data-quality fixes belong at `papertek-vocabulary`, not in extension code (memory `project_nn_infinitive_fix.md`).
- **Telemetry on student writing content** — GDPR/Schrems-II complexity; breaks landing-page trust; "anonymous opt-in" belongs in a future milestone with legal review.
- **New runtime dependencies (Hunspell, spellchecker-wasm, ML libs)** — all mature Norwegian Hunspell dictionaries are GPL-2.0 (incompatible with MIT promise); ML violates heuristic constraint; roll-own is ~180 LOC.

## Context

**Business + brand:**
- Papertek forlag AS is the commercial operator. Existing premium (TTS) funds external API costs and a small margin. Non-TTS features are a permanent free tier — a marketed promise, not an internal policy.
- "Perfekt for elever med dysleksi" is a named landing-page section. Dyslexia-supporting features (smart suggestions, pronunciation confirmation, tolerant matching) are positioned as free-tier brand benefits.
- Stated "Veien videre" commitment: expanded typo bank + accepted alternative answers + anonymous data contributions. Typo-bank growth shipped in v1.0 — alternatives + data contribution are v2.0+ candidates.

**Technical environment:**
- Chrome Manifest V3 extension, vanilla JavaScript, no build step for extension code — keeps the bar low for contributors.
- ~21k lines of JavaScript in `extension/` (9,148 LOC in spell-rules alone). Shipped zip 7.61 MiB (20 MiB internal cap, ~62% headroom).
- 59 spell-check rule files in plugin architecture (`spell-rules/*.js`); core engine ~3k LOC (`spell-check.js` + `spell-check-core.js` + `vocab-seam*.js`).
- Vocabulary data fetches from Papertek API on install and caches in IndexedDB (`lexi-vocab` v3). Only NB baseline (~130 KB) ships bundled. Update detection on startup with manual refresh.
- Vocab is authored in a separate repo (`papertek-vocabulary`) that also feeds `papertek-webapps` and `papertek-nativeapps`. Schema changes have cross-app blast radius — additive changes preferred.
- Backend is Vercel serverless (Node.js ESM). Firebase Admin SDK for user/subscription state. All costs covered by subscription revenue.

**Shipping rhythm:**
- Release as GitHub Release tags → landing page serves latest zip via `/releases/latest/download/lexi-extension.zip`.
- v1.0 shipped over 4 days (2026-04-18 → 2026-04-21, 133 commits) across 8 phases.
- v2.0 shipped over 2 days (2026-04-24 → 2026-04-25, ~140 commits) across 12 phases.
- v3.0 shipped in 1 day (2026-04-27, 28 commits) across 1 consolidated phase.
- 10 release gates enforced on every release (fixtures, explain-contract + self-test, rule-CSS wiring + self-test, feature-independent indexes, network silence, bundle size, benchmark-coverage, governance-data, stateful-rule-invalidation, baseline-bundle-size).

**Current state (post-v3.1):**
- 23/23 v3.1 in-scope requirements satisfied (EXAM-09 deferred by design); 16/16 v3.0; 12/12 v2.2; 11/12 v2.1; 42/42 v2.0; 19/19 v1.0.
- Released versions: 2.5.0 → 2.9.18 (18 published versions over v3.1 cycle).
- 12 release gates (added INFRA-08 benchmark-coverage, INFRA-09 governance-data, INFRA-10 vocab-seam-coverage; check-exam-marker for Phase 27; check-popup-deps for Phase 30; check-pedagogy-shape for Phase 26).
- Bundle 12.68 MiB / 20 MiB cap; NB baseline 130 KB / 200 KB cap.
- 57 fixture suites all P=R=F1=1.000.
- Compound-word intelligence in popup (prediction, pedagogy, back-nav, translation guess).
- "Lær mer" pedagogy panel covering DE preps + Wechselpräpositionen + FR aspect + ES por/para + ES gustar-class (10 verbs).
- Exam Mode: per-feature `exam: { safe, reason, category }` markers, student popup toggle with EKSAMENMODUS badge + amber widget border, lockdown teacher-lock via `RESOURCE_PROFILES.LEKSIHJELP_EXAM` (staging-lockdown deployed; production user-gated).
- Shared popup view modules (`popup/views/`) consumed by extension popup AND lockdown sidepanel host with limited deps (`audioEnabled: false`, no auth).
- Browser UAT backlog deferred to v3.2 (6 walkthroughs, see Deferred section).

## Constraints

- **Licensing / Promise**: Extension-side features stay free + open-source — only external-API services can be behind a paywall. Landing page commitment is public.
- **Dependency model**: Vocabulary data must originate in `papertek-vocabulary`; the extension pulls via `scripts/sync-vocab.js`. Never hand-edit `extension/data/*.json`.
- **Cross-app impact**: Vocab schema changes ripple to `papertek-webapps` and `papertek-nativeapps`. Additive changes are safe; structural edits require cross-app coordination.
- **Offline requirement**: Dictionary, prediction, spell-check, grammar features must all work without network. Only TTS and auth need connectivity. Enforced by `check-network-silence` release gate.
- **Bundle size**: Internal engineering ceiling 20 MiB enforced by `check-bundle-size`. Current 10.25 MiB. Data additions must stay within that budget.
- **Platform**: Chrome + Edge + Brave (Chromium-based). No Safari/Firefox promises.
- **Language priority**: NB first, NN second, then DE/ES/FR/EN for any language-specific feature work.
- **Regression fixture + release gates are now binding**: any PR that breaks `check-fixtures`, `check-explain-contract`, `check-rule-css-wiring`, `check-spellcheck-features`, `check-network-silence`, or `check-bundle-size` must not ship. Gates exist because v1.0 smoke-testing surfaced multiple bugs that all per-rule unit tests missed.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Spell-check stays **free** forever | Landing page publicly commits to this for all extension-side features; breaking trust is expensive | ✓ Good — v1.0 shipped 100% free, no gating |
| Production-quality bar, **no ML** | Keeps the product free and offline; ML would force external API costs | ✓ Good — v1.0 hit P=1.000 R=1.000 on særskriving and 11/11 smoke-test with heuristics only |
| Iterative releases, no hard deadline | Allows shipping partial wins and responding to real-use feedback | ✓ Good — 8 phases over 4 days, 3 of them decimal-inserted gap fixes when audits caught integration defects |
| Test approach: manual + growing regression fixture, pilot later | Matches current team size; fixture builds a repeatable check even without a test runner | ✓ Good — fixture (262 cases) caught every regression that got committed; smoke-test caught what fixture missed (feature-gated lookup bug, CSS wiring bug). Audit explicitly recommends the fixture as mandatory before future releases |
| Keep `spell-check.js` structurally separable | Leaves the door open to extraction into `skriv.papertek.app` without building premium gating now | ✓ Good — zero spell-check imports from word-prediction internals; `__lexiVocab` seam is the only coupling |
| **Raise bundle-size cap to 20 MiB** (Phase 02.1) | Honest engineering ceiling vs. original false "publicly-stated promise" framing; preserves gate as regression-detection guard | ✓ Good — cap never tested; zip stayed at 10.25 MiB. Cap serves as alarm, not constraint |
| **Decimal phase numbering for audit-driven inserts** (Phase 02.1 / 03.1 / 05.1) | Preserves integer-phase roadmap semantics while allowing urgent gap-closure between integers | ✓ Good — 3 decimal phases closed SC-4, SC-01, and UX-01 gaps without renumbering planned work |
| **Reverse SC-03 to flag-not-tolerate** (Phase 05.1 Gap D, user domain policy) | NB and NN are two distinct official standards; cross-standard tokens ARE student errors per user memory `project_nb_nn_no_mixing.md` | ✓ Good — dialect-mix rule + CROSS_DIALECT_MAP authoritative fire-gate; 11/11 Chrome smoke-test passed on cross-dialect sweep |
| **`papertek-vocabulary` is single source of data truth** | Three consumers (leksihjelp, papertek-webapps, papertek-nativeapps) stay in sync; additive schema changes only | ✓ Good — Phase 2 (typo bank) + Phase 05.1 (languagesbank + nationalitiesbank + adjective-declension audit) all landed at the source; extension pulled via `npm run sync-vocab` |
| **Sentence segmenter via `Intl.Segmenter`** (v2.0) | Zero-dependency, browser-native, handles all 5 languages | ✓ Good — consumed by every structural rule; no edge-case bugs surfaced |
| **Tagged-token POS view in core, not per-rule** (v2.0) | Prevents re-implementation; single source of `findFiniteVerb` / `isMainClause` | ✓ Good — 6+ rules consume `ctx.getTagged(i)` without duplicating the walk |
| **Shared `grammar-tables.js`** (v2.0) | One file for preposition-case tables, trigger sets, closed-adjective lists | ✓ Good — consumed by DE, ES, FR rules across Phases 8–13; no duplication |
| **Document-state two-pass runner** (v2.0) | Separate `kind: 'document'` rules run after all token rules, with explicit invalidation | ✓ Good — 4 doc-drift rules use it cleanly; `check-stateful-rule-invalidation` gate catches regressions |
| **Phase 16 deferred to v3.0** (v2.0 scope review) | Tense harmony/anaphora/long-distance SV agreement require deeper parsing; aspirational scope | ✓ Good — kept v2.0 shippable without unbounded parser work |
| **FR PP 10.3b deferred to v3.0** (v2.0) | Full PP agreement (distance > adjacent window, pronominal reflexive DO) needs near-parser capability | ✓ Good — adjacent-window 10.3a ships correct; corner cases wait for better infrastructure |
| **Gap closure via decimal phases** (v2.0) | 14.1 and 15.1 closed audit-found gaps without renumbering | ✓ Good — pattern established in v1.0 continues to work well |
| **Both-sides validation for decomposition** (v2.1) | Require both split components to be known nouns before accepting decomposition | ✓ Good — 0% FP rate on full NB+DE nounbank; prevents phantom compounds |
| **Decomposition does not mutate indexes** (v2.1) | Decomposed compounds don't add to validWords/compoundNouns — separate acceptance path | ✓ Good — no FP storm from accumulating questionable compounds |
| **Typo d=1 wins over decomposition** (v2.1) | Misspelled words get corrected rather than accepted as compounds | ✓ Good — "skoledegen" corrected to "skoledagen", not accepted as a compound |
| **Supplementary compounds over decomposition fallback in sarskriving** (v2.1) | Removed decomposition fallback from sarskriving; added 16 supplementary compounds to preserve recall | ✓ Good — eliminated 6 FP suites; sarskriving stays P=1.000 R=1.000 |
| **Algorithmic NN presens derivation** (v2.1) | Derive -est from stored -ast infinitives instead of Papertek deploy round-trip | ✓ Good — unblocks NN finite presens without data-source change |
| **Severity 'hint' for NB passiv overuse** (v2.1) | Document-level overuse is informational, not error; matches explain-contract gate | ✓ Good — doesn't alarm students, just suggests considering active voice |
| **Phase 20 deferred** (v2.1) | Browser visual verification deferred — code phases complete, visual checks can be ad-hoc | ⚠️ Revisit — VERIF-01 carried across four milestones now |
| **Combined FF + POLY into single phase** (v2.2) | Shared data enrichment + rendering pattern for false-friends and senses | ✓ Good — reduced from 2 separate phases to 1 phase with 2 plans |
| **Reverse linkedTo index for cross-language enrichment** (v2.2) | NB entries are canonical source; target entries enriched at render time via reverse index | ✓ Good — O(1) in popup, O(n) in widget; additive enrichment preserves direct NB data |
| **Priority 15 for å/og rule** (v2.2) | Most common NB writing error deserves high visibility; red-600 CSS dot | ✓ Good — clear visual signal without cluttering other priorities |
| **å/og removed from homophones rule** (v2.2) | Dedicated rule with posture-verb exceptions handles the full complexity | ✓ Good — prevents duplicate flagging between nb-homophones and nb-aa-og |
| **IndexedDB over `unlimitedStorage` permission** (v3.0) | Avoids stricter Web Store review; IDB quota is sufficient for vocab data | ✓ Good — no permission prompt, clean install experience |
| **Tiny NB baseline (~130 KB) bundled** (v3.0) | First lookup works offline on install; full data downloads in background | ✓ Good — top-2k Zipf + typos + pronouns covers 95% of lookups; 200 KB cap gate prevents regression |
| **Pre-gzip bundle responses** (v3.0) | Module-cached buffers per (language, revision); DE wire size 4.45 MB → ~795 KB | ✓ Good — 3.7 MB headroom under Vercel 4.5 MB cap; no contract change |
| **IDB rename lexi-vocab v3** (v3.0) | Clean break from v2 `leksihjelp-vocab` v2 store; old DB sits inert | ✓ Good — avoids dual-shape support; migration downloads fresh data |
| **Consolidated v3.0 into single phase** (v3.0) | 1M context window allows one 8-plan phase instead of 3-4 smaller phases | ✓ Good — shipped in 1 day; dependency chains within the phase were natural wave ordering |
| **SC-06 sanctioned bootstrap exception** (v3.0) | Service-worker fetch is the only network path; spell-check + word-prediction stay offline | ✓ Good — belt-and-braces: header doc + self-test plants fetch in bootstrap and asserts gate stays green |
| **Per-feature exam markers, default-conservative** (v3.1 Phase 27) | Exam regulations require browser-native-spellcheck parity; classify lookup-shaped grammar rules `safe=false` until browser-baseline audit confirms parity | ✓ Good — Phase 33 followed up with the audit and flipped where appropriate; `check-exam-marker` gate prevents new features shipping unclassified |
| **`exam-registry.js` for non-rule UI surfaces** (v3.1 Phase 27) | Rules use `rule.exam`; non-rule surfaces (popup, conjugation tables, TTS) need their own marker shape | ✓ Good — synced to lockdown via existing pipeline; teacher-lock uses same registry |
| **Dep injection for popup view modules** (v3.1 Phase 30) | View modules need to mount in extension popup AND lockdown sidepanel without behavior change; explicit deps = no implicit globals | ✓ Good — `check-popup-deps` gate enforces no `chrome.*` / `window.__lexi*` / unscoped `getElementById`; lockdown sidepanel hosts the same code with limited deps |
| **`audioEnabled: false` in lockdown** (v3.1 Phase 30) | Audio is leksihjelp's only premium-cost surface; lockdown is a school deployment, no MB-level downloads | ✓ Good — three independent safeguards (renderResults gate + host never passes real playAudio + `extension/audio/` excluded from sync) |
| **INFRA-10 vocab-seam-coverage gate** (v3.1 Phase 36) | Phase 26-01 / 32-01 / 32-03 each shipped indexes through gates green that were silently empty in browser; static-parse `buildIndexes` literal + assert seam wiring | ✓ Good — caught 3 additional seam-bug instances on first run beyond the v2.9.15 ad-hoc fix; the regression class is now structurally defended |
| **Population canaries in seam-coverage gate** (v3.1 Phase 36-03) | Asserting indexes exist isn't enough — they need to be non-empty under the default preset (the user's actual baseline) | ✓ Good — defensively closed F36-1 even before browser UAT; rule cannot recur |
| **Cross-language verb-form guard in nb-typo-fuzzy** (v3.1 Phase 36-03) | FR `mangeait` was being flagged as NB typo because nb-typo-fuzzy didn't check for cross-language verb forms before suggesting | ✓ Good — F36-1 root cause closed; rule no longer claims foreign-language tokens |
| **Custom split: hygiene now, UAT to v3.2** (v3.1 Quick Task 1) | 14 tech-debt items split into "do now" (hygiene + orphan cleanup) vs "do as v3.2 phase" (browser UAT batch); avoids cleanup phase scope creep | ✓ Good — milestone archive is hygiene-clean; UAT consolidated as v3.2 entry point |

---
*Last updated: 2026-05-01 after v3.1 milestone (Polish & Intelligence) shipped*
