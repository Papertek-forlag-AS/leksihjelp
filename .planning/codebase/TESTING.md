# Testing Patterns

**Analysis Date:** 2026-04-17

## Current State

**⚠️ NO AUTOMATED TESTS CONFIGURED**

This codebase currently has **no test framework, no test files, and no automated testing pipeline**. All testing is manual.

- No `jest.config.js`, `vitest.config.js`, or equivalent test runner configuration
- No `test` or `__tests__` directories anywhere in the codebase
- No test scripts in `package.json` (only `sync-vocab` and `package` scripts)
- No test dependencies in either `package.json`

This is a significant gap for a production codebase with:
- Authentication flows (Vipps OIDC, JWT token verification)
- Payment processing (Stripe, Vipps Recurring)
- Complex stateful logic (quota rollover, subscription lifecycle)
- Extension content scripts with message passing between isolated contexts

## Testing Gaps & Risks

**Critical Logic Without Tests:**
- `backend/api/_jwt.js` — JWT creation/verification (HMAC-SHA256)
  - Risk: Signature verification bypass or token forgery
  - Files: `_jwt.js`
- `backend/api/_vipps.js` — OAuth2/OIDC token exchange, Vipps API calls
  - Risk: Authentication bypass or incorrect user data
  - Files: `_vipps.js`
- `backend/api/tts.js` — Dual auth (Bearer + legacy code), quota calculation
  - Risk: Unauthorized access or quota overflow
  - Files: `tts.js`
- `backend/api/webhooks/stripe.js` — Stripe webhook signature verification
  - Risk: Webhook forgery, unauthorized subscription activation
  - Files: `webhooks/stripe.js`
- `backend/api/webhooks/vipps.js` — Vipps webhook signature verification, event type parsing
  - Risk: Webhook forgery, incorrect state transitions
  - Files: `webhooks/vipps.js`
- `backend/api/_quota.js` — Quota rollover, balance management
  - Risk: Quota overflow, incorrect character tracking
  - Files: `_quota.js`

**Content Script Logic Without Tests:**
- `extension/popup/popup.js` — Dictionary search, grammar feature filtering (300+ lines)
  - Risk: Search results broken by vocabulary data changes
  - Files: `popup.js`
- `extension/content/floating-widget.js` — TTS playback, word highlighting, voice selection
  - Risk: Audio not playing, widget interaction broken
  - Files: `floating-widget.js`
- `extension/content/word-prediction.js` — Autocomplete, recent word tracking, bigram scoring
  - Risk: Suggestions broken, debounce logic fails
  - Files: `word-prediction.js`
- `extension/content/vocab-store.js` — IndexedDB caching, language pack downloads
  - Risk: Cache corruption, offline mode broken
  - Files: `vocab-store.js`

**Data Transformation Without Tests:**
- `scripts/sync-vocab.js` — Fetches API data, writes to JSON files
  - Risk: Malformed vocabulary data breaks extension UI
  - Files: `sync-vocab.js`

## Proposed Testing Strategy

### Unit Tests (High Priority)

**Backend utilities** — Test in isolation:
1. `_jwt.js`:
   - Token creation with custom expiry
   - Token verification with valid/invalid signatures
   - Token expiration detection
   - Timing-safe comparison

2. `_utils.js`:
   - CORS origin validation (allowed vs. blocked origins)
   - Rate limiting bucket behavior (window reset, counter increment)
   - IP extraction from x-forwarded-for header

3. `_quota.js`:
   - Quota rollover calculation (rollover timing, max balance cap)
   - Character deduction within balance
   - Month boundary transitions

4. `_stripe.js`:
   - Checkout session creation (metadata, amount)
   - Yearly duration calculation

### Integration Tests (Medium Priority)

**Webhook handlers** — Test signature verification + data persistence:
1. `webhooks/stripe.js`:
   - Valid `checkout.session.completed` event → user subscription activated
   - Invalid signature → 400 Bad Request
   - Missing signature → 400 Bad Request
   - Unhandled event type → 200 (logged, not processed)

2. `webhooks/vipps.js`:
   - Valid agreement event → Firestore agreement record updated
   - Valid charge event → Firestore charge record updated
   - Invalid signature → early return without processing
   - Event type mapping (recurring.agreement-activated.v1 → "ACTIVE")

3. `auth/exchange-code.js`:
   - Valid code → token exchange + user document created
   - Invalid code → 401 Unauthorized
   - Rate limiting kicks in after 10 requests/min
   - New user vs. existing user update paths

### Content Script Tests (Lower Priority, More Complex)

Test infrastructure would require:
- DOM mocking/jsdom for popup and content scripts
- Chrome API mocking (chrome.storage, chrome.tabs, chrome.runtime.sendMessage)
- IndexedDB mocking for vocab-store
- Fetch mocking for API calls

**Candidates:**
1. `vocab-store.js` — IndexedDB operations
2. `floating-widget.js` — Message handling, pause state
3. `word-prediction.js` — Prefix index building, dropdown selection

## Recommended Test Framework

**For backend (Node.js):**
- **Vitest** — Fast, modern, lower config than Jest
- Or **Jest** — More mature, wider adoption
- **Supertest** — HTTP assertion library for testing Vercel handlers

**For extension scripts (if needed):**
- **Vitest** with `jsdom` environment for DOM testing
- **@testing-library/dom** for DOM interaction testing
- **Mock Service Worker** or **jest-fetch-mock** for fetch stubbing

## Manual Testing Checklist

Until automated tests are in place, manually verify:

### Authentication Flows
- [ ] Vipps login redirects to OIDC consent screen
- [ ] Token exchange successful after user consent
- [ ] JWT stored in chrome.storage.local after login
- [ ] Session validation fails with expired token
- [ ] Extension shows "logged in" state correctly

### Payment Flows
- [ ] Vipps subscription agreement creation works
- [ ] Vipps webhook activates agreement correctly
- [ ] Stripe Checkout session created with correct metadata
- [ ] Stripe webhook activates yearly subscription
- [ ] Expiry cron deactivates expired subscriptions

### TTS Quota
- [ ] Authenticated user with quota can request TTS
- [ ] Quota decreases after TTS request
- [ ] Fallback to browser speechSynthesis when quota exhausted
- [ ] Legacy access code still works (backward compat)
- [ ] Quota rolls over on first of month
- [ ] Max balance cap enforced

### Dictionary Search (Extension)
- [ ] Forward search (target language → Norwegian) works
- [ ] Reverse search (Norwegian → target language) works
- [ ] Grammar feature toggles show/hide relevant sections
- [ ] Search handles typos and inflected forms
- [ ] Word prediction suggestions appear on typing

### Vocabulary Sync
- [ ] `npm run sync-vocab` fetches all languages
- [ ] `npm run sync-vocab:de` fetches only German
- [ ] Output files are valid JSON
- [ ] Bank structure preserved (verbbank, nounbank, etc.)

---

## Notes

**Why no tests yet:**
- Early-stage project with rapid iteration on features
- Complex external dependencies (Vipps, Stripe) require mock setup
- Chrome extension testing requires special tooling
- Priority on shipping features over test coverage

**Next Steps (Priority Order):**
1. Set up Vitest for backend unit tests
2. Add tests for JWT/signature verification (security-critical)
3. Add tests for webhook handlers
4. Add tests for quota calculations
5. Add tests for authentication flows
6. Consider extension testing setup (lower priority)

---

*Testing analysis: 2026-04-17*
