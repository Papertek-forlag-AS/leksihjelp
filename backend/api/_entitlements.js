/**
 * Leksihjelp — Entitlements
 *
 * Single source of truth for which paid features a user has access to.
 *
 * Why this exists separately from `subscriptionStatus`:
 *   We want to be able to flip a feature from free → paid (or paid → free)
 *   without an extension release. The extension asks the backend "what may
 *   this user do right now?" via the entitlements object on the session
 *   response, and gates UI accordingly. Changing what's free is a server-side
 *   config change.
 *
 * Future inputs (NOT yet wired):
 *   - FEIDE institutional entitlements (subscriptionType === 'feide_institution')
 *   - Per-school overrides (e.g. UDIR pilot agreements)
 *   - Time-bounded promo unlocks
 */

/**
 * Compute a user's current entitlements.
 *
 * @param {Object} userData — Firestore `users/{id}` document, or null for unauthenticated.
 * @returns {Object} entitlements — { tts, larMerPremium, ... }
 */
export function computeEntitlements(userData) {
  const isPaid = isActiveSubscription(userData);

  return {
    // Always free, offline, no login required:
    dictionary: true,
    spellCheck: true,
    wordPrediction: true,
    browserTts: true,

    // Currently free for everyone — flag exists so we can flip to paid-only
    // without an extension release. Set to `isPaid` when ready to flip.
    larMerBasic: true,

    // Paid features (require active subscription / institutional entitlement):
    elevenLabsTts: isPaid,
    larMerPremium: isPaid, // reserved for future rich pedagogy content
  };
}

/**
 * Whether this user has an active paid entitlement right now.
 *
 * Recognized subscription types:
 *   - 'vipps_monthly', 'vipps_yearly' — active when subscriptionStatus === 'active'
 *   - 'stripe_yearly' — active when stripeExpiresAt is in the future
 *   - 'feide_institution' (future) — active when institutionEntitlement.expiresAt is in the future
 *
 * @param {Object|null} userData
 * @returns {boolean}
 */
export function isActiveSubscription(userData) {
  if (!userData) return false;

  if (userData.subscriptionStatus === 'active') return true;

  if (userData.subscriptionType === 'stripe_yearly' && userData.stripeExpiresAt) {
    const expiresAt = new Date(userData.stripeExpiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return true;
  }

  // Placeholder for FEIDE institutional flow (Phase 30-04+):
  // if (userData.subscriptionType === 'feide_institution' && userData.institutionEntitlement?.expiresAt) { ... }

  return false;
}

/**
 * Anonymous (not-logged-in) entitlements — what the extension may do without a session.
 *
 * @returns {Object}
 */
export function anonymousEntitlements() {
  return computeEntitlements(null);
}
