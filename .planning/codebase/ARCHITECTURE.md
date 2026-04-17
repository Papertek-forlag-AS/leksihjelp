# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Client-server architecture with a Chrome extension (content + popup) communicating with a Vercel serverless backend. Extension runs offline with bundled vocabulary; backend handles authentication, subscription management, and TTS proxying.

**Key Characteristics:**
- **Offline-first extension**: Vocabulary pre-bundled in `extension/data/`, no runtime fetch
- **Dual auth flows**: Vipps OAuth (OIDC) for browser login + code exchange for extension popup
- **Quota-based TTS**: Monthly character allowance with school-year rollover (Aug–Jun, reset July 1)
- **Content script injection**: Floating widget, word prediction, spell-check run on every web page
- **Firestore persistence**: User profiles, subscription agreements, charge records
- **Webhook-driven billing**: Vipps + Stripe webhooks update subscription state; daily cron jobs manage recurring charges

## Layers

**Extension (Client):**
- Purpose: Provides dictionary lookup, word prediction, spell-checking, and TTS on any webpage
- Location: `extension/`
- Contains: Content scripts, popup UI, bundled vocabulary data, i18n strings
- Depends on: Papertek Vocabulary API (for syncing vocab only, not runtime); Leksihjelp backend (for TTS, auth, session validation)
- Used by: Student users learning German/Spanish/French in browsers

**Backend (API):**
- Purpose: Authentication, subscription management, TTS proxying, webhook handling, quota tracking
- Location: `backend/api/`
- Contains: Express-style handlers for Vercel Functions (ESM), auth endpoints, webhooks, cron jobs
- Depends on: Firebase Firestore (user data, agreements, charges), Vipps API (OAuth + Recurring), Stripe API (payments), ElevenLabs API (TTS)
- Used by: Extension popup, content scripts, Vipps/Stripe (webhooks), Vercel cron scheduler

**Data (Bundled):**
- Purpose: Offline vocabulary access
- Location: `extension/data/`
- Contains: Bank-organized vocab JSON files (de.json, es.json, fr.json, nb.json, nn.json), grammar feature definitions, bigram frequency data
- Sources: Synced from Papertek Vocabulary API via `npm run sync-vocab`

## Data Flow

**Dictionary Lookup (popup.js):**

1. User types in `#search-input` in popup
2. `popup.js` searches the loaded `allWords` array (flattened from bank structure)
3. Uses fuzzy matching + inflection index for conjugated/declined forms
4. Renders results with feature-filtered grammar info (based on `enabledFeatures`)
5. Displays Norwegian translation (nb or nn based on UI language preference via `getTranslation()`)
6. User clicks result → inline TTS call via `POST /api/tts`

**Text Selection → Floating Widget (floating-widget.js):**

1. User selects text on webpage
2. Content script listens to `mouseup`
3. Shows glassmorphism widget with lookup + TTS buttons
4. Click "Slå opp" → searches bundled vocab, shows inline panel
5. Click "Les opp" → `POST /api/tts` with Bearer token or legacy code
6. Widget shows quota bar (if authenticated) after TTS call

**Word Prediction (word-prediction.js):**

1. User types in `<input>` or `<textarea>` on webpage
2. Debounced search against `wordList` (language-dependent, filtered by `enabledFeatures`)
3. Bigram weighting: if previous word known, reorder suggestions by `bigramData[prevWord]`
4. Render dropdown with fuzzy matches
5. Arrow keys + Enter to select; stores in `recentWords` per language
6. Broadcasts grammar feature changes via `GRAMMAR_FEATURES_CHANGED` message to all content scripts

**Spell-Check (spell-check.js):**

1. Listens on Norwegian (`nb`/`nn`) text inputs
2. Scans every keystroke for learner error patterns:
   - Gender-article mismatch: "en hus" → "et hus"
   - Wrong verb form after modal: "kan spiser" → "kan spise"
   - Typo lookup: "komer" → "kommer"
   - Särskriving: "skole sekk" → "skolesekk"
3. Renders small dot under erroneous word; popover on click with accept/dismiss actions
4. Consumes lookup indexes from `word-prediction.js` (lazy rebuild on language change)

**Authentication Flow (Vipps OIDC):**

