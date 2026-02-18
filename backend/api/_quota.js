/**
 * Leksihjelp — Quota Rollover System
 *
 * Manages monthly character quotas for TTS usage with rollover.
 * Unused characters carry forward to the next month, capped at 2× monthly allowance.
 *
 * Firestore user fields:
 *   quotaBalance          — Remaining characters (decrements on use)
 *   quotaLastTopUp        — ISO date string of last monthly top-up
 *   quotaMonthlyAllowance — Characters added per month (default: 10000)
 *   quotaMaxBalance       — Maximum balance cap (default: 20000 = 2× monthly)
 */

// ── Defaults ──

const DEFAULT_MONTHLY_ALLOWANCE = 10_000;
const DEFAULT_MAX_BALANCE = 20_000; // 2× monthly allowance

// ── Helpers ──

/**
 * Get the first day of the month for a given date (midnight UTC).
 * @param {Date} date
 * @returns {Date}
 */
export function firstOfMonth(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Check if two dates are in different calendar months (UTC).
 * @param {Date|string} lastDate
 * @param {Date|string} nowDate
 * @returns {boolean}
 */
export function isNewMonth(lastDate, nowDate) {
  const last = new Date(lastDate);
  const now = new Date(nowDate);
  return last.getUTCFullYear() !== now.getUTCFullYear() ||
         last.getUTCMonth() !== now.getUTCMonth();
}

// ── Core ──

/**
 * Recalculate a user's quota balance with monthly rollover.
 *
 * Call this on every session check and before TTS usage.
 * If a new month has started since the last top-up, adds the monthly allowance
 * to the existing balance (capped at maxBalance).
 *
 * @param {Object} userData — Firestore user document data
 * @returns {{ quotaBalance: number, quotaLastTopUp: string, quotaMonthlyAllowance: number, quotaMaxBalance: number, needsUpdate: boolean, updateFields: Object } | null}
 *   Returns null if no update is needed; otherwise returns the new values and the Firestore update payload.
 */
export function recalculateQuota(userData) {
  const now = new Date();
  const monthlyAllowance = userData.quotaMonthlyAllowance || DEFAULT_MONTHLY_ALLOWANCE;
  const maxBalance = userData.quotaMaxBalance || DEFAULT_MAX_BALANCE;

  const lastTopUp = userData.quotaLastTopUp ? new Date(userData.quotaLastTopUp) : null;

  if (!lastTopUp || isNewMonth(lastTopUp, now)) {
    // New month — add monthly allowance to current balance
    const currentBalance = userData.quotaBalance || 0;
    const newBalance = Math.min(currentBalance + monthlyAllowance, maxBalance);
    const newTopUp = firstOfMonth(now).toISOString();

    return {
      quotaBalance: newBalance,
      quotaLastTopUp: newTopUp,
      quotaMonthlyAllowance: monthlyAllowance,
      quotaMaxBalance: maxBalance,
      needsUpdate: true,
      updateFields: {
        quotaBalance: newBalance,
        quotaLastTopUp: newTopUp,
      },
    };
  }

  // No update needed — current month, balance is fine
  return null;
}

/**
 * Get the initial quota fields for a brand-new user.
 *
 * @param {number} [monthlyAllowance=10000]
 * @returns {Object} Fields to set on the user document
 */
export function getInitialQuotaFields(monthlyAllowance = DEFAULT_MONTHLY_ALLOWANCE) {
  return {
    quotaBalance: monthlyAllowance,
    quotaLastTopUp: firstOfMonth(new Date()).toISOString(),
    quotaMonthlyAllowance: monthlyAllowance,
    quotaMaxBalance: monthlyAllowance * 2,
  };
}
