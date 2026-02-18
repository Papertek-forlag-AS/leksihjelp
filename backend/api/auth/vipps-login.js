/**
 * GET /api/auth/vipps-login
 *
 * Initiates the Vipps OIDC login flow.
 * Builds the authorization URL and redirects the user to Vipps.
 *
 * Query params:
 *   source       — 'web' (default) or 'extension'
 *   redirect_uri — Extension's chrome.identity redirect URL (extension flow only)
 */

import { buildAuthorizationUrl, createStateToken } from '../_vipps.js';
import crypto from 'crypto';

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://leksihjelp.vercel.app';

// Production domain override
const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const secret = process.env.SESSION_JWT_SECRET;
    if (!secret) {
      console.error('SESSION_JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const source = req.query?.source || 'web';
    const extensionRedirectUri = req.query?.redirect_uri || '';
    const state = createStateToken(source, secret,
      extensionRedirectUri ? { extensionRedirectUri } : {}
    );
    const nonce = crypto.randomUUID();

    // Callback URL — Vercel handles routing to /api/auth/vipps-callback
    const redirectUri = `${SITE_URL}/api/auth/vipps-callback`;

    const authUrl = buildAuthorizationUrl(state, nonce, redirectUri);

    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (err) {
    console.error('vipps-login error:', err.message);
    return res.status(500).json({ error: 'Failed to initiate login' });
  }
}
