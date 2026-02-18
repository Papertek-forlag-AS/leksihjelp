/**
 * GET /api/cron/check-stripe-expiry
 *
 * Daily cron job (runs at 07:00 UTC) that deactivates expired Stripe yearly subscriptions.
 * Checks all users with subscriptionType === 'stripe_yearly' and stripeExpiresAt in the past.
 *
 * Protected by CRON_SECRET (same as create-charges).
 */

import { getFirestoreDb } from '../_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers?.authorization || '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const db = await getFirestoreDb();
    const now = new Date().toISOString();

    // Find all active Stripe yearly users whose subscription has expired
    const snapshot = await db.collection('users')
      .where('subscriptionType', '==', 'stripe_yearly')
      .where('subscriptionStatus', '==', 'active')
      .get();

    let deactivated = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.stripeExpiresAt && data.stripeExpiresAt < now) {
        batch.update(doc.ref, {
          subscriptionStatus: 'expired',
        });
        deactivated++;
        console.log(`Deactivating expired Stripe subscription for user ${doc.id}`);
      }
    }

    if (deactivated > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      checked: snapshot.size,
      deactivated,
    });
  } catch (err) {
    console.error('check-stripe-expiry error:', err.message);
    return res.status(500).json({ error: 'Cron job failed' });
  }
}
