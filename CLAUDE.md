# Leksihjelp - Project Reference

## Overview

Chrome/Edge browser extension for Norwegian students learning foreign languages (German, Spanish, French). Provides dictionary lookup, text-to-speech, and word prediction.

## Tech Stack

- **Extension:** Vanilla JavaScript, Chrome Manifest V3
- **Backend:** Vercel Serverless (Node.js) at `https://leksihjelp.vercel.app` (custom domain: `leksihjelp.no`)
- **Vocabulary API:** Papertek API at `https://www.papertek.no`
- **Auth & Payments:** Vipps MobilePay (OIDC login + Recurring Payments), Stripe (yearly card payments)
- **Database:** Firebase Firestore
- **TTS:** ElevenLabs API (premium) with browser speechSynthesis fallback

## Project Structure

```
leksihjelp/
├── extension/
│   ├── manifest.json          # Chrome extension manifest
│   ├── popup/
│   │   ├── popup.html         # Main popup UI (Vipps login + dictionary)
│   │   └── popup.js           # Dictionary search, auth, grammar features
│   ├── content/
│   │   ├── floating-widget.js # TTS widget on text selection (dual auth)
│   │   └── word-prediction.js # Autocomplete in text inputs
│   ├── background/
│   │   └── service-worker.js  # Context menus, session refresh, message routing
│   ├── data/
│   │   ├── {lang}.json        # Vocabulary data (de.json, es.json, fr.json)
│   │   └── grammarfeatures-{lang}.json  # Grammar feature definitions
│   ├── styles/
│   │   ├── popup.css          # Popup styles
│   │   └── content.css        # Content script styles
│   └── assets/                # Extension icons
├── backend/
│   ├── api/
│   │   ├── _vipps.js          # Vipps API helpers (OIDC, Recurring, state tokens)
│   │   ├── _jwt.js            # Session JWT utility (HMAC-SHA256)
│   │   ├── _firebase.js       # Lazy Firebase Admin SDK init
│   │   ├── _quota.js          # Quota rollover system
│   │   ├── _stripe.js         # Stripe helpers (Checkout, webhook verification)
│   │   ├── _utils.js          # CORS, rate limiting, IP extraction
│   │   ├── tts.js             # ElevenLabs TTS proxy (dual auth + quota)
│   │   ├── verify.js          # Legacy access code verification
│   │   ├── auth/
│   │   │   ├── vipps-login.js       # GET  — Redirects to Vipps OIDC
│   │   │   ├── exchange-code.js     # POST — Extension OAuth code exchange
│   │   │   ├── vipps-callback.js    # GET  — Web OAuth callback
│   │   │   ├── session.js           # POST — Validate JWT, return user info
│   │   │   ├── subscribe.js         # POST — Create Vipps Recurring agreement
│   │   │   ├── subscribe-callback.js # GET — Redirect after subscription
│   │   │   └── create-checkout.js   # POST — Create Stripe Checkout session
│   │   ├── webhooks/
│   │   │   ├── vipps.js       # POST — Vipps webhook handler
│   │   │   └── stripe.js      # POST — Stripe webhook handler
│   │   └── cron/
│   │       ├── create-charges.js     # GET — Daily Vipps charge creation
│   │       └── check-stripe-expiry.js # GET — Daily Stripe expiry check
│   ├── public/
│   │   ├── index.html         # Landing page
│   │   └── vilkar.html        # Terms of sale (required by Vipps)
│   ├── vercel.json            # Routes, rewrites, cron config
│   ├── local-server.js        # Dev server with all routes
│   ├── package.json           # firebase-admin dependency
│   └── .env.example           # All environment variables
├── scripts/
│   └── sync-vocab.js          # Fetches vocabulary from Papertek API
└── package.json               # npm scripts for syncing + packaging
```

