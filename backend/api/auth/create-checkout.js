/**
 * POST /api/auth/create-checkout
 *
 * Creates a Stripe Checkout Session for a yearly payment (290 NOK).
 * Requires an authenticated user (Bearer token from Vipps login).
 * After successful payment, Stripe sends a webhook to activate the subscription.
 *
 * Body: (none required)
 * Headers: Authorization: Bearer <jwt>
 * Returns: { checkoutUrl: string }
 */

import { setCorsHeaders, rateLimit, getClientIp } from '../_utils.js';
import { verifySessionToken } from '../_jwt.js';
import { getStripe, YEARLY_PRICE_NOK } from '../_stripe.js';

const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 requests per minute per IP
  const ip = getClientIp(req);
  const rl = rateLimit('create-checkout', ip, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'For mange forespørsler. Prøv igjen senere.' });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('SESSION_JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify Bearer token
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifySessionToken(token, secret);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const stripe = getStripe();

    // Create Checkout Session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nok',
            unit_amount: YEARLY_PRICE_NOK,
            product_data: {
              name: 'Leksihjelp Årsabonnement',
              description: '12 måneder premium-uttale med ElevenLabs (10 000 tegn/mnd)',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: payload.sub,
        plan: 'yearly',
      },
      success_url: `${SITE_URL}/?payment=success`,
      cancel_url: `${SITE_URL}/?payment=cancelled`,
    });

    return res.status(200).json({ checkoutUrl: session.url });
  } catch (err) {
    if (err.message?.includes('expired')) {
      return res.status(401).json({ error: 'Token expired', tokenExpired: true });
    }
    console.error('create-checkout error:', err.message);
    return res.status(500).json({ error: 'Kunne ikke opprette betaling. Prøv igjen.' });
  }
}
