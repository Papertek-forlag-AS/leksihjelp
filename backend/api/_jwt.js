/**
 * Leksihjelp — Session JWT utility (zero external dependencies)
 *
 * Uses Node.js built-in crypto for HMAC-SHA256 signing.
 * These are session tokens for the extension, NOT Firebase tokens.
 *
 * Environment variables required:
 *   SESSION_JWT_SECRET — Random 64-char hex string (openssl rand -hex 32)
 */

import crypto from 'crypto';

function base64urlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function sign(input, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(input)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create a signed session JWT.
 *
 * @param {Object} payload — Claims to include (sub, email, name, etc.)
 * @param {string} secret — HMAC-SHA256 signing secret
 * @param {number} [expiresInSeconds=2592000] — Token lifetime (default: 30 days)
 * @returns {string} Signed JWT string
 */
export function createSessionToken(payload, secret, expiresInSeconds = 30 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerEncoded = base64urlEncode(header);
  const payloadEncoded = base64urlEncode(fullPayload);
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verify and decode a session JWT.
 *
 * @param {string} token — JWT string to verify
 * @param {string} secret — HMAC-SHA256 signing secret
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid, expired, or tampered with
 */
export function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

  // Verify signature (constant-time comparison to prevent timing attacks)
  const expectedSignature = sign(`${headerEncoded}.${payloadEncoded}`, secret);
  try {
    const sigBuf = Buffer.from(signatureEncoded);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new Error('Invalid token signature');
    }
  } catch (e) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const payload = JSON.parse(base64urlDecode(payloadEncoded));

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('Token expired');
  }

  return payload;
}
