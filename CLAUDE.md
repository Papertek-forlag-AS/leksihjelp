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

1. Update the version in all three places:
   - `extension/manifest.json` (the Chrome extension version)
   - `package.json` (the project version)
   - `backend/public/index.html` (the landing page display version)
2. Rebuild the zip: `npm run package`
3. Upload the zip as a GitHub Release asset

## Development Notes

- Extension is designed for **offline use** — vocabulary is bundled, not fetched at runtime
- TTS uses ElevenLabs (with subscription) or browser speechSynthesis (free fallback)
- All vocabulary data comes from the Papertek API
- Grammar features are language-specific and loaded dynamically
- Legacy access code auth coexists with Vipps token auth — both paths work in `tts.js`
- Firebase service account key is in `.gitignore` — never commit to repo
