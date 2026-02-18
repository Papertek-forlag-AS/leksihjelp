/**
 * Leksihjelp — Vipps MobilePay API helpers
 *
 * Handles OAuth2/OIDC login flow and Recurring Payments API.
 * Uses standard fetch() — no Vipps SDK needed.
 *
 * Environment variables required:
 *   VIPPS_CLIENT_ID              — OAuth2 client ID
 *   VIPPS_CLIENT_SECRET          — OAuth2 client secret
 *   VIPPS_SUBSCRIPTION_KEY       — Ocp-Apim-Subscription-Key
 *   VIPPS_MERCHANT_SERIAL_NUMBER — Merchant serial number
 *   VIPPS_API_BASE               — API base URL (https://apitest.vipps.no or https://api.vipps.no)
 */

import crypto from 'crypto';
import { createSessionToken, verifySessionToken } from './_jwt.js';

// ── Configuration ──

export function getVippsConfig() {
  const config = {
    clientId: process.env.VIPPS_CLIENT_ID,
    clientSecret: process.env.VIPPS_CLIENT_SECRET,
    subscriptionKey: process.env.VIPPS_SUBSCRIPTION_KEY,
    merchantSerialNumber: process.env.VIPPS_MERCHANT_SERIAL_NUMBER,
    apiBase: process.env.VIPPS_API_BASE || 'https://apitest.vipps.no',
  };

  const missing = Object.entries(config)
    .filter(([key, val]) => !val && key !== 'apiBase')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Vipps config missing: ${missing.join(', ')}`);
  }

  return config;
}

// ── OpenID Connect / OAuth2 ──

/**
 * Build the Vipps authorization URL for the OIDC login flow.
 *
 * @param {string} state — Opaque state string (should be a signed JWT for stateless validation)
 * @param {string} nonce — Unique nonce for the OIDC flow
 * @param {string} redirectUri — Where Vipps should redirect after login
 * @returns {string} Full authorization URL
 */
export function buildAuthorizationUrl(state, nonce, redirectUri) {
  const { clientId, apiBase } = getVippsConfig();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid name email phoneNumber',
    state,
    nonce,
  });

  return `${apiBase}/access-management-1.0/access/oauth2/auth?${params}`;
}

/**
 * Exchange an authorization code for tokens.
 *
 * @param {string} code — Authorization code from Vipps callback
 * @param {string} redirectUri — Must match the redirect_uri used in the authorization request
 * @returns {Promise<{ access_token: string, id_token: string, token_type: string, expires_in: number }>}
 */
export async function exchangeCodeForTokens(code, redirectUri) {
  const { clientId, clientSecret, apiBase } = getVippsConfig();

  const tokenUrl = `${apiBase}/access-management-1.0/access/oauth2/token`;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // client_secret_basic: Base64(client_id:client_secret)
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Vipps token exchange failed:', res.status, errText);
    throw new Error(`Vipps token exchange failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch user info from Vipps using an access token.
 *
 * @param {string} accessToken — Access token from the token exchange
 * @returns {Promise<{ sub: string, name: string, email: string, phone_number: string, ... }>}
 */
export async function getVippsUserInfo(accessToken) {
  const { apiBase } = getVippsConfig();

  const res = await fetch(`${apiBase}/vipps-userinfo-api/userinfo`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Vipps userinfo failed:', res.status, errText);
    throw new Error(`Vipps userinfo failed: ${res.status}`);
  }

  return res.json();
}

// ── Vipps API Access Token (for Recurring/ePayment) ──

/**
 * Get a Vipps API access token for server-to-server calls.
 * This is different from the OIDC access token — it's for calling
 * Vipps APIs like Recurring Payments.
 *
 * @returns {Promise<string>} Access token
 */
export async function getVippsAccessToken() {
  const { clientId, clientSecret, subscriptionKey, apiBase, merchantSerialNumber } = getVippsConfig();

  const res = await fetch(`${apiBase}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client_id': clientId,
      'client_secret': clientSecret,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Merchant-Serial-Number': merchantSerialNumber,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Vipps access token failed:', res.status, errText);
    throw new Error(`Vipps access token failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Get standard Vipps API headers for Recurring/ePayment calls.
 *
 * @param {string} accessToken — API access token from getVippsAccessToken()
 * @returns {Object} Headers object
 */
export function getVippsApiHeaders(accessToken) {
  const { subscriptionKey, merchantSerialNumber } = getVippsConfig();

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Merchant-Serial-Number': merchantSerialNumber,
  };
}

// ── State Token (signed JWT for stateless CSRF protection) ──

/**
 * Create a signed state token for OAuth2 CSRF protection.
 * Uses the session JWT utility to create a short-lived signed token.
 *
 * @param {string} source — 'web' or 'extension'
 * @param {string} secret — SESSION_JWT_SECRET
 * @param {Object} [extra] — Additional fields to include (e.g. extensionRedirectUri)
 * @returns {string} Signed state token (JWT, 10 min expiry)
 */
export function createStateToken(source, secret, extra = {}) {
  return createSessionToken(
    { type: 'oauth_state', source, nonce: crypto.randomUUID(), ...extra },
    secret,
    600 // 10 minutes
  );
}

/**
 * Verify a state token.
 *
 * @param {string} state — State token to verify
 * @param {string} secret — SESSION_JWT_SECRET
 * @returns {Object} Decoded state payload
 * @throws {Error} If invalid or expired
 */
export function verifyStateToken(state, secret) {
  const payload = verifySessionToken(state, secret);
  if (payload.type !== 'oauth_state') {
    throw new Error('Invalid state token type');
  }
  return payload;
}
