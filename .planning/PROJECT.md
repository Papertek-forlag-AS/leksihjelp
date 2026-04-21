# Leksihjelp

## What This Is

Chrome/Edge browser extension for Norwegian students learning foreign languages
(German, Spanish, French, English). Provides dictionary lookup, pronunciation
(text-to-speech), context-aware word prediction in any text input, and a
production-quality Norwegian spell-check surface (NB + NN) aimed especially at
students with dyslexia. Distributed as a free, open-source extension (MIT) with
an optional premium subscription that funds the ElevenLabs TTS calls. All
non-TTS features are 100% offline and free.

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

### Active

<!-- Next milestone. Hypotheses until planned. -->

Next milestone not yet scoped. Run `/gsd:new-milestone` to begin.

Candidate work tracked during v1.0 (see `.planning/milestones/v1.0-MILESTONE-AUDIT.md` tech-debt section):

- Manual "Run spell-check" button (Phase 5 deferred feature — user memory `project_phase5_manual_spellcheck_button.md`)
- Demonstrative-mismatch rule (`Det boka`, `Den huset`) — extends nb-gender beyond en/ei/et
- Triple-letter typo budget (`tykkkjer`) — frequency-weighted fuzzy-distance tiebreak
- NN phrase-infinitive triage (~214 `papertek-vocabulary` verbbank entries)
- Data-source architecture move: extension = functions only, bundled baseline + sync with papertek-vocabulary (memory `project_data_source_architecture.md`)
- Leksi-in-skriv integration: embed spell-check/prediction as native feature inside `skriv.papertek.app` (memory `project_lexi_in_skriv_integration.md`)
- `papertek-vocabulary` data gaps: `markeres` s-passiv; `setningen` NB bestemt form
- Future promotion: move `CROSS_DIALECT_MAP` from `nb-dialect-mix.js` into `papertek-vocabulary` for cross-app reuse

### Out of Scope

<!-- Explicit exclusions with reasoning. Prevents re-adding later. -->

- **Premium-gating for spell-check or other extension-side features** — landing page (`backend/public/index.html:681-683`) publicly commits all extension features stay free/open. Gating contradicts the promise and breaks user trust.
- **Spell-check for non-Norwegian languages** — v1 rule set is specific to Norwegian (gender, særskriving). Each new language = its own milestone-scale effort.
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
- ~9.5k lines of JavaScript in `extension/`. Shipped zip 10.25 MiB (20 MiB internal cap, ~49% headroom).
- Vocabulary data ships bundled per language; runtime downloads available for DE/ES/FR via IndexedDB; NB/NN/EN always bundled.
- Vocab is authored in a separate repo (`papertek-vocabulary`) that also feeds `papertek-webapps` and `papertek-nativeapps`. Schema changes have cross-app blast radius — additive changes preferred.
- Backend is Vercel serverless (Node.js ESM). Firebase Admin SDK for user/subscription state. All costs covered by subscription revenue.

**Shipping rhythm:**
- Release as GitHub Release tags → landing page serves latest zip via `/releases/latest/download/lexi-extension.zip`.
- v1.0 shipped over 4 days (2026-04-18 → 2026-04-21, 133 commits) across 8 phases (3 of which were decimal-inserted gap-closure phases: 02.1, 03.1, 05.1).
- 8 release gates enforced on every release (fixtures, explain-contract + self-test, rule-CSS wiring + self-test, feature-independent indexes, network silence, bundle size).

**Current state (post-v1.0):**
- 19/19 v1 requirements shipped and verified.
- Chrome smoke test 11/11 PASS on `leksihjelp-2.3.1`.
- No automated test suite — regression fixture is the first meaningful safety net. 262 hand-authored NB/NN cases, P/R/F1 gated per rule class.
- Known v2.0+ tech debt tracked in v1.0 audit (no blockers for release).

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

---
*Last updated: 2026-04-21 after v1.0 Spell-Check & Prediction Quality milestone*
