/**
 * GET /api/auth/subscribe-callback
 *
 * Vipps redirects here after the user approves/rejects the recurring agreement.
 * Redirects to the landing page with status.
 *
 * Query params:
 *   agreementId — The agreement ID
 */

const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agreementId } = req.query || {};

  // Redirect to landing page — the actual agreement status will be
  // updated asynchronously via the Vipps webhook
  const status = agreementId ? 'pending' : 'unknown';
  res.writeHead(302, {
    Location: `${SITE_URL}/?subscription=${status}`,
  });
  res.end();
}
