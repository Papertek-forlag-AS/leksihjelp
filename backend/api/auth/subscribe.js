/**
 * POST /api/auth/subscribe
 *
 * Creates a Vipps Recurring agreement for the authenticated user.
 * Returns the Vipps confirmation URL where the user approves the subscription.
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

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rl = rateLimit('subscribe', ip, { maxRequests: 5, windowMs: 60_000 });
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

    // Check if user already has an active agreement
    const db = await getFirestoreDb();
    const userDoc = await db.collection('users').doc(payload.sub).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();
    if (userData.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'Du har allerede et aktivt abonnement' });
    }

    // Create Vipps Recurring agreement
    const { apiBase, merchantSerialNumber } = getVippsConfig();
    const accessToken = await getVippsAccessToken();
    const headers = getVippsApiHeaders(accessToken);

    const agreementId = `lexi-${payload.sub}-${Date.now()}`;
    const idempotencyKey = crypto.randomUUID();

    const agreementBody = {
      pricing: {
        type: 'LEGACY', // Fixed-price subscription (correct for Recurring v3, default type)
        amount: 2900, // 29.00 NOK in øre
        currency: 'NOK',
      },
      interval: {
        unit: 'MONTH',
        count: 1,
      },
      merchantRedirectUrl: `${SITE_URL}/api/auth/subscribe-callback?agreementId=${encodeURIComponent(agreementId)}`,
      merchantAgreementUrl: `${SITE_URL}/vilkar`,
      phoneNumber: userData.phone || undefined,
      productName: 'Leksihjelp — ElevenLabs uttale',
      productDescription: 'Månedlig abonnement for naturlig uttale (10 000 tegn/mnd)',
    };

    const vippsRes = await fetch(
      `${apiBase}/recurring/v3/agreements`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(agreementBody),
      }
    );

    if (!vippsRes.ok) {
      const errText = await vippsRes.text();
      console.error('Vipps create agreement failed:', vippsRes.status, errText);
      return res.status(502).json({ error: 'Kunne ikke opprette abonnement hos Vipps' });
    }

    const vippsData = await vippsRes.json();

    // Store agreement in Firestore
    await db.collection('agreements').doc(vippsData.agreementId || agreementId).set({
      agreementId: vippsData.agreementId || agreementId,
      userId: payload.sub,
      status: 'PENDING',
      amount: 2900,
      createdAt: new Date().toISOString(),
      startDate: null,
      nextChargeDate: null,
    });

    // Update user with pending subscription
    await db.collection('users').doc(payload.sub).update({
      subscriptionStatus: 'pending',
      agreementId: vippsData.agreementId || agreementId,
    });

    return res.status(200).json({
      vippsConfirmationUrl: vippsData.vippsConfirmationUrl,
    });
  } catch (err) {
    if (err.message?.includes('expired') || err.message?.includes('invalid')) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
    console.error('subscribe error:', err.message);
    return res.status(500).json({ error: 'Abonnement feilet. Prøv igjen.' });
  }
}
