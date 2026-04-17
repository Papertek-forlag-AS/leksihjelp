# Codebase Structure

**Analysis Date:** 2026-04-17

## Directory Layout

```
leksihjelp/
├── extension/                 # Chrome extension (Manifest V3)
│   ├── manifest.json         # Extension manifest, content script declarations
│   ├── popup/                # Dictionary popup UI
│   │   ├── popup.html        # Popup UI layout (search, login, settings)
│   │   └── popup.js          # Dictionary search logic, auth, grammar filtering (2278 lines)
│   ├── content/              # Content scripts (injected on all webpages)
│   │   ├── floating-widget.js   # TTS widget on text selection (1111 lines)
│   │   ├── word-prediction.js   # Autocomplete suggestions in inputs (1845 lines)
│   │   ├── spell-check.js       # Norwegian spelling/grammar checker (898 lines)
│   │   └── vocab-store.js       # IndexedDB access layer (557 lines)
│   ├── background/           # Service worker (runs in extension context)
│   │   └── service-worker.js # Context menus, message routing, install setup
│   ├── data/                 # Bundled vocabulary data (offline support)
│   │   ├── de.json          # German vocabulary (banks: verbbank, nounbank, etc.)
│   │   ├── es.json          # Spanish vocabulary
│   │   ├── fr.json          # French vocabulary
│   │   ├── en.json          # English vocabulary (for testing)
│   │   ├── nb.json          # Norwegian Bokmål (for two-way lookups)
│   │   ├── nn.json          # Norwegian Nynorsk (for two-way lookups)
│   │   ├── grammarfeatures-de.json   # Grammar feature definitions (German)
│   │   ├── grammarfeatures-es.json   # Grammar feature definitions (Spanish)
│   │   ├── grammarfeatures-fr.json   # Grammar feature definitions (French)
│   │   ├── grammarfeatures-en.json   # Grammar feature definitions (English)
│   │   ├── grammarfeatures-nb.json   # Grammar feature definitions (Norwegian Bokmål)
│   │   ├── grammarfeatures-nn.json   # Grammar feature definitions (Norwegian Nynorsk)
│   │   ├── bigrams-de.json  # Bigram frequency data (German)
│   │   ├── bigrams-es.json  # Bigram frequency data (Spanish)
│   │   ├── bigrams-fr.json  # Bigram frequency data (French)
│   │   ├── bigrams-nb.json  # Bigram frequency data (Norwegian Bokmål)
│   │   └── bigrams-nn.json  # Bigram frequency data (Norwegian Nynorsk)
│   ├── audio/               # Predownloaded pronunciation audio (optional)
│   │   └── de/              # German audio files (mp3)
│   ├── styles/              # Extension CSS
│   │   ├── popup.css        # Popup styles
│   │   └── content.css      # Floating widget styles
│   ├── i18n/                # Internationalization
│   │   └── strings.js       # UI strings (Norwegian, Nynorsk, English)
│   └── assets/              # Icons
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── backend/                 # Vercel serverless backend (Node.js ESM)
│   ├── api/                 # HTTP handlers (Vercel Functions)
│   │   ├── tts.js          # TTS proxy (ElevenLabs) with dual auth + quota (291 lines)
│   │   ├── download.js     # File download endpoint (extension zip)
│   │   ├── verify.js       # Legacy access code verification
│   │   ├── _firebase.js    # Firebase Admin SDK lazy init
│   │   ├── _vipps.js       # Vipps API helpers (OAuth, Recurring Payments)
│   │   ├── _jwt.js         # Session JWT creation/verification (HMAC-SHA256)
│   │   ├── _quota.js       # Quota rollover system (monthly + summer reset)
│   │   ├── _stripe.js      # Stripe Checkout helpers + config
│   │   ├── _utils.js       # CORS, rate limiting, IP extraction
│   │   ├── auth/           # Authentication endpoints
│   │   │   ├── vipps-login.js       # GET  — Initiate OIDC flow
│   │   │   ├── vipps-callback.js    # GET  — OIDC callback (extension + web)
│   │   │   ├── exchange-code.js     # POST — Extension code exchange
│   │   │   ├── session.js           # POST — Validate JWT + return user info
│   │   │   ├── subscribe.js         # POST — Create Vipps Recurring agreement
│   │   │   ├── subscribe-callback.js # GET — Redirect after subscription
│   │   │   ├── topup.js             # POST — Request quota top-up (future)
│   │   │   ├── topup-callback.js    # GET — Redirect after top-up
│   │   │   └── create-checkout.js   # POST — Create Stripe Checkout Session
│   │   ├── webhooks/       # Third-party webhook handlers
│   │   │   ├── vipps.js   # POST — Vipps Recurring + Charge events
│   │   │   └── stripe.js  # POST — Stripe Checkout completion
│   │   └── cron/           # Vercel cron jobs
│   │       ├── create-charges.js      # GET — Daily Vipps charge creation (6:00 UTC)
│   │       └── check-stripe-expiry.js # GET — Daily Stripe expiry check (7:00 UTC)
│   ├── public/             # Static files served by Vercel
│   │   ├── index.html      # Landing page (https://leksihjelp.no)
│   │   ├── vilkar.html     # Terms of sale (required by Vipps)
│   │   └── lexi-extension.zip # Packaged extension (generated via npm run package)
│   ├── vercel.json         # Vercel config: routes, rewrites, cron schedule
│   ├── local-server.js     # Local dev server (http://localhost:3000) with all routes
│   ├── package.json        # Backend dependencies (firebase-admin)
│   ├── .env.example        # All required environment variables (never commit .env)
│   └── test-stripe.js      # Stripe webhook test script
├── scripts/                # Build and sync tools
│   └── sync-vocab.js       # Fetches vocabulary from Papertek API (syncs to extension/data/)
├── .planning/              # GSD planning (auto-generated)
│   └── codebase/           # Codebase documentation
│       ├── ARCHITECTURE.md # Layer + data flow patterns
│       ├── STRUCTURE.md    # This file
│       ├── STACK.md        # (if tech focus)
│       ├── INTEGRATIONS.md # (if tech focus)
│       ├── CONVENTIONS.md  # (if quality focus)
│       ├── TESTING.md      # (if quality focus)
│       └── CONCERNS.md     # (if concerns focus)
├── .claude/                # Claude Code project metadata
├── .github/                # GitHub workflows, issue templates
├── package.json            # Root project (npm scripts for sync + package)
├── CLAUDE.md               # Project documentation
└── .gitignore              # Excludes .env, credentials, node_modules, etc.
```

