/**
 * Leksihjelp — Stripe Helpers
 *
 * Handles Stripe Checkout for yearly payments (290 NOK/year).
 * One-time payment gives 12 months of access.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY       — Stripe API secret key
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret (from Stripe dashboard)
 */

import Stripe from 'stripe';

let _stripe = null;

/**
 * Get a lazily-initialized Stripe client.
 */
export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' });
  }
  return _stripe;
}

/**
 * Verify a Stripe webhook signature.
 * Returns the parsed event, or throws on failure.
 *
 * @param {string|Buffer} rawBody — Raw request body
 * @param {string} signature — stripe-signature header
 * @returns {Stripe.Event}
 */
export function verifyWebhookEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

// ── Yearly plan config ──

export const YEARLY_PRICE_NOK = 290_00; // 290 NOK in øre
export const YEARLY_PRICE_DISPLAY = '290';
export const YEARLY_DURATION_DAYS = 365;
export const YEARLY_MONTHLY_QUOTA = 10_000; // same quota as monthly subscribers
