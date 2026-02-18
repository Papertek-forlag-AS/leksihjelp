/**
 * Shared utilities for Leksihjelp API handlers.
 * Provides CORS validation, rate limiting, and origin checking.
 */

// ── CORS ──
// Chrome extensions send Origin: chrome-extension://<id>
// We allow extension origins + localhost for dev.
const ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,         // Firefox (future-proofing)
  /^http:\/\/localhost(:\d+)?$/,  // Local development
  /^https:\/\/leksihjelp\.vercel\.app$/,  // Vercel deployment
  /^https:\/\/leksihjelp\.no$/            // Production domain
];

export function getAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.Origin || '';
  for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
    if (pattern.test(origin)) return origin;
  }
  return null;
}

export function setCorsHeaders(res, req) {
  const origin = getAllowedOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // If origin is not allowed, we simply don't set Allow-Origin.
  // The browser will block the response from being read by the caller.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lexi-Client, Authorization');
}

// ── Rate Limiting ──
// In-memory, per Vercel warm container. Not perfect, but stops
// automated scripts from hammering a single instance.
const rateMaps = new Map(); // key = bucket name

export function rateLimit(bucketName, ip, { maxRequests, windowMs }) {
  if (!rateMaps.has(bucketName)) {
    rateMaps.set(bucketName, new Map());
  }
  const bucket = rateMaps.get(bucketName);

  const now = Date.now();
  const record = bucket.get(ip);

  if (!record || now - record.windowStart > windowMs) {
    // New window
    bucket.set(ip, { windowStart: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  record.count++;
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - record.windowStart) };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}

// Periodically clean stale entries to prevent memory leaks.
// Runs every 5 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [, bucket] of rateMaps) {
    for (const [ip, record] of bucket) {
      if (now - record.windowStart > 600_000) { // 10 min stale
        bucket.delete(ip);
      }
    }
  }
}, 300_000);

// ── IP extraction ──
export function getClientIp(req) {
  // Vercel sets x-forwarded-for; take the first entry (client IP)
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