## Directory Purposes

**extension/:**
- Purpose: Chrome extension source code (Manifest V3)
- Contains: Content scripts, popup, background service worker, bundled vocabulary, styles, i18n
- Packaged via: `npm run package` → creates `backend/public/lexi-extension.zip`

**extension/popup/:**
- Purpose: Dictionary UI shown when user clicks extension icon
- Contains: HTML template + main application logic
- Entry point: `popup.html` loaded by Chrome when user clicks icon

**extension/content/:**
- Purpose: Scripts injected into webpages (run on page's origin)
- Runs at: `document_idle` (after page fully loaded)
- All frames: Yes (iframes included)
- Scripts: Vocab store (prerequisite), floating widget, word prediction, spell check

**extension/data/:**
- Purpose: Bundled vocabulary for offline use
- Format: JSON files with bank-based organization (verbbank, nounbank, etc.)
- Updated via: `npm run sync-vocab` (fetches from Papertek Vocabulary API)
- Grammar features: Separate JSON file per language (definitions + UI metadata)
- Bigrams: Frequency data for word prediction weighting

**backend/api/:**
- Purpose: Serverless HTTP handlers (each file = one Vercel Function)
- Runtime: Node.js 18+ with ES modules (import/export)
- Entry points: Declared in `vercel.json` (routes + cron schedule)
- Response format: JSON (CORS-enabled)

**backend/api/auth/:**
- Purpose: Authentication flow handlers
- Vipps path: `vipps-login.js` → (user approves) → `vipps-callback.js` → (extension intercepts code) → `exchange-code.js`
- Web path: `vipps-login.js` → (user approves) → `vipps-callback.js` → (redirects with token)
- Validation: `session.js` checks JWT on every extension request

**backend/api/webhooks/:**
- Purpose: Third-party event handlers (Vipps, Stripe)
- Verification: HMAC-SHA256 signature validation before processing
- Idempotency: Check fields before updating (prevent double-charges)
- Response: Always return 200 quickly (Vipps/Stripe retry on timeout)

**backend/api/cron/:**
- Purpose: Scheduled tasks (Vercel cron jobs)
- Execution: `create-charges.js` at 06:00 UTC daily, `check-stripe-expiry.js` at 07:00 UTC daily
- Protection: Require `CRON_SECRET` header (Vercel sets this)
- Queries: Firestore for active agreements / expired subscriptions

**backend/public/:**
- Purpose: Static files served by Vercel
- `index.html`: Landing page (user-facing website)
- `vilkar.html`: Terms of sale (required by Vipps for recurring payments)
- `lexi-extension.zip`: Extension package (downloaded by users)

**scripts/:**
- Purpose: Build and maintenance scripts
- `sync-vocab.js`: Fetches vocabulary from Papertek Vocabulary API, writes to `extension/data/`
- Usage: `npm run sync-vocab`, `npm run sync-vocab:de`, `npm run sync-vocab:audio`

## Key File Locations

**Entry Points:**

| File | Purpose | Entry Trigger |
|------|---------|---|
| `extension/manifest.json` | Declares all scripts, permissions, icons | Chrome extension load |
| `extension/popup/popup.js` | Dictionary UI + auth logic | User clicks extension icon |
| `extension/background/service-worker.js` | Context menus, message routing | Extension startup |
| `extension/content/floating-widget.js` | Text selection TTS widget | Text selection on any page |
| `extension/content/word-prediction.js` | Input autocomplete | Focus on input/textarea |
| `extension/content/spell-check.js` | Norwegian error detection | Content script load |
| `backend/api/auth/vipps-login.js` | Start OIDC flow | User clicks "Logg inn" |
| `backend/api/tts.js` | TTS proxy endpoint | Content script calls /api/tts |

**Configuration:**

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Extension permissions, host permissions, manifest version, icons, keyboard shortcuts |
| `backend/vercel.json` | Routes, rewrites, cron schedules |
| `backend/.env.example` | All environment variables (Firebase, Vipps, Stripe, ElevenLabs, JWT secret, cron secret) |
| `backend/local-server.js` | Local development server (http://localhost:3000) |

**Core Logic:**

| File | Purpose | Lines |
|------|---------|-------|
| `extension/popup/popup.js` | Dictionary search, bank flattening, grammar filtering, two-way lookups | 2278 |
| `extension/content/floating-widget.js` | TTS widget, voice selection, quota display, ElevenLabs + browser fallback | 1111 |
| `extension/content/word-prediction.js` | Autocomplete dropdown, fuzzy matching, bigram weighting, debouncing | 1845 |
| `extension/content/spell-check.js` | Gender-article, modal verb, typo, särskriving detection | 898 |
| `backend/api/tts.js` | Bearer token + legacy code auth, quota deduction, ElevenLabs proxy | 291 |
| `backend/api/_vipps.js` | OIDC, token exchange, Recurring API helpers, access token management | ~400 |
| `backend/api/_quota.js` | Monthly top-up, summer reset logic, balance calculation | ~100 |

**Testing:**

| File | Purpose |
|------|---------|
| `backend/test-stripe.js` | Stripe webhook test (POST to `/api/webhooks/stripe` with test charge) |
| `extension/popup/popup.js` (bottom section) | Unit tests for `flattenBanks()`, `inflectionIndex` building |

## Naming Conventions

**Files:**

- **extension content scripts**: kebab-case, semantic name (e.g., `floating-widget.js`, `word-prediction.js`)
- **backend handlers**: kebab-case, semantic name (e.g., `vipps-login.js`, `exchange-code.js`)
- **utilities**: underscore prefix (e.g., `_firebase.js`, `_vipps.js`, `_jwt.js`)
- **vocabulary data**: language code (e.g., `de.json`, `grammarfeatures-es.json`, `bigrams-fr.json`)
- **CSS/HTML**: kebab-case (e.g., `popup.css`, `popup.html`)

**Directories:**

- **content scripts**: `extension/content/` (all run on webpage origin)
- **popup UI**: `extension/popup/`
- **styles**: `extension/styles/`
- **backend API routes**: `backend/api/{feature}/{handler}.js` (e.g., `backend/api/auth/session.js`)
- **utilities**: `backend/api/_*.js` (shared by multiple handlers)

**JavaScript naming:**

- **Functions**: camelCase (e.g., `getTranslation()`, `flattenBanks()`, `recalculateQuota()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BANK_TO_POS`, `DEFAULT_MAX_BALANCE`)
- **Variables**: camelCase for regular, `_privatePrefix` for module-private (e.g., `_isExtensionOrigin`)
- **Classes/Objects**: PascalCase (rare in this codebase; mostly plain objects)

**Storage keys:**

- Chrome storage: camelCase (e.g., `sessionToken`, `predictionEnabled`, `enabledGrammarFeatures`)
- IndexedDB stores: camelCase (e.g., `languages`, `audio`)
- Firestore collections: lowercase (e.g., `users`, `agreements`, `charges`)

## Where to Add New Code

**New Feature (e.g., new content script capability):**
- Implementation: `extension/content/{feature-name}.js`
- Tests: Add unit tests at bottom of same file (or create `{feature-name}.test.js` if shared)
- Manifest: Declare in `extension/manifest.json` content_scripts array with appropriate `run_at` timing
- Message passing: Add handlers in `background/service-worker.js` if cross-script communication needed
- State: Store in `chrome.storage.local` if needs to persist across sessions

**New API Endpoint (e.g., user settings endpoint):**
- Implementation: `backend/api/{category}/{handler}.js`
- Utilities: Add shared functions to `backend/api/_{utility}.js` (e.g., `_settings.js`)
- Firestore: Add collection access in handler; define schema comments at top of file
- Auth: Use `verifySessionToken()` from `_jwt.js` if auth required; add CORS via `setCorsHeaders()`
- Testing: Document curl/fetch examples as comments in handler
- Routes: No registration needed (Vercel automatically routes `/api/{category}/{handler}` to file)

**New Grammar Feature:**
- Grammar metadata: Add entry to `extension/data/grammarfeatures-{lang}.json` with ID, name, category
- Rendering: Add conditional in grammar display template in `popup.js` using `isFeatureEnabled('feature_id')`
- Translation: Add i18n keys to `extension/i18n/strings.js` for feature name + description
- Word list filtering: Modify `loadWordList()` in `word-prediction.js` if affects prediction visibility

**New Vocabulary Language:**
- Sync script: Run `npm run sync-vocab:new-lang-code` (modify `scripts/sync-vocab.js` to support new code)
- Data structure: Sync creates `extension/data/{lang}.json` with bank structure
- Grammar: Sync creates `extension/data/grammarfeatures-{lang}.json`
- Bigrams: Sync creates `extension/data/bigrams-{lang}.json`
- Popup: Add language to picker buttons in `extension/popup/popup.html` + language list in `popup.js`
- Voices: Add ElevenLabs voice IDs to `ELEVENLABS_VOICES` mapping in `floating-widget.js`

**Shared Utilities:**
- Location: `backend/api/_*.js` or `extension/common/` (create if needed)
- Module pattern: ESM exports for backend, IIFE for extension content scripts
- Example: `_firebase.js` lazily initializes Firebase once, then exports `getFirestoreDb()`

**Tests:**
- Unit: Place inline in handler files or create `{file}.test.js` (no formal test runner currently)
- Integration: Manual via curl/Postman to local-server.js or staging backend
- End-to-end: Manual extension testing (content scripts can't be unit tested without DOM)

## Special Directories

**extension/data/:**
- Purpose: Bundled vocabulary for offline use
- Generated: Yes (created by `npm run sync-vocab` from Papertek API)
- Committed: Yes (checked into git to support offline use)
- Size: ~40 MB (6 language packs + grammar features + bigrams)
- Sync frequency: Manual on release or quarterly to keep data fresh

**extension/audio/:**
- Purpose: Predownloaded pronunciation audio (optional, language-specific)
- Generated: Yes (created by `npm run sync-vocab:audio` or `npm run sync-vocab:de:audio`)
- Committed: Selectively (large, only for languages with audio)
- Format: MP3 files organized by language subdirectory
- Usage: Referenced in floating-widget.js for audio playback (fallback to TTS if not available)

**backend/node_modules/:**
- Purpose: Node.js dependencies (firebase-admin)
- Generated: Yes (created by `npm install`)
- Committed: No (.gitignore)
- Install: `npm install` in backend/ directory

**backend/public/lexi-extension.zip:**
- Purpose: Packaged extension for distribution
- Generated: Yes (created by `npm run package`)
- Committed: No (gitignore)
- Creation: Zips entire `extension/` directory, writes to `backend/public/lexi-extension.zip`
- Distribution: Served by Vercel at `/lexi-extension.zip` (rewrite in vercel.json)

**.env files:**
- Purpose: Environment variables (secrets)
- Generated: No (manual setup)
- Committed: No (.gitignore) — **CRITICAL: Never commit .env with secrets**
- Reference: `.env.example` shows all required variables
- Usage: Vercel dashboard stores these; local dev uses `.env.local` (never committed)

---

*Structure analysis: 2026-04-17*
