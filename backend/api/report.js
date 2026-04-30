import { setCorsHeaders, rateLimit, getClientIp } from './_utils.js';
import { getFirestoreDb } from './_firebase.js';
import { verifySessionToken } from './_jwt.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = rateLimit('report', ip, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'For mange rapporter. Prøv igjen om litt.' });
  }

  const client = req.headers['x-lexi-client'];
  if (client !== 'lexi-extension') {
    return res.status(403).json({ error: 'Invalid client' });
  }

  const { type, category, ruleId, original, suggestion, context, text, language, description, url, lockdownContext } = req.body || {};

  if (!type || !['spell', 'vocab', 'ui', 'other'].includes(type)) {
    return res.status(400).json({ error: 'type required (spell|vocab|ui|other)' });
  }

  let lockdownCtx = null;
  if (lockdownContext && typeof lockdownContext === 'object') {
    const tc = typeof lockdownContext.testCode === 'string' ? lockdownContext.testCode.slice(0, 16) : null;
    const pid = typeof lockdownContext.pid === 'string' ? lockdownContext.pid.slice(0, 64) : null;
    if (tc || pid) lockdownCtx = { testCode: tc, pid };
  }

  let userEmail = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = verifySessionToken(auth.slice(7));
      userEmail = payload.email || null;
    } catch (_) { /* anonymous report is fine */ }
  }

  try {
    const db = await getFirestoreDb();
    await db.collection('bug_reports').add({
      type,
      category: category || null,
      ruleId: ruleId || null,
      original: (original || '').slice(0, 200),
      suggestion: (suggestion || '').slice(0, 200),
      context: (context || '').slice(0, 500),
      text: (text || '').slice(0, 1000),
      language: language || null,
      description: (description || '').slice(0, 1000),
      url: (url || '').slice(0, 500),
      userEmail,
      ip,
      lockdownContext: lockdownCtx,
      status: 'new',
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Report API error:', err);
    return res.status(500).json({ error: 'Kunne ikke lagre rapporten.' });
  }
}
