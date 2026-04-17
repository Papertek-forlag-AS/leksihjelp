# Codebase Concerns

**Analysis Date:** 2026-04-17

## Test Coverage Gaps

**Entire codebase lacks automated tests:**
- **Backend API:** `backend/api/**/*.js` — No unit or integration tests for auth, webhooks, cron, quota logic, or TTS proxy.
- **Extension code:** `extension/popup/popup.js`, `extension/content/*.js` — No test suite for vocabulary loading, grammar features, search, TTS, or word prediction.
- **Sync script:** `scripts/sync-vocab.js` — No tests for API integration, data parsing, or error handling.
- **Impact:** Breaking changes go undetected. Subtle bugs in quota calculation, webhook signature verification, or search logic have escaped production.
- **Risk:** High. Critical features (payments, quota, TTS authentication) have zero test coverage.
- **Priority:** High — Consider adding tests for critical paths: TTS quota, Vipps/Stripe webhooks, JWT validation, search logic.

## Quota System Race Conditions

**File:** `backend/api/tts.js` (lines 129–166), `backend/api/_quota.js` (lines 44–91)

**Issue:**
- TTS endpoint deducts quota in a Firestore transaction (safe), but monthly rollover logic in `recalculateQuota()` runs WITHIN the transaction.
- If a transaction is retried (due to contention), quota may be recalculated multiple times before the deduction is applied, leading to incorrect balance.
- The rollover check at line 64–75 of `_quota.js` reads `quotaLastTopUp` and determines if a new month has arrived. If two concurrent TTS requests both see "new month," they both add the monthly allowance.

**Evidence:**
- `tts.js` lines 130–152: Calls `recalculateQuota()` inside the transaction, then deducts from the recalculated balance.
- If quota rollover should happen ONCE per month, concurrent requests can trigger it twice in rapid succession.

