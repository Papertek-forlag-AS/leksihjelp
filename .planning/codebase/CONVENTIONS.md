# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**
- camelCase for JavaScript files: `popup.js`, `floating-widget.js`, `service-worker.js`
- Hyphenated names for complex modules: `floating-widget.js`, `word-prediction.js`, `spell-check.js`
- Lowercase for data/config directories
- Backend API files use action names: `exchange-code.js`, `vipps-callback.js`, `create-checkout.js`
- Webhook files grouped under `webhooks/`: `webhooks/vipps.js`, `webhooks/stripe.js`
- Auth flows grouped under `auth/`: `auth/vipps-login.js`, `auth/exchange-code.js`, `auth/session.js`
- Cron jobs grouped under `cron/`: `cron/create-charges.js`, `cron/check-stripe-expiry.js`

**Functions:**
- camelCase: `getTranslation()`, `flattenBanks()`, `exchangeCodeForTokens()`, `performSearch()`
- Descriptive action names: `initI18n()`, `loadDictionary()`, `handlePlay()`, `broadcastToAllTabs()`
- Private/internal functions use leading underscore: `_isExtensionOrigin`, `_sendMessageAsync()`
- Async functions explicitly named: `async function init()`, `async function handler(req, res)`

**Variables:**
- camelCase: `currentLang`, `enabledFeatures`, `isAuthenticated`, `selectedIndex`
- Constants use UPPER_CASE: `BACKEND_URL`, `BANK_TO_POS`, `ELEVENLABS_VOICES`, `FONT_SIZE_MAX`
- Boolean flags: `enabled`, `isAuthenticated`, `lexiPaused`, `justDragged`
- Collections: plural names: `allWords`, `recentWords`, `enabledFeatures` (Set)
- Maps/indexes: `inflectionIndex`, `prefixIndex`, `rateMaps` (Map)

**Types/Objects:**
- Object literals describe data structure: `BANK_TO_POS = { verbbank: 'verb', nounbank: 'substantiv' }`
- Configuration objects uppercase: `ELEVENLABS_VOICES`, `LANG_NAMES`, `VOICE_LANG_MAP`
- Event payloads: `event.type`, `event.data.object` (Stripe webhook structure)
- Database field names: `subscriptionStatus`, `quotaBalance`, `stripeExpiresAt` (camelCase)

## Code Style

**Formatting:**
- No auto-formatter configured (no `.prettierrc`, no `eslint` setup)
- Manual style observed:
  - 2-space indentation throughout
  - Semicolons used consistently
  - Long lines break after operator or comma
  - Template literals for i18n and URLs: `` `${variable}` ``

**Linting:**
- No linter configured (no `.eslintrc` files in root)
- No automated checks enforced
- Code written to be self-documenting with JSDoc-style headers

## Import Organization

**Extension Scripts (IIFE Modules - no import/export):**
- No explicit imports; modules use immediately-invoked function expressions (IIFE)
- Shared globals injected via Chrome extension manifest:
  - `self.__lexiI18n` — i18n functions from `i18n/strings.js`
  - `window.__lexiVocabStore` — vocab store from `vocab-store.js`
- Modules communicate via `chrome.runtime.sendMessage()` and `chrome.storage`
- Example: `const { t, initI18n, setUiLanguage, getUiLanguage } = self.__lexiI18n;`

**Backend Scripts (ES Modules):**
- `type: "module"` in `backend/package.json`
- Use ES6 `import` syntax:
  ```javascript
  import { setCorsHeaders, rateLimit, getClientIp } from './_utils.js';
  import { verifySessionToken } from './_jwt.js';
  import { getFirestoreDb } from './_firebase.js';
  ```
- Single default export per file: `export default async function handler(req, res)`
- Shared utilities start with underscore: `_utils.js`, `_jwt.js`, `_firebase.js`, `_vipps.js`, `_stripe.js`, `_quota.js`

**Scripts (CommonJS):**
- `scripts/sync-vocab.js` uses CommonJS:
  ```javascript
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');
  ```

## Error Handling

**Extension/Client-Side:**
- Try-catch blocks wrap async operations:
  ```javascript
  try {
    await window.__lexiVocabStore.downloadLanguage(lang, progressCallback);
  } catch (err) {
    console.error('Language download failed:', err);
    status.textContent = t('picker_failed');
  }
  ```
- IndexedDB errors caught and logged, then return `null` gracefully:
  ```javascript
  try {
    const db = await openDB();
    const record = await dbGet(db, lang);
    db.close();
    return record?.data || null;
  } catch (e) {
    console.warn('Leksihjelp: getCachedLanguage failed', e);
    return null;
  }
  ```
- Errors logged to console; UI shows i18n error messages to user
- Message sending wrapped in `.catch(() => {})` to prevent console errors on message failure:
  ```javascript
  chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  ```

**Backend/API Routes:**
- All handlers wrapped in try-catch with error status responses
- Early returns on validation failures:
  ```javascript
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  ```
- Error messages in Norwegian for user-facing endpoints:
  ```javascript
  return res.status(429).json({ error: 'For mange forespørsler. Vent litt.' });
  return res.status(401).json({ error: 'Ugyldig tilgangskode' });
  return res.status(400).json({ error: 'Ugyldig tekst (maks 2000 tegn)' });
  ```
- Console errors logged with context: `console.error('exchange-code error:', err.message);`
- Server errors return generic 500 with safe message:
  ```javascript
  catch (err) {
    console.error('tts handler error:', err.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }
  ```
- Webhook handlers (Vipps, Stripe) respond 200 quickly, errors logged:
  ```javascript
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err.message);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
  ```

