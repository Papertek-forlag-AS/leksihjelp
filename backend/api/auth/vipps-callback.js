/**
 * GET /api/auth/vipps-callback
 *
 * OAuth2 callback handler for Vipps OIDC login.
 * Vipps redirects here after the user approves login.
 *
 * Handles TWO flows:
 *   1. Web flow (source=web): Exchanges code, mints JWT, redirects to SITE_URL/?token=<jwt>
 *   2. Extension flow (source=extension): Redirects to the extension's
 *      chrome.identity redirect URL with the authorization code.
 *      The extension then calls /api/auth/exchange-code to get a session token.
 *
 * Query params (from Vipps):
 *   code  — Authorization code
 *   state — Signed state token (JWT) containing { source, extensionRedirectUri? }
 *   error — Error code if user cancelled or something went wrong
 */

import { verifyStateToken } from '../_vipps.js';
import { exchangeCodeForTokens, getVippsUserInfo } from '../_vipps.js';
import { createSessionToken } from '../_jwt.js';
import { getFirestoreDb } from '../_firebase.js';
import { getInitialQuotaFields } from '../_quota.js';

const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('SESSION_JWT_SECRET not set');
    return redirect(res, `${SITE_URL}/?login_error=server_error`);
  }

  const { code, state, error } = req.query || {};

  // User cancelled or Vipps returned an error
  if (error) {
    console.log('Vipps callback error:', error);
    // Try to determine source and redirect URI from state
    let source = 'web';
    let extensionRedirectUri = '';
    try {
      if (state) {
        const statePayload = verifyStateToken(state, secret);
        source = statePayload.source || 'web';
        extensionRedirectUri = statePayload.extensionRedirectUri || '';
      }
    } catch { /* ignore — state might be expired too */ }

    if (source === 'extension' && extensionRedirectUri) {
      const url = new URL(extensionRedirectUri);
      url.searchParams.set('login_error', error);
      return redirect(res, url.toString());
    }
    return redirect(res, `${SITE_URL}/?login_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return redirect(res, `${SITE_URL}/?login_error=missing_params`);
  }

  try {
    // 1. Verify state token (CSRF protection) and determine source
    const statePayload = verifyStateToken(state, secret);
    const source = statePayload.source || 'web';
    const extensionRedirectUri = statePayload.extensionRedirectUri || '';

    // ── Extension Flow ──
    // Redirect to the extension's chrome.identity redirect URL with the code.
    // chrome.identity.launchWebAuthFlow() will intercept this redirect and
    // resolve its promise with the URL (including the code parameter).
    // The extension then calls /api/auth/exchange-code to get a session token.
    if (source === 'extension' && extensionRedirectUri) {
      // Validate the redirect URI is a chromiumapp.org URL (security check)
      const redirectUrl = new URL(extensionRedirectUri);
      if (!redirectUrl.hostname.endsWith('.chromiumapp.org')) {
        console.error('Invalid extension redirect URI:', extensionRedirectUri);
        return res.status(400).json({ error: 'Invalid redirect URI' });
      }

      redirectUrl.searchParams.set('code', code);
      return redirect(res, redirectUrl.toString());
    }

    // ── Web Flow ──
    // Exchange code, create user, mint JWT, redirect to landing page.

    // 2. Exchange code for tokens
    const redirectUri = `${SITE_URL}/api/auth/vipps-callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // 3. Fetch user info
    const userInfo = await getVippsUserInfo(tokens.access_token);

    // 4. Create or update user in Firestore
    const db = await getFirestoreDb();
    const userRef = db.collection('users').doc(userInfo.sub);
    const userDoc = await userRef.get();

    const now = new Date().toISOString();

    if (!userDoc.exists) {
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
      await userRef.update({
        name: userInfo.name || userDoc.data().name,
        email: userInfo.email || userDoc.data().email,
        phone: userInfo.phone_number || userDoc.data().phone,
        lastLoginAt: now,
      });
    }

    const userData = (await userRef.get()).data();

    // 5. Mint session JWT (30 days)
    const token = createSessionToken(
      { sub: userInfo.sub, email: userData.email, name: userData.name },
      secret,
      30 * 24 * 60 * 60
    );

    // 6. Redirect to landing page with token
    return redirect(res, `${SITE_URL}/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('vipps-callback error:', err.message);
    return redirect(res, `${SITE_URL}/?login_error=auth_failed`);
  }
}

function redirect(res, url) {
  res.writeHead(302, { Location: url });
  res.end();
}