**Current mitigation:**
- Transaction retries reduce (but don't eliminate) race window.
- Firestore's optimistic concurrency is "last write wins" — if quota is deducted twice from the same user in the same second, one deduction may be lost.

**Recommendation:**
- Move rollover logic out of the TTS request path. Trigger rollover via a monthly cron job or lazy evaluation with a "lock" field.
- Or: Use a separate `quotaLastUpdated` timestamp and check drift at transaction time to prevent re-rolling.

## Month-Boundary Charge Issues

**File:** `backend/api/cron/create-charges.js` (lines 50–64)

**Issue:**
- Line 60 checks `dueThisMonth = now.getUTCDate() >= start.getUTCDate()` to handle month-boundary renewals.
- Example: Agreement starts on May 15 at 00:00 UTC. If cron runs on June 1 at 06:00 UTC:
  - `monthDelta = 1` (one month passed)
  - `dueThisMonth = 1 >= 15` = false
  - Charge NOT created (off by ~14 days).
- Conversely, an agreement starting May 31 would be due June 30, but the logic triggers June 31 (non-existent date).

**Evidence:**
- Lines 58–64: Day-of-month check does not account for months with fewer days.
- This is the source of the month-boundary charge delay mentioned in recent git logs (`20bb2da Fix several backend bugs`, `1197c5f Fix several backend bugs`).

**Current mitigation:**
- Users may see delayed charges, but they're eventually billed in the following month.
- Firestore charges collection shows delayed status; webhook reconciliation catches misses.

**Recommendation:**
- Use ISO 8601 date math: Add 1 month to `startDate` ISO string, then check `now >= nextChargeDate` directly.
- Example: `new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1))`.
- Add test case for month-end dates (Jan 31 → Feb 28/29, etc.).

## Vipps Webhook HMAC Verification

**File:** `backend/api/webhooks/vipps.js` (lines 59–112)

**Issue:**
- HMAC-SHA256 signature verification is strong, but the webhook secret is **Base64-encoded** (line 97: `Buffer.from(secret, 'base64')`).
- If `VIPPS_WEBHOOK_SECRET` env var is accidentally stored as plaintext instead of Base64, signature verification will fail silently, and webhooks will be rejected (line 163).
- Line 165–169: Production environment silently rejects unsigned webhooks if secret is missing. This could hide configuration errors.

**Evidence:**
- Lines 97–101: Secret is decoded from Base64; if env var is wrong encoding, the HMAC won't match.
- Lines 165–169: If secret is missing in production, webhook handler logs and returns 500 (breaking payment flow).

**Current mitigation:**
- VIPPS_WEBHOOK_SECRET is set in Vercel env (hopefully correct encoding).
- Error logging shows when HMAC fails.

**Recommendation:**
- Document that `VIPPS_WEBHOOK_SECRET` MUST be Base64-encoded.
- Add a startup validation in a healthcheck endpoint to verify webhook secret can be decoded.
- Consider switching to plaintext secret and encoding in code (simpler than requiring Base64 in env).

## Stripe Webhook Signature Verification

**File:** `backend/api/webhooks/stripe.js` (lines 51–66)

**Issue:**
- Dynamic `import('stripe')` inside the handler (line 54) is inefficient. The Stripe module is re-imported and instantiated on every webhook.
- If `STRIPE_SECRET_KEY` is missing in production (line 55), signature verification fails and webhooks are silently discarded (line 64).
- No retry mechanism: if a Stripe webhook arrives before `STRIPE_SECRET_KEY` is set, it's lost forever.

**Evidence:**
- Lines 54–55: Stripe is imported and instantiated per request.
- Line 64: Errors are caught and returned as 400, but the webhook is already considered delivered by Stripe (no retry).

**Current mitigation:**
- Stripe usually retries on 4xx responses, so eventual consistency is achieved.
- STRIPE_SECRET_KEY is provisioned before accepting webhooks.

**Recommendation:**
- Import Stripe at module load time, not per-request.
- Add a healthcheck that validates `STRIPE_SECRET_KEY` at startup.
- Consider storing last webhook ID in Firestore to detect duplicates and prevent re-processing.

## TTS Language Code Mismatch

**File:** `backend/api/tts.js` (lines 174–177)

**Issue:**
- ElevenLabs accepts short language codes (`no`, `es`, `de`, `fr`) for `eleven_flash_v2_5` model.
- Frontend sends `language` param from user's UI setting, which could be `nb`, `nn`, or other variants.
- Line 177 passes `language || null` directly to ElevenLabs without mapping.
- If user has `nb` or `nn` set, ElevenLabs receives `nb` or `nn` (not recognized for v2.5), and silently defaults to English TTS.

**Evidence:**
- CLAUDE.md notes: "TTS language code mismatches" were a known issue (git commit `a5769c7 fix: NB/NN TTS language code`).
- Lines 174–177: No mapping from `nb`/`nn` to `no` for ElevenLabs.

**Current mitigation:**
- Frontend handles remapping in some places (e.g., `floating-widget.js` line 65: `const VOICE_LANG_MAP = { nb: 'no', nn: 'no' }`).
- But this is frontend-only; backend doesn't validate or map.

**Recommendation:**
- Add a language code mapping table in `tts.js`:
  ```javascript
  const LANGUAGE_CODE_MAP = { nb: 'no', nn: 'no', en: 'en', de: 'de', es: 'es', fr: 'fr' };
  const mappedLang = LANGUAGE_CODE_MAP[language] || language;
  ```
- Return error if unsupported language code is sent.

## Global Content Script Event Listeners

**File:** `extension/content/floating-widget.js` (lines 113–146), `extension/content/word-prediction.js` (lines 55–78)

**Issue:**
- Both content scripts attach global `chrome.runtime.onMessage` listeners on every website.
- No message type validation or namespace segregation: a malicious page could send `{ type: 'LANGUAGE_CHANGED' }` to hijack the extension state.
- Widget listens to ANY message with `type: 'PLAY_TTS'` (line 126) — malicious site could trigger TTS playback of arbitrary text.
- No rate limiting on message processing: a page could flood the extension with messages.

**Evidence:**
- `floating-widget.js` lines 116–146: Listeners for `LANGUAGE_CHANGED`, `PLAY_TTS`, `LOOKUP_WORD`, etc.
- `word-prediction.js` lines 55–78: Listeners for `LANGUAGE_CHANGED`, `GRAMMAR_FEATURES_CHANGED`, etc.
- No validation that messages come from the extension background script.

**Current mitigation:**
- Messages come from background script (`background/service-worker.js`), which is trusted.
- Content scripts run in isolated context (can't directly access page JS).

**Risk:**
- If background script is compromised, content scripts execute attacker-controlled actions.
- If a page exploits another browser weakness, it could inject messages into the extension.

**Recommendation:**
- Add message origin validation: Check that the sender is the background script (not a content script or webpage).
  ```javascript
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return; // Ignore external
    if (msg.type === 'PLAY_TTS') { ... }
  });
  ```
- Rate-limit message handlers (e.g., max 10 TTS requests per second per tab).
- Document which message types are safe for external callers.

## Bundled Vocabulary Data Freshness

**File:** `extension/data/*.json` (all dictionaries)

**Issue:**
- Extension ships with pre-bundled vocabulary from `scripts/sync-vocab.js`.
- Data becomes stale as soon as the sync script runs. There's no automatic update mechanism in the extension.
- `extension/content/vocab-store.js` (IDB cache) can download updates, but the bundled data is the fallback.
- Users on old extension versions use outdated vocabulary until they manually update.

**Evidence:**
- `scripts/sync-vocab.js` line 152: Writes JSON to disk at build time.
- Extension manifest doesn't specify `update_url` — relies on Chrome Web Store for updates only.
- `extension/content/vocab-store.js` checks for updates via `checkForUpdate()` (line 311), but bundled files are always used if update fails.

**Impact:**
- Typo entries, conjugation tables, and grammar features are static.
- If Papertek vocabulary API is fixed (e.g., a misspelled word corrected), old extension users still see the old data.
- For languages like German (where NN data is still being standardized per CLAUDE.md), stale data affects user experience.

**Recommendation:**
- Implement versioning: include `_metadata.version` in bundled data, compare with remote version on each session.
- Add an explicit "Update vocabulary" button in popup for users on slow auto-update cycles.
- Consider implementing differential updates (only sync changed words) to reduce bandwidth.

## Cross-Project Vocabulary Schema Coupling

**File:** `scripts/sync-vocab.js` (lines 161–248), `backend/.env.example`

**Issue:**
- Leksihjelp consumes vocabulary from the Papertek API (`papertek-vocabulary.vercel.app`).
- CLAUDE.md notes: "Vocabulary API schema changes affect all three consumers: leksihjelp, papertek-webapps, papertek-nativeapps."
- If the API schema changes (e.g., `linkedTo` structure), Leksihjelp's sync script fails silently (line 140–142: errors are logged but sync continues).
- No version pinning: script always fetches from the latest API version.

**Evidence:**
- `sync-vocab.js` lines 187–229: Tries to resolve `linkedTo.nb`, `linkedTo.nn` — if API changes this structure, resolution fails and `translation` is null.
- No API version in URL (always `v3`); if v4 is released, old code breaks.

**Current mitigation:**
- Manual testing before releasing vocabulary changes.
- Git history shows vocabulary sync commits, so breaking changes are visible.

**Recommendation:**
- Add a manifest compatibility check at startup: `extension/content/vocab-store.js` should validate that `_metadata.apiVersion` matches the expected version.
- Consider versioning the sync script alongside the extension (e.g., `sync-vocab-v3.js`).
- Add unit tests to the sync script to validate JSON structure before writing files.

## Legacy Access Code Auth in TTS

**File:** `backend/api/tts.js` (lines 75–88)

**Issue:**
- TTS endpoint still supports legacy `x-access-code` header for backward compatibility.
- This auth method has no quota tracking: legacy users get unlimited free TTS.
- If the legacy code is leaked, TTS is exploited (no rate limiting beyond IP).
- No deprecation timeline: unclear when/if this will be removed.

**Evidence:**
- Lines 75–88: Falls back to code-based auth if no Bearer token.
- No deprecation warning in logs when legacy code is used.
- Lines 33 & 178: IP-based rate limit applies to all requests (30/min), but legacy users bypass token-based quota entirely.

**Current mitigation:**
- `ACCESS_CODE` env var is unique and rotated by Vercel secrets management.
- IP rate limiting (30 req/min) prevents egregious abuse.

**Recommendation:**
- Add a deprecation warning to logs: `console.warn('Legacy access code auth used by IP:', ip)`.
- Set a sunset date: e.g., "Legacy code auth removed after 2026-12-31."
- Consider forcing legacy users to migrate to token-based auth (create a "legacy user" subscription plan).

## Unprotected Development Endpoints

**File:** `backend/api/cron/*.js`, `backend/api/webhooks/*.js`

**Issue:**
- Cron jobs are protected by `CRON_SECRET` (lines 21–24 of `create-charges.js`).
- But if `CRON_SECRET` is undefined, the check is skipped (line 22: `if (cronSecret && ...)`).
- In development, `CRON_SECRET` is often not set, allowing anyone to trigger charge creation.
- Webhooks require signature verification, but if the webhook secret is missing, verification is skipped (e.g., `vipps.js` line 159–169).

**Evidence:**
- `create-charges.js` lines 21–24: Only checks cron secret if it's set.
- `check-stripe-expiry.js` lines 19–25: Same pattern.
- `vipps.js` lines 165–169: Logs warning and continues if secret is not set.

**Current mitigation:**
- These are Vercel serverless functions, accessible only via HTTP (no SSH).
- Secrets are set in Vercel environment; dev environment shouldn't expose these endpoints.

**Risk:**
- If someone discovers the function URLs, they can trigger charge creation or subscription changes without authentication.

**Recommendation:**
- Always require `CRON_SECRET` and `VIPPS_WEBHOOK_SECRET` in production: fail fast at startup rather than at request time.
- Add a health-check endpoint (`GET /api/health`) that validates all required secrets are set.
- In development, use a placeholder secret or require explicit opt-in to disable checks.

## Missing TTS Error Recovery

**File:** `backend/api/tts.js` (lines 227–231), `extension/content/floating-widget.js` (lines 814–885)

**Issue:**
- When ElevenLabs API fails (e.g., 502 error), quota is refunded via `refundQuota()` (line 210).
- But `refundQuota()` is async and not awaited (line 210). If it throws, the error is swallowed (line 229: `catch { }`).
- Quota refund failures are logged but do NOT cause the TTS request to fail.
- User sees "TTS failed, falling back to browser TTS" but doesn't know if quota was refunded.

**Evidence:**
- Line 210: `await refundQuota(...)` is awaited, but line 229 swallows errors.
- Lines 234–249: `refundQuota()` has its own try-catch that only logs errors.

**Current mitigation:**
- Refund logic is simple (single update). Errors are rare.
- Users can always spend quota on retry (rate limiting prevents hammering).

**Recommendation:**
- Return quota refund status to the client in the error response: `{ error: '...', quotaRefunded: true|false }`.
- Add monitoring alerts for quota refund failures.
- Consider storing failed refunds in a separate collection for manual reconciliation.

## Firestore Batch Write Limits Not Documented

**File:** `backend/api/cron/check-stripe-expiry.js` (lines 38–62)

**Issue:**
- Line 52: Batch limit is hardcoded to 500 (Firestore max).
- But if there are >500 expired Stripe subscriptions, the job loops and commits multiple batches.
- If the second batch fails partway through, some subscriptions are marked expired but others aren't.
- No transaction across batches: inconsistent state is possible.

**Evidence:**
- Lines 38–62: Batch loop commits every 500 writes.
- If a commit fails (e.g., quota exceeded), the loop continues, but some users are left half-updated.

**Current mitigation:**
- Firestore quotas are generous; batch failures are rare.
- Users can manually re-trigger the cron or check manually.

**Recommendation:**
- Wrap the entire batch loop in a transaction (if Firestore supports it; if not, use a "checkpoint" approach).
- Log which subscriptions were deactivated so the job is idempotent (check if already deactivated before updating).
- Add a `lastDeactivationCronRun` timestamp to track which run made the change.

## Nynorsk (NN) Vocabulary Data Inconsistency

**File:** `extension/data/nn.json`, `scripts/sync-vocab.js` (lines 188–197), CLAUDE.md mentions NN infinitive standardization

**Issue:**
- NN vocabulary data should use e-infinitiv (e.g., "å læra" not "å lære"), but Papertek API sync may produce inconsistent results.
- `scripts/sync-vocab.js` lines 188–197 try to resolve NN translations from `linkedTo.nb`, but if the nb entry has a-infinitiv (e.g., "å lære"), the NN version gets the wrong form.
- User memory notes reference "project_nn_infinitive_fix.md" — NN dictionary data mixes -a/-e infinitives.

**Evidence:**
- CLAUDE.md notes in memory: "NN dictionary data mixes -a/-e infinitives, needs standardizing to e-infinitiv at Papertek API."
- `sync-vocab.js` lines 190–196: Fallback translation resolution doesn't apply NN infinitive normalization.

**Impact:**
- Word prediction and dictionary suggest wrong verb forms in Nynorsk.
- Users learning Nynorsk see bokmål-influenced infinitives.

**Recommendation:**
- Add a post-processing step in `buildLanguageData()` to normalize NN infinitives after fetch.
- OR: Fix the data in `papertek-vocabulary` at source (preferred per CLAUDE.md).
- Add a test case that validates NN verb entries end in `-a` (not `-e`).

## Floating Widget DOM Pollution on Conflicting Websites

**File:** `extension/content/floating-widget.js` (lines 164–180)

**Issue:**
- Widget creates a `<div id="lexi-widget">` at document root (line 164 or later).
- If a website already has an element with `id="lexi-widget"`, the extension's DOM is inserted inside or replaces it, breaking both the page and the widget.
- No namespace prefix on widget ID (e.g., should be `lh-widget-main` or `_lexi_widget_internal`).
- Similarly, CSS classes in `styles/content.css` may conflict with page styles.

**Evidence:**
- Widget creation (lines 164–180 approximate): Inserts into document without checking for ID collisions.
- No `!important` flags on critical styles, so page CSS can override widget appearance.

**Current mitigation:**
- Unlikely collision (custom ID namespace).
- Users can disable extension if widget breaks page.

**Recommendation:**
- Use a namespaced ID like `__leksihjelp_widget_root` with `!important` on critical styles.
- Use Shadow DOM to isolate widget styles from page: `const shadow = element.attachShadow({ mode: 'open' })`.

## No Graceful Degradation for Missing JSON Files

**File:** `extension/content/word-prediction.js` (lines 81–105), `extension/popup/popup.js` (lines 163–164)

**Issue:**
- If `grammarfeatures-{lang}.json` is missing or corrupted, the fetch fails silently (line 98: `catch (e) { grammarFeatures = null }`).
- Code then proceeds with `enabledFeatures = new Set(grammarFeatures.features.map(...))` (line 101), which throws if grammarFeatures is null.
- Similarly, if `${lang}.json` vocabulary file is missing, search returns no results with no error message.

**Evidence:**
- `word-prediction.js` lines 81–105: Fetch errors are caught but don't set a fallback.
- Line 101: Tries to iterate `grammarFeatures.features` without null check.

**Impact:**
- Silent failures: user sees empty search results or broken grammar UI.
- Hard to debug (no error message in console).

**Recommendation:**
- Add explicit null checks before using grammarFeatures: `if (!grammarFeatures || !grammarFeatures.features)`.
- Log a warning (not error) when files are missing: `console.warn('Grammar features file not found for', lang)`.
- Return sensible defaults (e.g., all features enabled) instead of failing.

## Hard-Coded Magic Numbers in TTS

**File:** `backend/api/tts.js` (lines 91, 169, 172)

**Issue:**
- Line 91: Max text length hardcoded to 2000 characters.
- Line 169: Default voice ID hardcoded to `ThT5KcBeYPX3keUQqHPh`.
- Line 172: Voice speed range hardcoded to 0.7–1.2.
- No constants defined; these values are scattered and can't be reused.

**Evidence:**
- Lines 91, 169, 172: Magic numbers inline.
- No configuration mechanism to change limits without redeploying.

**Recommendation:**
- Define constants at module top:
  ```javascript
  const MAX_TEXT_LENGTH = 2000;
  const DEFAULT_VOICE_ID = 'ThT5KcBeYPX3keUQqHPh';
  const VOICE_SPEED_MIN = 0.7;
  const VOICE_SPEED_MAX = 1.2;
  ```
- Move to environment variables if these need to be tunable without redeployment.

## No Request Validation Schema

**File:** `backend/api/tts.js` (lines 45–93)

**Issue:**
- TTS endpoint accepts `{ text, voiceId, speed, code, language }` but has no validation schema (e.g., OpenAPI, Zod, or Joi).
- Each handler manually checks input: `if (!text || typeof text !== 'string' || text.length > 2000)` (line 91).
- No type coercion, no sanitization. If a non-string speed is sent, `parseFloat()` returns NaN, and `Math.max()` silently defaults (line 172).
- No schema documentation — frontend must reverse-engineer valid inputs.

**Evidence:**
- Lines 45, 91–93: Ad-hoc validation per field.
- No centralized schema definition.

**Recommendation:**
- Use a lightweight validation library (e.g., `zod` or hand-rolled schema).
- Define once, reuse across handlers.
- Return detailed validation errors: `{ error: 'Invalid input', details: { speed: 'must be number' } }`.

## Undocumented Cron Job Schedule

**File:** `backend/vercel.json`, `backend/api/cron/create-charges.js` (line 1–8), `backend/api/cron/check-stripe-expiry.js` (line 1–8)

**Issue:**
- Cron schedule is defined in `backend/vercel.json` but NOT referenced in the handler files.
- Comments say "runs daily at 06:00 UTC" and "runs at 07:00 UTC", but the `vercel.json` is the source of truth and may drift.
- If cron is disabled in `vercel.json`, the handler code is misleading.
- No alerting if a cron job doesn't run (e.g., Vercel rate limit or misconfiguration).

**Evidence:**
- `create-charges.js` line 4: "runs daily at 06:00 UTC" (source of truth is `vercel.json`).
- `check-stripe-expiry.js` line 4: "runs at 07:00 UTC" (order matters: create-charges runs first, then expiry check).

**Recommendation:**
- Embed the cron schedule in the handler as a constant comment or log it on startup.
- Add a healthcheck endpoint that reports when each cron job last ran (store in Firestore).
- Alert if any cron job hasn't run in 25 hours.

---

*Concerns audit: 2026-04-17*
