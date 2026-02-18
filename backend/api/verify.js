/**
 * Leksihjelp — Access Code Verification (Vercel Serverless Function)
 *
 * Environment variables required:
 *   ACCESS_CODE — The access code users must provide
 */

import { setCorsHeaders, rateLimit, getClientIp } from './_utils.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 10 attempts per minute per IP
  const ip = getClientIp(req);
  const rl = rateLimit('verify', ip, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'For mange forsøk. Prøv igjen om litt.' });
  }

  const validCode = process.env.ACCESS_CODE;
  if (!validCode) {
    console.error('ACCESS_CODE environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { code } = req.body || {};

  return res.status(200).json({
    valid: typeof code === 'string' && code === validCode
  });
}
