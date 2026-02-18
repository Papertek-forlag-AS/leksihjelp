/**
 * GET /api/cron/create-charges
 *
 * Vercel Cron job — runs daily at 06:00 UTC.
 * Queries Firestore for active agreements where next charge is due,
 * then creates charges via the Vipps Recurring API.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { getFirestoreDb } from '../_firebase.js';
import { getVippsAccessToken, getVippsApiHeaders, getVippsConfig } from '../_vipps.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sends this header for cron jobs)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers?.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await getFirestoreDb();
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find active agreements where next charge date is today or earlier
    const agreementsSnap = await db.collection('agreements')
      .where('status', '==', 'ACTIVE')
      .get();

    if (agreementsSnap.empty) {
      return res.status(200).json({ message: 'No active agreements', chargesCreated: 0 });
    }

    const { apiBase } = getVippsConfig();
    const accessToken = await getVippsAccessToken();
    const headers = getVippsApiHeaders(accessToken);

    let chargesCreated = 0;
    let errors = 0;

    for (const doc of agreementsSnap.docs) {
      const agreement = doc.data();

      // Skip if next charge date is in the future
      if (agreement.nextChargeDate) {
        const nextCharge = new Date(agreement.nextChargeDate);
        if (nextCharge > now) continue;
      } else if (agreement.startDate) {
        // If no next charge date but has start date, check if it's been at least a month
        const start = new Date(agreement.startDate);
        const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        if (monthsSinceStart < 1) continue;
      } else {
        continue; // No start date yet, skip
      }

      try {
        const chargeId = `chg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const idempotencyKey = crypto.randomUUID();

        const chargeBody = {
          amount: agreement.amount || 2900,
          transactionType: 'DIRECT_CAPTURE', // Capture immediately (no reserve/capture flow)
          description: 'Leksihjelp — Månedlig abonnement',
          due: today,
          retryDays: 5,
          orderId: chargeId,
        };

        const chargeRes = await fetch(
          `${apiBase}/recurring/v3/agreements/${agreement.agreementId}/charges`,
          {
            method: 'POST',
            headers: {
              ...headers,
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(chargeBody),
          }
        );

        if (chargeRes.ok) {
          const chargeData = await chargeRes.json();

          // Store charge in Firestore
          await db.collection('charges').doc(chargeData.chargeId || chargeId).set({
            chargeId: chargeData.chargeId || chargeId,
            agreementId: agreement.agreementId,
            userId: agreement.userId,
            amount: agreement.amount || 2900,
            status: 'PENDING',
            dueDate: today,
            createdAt: now.toISOString(),
          });

          // Update next charge date
          const nextMonth = new Date(now);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          await doc.ref.update({
            nextChargeDate: nextMonth.toISOString(),
          });

          chargesCreated++;
        } else {
          const errText = await chargeRes.text();
          console.error(`Failed to create charge for ${agreement.agreementId}:`, chargeRes.status, errText);
          errors++;
        }
      } catch (err) {
        console.error(`Error creating charge for ${agreement.agreementId}:`, err.message);
        errors++;
      }
    }

    return res.status(200).json({
      message: 'Charges processed',
      chargesCreated,
      errors,
    });
  } catch (err) {
    console.error('Cron create-charges error:', err.message);
    return res.status(500).json({ error: 'Cron job failed' });
  }
}
