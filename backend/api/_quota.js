/**
 * Leksihjelp — Quota Rollover System
 *
 * Manages monthly character quotas for TTS usage with school-year rollover.
 * Unused characters accumulate throughout the school year (Aug–Jun),
 * then reset on July 1 (summer break).
 *
 * Firestore user fields:
 *   quotaBalance          — Remaining characters (decrements on use)
 *   quotaLastTopUp        — ISO date string of last monthly top-up
 *   quotaMonthlyAllowance — Characters added per month (default: 50000)
 *   quotaMaxBalance       — Maximum balance cap (default: 500000 = full school year)
 */

// ── Defaults ──

const DEFAULT_MONTHLY_ALLOWANCE = 50_000;
const DEFAULT_MAX_BALANCE = 500_000; // ~10 months accumulation

// ── Helpers ──

/**
 * Get the first day of the month for a given date (midnight UTC).
 */
export function firstOfMonth(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Check if two dates are in different calendar months (UTC).
 */
export function isNewMonth(lastDate, nowDate) {
  const last = new Date(lastDate);
  const now = new Date(nowDate);
  return last.getUTCFullYear() !== now.getUTCFullYear() ||
         last.getUTCMonth() !== now.getUTCMonth();
}

/**
 * Check if a summer reset is needed.
 * Resets on July 1 each year. If lastTopUp is before July 1 of the current
 * year and now is July or later, a reset is due.
 */
function needsSummerReset(lastTopUp, now) {
  const julyFirst = new Date(Date.UTC(now.getUTCFullYear(), 6, 1)); // Month 6 = July
  return lastTopUp < julyFirst && now >= julyFirst;
}

// ── Core ──

/**
 * Recalculate a user's quota balance with monthly top-up and summer reset.
 *
 * - Each new month: adds monthly allowance to balance (capped at max)
 * - July 1: resets balance to monthly allowance (summer break reset)
 */
export function recalculateQuota(userData) {
  const now = new Date();
  const monthlyAllowance = userData.quotaMonthlyAllowance || DEFAULT_MONTHLY_ALLOWANCE;
  const maxBalance = userData.quotaMaxBalance || DEFAULT_MAX_BALANCE;

  const lastTopUp = userData.quotaLastTopUp ? new Date(userData.quotaLastTopUp) : null;

  if (!lastTopUp || isNewMonth(lastTopUp, now)) {
    const currentBalance = userData.quotaBalance || 0;
    const newTopUp = firstOfMonth(now).toISOString();

    let newBalance;
    if (lastTopUp && needsSummerReset(lastTopUp, now)) {
      // Summer reset — start fresh with monthly allowance
      newBalance = monthlyAllowance;
    } else {
      // Regular month — add allowance to existing balance
      newBalance = Math.min(currentBalance + monthlyAllowance, maxBalance);
    }

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

  return null;
}

/**
 * Get the initial quota fields for a brand-new user.
 */
export function getInitialQuotaFields(monthlyAllowance = DEFAULT_MONTHLY_ALLOWANCE) {
  return {
    quotaBalance: monthlyAllowance,
    quotaLastTopUp: firstOfMonth(new Date()).toISOString(),
    quotaMonthlyAllowance: monthlyAllowance,
    quotaMaxBalance: DEFAULT_MAX_BALANCE,
  };
}