1. User clicks "Logg inn med Vipps" in popup
2. `popup.js` calls `chrome.identity.launchWebAuthFlow()` → Vipps OIDC
3. After consent, Vipps redirects to `GET /api/auth/vipps-callback`
4. Callback returns HTML that posts authorization code back to extension via redirect URL
5. Extension calls `POST /api/auth/exchange-code` with code
6. Backend (`exchange-code.js`):
   - Exchanges code for Vipps tokens via `exchangeCodeForTokens()`
   - Fetches user info via `getVippsUserInfo()`
   - Creates/updates user doc in Firestore
   - Initializes quota fields (`quotaBalance`, `quotaLastTopUp`, `quotaMonthlyAllowance`)
   - Mints 30-day session JWT
7. Extension stores JWT in `chrome.storage.local`; popup displays user name + quota bar

**TTS Proxy (POST /api/tts):**

1. Content script or popup calls endpoint with `{ text, voiceId, speed, language }`
2. Bearer token auth → JWT verification → Firestore user lookup → quota recalculation (`recalculateQuota()`)
3. If monthly top-up due: adds allowance to balance; checks summer reset (July 1)
4. Deducts character count from `quotaBalance`; if quota exceeded, respond with `{ error: 'quota exceeded' }`
5. Proxy text to ElevenLabs API with selected voice + speed
6. Stream audio response back to client (base64)
7. Legacy access code auth (no quota tracking) for backward compatibility

**Subscription Management:**

1. User clicks "Abonner" (Vipps monthly, 29 kr/mnd) or "Betal 290 kr/år" (Stripe yearly)
2. **Vipps path:**
   - `POST /api/auth/subscribe` → creates Recurring agreement via `createRecurringAgreement()`
   - Returns `vippsConfirmationUrl` → user approves in Vipps app
   - Vipps webhook (`POST /api/webhooks/vipps`) → updates `agreements` collection with status
   - Daily cron (`GET /api/cron/create-charges`) → creates charges for due agreements
   - Charge webhook updates `charges` collection + user `subscriptionStatus`
3. **Stripe path:**
   - `POST /api/auth/create-checkout` → creates Checkout Session
   - Returns `checkoutUrl` → user completes payment on Stripe
   - Stripe webhook (`POST /api/webhooks/stripe`) → activates subscription, sets `stripeExpiresAt`
   - Daily cron (`GET /api/cron/check-stripe-expiry`) → deactivates expired subscriptions

## State Management

**Extension Storage:**
- `chrome.storage.local`:
  - `language`: Current learning language (de/es/fr)
  - `isAuthenticated`: Boolean
  - `sessionToken`: JWT (30 days)
  - `userData`: User profile snapshot (name, email, quotaBalance, subscriptionStatus)
  - `predictionEnabled`: Boolean (toggled via context menu)
  - `lexiPaused`: Boolean (context menu pause state)
  - `enabledGrammarFeatures`: `{ [lang]: [featureIds] }`
  - `uiLanguage`: UI language (nb/nn/en)
  - `recentWords`: `{ [lang]: [...] }` (last 20 selected predictions)

**Extension IndexedDB (`leksihjelp-vocab`):**
- `languages` store: `{ language, data, downloadedAt }`
  - Stores bundled + downloaded vocab JSON
  - Fallback for missing bundled language
- `audio` store: `{ key: "{lang}/{filename}", value: Blob }`
  - Cached pronunciation audio from Papertek API

**Firestore Collections:**
- `users`: User profiles with subscription + quota state
- `agreements`: Vipps Recurring payment agreements
- `charges`: Monthly charge records (success/failure tracking)

## Key Abstractions

**Vocabulary Bank System:**
- Purpose: Organize words by part of speech (verb, noun, adjective, etc.)
- Examples: `extension/data/de.json`, `extension/popup/popup.js` (BANK_TO_POS mapping)
- Pattern: Dictionaries stored as `{ verbbank: { verb_id: { word, translation, conjugations } }, nounbank: {...} }`
- Flattening: `flattenBanks()` converts bank structure to single array for searching
- Search: Inverted index + fuzzy matching for quick lookups

**Grammar Features System:**
- Purpose: Let users control which grammar details display (tenses, cases, pronouns, etc.)
- Examples: `extension/data/grammarfeatures-de.json`, `popup.js` (isFeatureEnabled())
- Pattern: Features grouped by category; each has an ID, name, enabled flag
- Rendering: Conditional templates check `isFeatureEnabled(featureId)` before showing info
- Multi-lang: Tense names vary by language (German `presens` vs Spanish `presente`)

