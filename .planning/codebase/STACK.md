# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- JavaScript (ES6+) — Extension popup, content scripts, background service worker, extension data processing
- JavaScript (Node.js, ES modules) — Vercel serverless backend APIs, sync scripts

**Secondary:**
- HTML5 — Extension popup and landing page UI
- CSS3 — Popup styles and content script widget styling

## Runtime

**Environment:**
- Node.js (runtime version not pinned; no `.nvmrc` file present)
- Chrome/Chromium (extension runs on Chrome, Edge via Manifest V3)

**Package Manager:**
- npm
- Lockfile: Not present in repository (may be managed separately)

## Frameworks

**Core:**
- Chrome Extensions API (Manifest V3) — Extension extension plugin architecture, permissions, content scripts, background service worker, context menus, keyboard shortcuts

**Testing:**
- No testing framework detected

**Build/Dev:**
- Manual packaging: `npm run package` creates zip file using native `zip` command
- Local development server: `backend/local-server.js` (Node.js HTTP server wrapping Vercel functions)
- Vercel Serverless Functions — Production deployment runtime

## Key Dependencies

**Critical:**
- `firebase-admin@^13.0.0` — Firestore database access for user profiles, subscription agreements, charges, quota tracking
- `stripe@^20.3.1` — Stripe Checkout API for yearly card payments (290 NOK)

**No other npm dependencies detected** — Extension uses vanilla JavaScript; backend minimizes dependencies for cold-start performance.

## Configuration

**Environment:**
- `.env` file (backend) — Contains all API keys, secrets, service account credentials
- File: `backend/.env.example` — Template with all required variables
- Environment variables loaded by `backend/local-server.js` for development
- Vercel environment variables set via dashboard for production

**Key configs required:**
- `ELEVENLABS_API_KEY` — TTS API key
- `SESSION_JWT_SECRET` — HMAC-SHA256 secret for session tokens (30-day expiry)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firestore access
- `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MERCHANT_SERIAL_NUMBER`, `VIPPS_API_BASE`, `VIPPS_WEBHOOK_SECRET` — Vipps MobilePay OAuth2/OIDC and Recurring Payments
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe Checkout and webhook verification
- `SITE_URL` — Application domain (defaults to `https://leksihjelp.no` in production)
- `CRON_SECRET` — Protects daily cron endpoints
- `ACCESS_CODE` — Legacy TTS authentication (for backward compatibility)

**Build:**
- `backend/vercel.json` — Vercel function config, rewrites, cron job schedules

## Platform Requirements

**Development:**
- Node.js (version unspecified, but ES modules required)
- Chrome browser or compatible (for extension testing)
- Vercel CLI (optional, for local simulation)

**Production:**
- Vercel Serverless Functions — Backend deployment
- Chrome Web Store submission — Extension distribution
- Firebase project — Firestore database
- Vipps MobilePay merchant account
- Stripe merchant account
- ElevenLabs API account

---

*Stack analysis: 2026-04-17*
