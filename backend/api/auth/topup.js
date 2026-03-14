/**
 * POST /api/auth/topup
 *
 * Creates a one-time Vipps ePayment for 49 kr to top up 50,000 characters.
 * Only available for active subscribers with less than 10,000 chars remaining.
 *
 * Headers: Authorization: Bearer <jwt>
 * Returns: { vippsConfirmationUrl: string }
 */

import { setCorsHeaders, rateLimit, getClientIp } from '../_utils.js';
import { verifySessionToken } from '../_jwt.js';
import { getFirestoreDb } from '../_firebase.js';
import { getVippsAccessToken, getVippsApiHeaders, getVippsConfig } from '../_vipps.js';
import crypto from 'crypto';

const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';
const TOPUP_AMOUNT = 4900; // 49.00 NOK in øre
const TOPUP_CHARS = 50_000;
const TOPUP_THRESHOLD = 10_000; // Only allow top-up when below this

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = rateLimit('topup', ip, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'For mange forespørsler.' });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Authenticate
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const payload = verifySessionToken(token, secret);
    if (!payload.sub) return res.status(401).json({ error: 'Invalid token' });

    // Check user status
    const db = await getFirestoreDb();
    const userDoc = await db.collection('users').doc(payload.sub).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();

    if (userData.subscriptionStatus !== 'active') {
      return res.status(400).json({ error: 'Aktivt abonnement kreves for å kjøpe ekstra tegn' });
    }

    if ((userData.quotaBalance || 0) >= TOPUP_THRESHOLD) {
      return res.status(400).json({
        error: `Du kan kjøpe ekstra tegn når du har under ${TOPUP_THRESHOLD.toLocaleString('nb-NO')} tegn igjen`
      });
    }

    // Create Vipps ePayment (one-time)
    const { apiBase } = getVippsConfig();
    const accessToken = await getVippsAccessToken();
    const headers = getVippsApiHeaders(accessToken);

    const reference = `topup-${payload.sub}-${Date.now()}`;
    const idempotencyKey = crypto.randomUUID();

    const paymentBody = {
      amount: {
        currency: 'NOK',
        value: TOPUP_AMOUNT,
      },
      paymentMethod: {
        type: 'WALLET',
      },
      reference,
      returnUrl: `${SITE_URL}/api/auth/topup-callback?reference=${encodeURIComponent(reference)}&userId=${encodeURIComponent(payload.sub)}`,
      userFlow: 'WEB_REDIRECT',
      paymentDescription: 'Leksihjelp — 50 000 ekstra tegn',
    };

    const vippsRes = await fetch(
      `${apiBase}/epayment/v1/payments`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(paymentBody),
      }
    );

    if (!vippsRes.ok) {
      const errText = await vippsRes.text();
      console.error('Vipps create payment failed:', vippsRes.status, errText);
      return res.status(502).json({ error: 'Kunne ikke opprette betaling hos Vipps' });
    }

    const vippsData = await vippsRes.json();

    // Store pending top-up in Firestore
    await db.collection('topups').doc(reference).set({
      reference,
      userId: payload.sub,
      amount: TOPUP_AMOUNT,
      chars: TOPUP_CHARS,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      vippsConfirmationUrl: vippsData.redirectUrl,
    });
  } catch (err) {
    if (err.message?.includes('expired') || err.message?.includes('invalid')) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
    console.error('topup error:', err.message);
    return res.status(500).json({ error: 'Kjøp feilet. Prøv igjen.' });
  }
}