---

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  Chrome Extension│    │  Vercel Backend   │    │  Vipps MobilePay  │
│  (popup.js)      │◄──►│  (leksihjelp.no)  │◄──►│  (OIDC + Recurring)│
│                  │    │                  │    │                   │
│  - Vipps login   │    │  Auth endpoints  │    │  Login API        │
│  - Subscribe btn │    │  TTS proxy       │    │  Recurring API v3 │
│  - TTS playback  │    │  Webhook handler │    │  Webhooks API     │
│  - Usage bar     │    │  Cron job        │    │                   │
└─────────────────┘    └───────┬──────────┘    └───────────────────┘
                               │
                        ┌──────▼──────┐
                        │  Firestore  │
                        │  - users    │
                        │  - agreements│
                        │  - charges  │
                        └─────────────┘
```

---

## Authentication Flows

**Extension login (popup.js):**
1. User clicks "Logg inn med Vipps" in popup
2. `chrome.identity.launchWebAuthFlow()` opens Vipps OIDC in browser
3. After consent, Vipps redirects to `/api/auth/vipps-callback`
4. Callback returns HTML that posts code back to extension via redirect URL
5. Extension calls `POST /api/auth/exchange-code` with the authorization code
6. Backend exchanges code for tokens, fetches user info, creates/updates Firestore user
7. Backend mints 30-day session JWT and returns it with user profile
8. Extension stores JWT in `chrome.storage.local`

**Web login (landing page):**
1. User clicks "Logg inn med Vipps" on leksihjelp.no
2. Redirects to `GET /api/auth/vipps-login`
3. Backend builds auth URL with signed state token, redirects to Vipps
4. After consent, Vipps redirects to `GET /api/auth/vipps-callback`
5. Backend verifies state, exchanges code, mints JWT
6. Redirects to landing page with token

**Subscription flow (Vipps monthly):**
1. Authenticated user clicks "Abonner" (29 kr/mnd)
2. Extension calls `POST /api/auth/subscribe` with Bearer token
3. Backend creates Vipps Recurring agreement
4. Returns `vippsConfirmationUrl` — user approves in Vipps app
5. Vipps sends webhook when agreement activates
6. Daily cron job creates charges for due agreements

**Stripe yearly payment:**
1. Authenticated user clicks "Betal 290 kr/år"
2. Extension calls `POST /api/auth/create-checkout` with Bearer token
3. Backend creates a Stripe Checkout Session (one-time payment, 290 NOK)
4. Returns `checkoutUrl` — user completes payment on Stripe's hosted page
5. Stripe sends `checkout.session.completed` webhook
6. Webhook handler activates subscription for 365 days
7. Daily cron job deactivates expired subscriptions

---

## TTS Dual Auth

The `POST /api/tts` endpoint supports two authentication methods:
1. **Bearer token:** JWT from Vipps login. Requires active subscription. Tracks character quota with rollover (10,000 chars/month, unused rolls over, max 20,000).
2. **Legacy access code:** `x-access-code` header. No quota tracking. For backward compatibility.

When quota is exceeded, the extension falls back to free browser speechSynthesis.

---

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key |
| `ACCESS_CODE` | Legacy TTS access code |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `SESSION_JWT_SECRET` | HMAC-SHA256 secret for session JWTs |
| `SITE_URL` | `https://leksihjelp.no` (prod), `http://localhost:3000` (dev) |
| `CRON_SECRET` | Protects the daily cron endpoints |
| `VIPPS_CLIENT_ID` | From Vipps merchant portal |
| `VIPPS_CLIENT_SECRET` | From Vipps merchant portal |
| `VIPPS_SUBSCRIPTION_KEY` | From Vipps developer portal |
| `VIPPS_MERCHANT_SERIAL_NUMBER` | From Vipps merchant portal |
| `VIPPS_API_BASE` | `https://apitest.vipps.no` (test) or `https://api.vipps.no` (prod) |
| `VIPPS_WEBHOOK_SECRET` | From Vipps webhook registration |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

---

## Firestore Collections

**`users`** — User profiles
```json
{
  "name": "Ola Nordmann",
  "email": "ola@example.com",
  "phone": "4712345678",
  "subscriptionStatus": "active|pending|none",
  "agreementId": "agr_xxx",
  "subscriptionType": "vipps_monthly|stripe_yearly",
  "quotaBalance": 8500,
  "quotaLastTopUp": "2026-02-01T00:00:00.000Z",
  "quotaMonthlyAllowance": 10000,
  "quotaMaxBalance": 20000,
  "stripeExpiresAt": "2027-02-13T..."
}
```