**Inflection Index:**
- Purpose: Fast lookup of conjugated/declined forms to base word
- Structure: `Map<lowercaseForm, [{ entry, matchType, matchDetail }]>`
- Used by: Dictionary search (user types "spiele" → finds "spielen"), word prediction
- Example in `popup.js`: `"spiele" → { infinitive: "spielen", pronoun: "du/ihr" }`

**Quota Rollover:**
- Purpose: Monthly allowances that accumulate through school year; reset in summer
- Location: `backend/api/_quota.js`
- Logic: 
  - New month detected → add `quotaMonthlyAllowance` to balance (capped at `quotaMaxBalance`)
  - July 1 reached → reset balance to allowance (summer break)
- Used by: `tts.js` before proxying audio

**Dual Authentication:**
- Token-based: JWT issued on Vipps login, verified on every API call
- Legacy code: Simple string comparison for backward compatibility during transition
- Both coexist in `tts.js`: try token first, fall back to code

## Entry Points

**Extension:**
- `extension/manifest.json`: Declares all content scripts, popup, background service worker, icons
- `extension/background/service-worker.js`: Listens for install, creates context menus, routes messages between popup and content scripts
- `extension/popup/popup.html` + `popup.js`: Dictionary UI, login button, settings
- `extension/content/floating-widget.js`: Activated on text selection
- `extension/content/word-prediction.js`: Activated on input focus
- `extension/content/spell-check.js`: Listens on Norwegian text inputs
- `extension/content/vocab-store.js`: Provides IndexedDB access to all scripts

**Backend:**
- `backend/api/auth/vipps-login.js`: `GET /api/auth/vipps-login` — Initiates Vipps OIDC flow
- `backend/api/auth/vipps-callback.js`: `GET /api/auth/vipps-callback` — Receives Vipps redirect (both extension + web)
- `backend/api/auth/exchange-code.js`: `POST /api/auth/exchange-code` — Extension code exchange
- `backend/api/auth/session.js`: `POST /api/auth/session` — Validate JWT, return user info
- `backend/api/auth/subscribe.js`: `POST /api/auth/subscribe` — Create Vipps Recurring agreement
- `backend/api/auth/create-checkout.js`: `POST /api/auth/create-checkout` — Create Stripe Checkout Session
- `backend/api/tts.js`: `POST /api/tts` — TTS proxy with dual auth + quota
- `backend/api/webhooks/vipps.js`: `POST /api/webhooks/vipps` — Vipps webhook handler
- `backend/api/webhooks/stripe.js`: `POST /api/webhooks/stripe` — Stripe webhook handler
- `backend/api/cron/create-charges.js`: `GET /api/cron/create-charges` — Daily charge creation (Vipps)
- `backend/api/cron/check-stripe-expiry.js`: `GET /api/cron/check-stripe-expiry` — Daily expiry check (Stripe)

## Error Handling

**Strategy:** Graceful degradation with fallback to free browser TTS

**Patterns:**
- **TTS quota exceeded:** Respond with `{ error: 'quota exceeded' }` → extension falls back to `speechSynthesis.speak()`
- **Network error on vocab sync:** Silently use bundled vocab (IndexedDB fallback)
- **Firebase timeout:** Webhook handlers retry on Vipps side; cron jobs have retry logic
- **Vipps token expiry:** Extension retries login on 401 response; JWTs have 30-day TTL
- **Stripe webhook duplicate:** Idempotent handlers check charge ID before updating

## Cross-Cutting Concerns

**Logging:** Console.error for backend errors; minimal logging in extension (IndexedDB doesn't support console on content scripts)

**Validation:**
- Backend: CORS origin check, rate limiting per IP, required env var validation
- Extension: User input sanitized before rendering (no innerHTML, use textContent)
- TTS: Require `x-lexi-client` header as lightweight client validation

**Authentication:**
- Extension: Session JWT stored in `chrome.storage.local`; refreshed via `POST /api/auth/session`
- Backend: JWT verified with HMAC-SHA256 using `SESSION_JWT_SECRET`
- Legacy code: Environment variable string comparison (no hashing)

**Internationalization (i18n):**
- Extension: Strings file `extension/i18n/strings.js` with language-specific translations
- UI language: Separate from content language; stored in `chrome.storage.local` as `uiLanguage`
- Content language: Learning language (de/es/fr); vocabulary varies
- Norwegian variant: nb vs nn tracked separately in grammar features + vocab data

---

*Architecture analysis: 2026-04-17*
