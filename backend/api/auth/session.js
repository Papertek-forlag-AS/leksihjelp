/**
 * POST /api/auth/session
 *
 * Validates a session JWT and returns the current user info.
 * Used by the extension on popup open and by the service worker on startup.
 *
 * Headers: Authorization: Bearer <jwt>
 * Returns: { user: { name, email, subscriptionStatus, quotaBalance, quotaMaxBalance } }
 */

import { setCorsHeaders, rateLimit, getClientIp } from '../_utils.js';
import { verifySessionToken } from '../_jwt.js';
import { getFirestoreDb } from '../_firebase.js';
import { recalculateQuota } from '../_quota.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute per IP (higher since extension checks on every open)
  const ip = getClientIp(req);
  const rl = rateLimit('session', ip, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'For mange forespørsler. Prøv igjen senere.' });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('SESSION_JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Extract Bearer token
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    // Verify JWT
    const payload = verifySessionToken(token, secret);

    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Fetch user from Firestore
    const db = await getFirestoreDb();
    const userDoc = await db.collection('users').doc(payload.sub).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Recalculate quota (handles rollover + lazy migration from old fields)
    const quotaUpdate = recalculateQuota(userData);
    if (quotaUpdate?.needsUpdate) {
      await db.collection('users').doc(payload.sub).update(quotaUpdate.updateFields);
    }

    const quotaBalance = quotaUpdate ? quotaUpdate.quotaBalance : (userData.quotaBalance ?? 0);
    const quotaMaxBalance = quotaUpdate ? quotaUpdate.quotaMaxBalance : (userData.quotaMaxBalance || 20_000);

    return res.status(200).json({
      user: {
        name: userData.name || '',
        email: userData.email || '',
        subscriptionStatus: userData.subscriptionStatus || 'none',
        subscriptionType: userData.subscriptionType || null,
        stripeExpiresAt: userData.stripeExpiresAt || null,
        quotaBalance,
        quotaMaxBalance,
      },
    });
  } catch (err) {
    if (err.message?.includes('expired') || err.message?.includes('invalid')) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
    console.error('session error:', err.message);
    return res.status(500).json({ error: 'Session validation failed' });
  }
}