**`agreements`** — Vipps Recurring agreements
```json
{
  "agreementId": "agr_xxx",
  "userId": "vipps-sub-123",
  "status": "ACTIVE|PENDING|STOPPED|EXPIRED",
  "amount": 2900,
  "nextChargeDate": "..."
}
```

**`charges`** — Monthly charge records
```json
{
  "chargeId": "chr_xxx",
  "agreementId": "agr_xxx",
  "status": "CHARGED|FAILED|REFUNDED",
  "amount": 2900
}
```

---

## Vocabulary Data

### Papertek API Endpoints

- `GET /api/vocab/v1/core/{language}` - Core vocabulary (words, conjugations, etc.)
- `GET /api/vocab/v1/translations/{pair}` - Norwegian translations (de-nb, es-nb, fr-nb)
- `GET /api/vocab/v1/grammarfeatures?language={code}` - Grammar feature definitions

### Syncing Vocabulary

```bash
npm run sync-vocab      # Sync all languages
npm run sync-vocab:de   # Sync only German
```

The sync script fetches from the Papertek API and writes to `extension/data/`.

### Data Structure

Vocabulary is organized by **banks** (not a flat array):

```json
{
  "_metadata": { "language": "de", "languageName": "Tysk" },
  "verbbank": {
    "sein_verb": { "word": "sein", "translation": "å være", "conjugations": {} }
  },
  "nounbank": {
    "schule_noun": { "word": "Schule", "genus": "f", "plural": "die Schulen" }
  }
}
```

Banks: `verbbank`, `nounbank`, `adjectivebank`, `articlesbank`, `generalbank`, `numbersbank`, `phrasesbank`, `pronounsbank`

---

## Grammar Features System

Users can toggle which grammar elements to display in dictionary results.

1. Grammar features are defined per language in `grammarfeatures-{lang}.json`
2. Features are grouped by category (verbs, nouns, adjectives)
3. User selections are stored in `chrome.storage.local` under `enabledGrammarFeatures`
4. Rendering functions check `isFeatureEnabled(featureId)` before displaying

### Key Feature IDs

**German:**
- `grammar_present`, `grammar_preteritum`, `grammar_perfektum` (verb tenses)
- `grammar_pronouns_ich_du`, `grammar_pronouns_singular_wir`, `grammar_pronouns_all` (pronoun filtering)
- `grammar_articles`, `grammar_plural`, `grammar_accusative_*`, `grammar_dative` (noun cases)
- `grammar_comparative`, `grammar_superlative` (adjectives)

**Spanish:**
- `grammar_present`, `grammar_preterito` (verb tenses)
- `grammar_articles`, `grammar_plural` (nouns)
- `grammar_comparative`, `grammar_superlative` (adjectives)

---

## Key Code Patterns

### Flattening Banks for Search

```javascript
function flattenBanks(dict) {
  const words = [];
  for (const bank of Object.keys(BANK_TO_POS)) {
    const bankData = dict[bank];
    if (!bankData) continue;
    for (const [wordId, entry] of Object.entries(bankData)) {
      words.push({ ...entry, _bank: bank, partOfSpeech: BANK_TO_POS[bank] });
    }
  }
  return words;
}
```

### Feature-Aware Rendering

```javascript
// Only show gender if grammar_articles feature is enabled
${entry.gender && isFeatureEnabled('grammar_articles') ? `<span>${entry.gender}</span>` : ''}
```

### Multi-Language Support in Rendering

Conjugation keys vary by language (German: `presens`, Spanish: `presente`):

```javascript
const tenseConfig = [
  { keys: ['presens', 'presente'], featureIds: ['grammar_present'], name: 'Presens' },
  // ...
];
```

---

## Important Files

