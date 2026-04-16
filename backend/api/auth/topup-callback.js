/**
 * GET /api/auth/topup-callback
 *
 * Redirect target after Vipps ePayment for top-up.
 * Checks payment status and credits the user's quota.
 *
 * Query params:
 *   reference — Payment reference
 *   userId    — User ID to credit
 */

import { getFirestoreDb } from '../_firebase.js';
import { getVippsAccessToken, getVippsApiHeaders, getVippsConfig } from '../_vipps.js';

const SITE_URL = process.env.SITE_URL || 'https://leksihjelp.no';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference } = req.query || {};

  if (!reference) {
    return redirect(res, `${SITE_URL}/?topup_error=missing_params`);
  }

  try {
    const db = await getFirestoreDb();

    // Check if already processed (idempotency)
    const topupDoc = await db.collection('topups').doc(reference).get();
    if (!topupDoc.exists) {
      return redirect(res, `${SITE_URL}/?topup_error=not_found`);
    }

    const topupData = topupDoc.data();

    // The stored topup record is the source of truth for which user to credit.
    // Never trust the userId from the query string for authorization.
    const userId = topupData.userId;
    if (!userId) {
      console.error(`topup-callback stored record missing userId: ${reference}`);
      return redirect(res, `${SITE_URL}/?topup_error=invalid_user`);
    }

    if (topupData.status === 'COMPLETED') {
      // Already credited — just redirect
      return redirect(res, `${SITE_URL}/?topup=success`);
    }

    // Check payment status with Vipps
    const { apiBase } = getVippsConfig();
    const accessToken = await getVippsAccessToken();
    const headers = getVippsApiHeaders(accessToken);

    const vippsRes = await fetch(
      `${apiBase}/epayment/v1/payments/${reference}`,
      { headers }
    );

    if (!vippsRes.ok) {
      console.error('Vipps payment status check failed:', vippsRes.status);
      return redirect(res, `${SITE_URL}/?topup_error=check_failed`);
    }

    const paymentData = await vippsRes.json();
    const state = paymentData.state;

    if (state === 'AUTHORIZED' || state === 'CHARGED') {
      // Payment successful — credit the user
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const currentBalance = userDoc.data().quotaBalance || 0;
        await userRef.update({
          quotaBalance: currentBalance + topupData.chars,
        });
      }

      // If only authorized, capture the payment
      if (state === 'AUTHORIZED') {
        const captureRes = await fetch(
          `${apiBase}/epayment/v1/payments/${reference}/capture`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              modificationAmount: {
                currency: 'NOK',
                value: topupData.amount,
              },
            }),
          }
        );
        if (!captureRes.ok) {
          console.error(`Topup capture failed for ${reference}:`, captureRes.status);
        }
      }

      // Mark top-up as completed
      await db.collection('topups').doc(reference).update({
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });

      return redirect(res, `${SITE_URL}/?topup=success`);
    } else {
      // Payment not completed
      await db.collection('topups').doc(reference).update({
        status: state || 'FAILED',
      });
      return redirect(res, `${SITE_URL}/?topup_error=payment_${state?.toLowerCase() || 'failed'}`);
    }
  } catch (err) {
    console.error('topup-callback error:', err.message);
    return redirect(res, `${SITE_URL}/?topup_error=server_error`);
  }
}

function redirect(res, url) {
  res.writeHead(302, { Location: url });
  res.end();
}
