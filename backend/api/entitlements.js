/**
 * GET /api/entitlements
 *
 * Returns the current user's feature entitlements. Drives extension UI
 * gating — e.g. whether to show the "Lær mer" button, whether to attempt
 * ElevenLabs TTS, etc.
 *
 * Auth modes:
 *   - With `Authorization: Bearer <jwt>` — returns entitlements computed from
 *     the user's subscription / institutional state.
 *   - Without auth — returns anonymous entitlements (free-tier only).
 *
 * Why a dedicated endpoint (vs. only on /api/auth/session):
 *   - The extension can poll this on a cheap path without re-fetching the
 *     full user profile.
 *   - Future: this is where FEIDE institutional entitlement lookup will plug
 *     in (the institution's IdP token attests; the backend issues the
 *     entitlement set).
 *
 * Returns: { entitlements: {...}, authenticated: boolean }
 */

import { setCorsHeaders, rateLimit, getClientIp } from './_utils.js';
import { verifySessionToken } from './_jwt.js';
import { getFirestoreDb } from './_firebase.js';
import { computeEntitlements, anonymousEntitlements } from './_entitlements.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = rateLimit('entitlements', ip, { maxRequests: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'For mange forespørsler. Prøv igjen senere.' });
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Anonymous path — no token, just return free-tier entitlements.
  if (!token) {
    return res.status(200).json({
      authenticated: false,
      entitlements: anonymousEntitlements(),
    });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('SESSION_JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = verifySessionToken(token, secret);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const db = await getFirestoreDb();
    const userDoc = await db.collection('users').doc(payload.sub).get();

    // Token valid but user record missing — degrade gracefully to anonymous.
    if (!userDoc.exists) {
      return res.status(200).json({
        authenticated: false,
        entitlements: anonymousEntitlements(),
      });
    }

    return res.status(200).json({
      authenticated: true,
      entitlements: computeEntitlements(userDoc.data()),
    });
  } catch (err) {
    if (err.message?.includes('expired') || err.message?.includes('invalid')) {
      // Token expired/invalid — fall back to anonymous so the UI keeps working.
      return res.status(200).json({
        authenticated: false,
        entitlements: anonymousEntitlements(),
      });
    }
    console.error('entitlements error:', err.message);
    return res.status(500).json({ error: 'Entitlements lookup failed' });
  }
}
