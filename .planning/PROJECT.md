# Leksihjelp

## What This Is

Chrome/Edge browser extension for Norwegian students learning foreign languages
(German, Spanish, French, English). Provides dictionary lookup, pronunciation
(text-to-speech), and context-aware word prediction in any text input, plus a
Norwegian spell-check surface aimed especially at students with dyslexia.
Distributed as a free, open-source extension (MIT) with an optional premium
subscription that funds the ElevenLabs TTS calls.

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
- ✓ **Norwegian spell-check v1 (NB/NN)** — per-word inline dots with click-to-fix popover; four error classes (gender article, wrong-form-after-modal, særskriving, typo) + bounded Damerau-Levenshtein fuzzy matching with proper-noun guard
- ✓ **Norwegian adjective agreement** — gender + number + definiteness signals drive prediction scoring
- ✓ **First-run onboarding** — UI-language picker and target-language picker, gated on a dedicated flag
- ✓ **Pencil shortcut + detached "Fest" window** — pencil opens skriv.papertek.app; Fest opens a persistent floating popup window (`chrome.windows.create`)
- ✓ **Custom grammar settings per language** — students toggle which grammar features appear in the dictionary

### Active

<!-- This milestone. Hypotheses until shipped and validated by real use. -->

- [ ] **Spell-check quality to production level (NB + NN)** — minimal false positives, catches most real learner errors so students don't reach for another tool
- [ ] **Word-prediction quality push** — ranking, coverage, and filtering improvements across all six languages (DE/ES/FR/NB/NN/EN)
- [ ] **Papertek-vocabulary data improvements** — which specific improvements get prioritized is a planner/research decision; data changes land in the sibling `papertek-vocabulary` repo and flow back via `npm run sync-vocab`
- [ ] **"Why was this flagged?" explanation in spell-check popover** — student-friendly reasoning rather than bare class labels ("Skrivefeil", "Kjønn", …)
- [ ] **Regression test fixture** — a growing text file of sentences with known errors + expected corrections, runnable as a script, used on every version
- [ ] **Module separability preserved** — spell-check keeps its narrow `__lexiPrediction` interface so it could later be extracted without touching prediction internals (no premium/policy infrastructure — see Out of Scope)

### Out of Scope

<!-- Explicit exclusions with reasoning. Prevents re-adding later. -->

- **Premium-gating for spell-check** — landing page (`backend/public/index.html:681-683`) publicly commits: "Alle funksjoner i selve utvidelsen er og forblir gratis og åpen kildekode. Eventuelle fremtidige betalingsfunksjoner vil kun gjelde tjenester som krever eksterne API-kostnader." Spell-check is 100% extension-side with no external cost — gating contradicts the promise and damages trust with existing users.
- **Spell-check for non-Norwegian languages** — v1 language models are specific to Norwegian grammar (gender, særskriving). Adding DE/ES/FR requires language-specific rule sets, a separate milestone.
- **Machine-learning models** — heuristics only. No on-device ML, no API calls for correction, keeps the product free and offline.
- **Bundle-size growth beyond current ~10MB** — bigrams and frequency tables should stay within the existing budget; any growth must be justified.
- **Complete Grammarly parity** — explicitly unreachable without ML. We aim for production-quality on common errors, not full coverage of English-market grammar tooling.

## Context

**Business + brand:**
- Papertek forlag AS is the commercial operator. Existing premium (TTS) funds external API costs and a small margin. Non-TTS features are a permanent free tier — this is a marketed promise, not an internal policy.
- "Perfekt for elever med dysleksi" is a named section on the landing page. Dyslexia-supporting features (smart suggestions, pronunciation confirmation, tolerant matching) are positioned as free-tier brand benefits, not up-sells.
- Stated "Veien videre" commitment: expanded typo bank + accepted alternative answers + anonymous data contributions. Aligns directly with this milestone's spell-check + vocab work.

**Technical environment:**
- Chrome Manifest V3 extension, vanilla JavaScript, no build step for extension code — keeps the bar low for contributors.
- Vocabulary data ships bundled per language (`extension/data/*.json`); runtime downloads available for DE/ES/FR via IndexedDB vocab-store; NB/NN/EN always bundled.
- Vocab is authored in a separate repo (`papertek-vocabulary`) that also feeds `papertek-webapps` and `papertek-nativeapps`. Schema changes have cross-app blast radius.
- Backend is Vercel serverless (Node.js ESM). Firebase Admin SDK for user/subscription state. All costs are covered by subscription revenue.

**Shipping rhythm:**
- Release as GitHub Release tags → landing page serves latest zip via `/releases/latest/download/lexi-extension.zip`.
- Small-step versioning: patch bumps are cheap; the branch is typically the same main. Iterative wins are the preferred mode.
- No automated test suite currently — regression fixture under development is the first step toward changing that.

## Constraints

- **Licensing / Promise**: Extension-side features stay free and open-source — only external-API services can be behind a paywall. Landing page commitment publicly.
- **Dependency model**: Vocabulary data must originate in `papertek-vocabulary`; the extension pulls via `scripts/sync-vocab.js`. Never hand-edit `extension/data/*.json`.
- **Cross-app impact**: Vocab schema changes ripple to `papertek-webapps` and `papertek-nativeapps`. Additive changes are safe; structural edits require cross-app coordination.
- **Offline requirement**: Dictionary, prediction, spell-check, grammar features must all work without network. Only TTS and auth need connectivity.
- **Bundle size**: Current ~10 MB. Data additions (frequency tables, bigrams, typo expansions) must stay within that budget.
- **Platform**: Chrome + Edge + Brave (Chromium-based). No Safari/Firefox promises.
- **Language priority**: NB first, NN second, then DE/ES/FR/EN for any language-specific feature work.
- **No automated tests yet**: This milestone introduces a regression fixture as the first step toward measurable quality. Manual testing is the current baseline.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Spell-check stays **free** forever | Landing page publicly commits to this for all extension-side features; breaking trust is expensive | — Pending |
| Production-quality bar, **no ML** | Keeps the product free and offline; ML would force external API costs | — Pending |
| Iterative releases, no hard deadline | Allows shipping partial wins weekly and responding to real-use feedback | — Pending |
| Test approach: manual + growing regression fixture, pilot later | Matches current team size (solo-ish); fixture builds a repeatable check even without a test runner | — Pending |
| Milestone scope = spell-check + prediction + vocab | Treats related quality work as one release cycle so cross-cutting changes (e.g., frequency tables) benefit both | — Pending |
| Keep `spell-check.js` structurally separable via narrow `__lexiPrediction` interface | Leaves the door open to later extraction (e.g., `skriv.papertek.app` integration) without building premium gating now | — Pending |

---
*Last updated: 2026-04-17 after initialization*
