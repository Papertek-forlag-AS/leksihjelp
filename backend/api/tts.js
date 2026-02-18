/**
 * Leksihjelp — TTS Proxy (Vercel Serverless Function)
 *
 * Proxies text-to-speech requests to ElevenLabs API.
 * Supports dual authentication:
 *   1. Bearer token (Vipps login + subscription) — tracks character quota
 *   2. Legacy access code — for backward compatibility during transition
 *
 * Environment variables required:
 *   ELEVENLABS_API_KEY  — Your ElevenLabs API key
 *   ACCESS_CODE         — Legacy access code
 *   SESSION_JWT_SECRET  — For verifying Bearer tokens
 */

import { setCorsHeaders, rateLimit, getClientIp } from './_utils.js';
import { verifySessionToken } from './_jwt.js';
import { getFirestoreDb } from './_firebase.js';
import { recalculateQuota } from './_quota.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute per IP
  const ip = getClientIp(req);
  const rl = rateLimit('tts', ip, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'For mange forespørsler. Vent litt.' });
  }

  // Require custom header as lightweight client validation
  const clientHeader = req.headers?.['x-lexi-client'];
  if (clientHeader !== 'lexi-extension') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { text, voiceId, speed, code, language } = req.body || {};

  // ── Authentication: try Bearer token first, then legacy code ──
  let authMethod = null; // 'token' or 'code'
  let userSub = null;

  const authHeader = req.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    // Token-based auth (Vipps login)
    const secret = process.env.SESSION_JWT_SECRET;
    if (!secret) {
      console.error('SESSION_JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const payload = verifySessionToken(bearerToken, secret);
      if (!payload.sub) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      userSub = payload.sub;
      authMethod = 'token';
    } catch (err) {
      if (err.message?.includes('expired')) {
        return res.status(401).json({ error: 'Token expired', tokenExpired: true });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } else if (code) {
    // Legacy access code auth
    const validCode = process.env.ACCESS_CODE;
    if (!validCode) {
      console.error('ACCESS_CODE environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    if (typeof code !== 'string' || code !== validCode) {
      return res.status(401).json({ error: 'Ugyldig tilgangskode' });
    }
    authMethod = 'code';
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // ── Validate input ──
  if (!text || typeof text !== 'string' || text.length > 2000) {
    return res.status(400).json({ error: 'Ugyldig tekst (maks 2000 tegn)' });
  }

  // ── Character quota check (token auth only) ──
  if (authMethod === 'token' && userSub) {
    const db = await getFirestoreDb();
    const userRef = db.collection('users').doc(userSub);

    // Pre-transaction checks (read-only, outside transaction for clarity)
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check subscription status (Vipps monthly OR Stripe yearly)
    if (userData.subscriptionStatus !== 'active') {
      return res.status(403).json({
        error: 'Abonnement kreves for ElevenLabs-stemmer',
        subscriptionRequired: true,
      });
    }

    // Check if Stripe yearly has expired (belt-and-suspenders with cron)
    if (userData.subscriptionType === 'stripe_yearly' && userData.stripeExpiresAt) {
      if (new Date(userData.stripeExpiresAt) < new Date()) {
        await userRef.update({ subscriptionStatus: 'expired' });
        return res.status(403).json({
          error: 'Årsabonnementet har utløpt. Forny for å fortsette.',
          subscriptionRequired: true,
        });
      }
    }

    // Atomic quota check + deduction via Firestore transaction
    try {
      const quotaResult = await db.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(userRef);
        const freshData = freshDoc.data();

        // Recalculate quota (handles rollover + lazy migration)
        const quotaUpdate = recalculateQuota(freshData);
        if (quotaUpdate?.needsUpdate) {
          transaction.update(userRef, quotaUpdate.updateFields);
          freshData.quotaBalance = quotaUpdate.quotaBalance;
        }

        const quotaBalance = freshData.quotaBalance ?? 0;
        const quotaMaxBalance = freshData.quotaMaxBalance || 20_000;

        // Check quota — is there enough balance for this request?
        if (quotaBalance < text.length) {
          return { exceeded: true, quotaBalance, quotaMaxBalance };
        }

        // Decrement quota balance atomically
        const newBalance = quotaBalance - text.length;
        transaction.update(userRef, { quotaBalance: newBalance });

        return { exceeded: false };
      });

      if (quotaResult.exceeded) {
        return res.status(403).json({
          error: 'Kvoten er brukt opp. Ubrukte tegn overføres neste måned.',
          quotaExceeded: true,
          quotaBalance: quotaResult.quotaBalance,
          quotaMaxBalance: quotaResult.quotaMaxBalance,
        });
      }
    } catch (err) {
      console.error('Firestore quota transaction error:', err.message);
      return res.status(503).json({ error: 'TTS-tjenesten er midlertidig utilgjengelig. Prøv igjen.' });
    }
  }

  // ── Call ElevenLabs ──
  const voice = voiceId || 'ThT5KcBeYPX3keUQqHPh'; // default voice
  const rate = Math.max(0.5, Math.min(1.5, parseFloat(speed) || 1.0));

  // Pass language code directly to ElevenLabs.
  // eleven_flash_v2_5 uses short codes (no, es, de, fr).
  // eleven_v3 uses ISO 639-3 (nor, spa, deu, fra) — see CLAUDE.md.
  const lang = language || null;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TTS-tjenesten er ikke konfigurert' });
  }

  try {
    const elevenLabsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_flash_v2_5',
          ...(lang && { language_code: lang }),
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: rate
          }
        })
      }
    );

    if (!elevenLabsRes.ok) {
      const errText = await elevenLabsRes.text();
      console.error('ElevenLabs error:', elevenLabsRes.status, errText);
      return res.status(502).json({
        error: 'Uttale-tjenesten er midlertidig utilgjengelig'
      });
    }

    // Stream audio back
    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = await elevenLabsRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('TTS proxy error:', err);
    return res.status(500).json({ error: 'Intern serverfeil' });
  }
}
