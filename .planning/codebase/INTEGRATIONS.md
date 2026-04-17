# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**Papertek Vocabulary API:**
- Papertek Vocabulary API (sibling project at `/Users/geirforbord/Papertek/papertek-vocabulary`)
- What it's used for: Fetch vocabulary data (words, conjugations, typos, grammar features) for German, Spanish, French
  - SDK/Client: fetch() (vanilla HTTP)
  - Endpoints:
    - `GET /api/vocab/v1/core/{language}` — Core vocabulary per language
    - `GET /api/vocab/v1/translations/{pair}` — Norwegian translations (de-nb, es-nb, fr-nb)
    - `GET /api/vocab/v1/grammarfeatures?language={code}` — Grammar feature definitions per language
  - Environment: `PAPERTEK_VOCAB_API` (defaults to `https://papertek-vocabulary.vercel.app/api/vocab`)
  - Synced to: `extension/data/{de,es,fr}.json` and `extension/data/grammarfeatures-{lang}.json`

**ElevenLabs TTS API:**
- ElevenLabs — Text-to-speech synthesis
  - What it's used for: Convert text to audio for vocabulary words
  - SDK/Client: Vercel backend proxy (`backend/api/tts.js`) via fetch()
  - Model: `eleven_flash_v2_5` (32 languages, widely available)
  - Language codes: Short codes (`es`, `de`, `fr`, `no` for Norwegian)
  - Voice IDs: Configured in `extension/content/floating-widget.js` (Spanish, German, French, English, Norwegian)
  - Auth: `x-lexi-client: lexi-extension` header (lightweight client validation) + Bearer token OR legacy access code
  - Rate limit: 30 requests/minute per IP

## Data Storage

**Databases:**
- Firebase Firestore (Google Cloud)
  - Connection: Firestore Admin SDK via `backend/api/_firebase.js` (lazy initialization)
  - Client: `firebase-admin@^13.0.0`
  - Collections:
    - `users` — User profiles (name, email, phone, subscription status, quota balance)
    - `agreements` — Vipps Recurring Payments agreements (agreement ID, user ID, status, charge date)
    - `charges` — Historical charge records (charge ID, status, amount)

**File Storage:**
- Local filesystem only — No cloud file storage
- Vocabulary data bundled in extension: `extension/data/{de,es,fr}.json`
- Audio files (optional): `extension/audio/{language}/{voiceId}/{word}.mp3` (from Papertek legacy API ZIP downloads)

**Caching:**
- None detected — In-memory state management only

## Authentication & Identity

**Auth Provider:**
- Vipps MobilePay (Norwegian mobile payment provider)
  - Implementation: OpenID Connect (OIDC) + OAuth2 for user login
  - Vipps user info: name, email, phone number
  - Session token: HMAC-SHA256 signed JWT (30-day expiry) created by `backend/api/_jwt.js`
  - Endpoints:
    - `POST /api/auth/vipps-login` — Initiates OIDC flow with state token CSRF protection
    - `POST /api/auth/exchange-code` — Extension code exchange (Chrome identity API callback)
    - `GET /api/auth/vipps-callback` — Web OAuth callback (state verification via signed JWT)
    - `POST /api/auth/session` — Validate JWT, return user info
  - Environment:
    - `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET` — OAuth2 credentials
    - `VIPPS_API_BASE` — API endpoint (https://apitest.vipps.no or https://api.vipps.no)
    - `SESSION_JWT_SECRET` — For signing state tokens and session tokens

**Legacy Access Code:**
- `x-access-code` header in TTS requests — For backward compatibility (no quota tracking)

## Monitoring & Observability

**Error Tracking:**
- None detected — No Sentry, Datadog, or similar

**Logs:**
- Console logging only (`console.error()`, `console.warn()`, `console.log()`)
- Vercel function logs via Vercel Dashboard

## CI/CD & Deployment

**Hosting:**
- Vercel Serverless Functions — Backend (custom domain: `https://leksihjelp.no`)
- Chrome Web Store — Extension distribution
- GitHub — Source code repository at `https://github.com/Papertek-forlag-AS/leksihjelp`

**CI Pipeline:**
- None detected — No GitHub Actions, GitLab CI, or similar

**Deployment:**
- Manual: Push to GitHub main branch → Vercel auto-deploys
- Extension packaging: `npm run package` creates `backend/public/lexi-extension.zip` → Upload to Chrome Web Store as GitHub Release

## Environment Configuration

**Required env vars:**
- `ELEVENLABS_API_KEY` — TTS API key
- `SESSION_JWT_SECRET` — HMAC-SHA256 secret
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firestore credentials
- `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MERCHANT_SERIAL_NUMBER`, `VIPPS_WEBHOOK_SECRET` — Vipps credentials
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe credentials
- `CRON_SECRET` — Protects cron endpoints
- `SITE_URL` — Application domain
- `ACCESS_CODE` — Legacy TTS access code
- `PAPERTEK_VOCAB_API` — Papertek Vocabulary API base URL (optional, defaults to vercel deployment)
- `PAPERTEK_API_BASE` — Papertek legacy API base URL for audio ZIP downloads (optional, defaults to https://www.papertek.no)

**Secrets location:**
- `.env` file in `backend/` (development, not committed to git)
- Vercel Environment Variables dashboard (production)
- Firebase service account key in `.gitignore` (never committed)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/vipps` — Vipps Recurring Payments webhooks (agreement activated/rejected/stopped/expired, charge captured/failed/refunded)
  - Security: HMAC-SHA256 signature verification using `VIPPS_WEBHOOK_SECRET`
  - Signature format: `Authorization: HMAC-SHA256 SignedHeaders=...; Signature=<base64>`
  - Raw body required for signature verification (`bodyParser: false` in Vercel config)
  - File: `backend/api/webhooks/vipps.js`

- `POST /api/webhooks/stripe` — Stripe webhook events (checkout.session.completed)
  - Security: Stripe signing secret verification using `STRIPE_WEBHOOK_SECRET`
  - Signature header: `stripe-signature`
  - Raw body required for signature verification (`bodyParser: false` in Vercel config)
  - File: `backend/api/webhooks/stripe.js`
  - Handler: Updates Firestore user record with `stripeExpiresAt` timestamp (365 days from payment)

**Outgoing:**
- `POST /api/auth/subscribe` → Vipps Recurring Payments API (create recurring agreement)
  - Authentication: Bearer token (Vipps API access token)
  - File: `backend/api/auth/subscribe.js`
- `POST /api/auth/create-checkout` → Stripe Checkout API (create checkout session)
  - Authentication: Bearer token (session JWT)
  - File: `backend/api/auth/create-checkout.js`

## Scheduled Jobs (Cron)

**Daily cron jobs via Vercel:**
- `GET /api/cron/create-charges` — Runs at 06:00 UTC daily
  - Creates charges for Vipps Recurring agreements with due charge dates
  - Requires `CRON_SECRET` query parameter for authorization
  - File: `backend/api/cron/create-charges.js`

- `GET /api/cron/check-stripe-expiry` — Runs at 07:00 UTC daily
  - Checks and deactivates expired Stripe yearly subscriptions
  - Requires `CRON_SECRET` query parameter for authorization
  - File: `backend/api/cron/check-stripe-expiry.js`

---

*Integration audit: 2026-04-17*