## Logging

**Framework:** Console logging only (no logging library)

**Patterns:**
- Errors: `console.error('context:', err.message)` or `console.error('Vipps token exchange failed:', res.status, errText)`
- Warnings: `console.warn('Webhook missing required headers for HMAC verification')`
- Info: `console.log('Activated yearly subscription for user ${userId}, expires ${expiresAt}')`
- Debug: Not used; use console.log instead when needed
- No log levels configured

**Guidelines:**
- Log errors and important state changes in backend handlers
- Log warnings for security-related issues (missing headers, signature mismatches)
- Suppress success responses in handlers; log unusual cases
- For webhook handlers, log after successful state update (proves processing occurred)
- Extension logs to console when download/cache operations fail
- No sensitive data in logs (no tokens, passwords, or API keys)

## Comments

**When to Comment:**
- JSDoc-style headers for functions with complex logic
- Inline comments for non-obvious data transformations
- Section headers using `// ── [Name] ──` pattern to group related functionality
- Rationale for security decisions (HMAC verification, timing-safe comparison)

**JSDoc/TSDoc:**
- Used in backend utilities and complex functions
- Format:
  ```javascript
  /**
   * Short description.
   *
   * @param {Type} paramName — Description
   * @returns {ReturnType} Description
   * @throws {ErrorType} When/why error is thrown
   */
  ```
- Example from `_jwt.js`:
  ```javascript
  /**
   * Create a signed session JWT.
   *
   * @param {Object} payload — Claims to include (sub, email, name, etc.)
   * @param {string} secret — HMAC-SHA256 signing secret
   * @param {number} [expiresInSeconds=2592000] — Token lifetime (default: 30 days)
   * @returns {string} Signed JWT string
   */
  export function createSessionToken(payload, secret, expiresInSeconds = 30 * 24 * 60 * 60)
  ```
- Complex algorithms documented:
  ```javascript
  /**
   * Verify the Vipps webhook HMAC signature.
   * ... full explanation of algorithm and format
   */
  function verifyWebhookSignature(req, rawBody, secret)
  ```

## Function Design

**Size:**
- Generally under 50 lines per function
- Longer functions (100+ lines) document sections with `// ── ──` headers
- Async handlers sometimes longer due to validation, async operations, state management

**Parameters:**
- Positional for required params, destructured objects for optional config
- Example: `rateLimit(bucketName, ip, { maxRequests, windowMs })`
- Handler functions always: `handler(req, res)` or `handler(event, callback)`
- Callback functions: `downloadLanguage(lang, progressCallback, { uiLanguage })`

**Return Values:**
- Async handlers return `res.status(...).json(...)` or `res.status(...).end()`
- Promises resolve to data objects or null on error
- Early returns used extensively to avoid nested conditions
- Null returned when cache miss or error occurs
- Objects with multiple return values: `{ allowed, remaining, retryAfterMs }`

## Module Design

**Exports:**
- Backend uses single default export per file:
  ```javascript
  export default async function handler(req, res) { ... }
  ```
- Utilities export named functions:
  ```javascript
  export function setCorsHeaders(res, req) { ... }
  export function rateLimit(bucketName, ip, config) { ... }
  export async function getVippsAccessToken() { ... }
  ```

**Barrel Files:**
- Not used in this codebase
- Each file is imported individually with full path

## Data Structures

**Vocabulary Banks:**
- Data organized by bank (not a flat array):
  ```javascript
  {
    _metadata: { language: "de", languageName: "Tysk" },
    verbbank: { "sein_verb": { word: "sein", translation: "å være", conjugations: {} } },
    nounbank: { "schule_noun": { word: "Schule", genus: "f", plural: "die Schulen" } }
  }
  ```
- Flattened for search: `[{ word, translation, _bank, partOfSpeech, ...entry }, ...]`

**User Documents (Firestore):**
- Field names camelCase
- Timestamps ISO 8601 format: `"2026-02-01T00:00:00.000Z"`
- Enums stored as string values: `subscriptionStatus: "active|pending|none"`
- Optional fields set to null or omitted

**Grammar Features:**
- Language-specific features stored in separate JSON files: `grammarfeatures-de.json`
- Structure: `{ features: [{ id, category, name, label }, ...] }`
- User selections stored as Set of feature IDs: `enabledFeatures = new Set(['grammar_present', 'grammar_articles'])`

## Special Patterns

**i18n/Internationalization:**
- Global object: `self.__lexiI18n = { t(), initI18n(), setUiLanguage(), getUiLanguage(), langName }`
- Translation function supports variable substitution:
  ```javascript
  t('auth_usage_chars', { count: 8500 })  // Uses {count} placeholder
  ```
- UI language selector dropdown uses `data-i18n` attributes:
  ```html
  <button data-i18n="pin_label">Fest</button>
  ```

**Storage:**
- All Chrome extension storage via `chrome.storage.local`
- Promise-wrapped: `chromeStorageGet(keys)`, `chromeStorageSet(data)`
- Example: `const { language, isAuthenticated } = await chromeStorageGet(['language', 'isAuthenticated'])`

**Message Passing (Chrome Extension):**
- `chrome.runtime.sendMessage(msg)` for popup ↔ content scripts
- Message types as discriminator: `{ type: 'LANGUAGE_CHANGED', language: 'de' }`
- Background service worker routes messages between popup and all tabs

**Authentication Dual-Path:**
- Bearer token (Vipps OIDC): `Authorization: Bearer <JWT>`
- Legacy access code: `x-access-code: <code>` header
- Both paths supported in `tts.js` for backward compatibility

---

*Convention analysis: 2026-04-17*