| File | Purpose |
|------|---------|
| `popup/popup.js` | Main dictionary logic, auth, grammar feature filtering |
| `content/floating-widget.js` | TTS widget, inline lookup, dual auth |
| `content/word-prediction.js` | Autocomplete suggestions |
| `background/service-worker.js` | Context menus, session refresh on startup |
| `scripts/sync-vocab.js` | API sync script |
| `data/*.json` | Bundled vocabulary (offline support) |
| `backend/api/_vipps.js` | All Vipps API interaction (OIDC + Recurring) |
| `backend/api/_jwt.js` | Session token creation/verification |
| `backend/api/_firebase.js` | Firestore initialization |
| `backend/api/_quota.js` | Quota rollover system |
| `backend/api/_stripe.js` | Stripe Checkout helpers + config |
| `backend/api/auth/create-checkout.js` | Creates Stripe Checkout Session |
| `backend/api/webhooks/stripe.js` | Stripe webhook handler |
| `backend/api/cron/check-stripe-expiry.js` | Daily Stripe expiry cron |
| `backend/api/tts.js` | TTS proxy with dual auth + quota tracking |

---

## ElevenLabs TTS Configuration

- **Model:** `eleven_flash_v2_5` (32 languages, widely available across plans)
- **Language codes:** Short codes (`no`, `es`, `de`, `fr`)
- **Voice IDs in this project use student-friendly display names** (e.g. "Lukas" is actually ElevenLabs' "Liam"). This is by design for a friendly UI.

## Release Workflow

After making changes to files under `extension/`:

1. Run the regression fixture suite:
   - `npm run check-fixtures` — must exit 0. Per-rule P/R/F1 is informational in Phase 1; hard mismatches (missing-expected or unexpected findings) block the release.
   - If anything fails, fix the rule (or the fixture, if the expected answer was wrong) and re-run until exit is 0.
2. Verify every popover-surfacing rule has a valid student-friendly explain contract (UX-01):
   - `npm run check-explain-contract` — must exit 0. Loads each of the five rule files under `extension/content/spell-rules/` that surface to the spell-check popover (`nb-gender`, `nb-modal-verb`, `nb-sarskriving`, `nb-typo-curated`, `nb-typo-fuzzy`) and asserts `rule.explain` is a callable returning `{nb: string, nn: string}` with non-empty strings for both registers. Exits 1 with a pointer to the offending file on any deviation.
   - Paired self-test: `npm run check-explain-contract:test` — belt-and-braces against the gate going silently permissive via regex / shape drift. Plants a broken-shape scratch rule, confirms the gate fires; plants a well-formed scratch rule, confirms the gate passes. Mirrors the `check-network-silence:test` pattern.
3. Verify every popover-surfacing rule also has a visible dot-colour CSS binding (Phase 05.1 Gap D):
   - `npm run check-rule-css-wiring` — must exit 0. For each rule in the same popover-surfacing TARGETS list as `check-explain-contract`, asserts `extension/styles/content.css` contains a `.lh-spell-<rule.id> { ...background... }` binding. Exits 1 with a file:line pointer and an add-this-line fix suggestion.
   - Paired self-test: `npm run check-rule-css-wiring:test` — plants a scratch rule with an unwired id (gate must fire) and one reusing a wired id (gate must pass). Mirrors the `check-explain-contract:test` pattern.
   - Why this gate exists: Phase 05.1 shipped the `dialect-mix` rule without a matching CSS colour, so the 3px marker painted transparent. All other gates passed; users saw Chrome's native red squiggle instead of our dot and concluded the rule was silent. This gate catches that class of regression before it reaches the browser.
4. Verify feature-gated preset doesn't starve the spell-check lookup indexes (Phase 05.1 smoke-test bug):
   - `npm run check-spellcheck-features` — must exit 0. For NB it simulates the browser's default `basic` preset predicate exactly (only `grammar_nb_presens + grammar_nb_genus + grammar_nb_flertall` enabled). For EN/DE/ES/FR it simulates a minimal preset per language with past-tense and/or plural features disabled. In every case it asserts that `verbInfinitive`, `nounGenus`, and `validWords` still contain feature-gated forms (e.g. `gikk`/`boka` for NB, `came`/`went` for EN, `ging`/`kam` for DE, `comí`/`casas` for ES, `aimais`/`aimé` for FR) AND that the corresponding gated entries are absent from `wordList` — proving the lookup indexes are built from the unfiltered superset while word-prediction still respects the user's preset.
   - Why this gate exists: Phase 05.1 smoke-test surfaced that `buildIndexes` was feeding the feature-gated wordList into `buildLookupIndexes`, silencing the modal-verb rule on preteritum tokens under the default preset even though `check-fixtures` passed (the fixture runner always uses `() => true`). This gate catches the Node-vs-browser divergence before shipping.
5. Verify the offline surface stays network-silent (SC-06):
   - `npm run check-network-silence` — must exit 0. Scans `extension/content/spell-check*.js`, `extension/content/spell-rules/**`, and `extension/content/word-prediction.js` for `fetch(`, `XMLHttpRequest`, `sendBeacon`, and `http(s)://` URL literals. Whitelists `chrome.runtime.getURL` and `chrome-extension://` (local-resource access is fine). Exits 1 on any forbidden hit with file:line output.
   - Philosophically: this gate enforces the "free + offline forever" promise on the extension side. A PR that adds `fetch(...)` to a spell rule for "just one loan-word list" breaks the gate and gets the attention it needs.
6. Verify every user-visible feature carries a valid exam-mode marker (Phase 27):
   - `npm run check-exam-marker` — must exit 0. Loads every rule under `extension/content/spell-rules/` and every entry in `extension/exam-registry.js` and asserts each carries a well-formed `exam: { safe: boolean, reason: string, category?: string }` marker (registry entries require `category`; rules accept it as optional but validate the closed set when present). Exits 1 with a per-rule diagnostic on any deviation.
   - Paired self-test: `npm run check-exam-marker:test` — belt-and-braces against the gate going silently permissive. Plants malformed/missing/invalid-category scratch rules (gate must fire on each) and a well-formed scratch rule (gate must pass).
   - Why this gate exists: Phase 27 ships exam-mode as a school-deployment feature. A new feature added without an exam marker would silently default to "unclassified" — the worst failure mode for an exam-compliance feature, since teachers couldn't trust that the extension is in fact suppressing every non-exam-safe surface. This gate ensures every shipped feature is explicitly classified.
7. Verify every popup view module honours its dep contract (Phase 30 GATES-03):
   - `npm run check-popup-deps` — must exit 0. Scans `extension/popup/views/*.js` for forbidden tokens (`chrome.`, `window.__lexi`, `document.getElementById` outside the container scope). Whitelists deps-provided wrappers. Exits 1 with file:line on any deviation.
   - Paired self-test: `npm run check-popup-deps:test` — plants a view that imports `chrome.storage.local.get` directly (gate must fire) and a well-formed dep-injected view (gate must pass).
   - Why this gate exists: Phase 30 made the view modules a synced surface for the lockdown webapp. A regression that adds an implicit global breaks lockdown silently because lockdown's chrome shim has limited support. This gate enforces the dep-injection contract.
8. Verify the packaged extension stays under the 20 MiB internal engineering ceiling:
   - `npm run check-bundle-size` — must exit 0. The script runs `npm run package` (which minifies `data/*.json` on the way into the zip), measures the resulting zip, and prints a per-directory byte breakdown.
   - If it exits 1 (zip over cap), stop and investigate the breakdown. The fix is almost always a data-file growth regression; do NOT bypass the cap by silently editing `CEILING_BYTES`. The 20 MiB number is our own (not Chrome Web Store's — they accept up to 2 GB) and exists to catch accidental growth. If the growth is intentional, raise the cap in a new phase with explicit sign-off.
9. Verify the bundled NB baseline stays under its 200 KB cap (GATES-02):
   - `npm run check-baseline-bundle-size` — must exit 0. Measures `extension/data/nb-baseline.json` (the source pretty-printed file). If it exceeds 200 KB, exits 1 with a fix hint. If the file does not exist yet (pre-plan-23-03 state), exits 0 with a "skipped — informational" message; the gate becomes meaningful once the baseline builder ships.
   - Paired self-test: `npm run check-baseline-bundle-size:test` — plants an oversized (250 KB) baseline → gate fires; plants a 5 KB well-formed baseline → gate passes; removes the file → gate skips. Backs up and restores any real baseline in try/finally.
   - Why this gate exists: Phase 23 removed bundled language data from the extension zip (data is now fetched at runtime via the sanctioned bootstrap path — see step 5 carve-out). The NB baseline is the only data file that ships in the zip going forward, so a regression that bloats it directly affects install footprint. This gate catches that class of regression early, before the packaged-zip gate (step 8) would.
10. Validate benchmark flip-rate expectations (INFRA-08):
   - `npm run check-benchmark-coverage` — must exit 0. Reads `benchmark-texts/expectations.json` and validates that each expected rule fires on the corresponding benchmark line. Prints per-priority-band (P1/P2/P3) flip-rate percentages. Passes when expectations are empty (nothing to check) or all expectations are met.
   - Paired self-test: `npm run check-benchmark-coverage:test` — plants a broken expectation (nonexistent rule on a benchmark line), confirms the gate fires; restores the empty (valid) manifest, confirms the gate passes.
11. Validate governance data bank presence and shape (INFRA-09):
   - `npm run check-governance-data` — must exit 0. Checks that governance data banks (`registerbank`, `collocationbank`, `phrasebank`) in bundled vocab have correct structural shape when present. Passes when no governance banks exist yet (pre-data-sync state).
   - Paired self-test: `npm run check-governance-data:test` — plants a data file with a broken registerbank (missing required fields), confirms the gate fires; plants a well-formed data file, confirms the gate passes; verifies baseline (no governance data) also passes.
12. Validate vocab-seam coverage (INFRA-10):
   - `npm run check-vocab-seam-coverage` — must exit 0. Static-parses `extension/content/vocab-seam-core.js`'s `buildIndexes` return literal (including `...moodIndexes` spread, recursively resolved into the `buildMoodIndexes` function's return), enumerates every key, and asserts each non-exempt key has both a matching `get<PascalCase>` getter on `extension/content/vocab-seam.js`'s `self.__lexiVocab = { … }` object AND a matching entry in `extension/content/spell-check.js`'s `runCheck()` `const vocab = { … }` consumer composition. Exits 1 with a per-violation diagnostic — including the exact copy-paste fix line for both files — on any deviation. EXEMPT list documents diagnostic / closure-bound / non-spell-check surface keys (e.g. `wordList`, `nounLemmaGenus`, `bigrams`, `typoBank`, `grammarTables`, `predictCompound`); GETTER_OVERRIDES handles non-default casing (e.g. `nnInfinitiveClasses` → `getNNInfinitiveClasses`).
   - Paired self-test: `npm run check-vocab-seam-coverage:test` — plants a scratch index in core only → confirms gate fires; plants the same scratch in core + seam + consumer → confirms gate passes; runs against clean HEAD → confirms gate passes. All file mutations guarded by try/finally with backup-restore.
   - Why this gate exists: Phase 26-01, 32-01, and 32-03 each added a new index to `buildIndexes` (prepPedagogy, frAspectPedagogy, gustarPedagogy, …) without surfacing it through `vocab-seam.js` or wiring `spell-check.js`. All 11 prior gates stayed green because the Node fixture-runner passes raw `buildIndexes` output directly to `core.check()`, bypassing the browser seam. Browser users got empty Maps/Sets and silent rules — the de-prep-case Lær mer button never rendered, es-gustar was silent on extended verbs, fr-aspect-hint was silent on canonical triggers. The seam fix shipped in v2.9.15 (commit 7f55b1c). On its first run this gate caught three more instances of the same bug-class — `frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms` — that the v2.9.15 fix missed; those wirings landed alongside the gate in Phase 36-02. This gate prevents the next instance.
13. Update the version in all three places:
    - `extension/manifest.json` (the Chrome extension version)
    - `package.json` (the project version)
    - `backend/public/index.html` (the landing page display version)
14. Rebuild the zip: `npm run package`
15. Upload the zip as a GitHub Release asset

The `check-bundle-size` script owns measurement and minification; never manually minify `extension/data/*.json` in the source tree — keep the repo copies pretty-printed for contributor readability.

## Papertek Vocabulary — Shared Data Source

The vocabulary API (`papertek-vocabulary.vercel.app`) is a sibling project we control. All dictionary data — words, conjugations, typos, grammar features — originates there.

**Core Principle: Data-Logic Separation**
- **Logic belongs in Leksihjelp:** Keep the extension code focused on algorithmic grammar rules and UI logic.
- **Data belongs in Papertek Vocabulary:** Favor data-enrichment at the source (adding missing plurals, irregular forms, pitfalls) over hardcoding word lists in extension rules. 
- **Active Planning:** We plan for data-enrichment in `papertek-vocabulary` whenever it enables more powerful features in Leksihjelp.

**Prefer fixing data issues at the API source** over adding client-side workarounds in Leksihjelp. For example, if a word has incorrect typo entries or wrong conjugations, fix it in `papertek-vocabulary`.

**However**, `papertek-vocabulary` is also consumed by other Papertek apps. Changes to the API data or schema affect all consumers, so consider cross-app impact.

## Development Notes

- Extension is designed for **offline use** — vocabulary is bundled, not fetched at runtime
- TTS uses ElevenLabs (with subscription) or browser speechSynthesis (free fallback)
- All vocabulary data comes from the Papertek API
- Grammar features are language-specific and loaded dynamically
- Legacy access code auth coexists with Vipps token auth — both paths work in `tts.js`
- Firebase service account key is in `.gitignore` — never commit to repo

## Downstream consumers: Lockdown webapp + skriveokt-zero

There are TWO downstream consumers re-using this extension's content scripts, styles, i18n, and data files in non-extension contexts (each via a chrome-API shim, no real Chrome API).

### 1. Lockdown webapp (in production)

`/Users/geirforbord/Papertek/lockdown`, deployed to `stb-lockdown.app` (staging) and `papertek.app` (prod). Re-uses leksihjelp via:

- `extension/content/*.js` → `lockdown/public/leksihjelp/*.js`
- `extension/exam-registry.js` → `lockdown/public/leksihjelp/exam-registry.js` (Phase 28 / EXAM-08 — must be loaded BEFORE `spell-check-core.js` so `__lexiExamRegistry` exists when consumers initialise; the loader's `LEKSI_BUNDLE` array enforces this order)
- `extension/styles/content.css` → `lockdown/public/leksihjelp/styles/leksihjelp.css` (renamed)
- `extension/popup/views/*.js` → `lockdown/public/leksihjelp/popup/views/*.js` (Phase 30 — synced view modules with explicit dep contracts; bug fixes go upstream and the webapp re-syncs)
- `extension/styles/popup-views.css` → `lockdown/public/leksihjelp/styles/popup-views.css` (Phase 30 — view-relevant CSS extracted from popup.css; not yet present, see Plan 30-01 deferred sub-step E)
- `extension/data/*` → `lockdown/public/leksihjelp/data/`
- `extension/i18n/*` → `lockdown/public/leksihjelp/i18n/`

Lockdown copies these via `node scripts/sync-leksihjelp.js` (postinstall hook). The dependency is currently `file:../leksihjelp`; once published to GitHub Packages it'll be a versioned `npm install`.

### 2. skriveokt-zero / lockdown-zero (Tauri desktop, NOT yet shipped to consumers)

`/Users/geirforbord/Papertek/lockdown/skriveokt-zero/` — a Tauri desktop sibling that consumes leksihjelp through its own `scripts/sync-leksihjelp.js` (different from the webapp's — it pulls from `node_modules/@papertek/leksihjelp` and renames `spell-rules/` → `rules/`). Synced files land in `src/leksihjelp/`. Phase 27 exam-mode parity (EXAM-09) is tracked as **deferred Phase 28.1** in the leksihjelp roadmap; un-defer when skriveokt-zero starts shipping to schools.

When EXAM-09 lands:
- `extension/popup/views/` will also be a future synced surface for skriveokt-zero. Plan 30 chose dep-injection for views deliberately so that adoption is a sync-script-extension change, not a logic change.

### Implications for changes here

- **CSS in `extension/styles/content.css`** also ships to both consumers. Don't assume "extension only" — selectors that don't match in the extension context (e.g. `.pdf-text-layer`, used by lockdown's PDF viewer) belong here too if a downstream consumer needs them, since the file is sync'd whole.
- **Content scripts** (`floating-widget.js`, `word-prediction.js`, `spell-check.js`, etc.) run downstream via a Chrome-API shim. In the webapp the shim is `lockdown/public/js/leksihjelp-loader.js`; in zero the shim lives alongside the synced files. Avoid hard dependencies on extension-only APIs (e.g. `chrome.tabs`) — keep `chrome.runtime`/`chrome.storage` usage inside what the shims provide (`onMessage`, `sendMessage`, `storage.local.get/set`, `runtime.getURL`).
- **`extension/exam-registry.js`** is also a synced surface (webapp today; zero when EXAM-09 lands). Adding a new entry — i.e. a new non-rule UI surface getting an exam marker — requires re-running each downstream consumer's sync so the registry stays in step.
- **Bumping `package.json` version** signals a downstream sync is needed. After a change that affects shared files, bump the version (matches the rule for `manifest.json` in the Release Workflow above) so consumers can pin and audit it.
- **Commit-message marker `[lockdown-resync-needed]`** — when a commit modifies any synced surface, include `[lockdown-resync-needed]` somewhere in the commit message (title, body, or trailer all acceptable). The synced-surface set:
  - `extension/content/`
  - `extension/popup/views/`
  - `extension/exam-registry.js`
  - `extension/styles/content.css`
  - `extension/data/`
  - `extension/i18n/`

  **Why:** Downstream consumers (lockdown webapp's `node scripts/sync-leksihjelp.js`, skriveokt-zero's analogue) scope their re-sync windows by scanning git log for the marker since their last consumed version. Without it, downstream maintainers must manually diff every commit since their last sync — error-prone, gets skipped under time pressure (root cause of the Phase 30-02 4-orphan-file class).

  **Enforcement:** `npm run check-synced-surface-version` (HYG-05 release gate) prints the `[lockdown-resync-needed]` marker as a copy-paste hint when it fires on an un-bumped synced-surface diff. The gate enforces the version bump, not the marker itself, but it surfaces the marker recommendation at the exact moment someone is about to forget it.

  **Retroactive scope:** Pre-Phase-37 commits don't carry the marker (convention didn't exist). The retroactive catch-up ledger lives at `.planning/deferred/lockdown-resync-pending.md` — doc-based, no git history rewrite.

  **Example:**
  ```
  fix(content): correct spell-check dot color for nb-sarskriving rule

  [lockdown-resync-needed]

  Closes F38-3.
  ```
- **Downstream-only quick fixes** to synced trees over there are fine for testing, but the canonical change still belongs *here*. The downstream CLAUDE.md documents the agreement: ports fixes upstream before merging.
- **Popup view modules** at `extension/popup/views/` are a synced surface (Phase 30). They are scaffolded with explicit dep injection: each `mountXView(container, deps)` accepts an explicit deps object (vocab, storage, runtime, t, audioEnabled, …). Changing a view's dep contract is a breaking change for the lockdown sidepanel host (`/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js`) — keep contracts additive, default new fields, and re-run the lockdown sidepanel's manual UAT (Plan 30-03 / future) when shipping. The release-gate `npm run check-popup-deps` enforces that view modules don't use implicit globals (`chrome.*`, `window.__lexi*`, `document.getElementById` outside container scope).
- **Audio is suppressed in lockdown by passing `audioEnabled: false`** to `mountDictionaryView`. The `extension/audio/` tree is also explicitly NOT in `lockdown/scripts/sync-leksihjelp.js`. Both safeguards must remain — adding audio to lockdown without explicit user sign-off violates the "school deployment, no MB-level downloads" constraint.

### When a fix arrives via lockdown's PR

If somebody on the lockdown side modified `public/leksihjelp/**` directly to fix something they noticed, mirror that change here, bump version, and have them re-sync. Don't leave the divergence — the next `npm install` over there will silently revert their fix.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
