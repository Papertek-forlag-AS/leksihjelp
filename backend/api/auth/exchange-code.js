/**
 * POST /api/auth/exchange-code
 *
 * Used by the Chrome extension via chrome.identity.launchWebAuthFlow().
 * Receives the Vipps authorization code, exchanges it for tokens,
 * fetches user info, creates/updates user in Firestore, and returns
 * a session JWT.
 *
 * Body: { code: string }
 * Returns: { token: string, user: { name, email, subscriptionStatus } }
 */

import { setCorsHeaders, rateLimit, getClientIp } from '../_utils.js';
import { exchangeCodeForTokens, getVippsUserInfo } from '../_vipps.js';
import { createSessionToken } from '../_jwt.js';
import { getFirestoreDb } from '../_firebase.js';
import { getInitialQuotaFields } from '../_quota.js';

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

  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(req);
  const rl = rateLimit('exchange-code', ip, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'For mange forespørsler. Prøv igjen senere.' });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('SESSION_JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // The redirect_uri must match what was used in the authorization request.
    // For the extension flow, we use a special redirect URI that the extension intercepts.
    const redirectUri = `${SITE_URL}/api/auth/vipps-callback`;

    // 1. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // 2. Fetch user info from Vipps
    const userInfo = await getVippsUserInfo(tokens.access_token);

    // 3. Create or update user in Firestore
    const db = await getFirestoreDb();
    const userRef = db.collection('users').doc(userInfo.sub);
    const userDoc = await userRef.get();

    const now = new Date().toISOString();

    if (!userDoc.exists) {
      // New user
      await userRef.set({
        name: userInfo.name || '',
        email: userInfo.email || '',
        phone: userInfo.phone_number || '',
        createdAt: now,
        lastLoginAt: now,
        subscriptionStatus: 'none',
        agreementId: null,
        ...getInitialQuotaFields(),
      });
    } else {
      // Existing user — update login time and profile
      await userRef.update({
        name: userInfo.name || userDoc.data().name,
        email: userInfo.email || userDoc.data().email,
        phone: userInfo.phone_number || userDoc.data().phone,
        lastLoginAt: now,
      });
    }

    // 4. Read the (possibly just-created) user doc
    const userData = (await userRef.get()).data();

    // 5. Mint session JWT (30 days)
    const token = createSessionToken(
      { sub: userInfo.sub, email: userData.email, name: userData.name },
      secret,
      30 * 24 * 60 * 60 // 30 days
    );

    return res.status(200).json({
      token,
      user: {
        name: userData.name,
        email: userData.email,
        subscriptionStatus: userData.subscriptionStatus || 'none',
        quotaBalance: userData.quotaBalance ?? 10_000,
        quotaMaxBalance: userData.quotaMaxBalance || 20_000,
      },
    });
  } catch (err) {
    console.error('exchange-code error:', err.message);
    return res.status(500).json({ error: 'Innlogging feilet. Prøv igjen.' });
  }
}
