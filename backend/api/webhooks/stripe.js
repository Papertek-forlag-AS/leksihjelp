/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. Currently handles:
 *   - checkout.session.completed — Activates yearly subscription
 *
 * The webhook secret must be set as STRIPE_WEBHOOK_SECRET env var.
 * Register this endpoint in Stripe Dashboard → Webhooks.
 *
 * IMPORTANT: This endpoint needs the raw body for signature verification.
 * Vercel passes the raw body automatically when we read from req.body as a Buffer.
 */

import { getFirestoreDb } from '../_firebase.js';
import { getInitialQuotaFields } from '../_quota.js';
import { YEARLY_DURATION_DAYS } from '../_stripe.js';

export const config = {
  api: {
    bodyParser: false, // Need raw body for Stripe signature verification
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.VERCEL_ENV === 'production') {
      console.error('STRIPE_WEBHOOK_SECRET not set in production — rejecting webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)');
  }

  let event;
  try {
    // Dynamically import Stripe to construct the event
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // No secret — parse but don't verify (dev only)
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ── Handle events ──
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err.message);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle a successful Stripe Checkout payment.
 * Sets the user's subscription to 'active' with a stripeExpiresAt date.
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId || plan !== 'yearly') {
    console.log('Ignoring checkout session — missing userId or not yearly plan');
    return;
  }

  if (session.payment_status !== 'paid') {
    console.log(`Checkout session ${session.id} not paid yet, status: ${session.payment_status}`);
    return;
  }

  const db = await getFirestoreDb();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.error(`User ${userId} not found in Firestore for Stripe checkout ${session.id}`);
    return;
  }

  // Calculate expiry: 365 days from now
  const now = new Date();
  const expiresAt = new Date(now.getTime() + YEARLY_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Activate subscription
  await userRef.update({
    subscriptionStatus: 'active',
    subscriptionType: 'stripe_yearly',
    stripeSessionId: session.id,
    stripeExpiresAt: expiresAt.toISOString(),
    stripePaidAt: now.toISOString(),
    // Initialize quota if not set
    ...(!userDoc.data().quotaBalance && !userDoc.data().quotaLastTopUp
      ? getInitialQuotaFields()
      : {}),
  });

  console.log(`Activated yearly subscription for user ${userId}, expires ${expiresAt.toISOString()}`);
}
